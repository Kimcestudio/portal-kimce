export const dynamic = 'force-static'
export const dynamicParams = process.env.NODE_ENV !== 'production'
export async function generateStaticParams() { return [{ slug: '_' }] }
// Ruta corta: /clientes/belcorp → mismo componente que /clientes/calendario/belcorp
export { default } from '../calendario/[id]/_CalendarioCompartido'
