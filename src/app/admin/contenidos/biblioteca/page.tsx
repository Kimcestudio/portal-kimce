'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { usePathname } from 'next/navigation'
import { Plus, ExternalLink, Trash2, Pencil, X, BookOpen } from 'lucide-react'

interface BibliotecaItem {
  id: string
  title: string
  imageUrl?: string
  linkUrl?: string
  note?: string
  brandId?: string
  tags: string[]
  createdAt: string
}

const FORM_EMPTY = { title: '', imageUrl: '', linkUrl: '', note: '', brandId: '', tagsRaw: '' }

export default function BibliotecaPage() {
  const { brands } = useHub()
  const { isDark } = useHubTheme()
  const auth = useOptionalAuth()
  const pathname = usePathname()
  const isAdmin =
    (auth?.profile as { role?: string })?.role === 'admin' ||
    pathname.startsWith('/admin')

  const [items, setItems] = useState<BibliotecaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBrand, setFilterBrand] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BibliotecaItem | null>(null)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'cmhub_biblioteca'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as BibliotecaItem)); setLoading(false) },
      err => { console.error('[Firestore biblioteca]', err); setLoading(false) },
    )
  }, [])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    items.forEach(it => (it.tags ?? []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => items.filter(it => {
    if (filterBrand && it.brandId !== filterBrand) return false
    if (filterTag && !(it.tags ?? []).includes(filterTag)) return false
    return true
  }), [items, filterBrand, filterTag])

  function openAdd() {
    setEditing(null)
    setForm(FORM_EMPTY)
    setShowModal(true)
  }

  function openEdit(item: BibliotecaItem) {
    setEditing(item)
    setForm({
      title:    item.title,
      imageUrl: item.imageUrl ?? '',
      linkUrl:  item.linkUrl  ?? '',
      note:     item.note     ?? '',
      brandId:  item.brandId  ?? '',
      tagsRaw:  (item.tags ?? []).join(', '),
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const tags = form.tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      title:    form.title.trim(),
      imageUrl: form.imageUrl.trim() || null,
      linkUrl:  form.linkUrl.trim()  || null,
      note:     form.note.trim()     || null,
      brandId:  form.brandId         || null,
      tags,
      _ts: serverTimestamp(),
    }
    try {
      if (editing) {
        await updateDoc(doc(db, 'cmhub_biblioteca', editing.id), payload)
      } else {
        await addDoc(collection(db, 'cmhub_biblioteca'), {
          ...payload,
          createdAt: new Date().toISOString(),
          createdBy: auth?.authUser?.uid ?? null,
        })
      }
      setShowModal(false)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try { await deleteDoc(doc(db, 'cmhub_biblioteca', id)) } catch (e) { console.error(e) }
    setDeleting(null)
  }

  const T = isDark ? {
    bg: '#09090b', card: '#1c1c1f', border: 'rgba(255,255,255,0.08)',
    text: '#f1f5f9', sub: '#94a3b8', label: 'rgba(255,255,255,0.35)',
    input: '#27272a', inputBorder: 'rgba(255,255,255,0.12)',
  } : {
    bg: '#f1f3f6', card: '#ffffff', border: '#e5e7eb',
    text: '#111827', sub: '#6b7280', label: '#9ca3af',
    input: '#f9fafb', inputBorder: '#e5e7eb',
  }

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]))

  return (
    <div className="h-full overflow-y-auto" style={{ background: T.bg }}>
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: T.text }}>Biblioteca</h1>
            <p className="text-[13px] mt-0.5" style={{ color: T.sub }}>
              Referencias visuales, links y notas del equipo
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#7c3aed' }}
            >
              <Plus size={15} /> Agregar
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-[13px] border outline-none cursor-pointer"
            style={{ background: T.card, borderColor: T.border, color: T.text }}
          >
            <option value="">Todos los clientes</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterTag('')}
              className="px-3 py-1 rounded-full text-[12px] font-medium border transition-all"
              style={{
                background: !filterTag ? '#7c3aed' : 'transparent',
                color:      !filterTag ? '#fff'    : T.sub,
                borderColor: !filterTag ? '#7c3aed' : T.border,
              }}
            >
              Todos
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                className="px-3 py-1 rounded-full text-[12px] font-medium border transition-all"
                style={{
                  background: filterTag === tag ? '#7c3aed' : 'transparent',
                  color:      filterTag === tag ? '#fff'    : T.sub,
                  borderColor: filterTag === tag ? '#7c3aed' : T.border,
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-[13px]" style={{ color: T.sub }}>Cargando…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <BookOpen size={36} style={{ color: T.label }} />
            <p className="text-[14px]" style={{ color: T.sub }}>
              {items.length === 0
                ? 'Sin referencias aún. Agrega la primera.'
                : 'Sin resultados para los filtros seleccionados.'}
            </p>
            {isAdmin && items.length === 0 && (
              <button
                onClick={openAdd}
                className="mt-1 px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: '#7c3aed' }}
              >
                Agregar referencia
              </button>
            )}
          </div>
        ) : (
          <div style={{ columnCount: 4, columnGap: '1rem' }}
            className="[column-count:2] sm:[column-count:3] lg:[column-count:4]">
            {filtered.map(item => {
              const brand = item.brandId ? brandMap[item.brandId] : null
              return (
                <div
                  key={item.id}
                  className="break-inside-avoid mb-4 rounded-2xl overflow-hidden border transition-shadow hover:shadow-md"
                  style={{ background: T.card, borderColor: T.border }}
                >
                  {item.imageUrl && (
                    <div className="w-full overflow-hidden" style={{ maxHeight: 220 }}>
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full object-cover"
                        style={{ maxHeight: 220 }}
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                      />
                    </div>
                  )}

                  <div className="p-3.5">
                    <p className="text-[13px] font-semibold leading-snug mb-1" style={{ color: T.text }}>
                      {item.title}
                    </p>
                    {item.note && (
                      <p
                        className="text-[12px] leading-relaxed mb-2.5"
                        style={{ color: T.sub, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {item.note}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                      {brand && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: brand.color }}
                        >
                          {brand.name}
                        </span>
                      )}
                      {(item.tags ?? []).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full border"
                          style={{ color: T.sub, borderColor: T.border }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.linkUrl && (
                        <a
                          href={item.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-opacity hover:opacity-70"
                          style={{ color: '#7c3aed', borderColor: '#ede9fe', background: '#faf5ff' }}
                        >
                          <ExternalLink size={11} /> Ver enlace
                        </a>
                      )}
                      {isAdmin && (
                        <div className="ml-auto flex items-center gap-0.5">
                          <button
                            onClick={() => openEdit(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: T.sub }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting === item.id}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: '#ef4444', opacity: deleting === item.id ? 0.4 : 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal agregar / editar */}
      {showModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: T.card }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
              <p className="text-[16px] font-bold" style={{ color: T.text }}>
                {editing ? 'Editar referencia' : 'Nueva referencia'}
              </p>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: T.sub }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: '65vh' }}>
              {[
                { key: 'title',    label: 'Título *',       placeholder: 'Nombre de la referencia',         type: 'text' },
                { key: 'imageUrl', label: 'URL de imagen',  placeholder: 'https://…',                       type: 'url'  },
                { key: 'linkUrl',  label: 'URL de enlace',  placeholder: 'https://…',                       type: 'url'  },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: T.label }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(form as Record<string, string>)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-xl text-[13px] border outline-none"
                    style={{ background: T.input, borderColor: T.inputBorder, color: T.text }}
                  />
                </div>
              ))}

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: T.label }}>
                  Nota
                </label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="¿Qué tiene de bueno esta referencia?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-[13px] border outline-none resize-none"
                  style={{ background: T.input, borderColor: T.inputBorder, color: T.text }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: T.label }}>
                  Cliente
                </label>
                <select
                  value={form.brandId}
                  onChange={e => setForm(f => ({ ...f, brandId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-[13px] border outline-none cursor-pointer"
                  style={{ background: T.input, borderColor: T.inputBorder, color: T.text }}
                >
                  <option value="">Sin cliente (referencia general)</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: T.label }}>
                  Tags <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(separados por coma)</span>
                </label>
                <input
                  type="text"
                  value={form.tagsRaw}
                  onChange={e => setForm(f => ({ ...f, tagsRaw: e.target.value }))}
                  placeholder="diseño, reels, copy, color, tipografía"
                  className="w-full px-3 py-2 rounded-xl text-[13px] border outline-none"
                  style={{ background: T.input, borderColor: T.inputBorder, color: T.text }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-[13px] font-medium border transition-opacity hover:opacity-70"
                style={{ color: T.sub, borderColor: T.border }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim() || saving}
                className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: '#7c3aed' }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
