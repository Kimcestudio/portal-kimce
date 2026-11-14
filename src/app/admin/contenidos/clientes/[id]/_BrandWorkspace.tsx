'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Download, FileText, ExternalLink, Loader2, Presentation, BarChart2, Columns3, TrendingUp, Link2, Radio, MessageSquare, CheckCircle2, Lightbulb, Globe, Share2, Copy, Check, FolderOpen, FileUp, Trash2, RefreshCw, Sheet, Users, type LucideIcon } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useHubMeta } from '@/cmhub/theme'
import { NETWORK_META, STATUS_META, PRIORITY_META } from '@/cmhub/data'
import { generateInsights, generateRecommendations } from '@/cmhub/insights'
import dynamic from 'next/dynamic'
const ContentModal = dynamic(() => import('@/components/cmhub/ContentModal'), { ssr: false })
import BrandModal from '@/components/cmhub/BrandModal'
import NetworkFilter from '@/components/cmhub/NetworkFilter'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Content, ContentStatus, Network } from '@/cmhub/types'
import BrandSolicitudesPanel from '@/components/cmhub/BrandSolicitudesPanel'
import ClientUsersTab from '@/components/cmhub/ClientUsersTab'
import { subscribeContentRequests } from '@/services/contentRequests'
import { listClientDocuments, uploadClientDocument, updateClientDocumentFile, deleteClientDocument, getClientDocumentUrl, type ClientDocument } from '@/services/clientDocuments'
import { readFileAsDataUrl } from '@/services/firebase/media'

function formatDocSize(size: number) {
  if (!size) return '-'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function absolutePublicUrl(path: string) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

const KANBAN_COLS: { key: ContentStatus; color: string; bg: string }[] = [
  { key: 'idea',       color: '#94a3b8', bg: '#f1f5f9' },
  { key: 'produccion', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'revision',   color: '#f59e0b', bg: '#fef3c7' },
  { key: 'aprobado',   color: '#10b981', bg: '#d1fae5' },
  { key: 'programado', color: '#16a34a', bg: '#f0fdf4' },
  { key: 'publicado',  color: '#8b5cf6', bg: '#ede9fe' },
]

function StatusDot({ status }: { status: string }) {
  const s = STATUS_META[status]
  return <div className="w-2 h-2 rounded-full inline-block" style={{ background: s?.dot }} />
}

type Tab = 'resumen' | 'kanban' | 'metricas' | 'informes' | 'recursos' | 'solicitudes' | 'archivos' | 'usuarios'
const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
  { key: 'resumen',      label: 'Resumen',      Icon: BarChart2 },
  { key: 'solicitudes',  label: 'Solicitudes',  Icon: MessageSquare },
  { key: 'kanban',       label: 'Kanban',       Icon: Columns3 },
  { key: 'metricas',     label: 'Métricas',     Icon: TrendingUp },
  { key: 'informes',     label: 'Informes',     Icon: FileText },
  { key: 'recursos',     label: 'Recursos',     Icon: Link2 },
  { key: 'archivos',     label: 'Archivos',     Icon: FolderOpen },
  { key: 'usuarios',     label: 'Accesos',      Icon: Radio },
]

