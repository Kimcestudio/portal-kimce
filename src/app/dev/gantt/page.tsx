import { notFound } from 'next/navigation'
import Demo from './_Demo'
export default function GanttDemo() { if(process.env.NODE_ENV!=='development')notFound(); return <Demo/> }
