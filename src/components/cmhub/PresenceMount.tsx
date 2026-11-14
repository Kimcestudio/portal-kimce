'use client'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { useMyPresence } from '@/services/presence'

export default function PresenceMount() {
  const auth   = useOptionalAuth()
  const uid    = auth?.authUser?.uid ?? null
  useMyPresence(uid)
  return null
}
