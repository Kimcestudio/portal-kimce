'use client'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { UserRound } from 'lucide-react'
import type { TeamMember } from '@/cmhub/types'
function Identity({label,children,tone}:{label:string;children:ReactNode;tone?:number}) {
  const [anchor,setAnchor]=useState<{left:number;top:number}|null>(null)
  function show(el:HTMLElement){const r=el.getBoundingClientRect();setAnchor({left:Math.max(12,Math.min(r.left,window.innerWidth-252)),top:r.bottom+8>window.innerHeight-80?Math.max(12,r.top-72):r.bottom+8})}
  return <><button type="button" className="pw-person" data-tone={tone} aria-label={label} aria-expanded={!!anchor} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={()=>setAnchor(null)} onFocus={e=>show(e.currentTarget)} onBlur={()=>setAnchor(null)} onClick={e=>show(e.currentTarget)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setAnchor(null)}}}>{children}</button>{anchor&&createPortal(<span className="pw-identity-tooltip" role="tooltip" style={anchor}>{label}</span>,document.body)}</>
}
export function Avatar({member,name}:{member?:TeamMember;name?:string}) {
  const [failed,setFailed]=useState(false)
  const label=member?.name||name||'Sin asignar'
  const initials=member?.initials||name?.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()
  const hue=Array.from(member?.id||label).reduce((n,c)=>n+c.charCodeAt(0),0)%5
  return <Identity label={label} tone={hue}>{member?.photoURL&&!failed?<img src={member.photoURL} alt="" onError={()=>setFailed(true)} loading="lazy" referrerPolicy="no-referrer"/>:initials||<UserRound size={14}/>}</Identity>
}
export function AvatarGroup({team,ids=[],names=[]}:{team:TeamMember[];ids?:string[];names?:string[]}) {
  const people=ids.length?ids.map(id=>({member:team.find(m=>m.id===id),name:team.find(m=>m.id===id)?.name||'Colaborador'})):names.filter(Boolean).map(name=>({member:team.find(m=>m.name===name),name}))
  return <span className="pw-people">{people.slice(0,3).map((p,i)=><Avatar key={p.member?.id||i} {...p}/>)}{people.length>3&&<Identity label={people.slice(3).map(p=>p.name).join(', ')}>+{people.length-3}</Identity>}</span>
}
