'use client'
import { usePathname } from 'next/navigation'

export function useHubBase() {
  const pathname = usePathname()
  return pathname.startsWith('/app/') ? '/app/contenidos' : '/admin/contenidos'
}
