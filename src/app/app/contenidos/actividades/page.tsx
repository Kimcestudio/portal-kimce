'use client'
import { Suspense } from 'react'
import Actividades from '@/app/admin/contenidos/actividades/page'

export default function ActividadesCollab() {
  return (
    <Suspense>
      <Actividades />
    </Suspense>
  )
}