export default function BrandWorkspace() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const BASE = useHubBase()
  const { NETWORK_META, STATUS_META, PRIORITY_META } = useHubMeta()
  const { brands, team, getBrandById, getContentsByBrand, updateContent, updateBrand, loading } = useHub()

  // Con output:export + Firebase Hosting rewrite, useParams puede quedarse con '_'
  // (el shell pre-renderizado). Leemos el ID real de window.location en el cliente.
  const [id, setId] = useState<string>(params?.id ?? '_')

  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean)
    const urlId = segments[segments.length - 1]
    if (urlId && urlId !== '_') setId(urlId)
  }, [])

  const brand = getBrandById(id)
  const contents = getContentsByBrand(id)

  // Mostrar spinner mientras: carga Firestore, ID aún es el shell '_', o brands vacío
  const stillLoading = loading || id === '_' || (!brand && brands.length === 0)


  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab') as Tab | null
      if (p && TABS.some(t => t.key === p)) return p
    }
    return 'resumen'
  })
  const [showContentModal, setShowContentModal] = useState(false)
  const [editingContent, setEditingContent] = useState<Content | undefined>()
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<ContentStatus | null>(null)
  const [pptLoading, setPptLoading] = useState(false)
  const [filterNetwork, setFilterNetwork] = useState('all')
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [sheetIdInput, setSheetIdInput] = useState('')
  const [savingSheetId, setSavingSheetId] = useState(false)
  const [slugInput, setSlugInput] = useState('')
  const [savingSlug, setSavingSlug] = useState(false)

  const [brandDocs, setBrandDocs] = useState<ClientDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsMessage, setDocsMessage] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [pendingSolicitudes, setPendingSolicitudes] = useState(0)

  useEffect(() => {
    if (!id || id === '_') return
    const unsub = subscribeContentRequests(id, (reqs) => {
      setPendingSolicitudes(reqs.filter(r => r.status === 'pendiente').length)
    })
    return () => unsub()
  }, [id])

  // Cuando el modal de compartir se abre, sincroniza las categorías de brand.contacts
  // con los datos actuales del equipo (por si cambiaron desde que se guardaron).
  useEffect(() => {
    if (!showShareModal || !brand || !team.length) return
    const current = brand.contacts ?? []
    if (!current.length) return
    const refreshed = current.map(c => {
      const live = team.find(m => m.email === c.email)
      return live ? { ...c, name: live.name, category: live.category ?? c.category } : c
    })
    const changed = refreshed.some((r, i) => r.category !== current[i]?.category || r.name !== current[i]?.name)
    if (changed) void updateBrand(brand.id, { contacts: refreshed })
  }, [showShareModal])

  const shareSlug = brand?.slug?.trim() || null
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/clientes/calendario/${shareSlug ?? id}`
    : ''

  async function refreshBrandDocs(brandName: string) {
    try {
      setDocsLoading(true)
      const all = await listClientDocuments()
      setBrandDocs(all.filter(d => d.clientName === brandName))
    } catch {
      setDocsMessage('No se pudo cargar los archivos.')
    } finally {
      setDocsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'archivos' && brand) refreshBrandDocs(brand.name)
  }, [tab, id])

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile || !brand) return
    if (uploadFile.size > 750 * 1024) {
      setDocsMessage('Sube archivos de hasta 750 KB.')
      return
    }
    try {
      setIsUploading(true)
      setDocsMessage('')
      const dataUrl = await readFileAsDataUrl(uploadFile)
      const docId = await uploadClientDocument({ title: uploadTitle, clientName: brand.name, file: uploadFile, dataUrl })
      const url = absolutePublicUrl(getClientDocumentUrl(docId))
      await navigator.clipboard?.writeText(url)
      setDocsMessage('Archivo publicado. Enlace copiado al portapapeles.')
      setUploadTitle('')
      setUploadFile(null)
      await refreshBrandDocs(brand.name)
    } catch {
      setDocsMessage('No se pudo publicar el archivo.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDocReplace(clientDoc: ClientDocument, file: File | null) {
    if (!file || !brand) return
    if (clientDoc.source === 'static' || clientDoc.publicPath) {
      setDocsMessage('Archivo fijo del sitio, no se puede reemplazar aquí.')
      return
    }
    if (file.size > 750 * 1024) {
      setDocsMessage('Sube archivos de hasta 750 KB.')
      return
    }
    try {
      setUpdatingDocId(clientDoc.id)
      setDocsMessage('')
      const dataUrl = await readFileAsDataUrl(file)
      await updateClientDocumentFile({ id: clientDoc.id, file, dataUrl })
      setDocsMessage('Archivo actualizado correctamente.')
      await refreshBrandDocs(brand.name)
    } catch {
      setDocsMessage('No se pudo actualizar el archivo.')
    } finally {
      setUpdatingDocId(null)
    }
  }

  async function handleDocDelete(clientDoc: ClientDocument) {
    if (!brand) return
    if (!window.confirm(`¿Eliminar "${clientDoc.title}"? Esta acción no se puede deshacer.`)) return
    try {
      setDeletingDocId(clientDoc.id)
      setDocsMessage('')
      await deleteClientDocument(clientDoc.id)
      setDocsMessage(`"${clientDoc.title}" eliminado.`)
      await refreshBrandDocs(brand.name)
    } catch {
      setDocsMessage('No se pudo eliminar el archivo.')
    } finally {
      setDeletingDocId(null)
    }
  }

  async function handleDocCopyLink(clientDoc: ClientDocument) {
    const url = absolutePublicUrl(getClientDocumentUrl(clientDoc.id))
    await navigator.clipboard?.writeText(url)
    setDocsMessage(`Enlace copiado: ${url}`)
  }

  function handleDocDownload(clientDoc: ClientDocument) {
    const source = clientDoc.publicPath ?? clientDoc.dataUrl
    if (!source) return
    const a = window.document.createElement('a')
    a.href = source
    a.download = clientDoc.fileName
    a.style.display = 'none'
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
  }

  async function handleToggleShare() {
    if (!brand) return
    await updateBrand(brand.id, { calendarShareEnabled: !brand.calendarShareEnabled })
  }

  async function handleSaveSheetId() {
    if (!brand || !sheetIdInput.trim()) return
    setSavingSheetId(true)
    try {
      await updateBrand(brand.id, { sheetId: sheetIdInput.trim() })
      setSheetIdInput('')
    } finally {
      setSavingSheetId(false)
    }
  }

  async function handleSaveSlug() {
    if (!brand) return
    const raw = slugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!raw) return
    setSavingSlug(true)
    try {
      await updateBrand(brand.id, { slug: raw })
      setSlugInput('')
    } finally {
      setSavingSlug(false)
    }
  }

  async function handleCopyShareLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleExportCSV() {
    if (!brand) return
    const { exportCSV } = await import('@/cmhub/export')
    exportCSV(contents, brand)
  }

  async function handleExportExcel() {
    if (!brand) return
    const { exportExcel } = await import('@/cmhub/export')
    exportExcel(contents, brand)
  }

  async function handlePrintReport() {
    if (!brand) return
    const { openPrintReport } = await import('@/cmhub/export')
    openPrintReport(brand, contents)
  }

  const availableMonths = useMemo(() => {
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const months = [...new Set(
      contents.map(c => c.date?.substring(0, 7)).filter((m): m is string => Boolean(m))
    )].sort((a, b) => b.localeCompare(a))
    return months.map(ym => {
      const [y, m] = ym.split('-')
      return { key: ym, label: `${MESES[parseInt(m) - 1]} ${y}`, count: contents.filter(c => c.date?.startsWith(ym)).length }
    })
  }, [contents])

  async function doExportWebReport(monthFilter: string | null) {
    if (!brand) return
    setShowMonthPicker(false)
    const filtered = monthFilter ? contents.filter(c => c.date?.startsWith(monthFilter)) : contents
    const { exportWebReport } = await import('@/cmhub/export')
    exportWebReport(brand, filtered)
  }

  async function handleExportPPT() {
    if (!brand) return
    setPptLoading(true)
    try {
      const { exportPPT } = await import('@/cmhub/pptExport')
      await exportPPT(brand, contents)
    } catch (err) {
      console.error('PPT export error:', err)
      alert('Error generando el PPT: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPptLoading(false)
    }
  }

  if (stillLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#f8fafc] gap-3">
        <Loader2 size={24} className="animate-spin text-[#7c3aed]" />
        <p className="text-[13px] text-[#9ca3af]">Cargando workspace…</p>
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#f8fafc]">
        <div className="text-[16px] font-semibold text-[#111827] mb-2">Marca no encontrada</div>
        <button onClick={() => router.push(`${BASE}/clientes`)} className="text-[#7c3aed] text-[13px] hover:underline">← Volver a clientes</button>
      </div>
    )
  }

  const published = contents.filter(c => c.status === 'publicado')
  const approved  = contents.filter(c => c.status === 'aprobado')
  const pending   = contents.filter(c => ['revision'].includes(c.status))
  const ideas     = contents.filter(c => c.status === 'idea')
  const insights  = generateInsights(contents, brand)
  const recs      = generateRecommendations(contents, brand)

  function onDrop(status: ContentStatus) {
    if (!dragging) return
    updateContent(dragging, { status })
    setDragging(null)
    setOver(null)
  }

  function openEdit(c: Content) {
    setEditingContent(c)
    setShowContentModal(true)
  }

  function openNew() {
    setEditingContent(undefined)
    setShowContentModal(true)
  }

  const totalReach = published.reduce((a, c) => a + (c.metrics?.reach ?? 0), 0)
  const avgEng = (() => {
    const rates = published.flatMap(c => c.metrics?.engagementRate ? [c.metrics.engagementRate] : [])
    return rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) : '—'
  })()

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]" style={{ zoom: 0.95 }}>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <button onClick={() => router.push(`${BASE}/clientes`)} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-extrabold text-white" style={{ background: brand.color }}>{brand.initials}</div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] text-[#9ca3af]">Clientes</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">{brand.name}</span>
        </div>
        <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 border border-[#e5e7eb] text-[#6b7280] text-[12px] px-3 py-1.5 rounded-xl hover:bg-[#f9fafb] transition-colors">
          <Share2 size={12} /> Compartir calendario
        </button>
        <button onClick={() => setShowBrandModal(true)} className="flex items-center gap-1.5 border border-[#e5e7eb] text-[#6b7280] text-[12px] px-3 py-1.5 rounded-xl hover:bg-[#f9fafb] transition-colors">
          <Edit2 size={12} /> Editar marca
        </button>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={14} /> Nueva publicación
        </button>
      </div>

      {/* Brand header */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] font-extrabold text-white shadow-md" style={{ background: brand.color }}>{brand.initials}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold text-[#111827]">{brand.name}</h1>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${brand.status === 'active' ? 'bg-[#dcfce7] text-[#16a34a]' : brand.status === 'paused' ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                {brand.status === 'active' ? 'ACTIVO' : brand.status === 'paused' ? 'PAUSADO' : 'CERRADO'}
              </span>
            </div>
            <div className="text-[12px] text-[#9ca3af] mt-0.5">{brand.industry} · {brand.country} · Responsable: {brand.responsible}</div>
            <div className="flex gap-1 mt-2">
              {brand.channels.map(n => (
                <div key={n} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: NETWORK_META[n]?.bg ?? '#f3f4f6', color: NETWORK_META[n]?.dot ?? '#9ca3af' }} title={NETWORK_META[n]?.label}>
                  <NetworkIcon network={n} size={12} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 text-center">
            {[
              { val: contents.length, label: 'Total' },
              { val: published.length, label: 'Publicados' },
              { val: approved.length, label: 'Aprobados' },
              { val: pending.length, label: 'Pendientes' },
            ].map(({ val, label }) => (
              <div key={label}>
                <div className="text-[22px] font-bold text-[#111827]">{val}</div>
                <div className="text-[10px] text-[#9ca3af]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e7eb] bg-white px-6 shrink-0">
        {TABS.map(t => {
          const TabIcon = t.Icon
          const isActive = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors ${isActive ? 'text-[#7c3aed] border-[#7c3aed]' : 'text-[#9ca3af] border-transparent hover:text-[#6b7280]'}`}>
              <TabIcon size={13} />
              {t.label}
              {t.key === 'solicitudes' && pendingSolicitudes > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${isActive ? 'bg-[#ede9fe] text-[#7c3aed]' : 'bg-[#fef3c7] text-[#d97706]'}`}>
                  {pendingSolicitudes}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden">

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                { val: totalReach > 0 ? (totalReach > 1000 ? (totalReach / 1000).toFixed(1) + 'K' : totalReach) : '—', label: 'Alcance total', Icon: Radio, bg: '#f5f3ff', color: '#7c3aed' },
                { val: avgEng !== '—' ? avgEng + '%' : '—', label: 'Engagement prom.', Icon: MessageSquare, bg: '#eff6ff', color: '#3b82f6' },
                { val: published.length, label: 'Publicados', Icon: CheckCircle2, bg: '#f0fdf4', color: '#16a34a' },
                { val: ideas.length, label: 'Ideas en cartera', Icon: Lightbulb, bg: '#fef3c7', color: '#d97706' },
              ].map(({ val, label, Icon, bg, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#e5e7eb] p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}><Icon size={16} style={{ color }} /></div>
                  <div className="text-[24px] font-bold text-[#111827]">{val}</div>
                  <div className="text-[11px] text-[#9ca3af] mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]">
                <span className="text-[15px] font-bold text-[#111827]">Estado del pipeline</span>
              </div>
              <div className="p-5 flex flex-col gap-2.5">
                {KANBAN_COLS.map(col => {
                  const count = contents.filter(c => c.status === col.key).length
                  const pct = contents.length ? Math.round((count / contents.length) * 100) : 0
                  const meta = STATUS_META[col.key]
                  return (
                    <div key={col.key} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full w-28 text-center shrink-0" style={{ background: meta.bg, color: meta.text }}>{meta.label}</span>
                      <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col.color }} />
                      </div>
                      <span className="text-[12px] font-semibold text-[#111827] w-6 text-right shrink-0">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
                <span className="text-[15px] font-bold text-[#111827]">Contenidos recientes</span>
                <button onClick={() => setTab('kanban')} className="text-[12px] text-[#7c3aed] hover:underline">Ver todos →</button>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {contents.slice(0, 5).map(c => {
                  const net = NETWORK_META[c.channel]
                  const st = STATUS_META[c.status]
                  const pr = PRIORITY_META[c.priority]
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] cursor-pointer transition-colors" onClick={() => openEdit(c)}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: net?.bg, color: net?.dot }}><NetworkIcon network={c.channel} size={15} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#111827] truncate">{c.title}</div>
                        <div className="text-[11px] text-[#9ca3af]">{c.format} · {c.date ?? 'Sin fecha'}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: pr.bg, color: pr.text }}>{pr.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* KANBAN */}
        {tab === 'kanban' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-6 pt-3 pb-1 shrink-0">
              <NetworkFilter contents={contents} value={filterNetwork} onChange={setFilterNetwork} />
            </div>
            <div className="flex-1 overflow-x-auto px-6 pb-6 pt-3 flex gap-3">
              {KANBAN_COLS.map(col => {
                const cards = contents.filter(c =>
                  c.status === col.key &&
                  (filterNetwork === 'all' || c.channel === filterNetwork)
                )
                const meta = STATUS_META[col.key]
                const isOver = over === col.key
                return (
                  <div key={col.key} className="w-[240px] shrink-0 flex flex-col"
                    onDragOver={e => { e.preventDefault(); setOver(col.key) }}
                    onDragLeave={() => setOver(null)}
                    onDrop={() => onDrop(col.key)}
                  >
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                      <span className="text-[12px] font-bold text-[#111827]">{meta.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: col.bg, color: col.color }}>{cards.length}</span>
                    </div>
                    <div className={`flex flex-col gap-2 flex-1 min-h-[80px] rounded-2xl p-2 transition-colors ${isOver ? 'bg-[#f5f3ff] ring-2 ring-[#7c3aed]/20' : 'bg-transparent'}`}>
                      {cards.map(c => {
                        const net = NETWORK_META[c.channel]
                        const pr = PRIORITY_META[c.priority]
                        return (
                          <div key={c.id} draggable onDragStart={() => setDragging(c.id)}
                            onClick={() => openEdit(c)}
                            className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all active:scale-95 active:opacity-75"
                          >
                            <div className="h-1 w-full" style={{ background: net?.dot }} />
                            <div className="p-3">
                              <div className="flex items-start justify-between mb-1.5 gap-1">
                                <div className="flex gap-1 flex-wrap">
                                  {(c.channels?.length ? c.channels : [c.channel]).map(ch => {
                                    const m = NETWORK_META[ch]
                                    return (
                                      <span key={ch} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: m?.dot ?? '#94a3b8', color: '#fff' }} title={m?.label}>
                                        <NetworkIcon network={ch as Network} size={11} />
                                      </span>
                                    )
                                  })}
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: pr.bg, color: pr.text }}>{pr.label}</span>
                              </div>
                              <p className="text-[12px] font-semibold text-[#111827] line-clamp-2 mb-2">{c.title}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] bg-[#f3f4f6] text-[#6b7280] px-1.5 py-0.5 rounded-lg">{c.format}</span>
                                <span className="text-[10px] font-mono text-[#9ca3af]">{c.date ? c.date.replace('2026-', '') : '—'}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <button onClick={openNew}
                        className="flex items-center justify-center gap-1 mt-1 py-2 text-[11px] text-[#9ca3af] hover:text-[#7c3aed] rounded-xl hover:bg-white transition-colors border border-dashed border-[#e5e7eb] hover:border-[#7c3aed]">
                        + Añadir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MÉTRICAS */}
        {tab === 'metricas' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
            <div className="grid grid-cols-4 gap-4">
              {[
                { val: published.length, label: 'Publicados', sub: 'este mes' },
                { val: totalReach > 0 ? totalReach.toLocaleString('es-ES') : '—', label: 'Alcance total', sub: 'suma acumulada' },
                { val: avgEng !== '—' ? avgEng + '%' : '—', label: 'Engagement prom.', sub: 'publicados con métricas' },
                { val: published.reduce((a, c) => a + (c.metrics?.likes ?? 0), 0).toLocaleString('es-ES') || '—', label: 'Likes totales', sub: 'suma acumulada' },
              ].map(({ val, label, sub }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                  <div className="text-[24px] font-bold text-[#111827]">{val}</div>
                  <div className="text-[12px] font-semibold text-[#4b5563] mt-1">{label}</div>
                  <div className="text-[11px] text-[#9ca3af] mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]">
                <div className="text-[15px] font-bold text-[#111827]">Métricas por publicación</div>
                <div className="text-[12px] text-[#9ca3af] mt-0.5">Haz clic en una publicación para editar sus métricas</div>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#f9fafb]">
                    {['Publicación', 'Canal', 'Fecha', 'Alcance', 'Impresiones', 'Engagement', 'Likes', 'Guardados'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide border-b border-[#f3f4f6]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contents.filter(c => c.status === 'publicado' || c.metrics).map(c => {
                    const net = NETWORK_META[c.channel]
                    return (
                      <tr key={c.id} className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa] cursor-pointer transition-colors" onClick={() => openEdit(c)}>
                        <td className="px-4 py-3 font-semibold text-[#111827] max-w-[160px]"><div className="truncate">{c.title}</div></td>
                        <td className="px-4 py-3"><span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: net?.bg, color: net?.text }}><NetworkIcon network={c.channel} size={10} /> {net?.label}</span></td>
                        <td className="px-4 py-3 font-mono text-[#9ca3af]">{c.date ?? '—'}</td>
                        <td className="px-4 py-3">{c.metrics?.reach?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3">{c.metrics?.impressions?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3 font-semibold">{c.metrics?.engagementRate ? c.metrics.engagementRate + '%' : <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3">{c.metrics?.likes?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                        <td className="px-4 py-3">{c.metrics?.saves?.toLocaleString('es-ES') ?? <span className="text-[#d1d5db]">—</span>}</td>
                      </tr>
                    )
                  })}
                  {contents.filter(c => c.status === 'publicado' || c.metrics).length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-[#9ca3af] text-[13px]">Aún no hay publicaciones con métricas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INFORMES */}
        {tab === 'informes' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
              <div className="text-[15px] font-bold text-[#111827] mb-1">Exportar informe</div>
              <div className="text-[12px] text-[#9ca3af] mb-4">Genera y descarga el informe de {brand.name}</div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={handleExportCSV} className="flex items-center gap-2 border border-[#e5e7eb] text-[#4b5563] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors"><Download size={14} /> Exportar CSV</button>
                <button onClick={handleExportExcel} className="flex items-center gap-2 border border-[#e5e7eb] text-[#4b5563] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors"><FileText size={14} /> Exportar Excel</button>
                <button onClick={handlePrintReport} className="flex items-center gap-2 border border-[#e5e7eb] text-[#4b5563] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f9fafb] transition-colors"><FileText size={14} /> Generar PDF</button>
                <button onClick={() => setShowMonthPicker(true)} className="flex items-center gap-2 border border-[#7c3aed] text-[#7c3aed] text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#f5f3ff] transition-colors"><Globe size={14} /> Web interactiva</button>
                <button onClick={handleExportPPT} disabled={pptLoading} className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#5b21b6] disabled:opacity-60 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"><Presentation size={14} /> {pptLoading ? 'Generando PPT…' : 'Exportar PPT'}</button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]"><div className="text-[15px] font-bold text-[#111827]">Insights automáticos</div><div className="text-[12px] text-[#9ca3af] mt-0.5">Generados a partir de los datos registrados</div></div>
              <div className="p-5 flex flex-col gap-2">
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[#f3f4f6] last:border-0">
                    <div className="w-5 h-5 rounded-full bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-[13px] text-[#374151]">{ins}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]"><div className="text-[15px] font-bold text-[#111827]">Recomendaciones estratégicas</div></div>
              <div className="p-5 flex flex-col gap-2">
                {recs.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[#f3f4f6] last:border-0">
                    <div className="w-5 h-5 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">→</div>
                    <p className="text-[13px] text-[#374151]">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RECURSOS */}
        {tab === 'recursos' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#f3f4f6]"><div className="text-[15px] font-bold text-[#111827]">Links importantes</div></div>
                <div className="p-5 flex flex-col gap-3">
                  {Object.entries(brand.links).filter(([, url]) => url).length === 0 && (
                    <div className="text-[13px] text-[#9ca3af] text-center py-4">No hay links configurados. <button onClick={() => setShowBrandModal(true)} className="text-[#7c3aed] hover:underline">Editar marca →</button></div>
                  )}
                  {([
                    { key: 'instagram', label: 'Instagram' },
                    { key: 'facebook', label: 'Facebook' },
                    { key: 'tiktok', label: 'TikTok' },
                    { key: 'linkedin', label: 'LinkedIn' },
                    { key: 'web', label: 'Sitio web' },
                    { key: 'drive', label: 'Google Drive' },
                    { key: 'designs', label: 'Carpeta diseños' },
                    { key: 'reports', label: 'Reportes' },
                  ] as { key: keyof typeof brand.links; label: string }[]).filter(({ key }) => brand.links[key]).map(({ key, label }) => (
                    <a key={key} href={brand.links[key]} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-xl hover:bg-[#f9fafb] transition-colors group border border-[#f3f4f6]">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: NETWORK_META[key]?.bg ?? '#f3f4f6', color: NETWORK_META[key]?.dot ?? '#9ca3af' }}>
                        {NETWORK_META[key] ? <NetworkIcon network={key as never} size={13} /> : <ExternalLink size={13} />}
                      </div>
                      <div className="flex-1">
                        <div className="text-[12px] font-semibold text-[#111827]">{label}</div>
                        <div className="text-[10px] text-[#9ca3af] truncate max-w-[200px]">{brand.links[key]}</div>
                      </div>
                      <ExternalLink size={12} className="text-[#9ca3af] group-hover:text-[#7c3aed]" />
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                  <div className="text-[14px] font-bold text-[#111827] mb-3">Información de la marca</div>
                  <div className="flex flex-col gap-3 text-[13px]">
                    <div className="flex justify-between"><span className="text-[#9ca3af]">Industria</span><span className="font-medium text-[#111827]">{brand.industry}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">País</span><span className="font-medium text-[#111827]">{brand.country}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">Responsable</span><span className="font-medium text-[#111827]">{brand.responsible}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">Estado</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${brand.status === 'active' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fef3c7] text-[#d97706]'}`}>
                        {brand.status === 'active' ? 'Activo' : 'Pausado'}
                      </span>
                    </div>
                  </div>
                </div>
                {brand.observations && (
                  <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                    <div className="text-[14px] font-bold text-[#111827] mb-2">Observaciones estratégicas</div>
                    <p className="text-[13px] text-[#4b5563] leading-relaxed">{brand.observations}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'solicitudes' && (
          <BrandSolicitudesPanel brandId={id} sheetId={brand.sheetId} brandName={brand.name} />
        )}

        {tab === 'usuarios' && (
          <ClientUsersTab brandId={id} brandName={brand.name} />
        )}

        {/* ARCHIVOS */}
        {tab === 'archivos' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
              <form onSubmit={handleDocUpload} className="bg-white rounded-2xl border border-[#e5e7eb] p-5 self-start">
                <div className="text-[15px] font-bold text-[#111827] mb-1">Subir archivo</div>
                <p className="text-[12px] text-[#9ca3af] mb-4">Publica archivos y comparte un enlace sin login. Máximo 750 KB.</p>
                <div className="flex flex-col gap-3">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Título</span>
                    <input
                      value={uploadTitle}
                      onChange={e => setUploadTitle(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#ede9fe]"
                      placeholder="Ej. Propuesta Mayo 2026"
                    />
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#d1d5db] bg-[#f9fafb] px-4 py-6 text-center transition hover:border-[#7c3aed] hover:bg-[#f5f3ff]/40">
                    <FileUp className="h-6 w-6 text-[#7c3aed]" />
                    <span className="mt-2 text-[13px] font-semibold text-[#374151]">
                      {uploadFile ? uploadFile.name : 'Seleccionar archivo'}
                    </span>
                    <span className="mt-1 text-[11px] text-[#9ca3af]">HTML, PDF o imagen</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".html,.htm,.pdf,image/*"
                      onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={!uploadTitle.trim() || !uploadFile || isUploading}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:bg-[#d1d5db] disabled:shadow-none"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Publicar y copiar enlace
                </button>
                {docsMessage && (
                  <p className="mt-3 rounded-xl bg-[#f9fafb] p-3 text-[12px] text-[#4b5563]">{docsMessage}</p>
                )}
              </form>

              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#f3f4f6]">
                  <div className="text-[15px] font-bold text-[#111827]">Archivos de {brand.name}</div>
                  <div className="text-[12px] text-[#9ca3af] mt-0.5">Documentos publicados y listos para compartir</div>
                </div>
                {docsLoading ? (
                  <div className="flex items-center justify-center py-16 text-[13px] text-[#9ca3af]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando archivos…
                  </div>
                ) : brandDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FolderOpen className="h-8 w-8 text-[#d1d5db] mb-3" />
                    <p className="text-[13px] text-[#9ca3af]">Aún no hay archivos para este cliente.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[640px]">
                      <div className="grid grid-cols-[1fr_100px_220px] bg-[#f9fafb] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                        <span>Documento</span>
                        <span>Tamaño</span>
                        <span className="text-right">Acciones</span>
                      </div>
                      <div className="divide-y divide-[#f3f4f6]">
                        {brandDocs.map(clientDoc => {
                          const href = getClientDocumentUrl(clientDoc.id)
                          return (
                            <div key={clientDoc.id} className="grid grid-cols-[1fr_100px_220px] items-center gap-3 px-5 py-3.5 text-[13px]">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[#111827]">{clientDoc.title}</p>
                                <p className="truncate text-[11px] text-[#9ca3af]">{clientDoc.fileName}</p>
                              </div>
                              <p className="text-[#6b7280]">{formatDocSize(clientDoc.size)}</p>
                              <div className="flex justify-end gap-1.5">
                                <label
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition ${
                                    clientDoc.source === 'static' || clientDoc.publicPath
                                      ? 'cursor-not-allowed opacity-40'
                                      : 'cursor-pointer hover:border-[#7c3aed]/40 hover:text-[#7c3aed]'
                                  }`}
                                  title="Actualizar archivo"
                                >
                                  {updatingDocId === clientDoc.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  )}
                                  <input
                                    type="file"
                                    className="sr-only"
                                    accept=".html,.htm,.pdf,image/*"
                                    disabled={Boolean(updatingDocId || clientDoc.source === 'static' || clientDoc.publicPath)}
                                    onChange={e => { handleDocReplace(clientDoc, e.target.files?.[0] ?? null); e.target.value = '' }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleDocCopyLink(clientDoc)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition hover:border-[#7c3aed]/40 hover:text-[#7c3aed]"
                                  title="Copiar enlace público"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition hover:border-[#7c3aed]/40 hover:text-[#7c3aed]"
                                  title="Abrir enlace público"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDocDownload(clientDoc)}
                                  disabled={!(clientDoc.publicPath ?? clientDoc.dataUrl)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition hover:border-[#7c3aed]/40 hover:text-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-40"
                                  title="Descargar archivo"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDocDelete(clientDoc)}
                                  disabled={Boolean(deletingDocId || clientDoc.source === 'static')}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                                  title={clientDoc.source === 'static' ? 'Archivo fijo, no se puede eliminar' : 'Eliminar archivo'}
                                >
                                  {deletingDocId === clientDoc.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showContentModal && (
        <ContentModal
          initial={editingContent}
          defaultBrandId={brand.id}
          onClose={() => { setShowContentModal(false); setEditingContent(undefined) }}
        />
      )}
      {showBrandModal && (
        <BrandModal initial={brand} onClose={() => setShowBrandModal(false)} />
      )}

      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] p-6 w-[420px] max-w-[92vw]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#ede9fe] flex items-center justify-center">
                <Share2 size={15} className="text-[#7c3aed]" />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[#111827]">Compartir calendario</div>
                <div className="text-[11px] text-[#9ca3af]">Enlace de solo lectura, actualizado en tiempo real.</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] mb-3">
              <div>
                <div className="text-[13px] font-semibold text-[#111827]">Calendario público</div>
                <div className="text-[11px] text-[#9ca3af]">
                  {brand.calendarShareEnabled ? 'Cualquiera con el enlace puede verlo.' : 'Actívalo para generar el enlace.'}
                </div>
              </div>
              <button
                onClick={handleToggleShare}
                className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${brand.calendarShareEnabled ? 'bg-[#7c3aed]' : 'bg-[#d1d5db]'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${brand.calendarShareEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {brand.calendarShareEnabled && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={e => e.target.select()}
                  className="flex-1 text-[12px] text-[#374151] border border-[#e5e7eb] rounded-xl px-3 py-2 bg-[#f9fafb] truncate"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6] text-white text-[12px] font-semibold px-3 py-2 rounded-xl transition-colors shrink-0"
                >
                  {linkCopied ? <Check size={13} /> : <Copy size={13} />}
                  {linkCopied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}

            {/* Slug del link público */}
            <div className="mt-4 border-t border-[#f3f4f6] pt-4">
              <div className="text-[12px] font-bold text-[#111827] mb-1 flex items-center gap-1.5">
                <Globe size={13} className="text-[#7c3aed]" />
                Slug del enlace
              </div>
              <p className="text-[11px] text-[#9ca3af] mb-2">
                Personaliza el link. Solo letras minúsculas, números y guiones.
              </p>
              {shareSlug ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[11px] text-[#374151] bg-[#ede9fe] border border-[#c4b5fd] rounded-lg px-3 py-1.5 font-mono truncate">
                    /clientes/calendario/<strong>{shareSlug}</strong>
                  </span>
                  <button
                    onClick={() => { setSlugInput(shareSlug); void updateBrand(brand.id, { slug: '' }) }}
                    className="text-[11px] text-[#ef4444] hover:text-[#b91c1c] font-semibold shrink-0"
                  >Quitar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={slugInput}
                    onChange={e => setSlugInput(e.target.value)}
                    placeholder="belcorp"
                    className="flex-1 text-[12px] border border-[#e5e7eb] rounded-lg px-3 py-1.5 outline-none focus:border-[#7c3aed] font-mono"
                  />
                  <button
                    onClick={() => void handleSaveSlug()}
                    disabled={savingSlug || !slugInput.trim()}
                    className="text-[11px] font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] rounded-lg px-3 py-1.5 disabled:opacity-40 shrink-0 flex items-center gap-1"
                  >
                    {savingSlug ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Guardar
                  </button>
                </div>
              )}
            </div>

            {/* Google Sheet vinculado */}
            <div className="mt-4 border-t border-[#f3f4f6] pt-4">
              <div className="text-[12px] font-bold text-[#111827] mb-1 flex items-center gap-1.5">
                <Sheet size={13} className="text-[#16a34a]" />
                Google Sheet vinculado
              </div>
              <p className="text-[11px] text-[#9ca3af] mb-2">
                Pega el ID del Sheet (la parte de la URL entre <code className="bg-[#f3f4f6] px-1 rounded">/d/</code> y <code className="bg-[#f3f4f6] px-1 rounded">/edit</code>).
              </p>
              {brand.sheetId ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[11px] text-[#374151] bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-3 py-1.5 font-mono truncate">{brand.sheetId}</span>
                  <button
                    onClick={() => { setSheetIdInput(brand.sheetId ?? ''); void updateBrand(brand.id, { sheetId: '' }) }}
                    className="text-[11px] text-[#ef4444] hover:text-[#b91c1c] font-semibold shrink-0"
                  >Quitar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={sheetIdInput}
                    onChange={e => setSheetIdInput(e.target.value)}
                    placeholder="1BxiMVs0XRA..."
                    className="flex-1 text-[12px] border border-[#e5e7eb] rounded-lg px-3 py-1.5 outline-none focus:border-[#16a34a] font-mono"
                  />
                  <button
                    onClick={() => void handleSaveSheetId()}
                    disabled={savingSheetId || !sheetIdInput.trim()}
                    className="text-[11px] font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] rounded-lg px-3 py-1.5 disabled:opacity-40 shrink-0 flex items-center gap-1"
                  >
                    {savingSheetId ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Guardar
                  </button>
                </div>
              )}
            </div>

            {/* Equipo visible en el portal del cliente */}
            <div className="mt-4 border-t border-[#f3f4f6] pt-4">
              <div className="text-[12px] font-bold text-[#111827] mb-1 flex items-center gap-1.5">
                <Users size={13} className="text-[#7c3aed]" />
                Equipo en el portal del cliente
              </div>
              <p className="text-[11px] text-[#9ca3af] mb-3">
                Selecciona quiénes aparecen cuando el cliente quiere contactar al equipo.
              </p>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {team.filter(m => m.status === 'active').map(m => {
                  const isSelected = (brand.contacts ?? []).some(c => c.email === m.email)
                  const catColors: Record<string, string> = { Diseño: '#ec4899', Audiovisual: '#f97316', Estrategia: '#6366f1', CM: '#10b981', Agencia: '#0844ef', Otro: '#64748b' }
                  const catColor = catColors[m.category ?? 'Otro'] ?? '#64748b'
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        const current = brand.contacts ?? []
                        const next = isSelected
                          ? current.filter(c => c.email !== m.email)
                          : [...current, { name: m.name, category: m.category ?? 'Otro', email: m.email, ...(m.phone ? { phone: m.phone } : {}) }]
                        void updateBrand(brand.id, { contacts: next })
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all text-left"
                      style={{
                        background:   isSelected ? `${catColor}08` : 'transparent',
                        borderColor:  isSelected ? `${catColor}30` : '#f3f4f6',
                      }}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-black shrink-0"
                        style={{ background: catColor }}>
                        {m.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#111827] truncate">{m.name}</p>
                        <p className="text-[10px]" style={{ color: catColor }}>{m.category ?? 'Otro'}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-[#7c3aed] bg-[#7c3aed]' : 'border-[#d1d5db]'}`}>
                        {isSelected && <Check size={9} className="text-white" />}
                      </div>
                    </button>
                  )
                })}
                {team.filter(m => m.status === 'active').length === 0 && (
                  <p className="text-[11px] text-[#9ca3af] text-center py-3">Sin miembros activos</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full mt-4 text-[12px] font-semibold text-[#6b7280] hover:text-[#111827] transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showMonthPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] p-6 w-[340px] max-w-[92vw]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#ede9fe] flex items-center justify-center">
                <Globe size={15} className="text-[#7c3aed]" />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[#111827]">Seleccionar mes</div>
                <div className="text-[11px] text-[#9ca3af]">Elige el período a incluir en el informe</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
              {availableMonths.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => doExportWebReport(key)}
                  className="flex items-center justify-between text-left px-4 py-2.5 rounded-xl border border-[#e5e7eb] hover:border-[#7c3aed] hover:bg-[#f5f3ff] hover:text-[#7c3aed] text-[#374151] transition-colors group"
                >
                  <span className="text-[13px] font-semibold">{label}</span>
                  <span className="text-[11px] text-[#9ca3af] group-hover:text-[#a78bfa]">{count} contenidos</span>
                </button>
              ))}
              {availableMonths.length > 0 && (
                <div className="border-t border-[#f3f4f6] my-1" />
              )}
              <button
                onClick={() => doExportWebReport(null)}
                className="flex items-center justify-between text-left px-4 py-2.5 rounded-xl border border-[#e5e7eb] hover:bg-[#f9fafb] text-[#6b7280] transition-colors"
              >
                <span className="text-[13px] font-semibold">Todos los contenidos</span>
                <span className="text-[11px] text-[#9ca3af]">{contents.length} totales</span>
              </button>
            </div>

            <button
              onClick={() => setShowMonthPicker(false)}
              className="mt-4 w-full text-[12px] text-[#9ca3af] hover:text-[#374151] transition-colors py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
