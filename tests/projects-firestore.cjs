const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const admin=require('../functions/node_modules/firebase-admin');
const {initializeApp,deleteApp}=require('firebase/app');
const {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,updateDoc,deleteDoc,terminate}=require('firebase/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Tests only run against the Firestore emulator.');
const projectId='demo-kimce-projects';admin.initializeApp({projectId});const server=admin.firestore();
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');const clients=[];
function client(uid){const app=initializeApp({projectId},uid||'anonymous'),db=getFirestore(app);connectFirestoreEmulator(db,host,Number(port),uid?{mockUserToken:{sub:uid,email:uid+'@example.test'}}:{});clients.push({app,db});return db}
async function denied(p,label){try{await p;assert.fail('Unexpected permission: '+label)}catch(e){assert.equal(e.code,'permission-denied',label+': '+e.message)}}
const base={id:'p',nombre:'Test',brandId:'b',fechaInicio:'2026-09-30',estado:'activo',avance:0,responsable:'',ownerIds:['manager'],tasksMigrated:true,taskRevision:0};
const task=(title='A')=>({title,status:'pendiente',proyectoId:'p',startDate:'2026-09-30',dueDate:'2026-10-02',assigneeIds:['worker'],progress:0});
async function main(){
 await Promise.all(['admin','manager','worker','other'].map(uid=>server.doc('users/'+uid).set({role:uid==='admin'?'admin':'collab',displayName:uid,approved:true,isActive:true})));
 await server.doc('cmhub_proyectos/p').set(base);await server.doc('hubActividades/a').set(task());await server.doc('hubActividades/b').set(task('B'));
 const a=client('admin'),m=client('manager'),w=client('worker'),o=client('other'),guest=client('');
 await denied(getDoc(doc(guest,'cmhub_proyectos','p')),'public project read');
 await updateDoc(doc(m,'cmhub_proyectos','p'),{descripcion:'Managed'});
 await denied(updateDoc(doc(w,'cmhub_proyectos','p'),{nombre:'Changed'}),'worker project metadata');
 await updateDoc(doc(w,'hubActividades','a'),{status:'en_curso',progress:25,completionSource:'project-workspace'});
 await denied(updateDoc(doc(o,'hubActividades','a'),{status:'completado'}),'unassigned task completion');
 await denied(updateDoc(doc(w,'hubActividades','a'),{dueDate:'2026-10-10'}),'worker rescheduling');
 await denied(updateDoc(doc(w,'hubActividades','a'),{assigneeIds:['other']}),'worker reassignment');
 await denied(deleteDoc(doc(m,'cmhub_proyectos','p')),'hard delete project');
 await denied(updateDoc(doc(w,'users','worker'),{role:'admin'}),'self privilege escalation');
 await setDoc(doc(m,'projectShares','test'),{projectId:'p',createdAt:'now'});await denied(getDoc(doc(guest,'projectShares','test')),'public share metadata');await deleteDoc(doc(m,'projectShares','test'));
 await updateDoc(doc(m,'cmhub_proyectos','p'),{archived:true});await denied(updateDoc(doc(w,'hubActividades','a'),{progress:30}),'archived project edit');await updateDoc(doc(m,'cmhub_proyectos','p'),{archived:false});
 console.log('PASS: rules / public isolation / roles / assignment / archive / revocation / profile protection');
 // Exercise the actual TypeScript repository against the emulator, injecting only the SDK client.
 function load(file,overrides={}){const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod.require=id=>id in overrides?overrides[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return mod.exports}
 const domain=load(path.resolve('src/cmhub/projects/domain.ts'));
 const repo=load(path.resolve('src/cmhub/projects/repository.ts'),{'@/services/firebase/client':{db:m,auth:{currentUser:{uid:'manager'}}},'./domain':domain});
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 const before=(await server.collection('hubActividades').get()).docs.map(d=>domain.fromActivity({id:d.id,...d.data()}));
 await repo.saveTasks(base,before,before.map(t=>t.id==='a'?{...t,nombre:'Renamed'}:t));
 await repo.saveTasks(base,before,before.map(t=>t.id==='b'?{...t,nombre:'B renamed'}:t));
 assert.equal((await server.doc('hubActividades/a').get()).data().title,'Renamed');
 assert.equal((await server.doc('hubActividades/b').get()).data().title,'B renamed');
 await assert.rejects(repo.saveTasks(base,before,before.map(t=>t.id==='a'?{...t,nombre:'Stale overwrite'}:t)),/Otra persona/);
 console.log('PASS: concurrent different-task edits survive; stale same-field edits rejected');
 const legacy={...base,id:'legacy',tasksMigrated:false,taskRevision:0,ganttTareas:[{id:'root',nombre:'Root',fechaInicio:'2026-10-01',fechaFin:'2026-10-02',estado:'pendiente',avance:0}]};await server.doc('cmhub_proyectos/legacy').set(legacy);
 const old=domain.legacyTasks(legacy);await repo.saveTasks(legacy,old,[...old,{id:'new-task',nombre:'New',fechaInicio:'2026-10-03',fechaFin:'2026-10-04',estado:'pendiente',avance:0}]);
 assert.equal((await server.doc('cmhub_proyectos/legacy').get()).data().tasksMigrated,true);assert.equal((await server.doc('cmhub_proyectos/legacy').get()).data().ganttTareas.length,1);assert.equal((await server.doc('hubActividades/legacy_legacy_root').get()).exists,true);
 console.log('PASS: legacy migration is atomic and keeps original source');
 // The actual public HTTP handler reads current data and honors revocation.
 const express=require('../functions/node_modules/express'), app=express();
 app.get('/gantt',require('../functions/projectGantt').publicProjectGantt);
 const listener=app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 const url=`http://127.0.0.1:${listener.address().port}/gantt?token=11111111-1111-1111-1111-111111111111`;
 await server.doc('projectShares/11111111-1111-1111-1111-111111111111').set({projectId:'p'});
 await server.doc('cmhub_proyectos/p').update({shareToken:'11111111-1111-1111-1111-111111111111',notas:[{texto:'PRIVATE NOTE'}],links:[{url:'https://private.example'}]});
 await server.doc('cmhub_brands/b').set({name:'Test brand',privateField:'PRIVATE BRAND'});
 let response=await fetch(url);assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.project.nombre,'Test');assert.ok(!JSON.stringify(payload).includes('PRIVATE'));assert.ok(payload.project.ganttTareas.length===2);
 await server.doc('projectShares/11111111-1111-1111-1111-111111111111').delete();response=await fetch(url);assert.equal(response.status,404);await new Promise(resolve=>listener.close(resolve));
 console.log('PASS: real public handler projects only safe data and rejects revoked links');
 // Completion side effects are idempotent and advance a workflow once.
 await server.doc('hubFlujos/flow').set({nombre:'Flow',pasos:[{titulo:'First',assigneeNames:['worker']},{titulo:'Next',assigneeNames:['worker']}],actividadIds:['flow-task',null],pasoActual:0,estado:'activo'});
 await server.doc('userDirectory/worker').set({displayName:'worker'});
 const taskRef=server.doc('hubActividades/flow-task');await taskRef.set({...task(),completionSource:'project-workspace',flujoId:'flow',pasoIndex:0});const previous=await taskRef.get();await taskRef.update({status:'completado'});const complete=await taskRef.get();
 const handler=require('../functions/projectCompletion').onProjectTaskCompleted;
 const event={id:'completion-test',time:'2026-10-01T15:00:00Z',params:{taskId:'flow-task'},data:{before:previous,after:complete}};
 await handler.run(event);await handler.run(event);
 assert.equal((await server.doc('cmhub_puntos/worker').get()).data().puntos,35);
 assert.equal((await server.doc('hubFlujos/flow').get()).data().actividadIds[1],'flow_flow_1');
 assert.equal((await server.doc('hubActividades/flow_flow_1').get()).data().proyectoId,'p');
 console.log('PASS: completion retries award points once and create one next workflow step');
 await Promise.all(clients.map(async({app,db})=>{await terminate(db);await deleteApp(app)}));await admin.app().delete();
}
main().catch(e=>{console.error(e);process.exit(1)});
