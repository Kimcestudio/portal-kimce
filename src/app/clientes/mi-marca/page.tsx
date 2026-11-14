'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { Loader2 } from 'lucide-react'

type BrandInfo = { id: string; name: string }

export default function MiMarcaPage() {
  const auth = useOptionalAuth()
  const router = useRouter()
  const [brands, setBrands] = useState<BrandInfo[]>([])
  const [loadingBrands, setLoadingBrands] = useState(false)

  const profile = auth?.profile

  // Redirigir si no es cliente o si solo tiene una marca
  useEffect(() => {
    if (!auth || auth.loading) return

    if (!profile) {
      router.replace('/login?from=/clientes/mi-marca')
      return
    }

    if (profile.role !== 'client') {
      router.replace(profile.role === 'admin' ? '/admin/dashboard' : '/app/dashboard')
      return
    }

    const { brandIds } = profile
    if (!brandIds || brandIds.length === 0) return
    if (brandIds.length === 1) {
      router.replace(`/clientes/calendario/${brandIds[0]}`)
    }
  }, [auth, profile, router])

  // Cargar nombres de marcas para el selector multi-marca
  useEffect(() => {
    const brandIds = profile?.brandIds
    if (!brandIds || brandIds.length <= 1) return
    setLoadingBrands(true)
    void getDocs(
      query(collection(db, 'cmhub_brands'), where('__name__', 'in', brandIds))
    ).then(snap => {
      const map = new Map(snap.docs.map(d => [d.id, (d.data() as { name?: string }).name ?? d.id]))
      setBrands(brandIds.map(id => ({ id, name: map.get(id) ?? id })))
    }).finally(() => setLoadingBrands(false))
  }, [profile?.brandIds])

  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#9ca3af]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!profile || profile.role !== 'client') {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#9ca3af] text-sm">
        Redirigiendo...
      </div>
    )
  }

  const { brandIds } = profile

  if (!brandIds || brandIds.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-4xl">⚠️</div>
        <p className="text-[15px] font-bold text-[#111827]">Sin marcas asignadas</p>
        <p className="text-[13px] text-[#9ca3af] max-w-xs">
          Tu cuenta aún no tiene acceso a ninguna marca. Contacta a tu equipo en KIMCE.
        </p>
        <button
          type="button"
          onClick={() => void auth.signOutUser()}
          className="mt-2 text-[12px] text-[#9ca3af] underline hover:text-[#374151]"
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  // Múltiples marcas → selector
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-6">
      <div className="text-center mb-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af]">Portal de cliente</p>
        <h1 className="text-[22px] font-bold text-[#111827] mt-1">
          Hola, {profile.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="text-[13px] text-[#9ca3af] mt-1">Selecciona la marca que deseas ver</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {loadingBrands ? (
          <div className="flex justify-center py-6 text-[#9ca3af]">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : (brands.length > 0 ? brands : brandIds.map(id => ({ id, name: id }))).map(brand => (
          <button
            key={brand.id}
            type="button"
            onClick={() => router.push(`/clientes/calendario/${brand.id}`)}
            className="flex items-center justify-between rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 text-left shadow-sm hover:border-[#7c3aed]/40 hover:shadow-md transition-all group"
          >
            <span className="text-[14px] font-semibold text-[#111827] truncate">{brand.name}</span>
            <span className="text-[#d1d5db] group-hover:text-[#7c3aed] text-lg ml-2">→</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void auth.signOutUser()}
        className="text-[11px] text-[#9ca3af] underline hover:text-[#374151] mt-2"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
