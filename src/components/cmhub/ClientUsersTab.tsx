'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, db } from '@/services/firebase/client'
import { Check, Copy, Loader2, Mail, Plus, Trash2, UserCheck, X } from 'lucide-react'
import type { UserProfile } from '@/services/firebase/types'

type Props = { brandId: string; brandName: string }

type ClientUser = Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'brandIds'>

export default function ClientUsersTab({ brandId, brandName }: Props) {
  const [users, setUsers] = useState<ClientUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ type: 'ok' | 'err'; msg: string; link?: string } | null>(null)
  const [removingUid, setRemovingUid] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('brandIds', 'array-contains', brandId),
    )
    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<ClientUser, 'uid'>) })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [brandId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !displayName.trim()) return
    setCreating(true)
    setResult(null)
    try {
      const fn = httpsCallable<
        { email: string; displayName: string; brandId: string },
        { uid: string; email: string; resetLink: string }
      >(getFunctions(app), 'adminCreateClientUser')
      const res = await fn({ email: email.trim(), displayName: displayName.trim(), brandId })
      setResult({ type: 'ok', msg: `✓ Cuenta creada para ${displayName.trim()}. Copia el link de acceso y envíaselo.`, link: res.data.resetLink })
      setEmail('')
      setDisplayName('')
      setShowForm(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setResult({ type: 'err', msg: `Error: ${msg}` })
    } finally {
      setCreating(false)
    }
  }

  async function handleRemove(uid: string) {
    setRemovingUid(uid)
    try {
      const fn = httpsCallable<{ uid: string; brandId: string }, { brandIds: string[] }>(
        getFunctions(app), 'adminRemoveClientBrand'
      )
      await fn({ uid, brandId })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setResult({ type: 'err', msg: `Error al quitar acceso: ${msg}` })
    } finally {
      setRemovingUid(null)
    }
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-[#7c3aed]" />
            <span className="text-[15px] font-bold text-[#111827]">Accesos de clientes</span>
            <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-bold text-[#7c3aed]">
              {users.length}
            </span>
          </div>
          <p className="text-[11px] text-[#9ca3af] mt-0.5">
            Usuarios con login propio para ver el portal de {brandName}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setResult(null) }}
          className="flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#6d28d9] active:scale-95 transition-all"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancelar' : 'Agregar acceso'}
        </button>
      </div>

      {/* Toast */}
      {result && (
        <div className={`rounded-xl px-4 py-3 text-[12px] font-semibold flex flex-col gap-2 ${
          result.type === 'ok'
            ? 'bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534]'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span>{result.msg}</span>
          {result.link && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.link}
                className="flex-1 text-[11px] bg-white border border-[#bbf7d0] rounded-lg px-2 py-1 font-mono truncate text-[#374151]"
                onFocus={e => e.target.select()}
              />
              <button
                type="button"
                onClick={() => void copyLink(result.link!)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#16a34a] hover:text-[#15803d] shrink-0"
              >
                {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                {copiedLink ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}
          <button type="button" onClick={() => setResult(null)} className="self-end text-[10px] opacity-60 hover:opacity-100">Cerrar</button>
        </div>
      )}

      {/* Formulario nuevo usuario */}
      {showForm && (
        <form
          onSubmit={e => void handleCreate(e)}
          className="bg-[#fafafa] border border-[#e5e7eb] rounded-2xl p-5 flex flex-col gap-3"
        >
          <div className="text-[13px] font-bold text-[#111827]">Nuevo acceso cliente</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-1">Nombre completo</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Fabiola Cáceres"
                className="w-full text-[13px] border border-[#e5e7eb] rounded-xl px-3 py-2 outline-none focus:border-[#7c3aed] bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="fabiola@empresa.com"
                className="w-full text-[13px] border border-[#e5e7eb] rounded-xl px-3 py-2 outline-none focus:border-[#7c3aed] bg-white"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af]">
            Se crea la cuenta y se genera un link para que el cliente establezca su contraseña. El link expira en 1 hora.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="text-[12px] text-[#9ca3af] hover:text-[#374151]">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating || !email.trim() || !displayName.trim()}
              className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-40 transition-colors"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              {creating ? 'Creando...' : 'Crear y generar link'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de usuarios */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-[#9ca3af] text-[13px]">
          <Loader2 size={16} className="animate-spin mr-2" /> Cargando...
        </div>
      ) : users.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5e7eb] text-center gap-2">
          <UserCheck size={24} className="text-[#d1d5db]" />
          <p className="text-[13px] font-semibold text-[#9ca3af]">Sin accesos configurados</p>
          <p className="text-[11px] text-[#9ca3af] max-w-[240px]">
            Agrega un acceso para que el cliente entre con su propio login en vez del link compartido.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(u => (
            <div key={u.uid} className="flex items-center gap-3 bg-white border border-[#e5e7eb] rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#ede9fe] flex items-center justify-center text-[12px] font-bold text-[#7c3aed] shrink-0">
                {(u.displayName ?? u.email ?? '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#111827] truncate">{u.displayName}</div>
                <div className="text-[11px] text-[#9ca3af] truncate">{u.email}</div>
              </div>
              <span className="text-[10px] bg-[#f0fdf4] text-[#16a34a] font-bold px-2 py-0.5 rounded-full shrink-0">ACTIVO</span>
              <button
                type="button"
                onClick={() => void handleRemove(u.uid)}
                disabled={removingUid === u.uid}
                title="Quitar acceso a esta marca"
                className="p-1.5 text-[#d1d5db] hover:text-[#ef4444] transition-colors disabled:opacity-50 shrink-0"
              >
                {removingUid === u.uid ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
