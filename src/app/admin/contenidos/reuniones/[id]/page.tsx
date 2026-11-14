export const dynamic = 'force-static'
export const dynamicParams = process.env.NODE_ENV !== 'production'
export async function generateStaticParams() { return [{ id: '_' }] }

export { default } from './_ReuniónDetalle'
