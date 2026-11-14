'use client'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useOverdueChecker } from '@/cmhub/useOverdueChecker'
import { useOptionalAuth } from '@/components/auth/AuthProvider'

export default function OverdueCheckerMount() {
  const auth = useOptionalAuth()
  const { tareasD, actividades } = useHub()
  const hubBase = useHubBase()

  const uid      = auth?.authUser?.uid ?? null
  const userName = (auth?.profile as { displayName?: string } | null)?.displayName ?? null

  useOverdueChecker({ uid, userName, tareasD, actividades, hubBase })

  return null
}
