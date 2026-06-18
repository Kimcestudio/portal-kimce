'use client'
import { useHub } from '@/cmhub/context'

export default function ImportOverlay() {
  const { loading } = useHub()
  if (!loading) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#7c3aed] text-white flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium pointer-events-none">
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
      Cargando datos…
    </div>
  )
}
