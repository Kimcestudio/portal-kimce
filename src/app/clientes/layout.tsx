'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { LogOut } from 'lucide-react'

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  const auth = useOptionalAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const profile = auth?.profile
  const isClient = profile?.role === 'client'

  // Solo redirigir a mi-marca si es cliente y está en la raíz /clientes
  useEffect(() => {
    if (!mounted || !isClient) return
    if (pathname === '/clientes' || pathname === '/clientes/') {
      router.replace('/clientes/mi-marca')
    }
  }, [mounted, isClient, pathname, router])

  if (!mounted) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* Barra mínima para clientes logueados */}
      {isClient && (
        <div className="fixed top-0 right-0 z-50 flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur border-b border-white/60 rounded-bl-xl shadow-sm">
          <span className="text-[11px] text-[#9ca3af]">
            {profile.displayName}
          </span>
          <button
            type="button"
            onClick={() => auth?.signOutUser?.()}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#9ca3af] hover:text-[#ef4444] transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={11} />
            Salir
          </button>
        </div>
      )}
      {children}
    </div>
  )
}
