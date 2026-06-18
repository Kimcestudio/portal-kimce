export const dynamic = 'force-static'
export const dynamicParams = process.env.NODE_ENV !== 'production'
export { default, generateStaticParams } from '@/app/admin/contenidos/clientes/[id]/page'
