# Deploy en Firebase Hosting (Next.js 14)

## Verificación SSR
- No se encontraron Server Actions (`"use server"`).
- No existen Route Handlers en `src/app/api`.
- No hay `getServerSideProps`.

Con esto, el despliegue es **estático** usando `output: "export"`.

## Configuración
1. Actualiza el proyecto en `.firebaserc`:
   ```json
   {
     "projects": {
       "default": "TU_PROJECT_ID"
     }
   }
   ```
2. Asegura variables de entorno `NEXT_PUBLIC_*` en tu entorno local o en la configuración del hosting (si aplica).

## Build y Deploy
```bash
npm install
npm run build
firebase deploy
```

## Resultado esperado
- La carpeta `out/` se publica en Firebase Hosting.
- Firebase Auth y Firestore siguen funcionando desde el cliente.
- No se requiere Cloud Functions para SSR.
