export const dynamic = 'force-static'
// In production (output: export) only the '_' shell is pre-rendered and
// Firebase Hosting rewrites every real brand ID to that shell.
// In dev we allow any param so Next.js doesn't 404 on real brand IDs.
export const dynamicParams = process.env.NODE_ENV !== 'production'
export async function generateStaticParams() { return [{ id: '_' }] }
export { default } from './_BrandWorkspace'
