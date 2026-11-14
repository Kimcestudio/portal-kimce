'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import {
  ArrowRight, Users, BarChart3, Calendar, Globe,
  MessageSquare, Search, Lightbulb, Rocket, TrendingUp,
  Quote, Phone, Mail, Instagram, Youtube, ChevronDown,
  CheckCircle,
} from 'lucide-react'

const GlassSphere = dynamic(() => import('@/components/landing/GlassSphere'), {
  ssr: false,
  loading: () => <div className="w-full h-full rounded-full opacity-10 bg-blue-500 animate-pulse" />,
})

const WA_NUMBER = '51999999999' // ← reemplazar con número real
const WA_MSG = encodeURIComponent('Hola KIMCE, me gustaría agendar una llamada para conocer cómo pueden ayudar a mi marca.')

// ─── Fade-in ─────────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { rootMargin: '-50px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={className}
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: `opacity 0.55s ${delay}s, transform 0.55s ${delay}s` }}>
      {children}
    </div>
  )
}

// ─── Counter animado ──────────────────────────────────────────────────────────
function Counter({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const t0 = Date.now(), dur = 1800
      const tick = () => {
        const p = Math.min((Date.now() - t0) / dur, 1)
        setV(Math.round((1 - Math.pow(1 - p, 3)) * to))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref}>{prefix}{v}{suffix}</span>
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const SERVICIOS = [
  {
    icon: MessageSquare,
    title: 'Gestión de Redes Sociales',
    tagline: 'Tu marca activa, todos los días.',
    desc: 'Sin que tengas que preocuparte. Publicamos, respondemos y hacemos crecer tu comunidad en Instagram, TikTok, LinkedIn y más.',
    color: 'from-blue-500/15 to-blue-600/3',
    border: 'border-blue-500/20',
    icon_color: 'text-blue-400',
    bg_icon: 'bg-blue-500/10',
  },
  {
    icon: Lightbulb,
    title: 'Producción de Contenido',
    tagline: 'Piezas que detienen el scroll.',
    desc: 'Diseño, video y copy que hacen que tu audiencia pare, mire y actúe. Reels, carruseles, historias y campañas completas.',
    color: 'from-purple-500/15 to-purple-600/3',
    border: 'border-purple-500/20',
    icon_color: 'text-purple-400',
    bg_icon: 'bg-purple-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Estrategia de Marca',
    tagline: 'Claridad antes de publicar.',
    desc: 'Definimos quién eres, a quién le hablas y cómo diferenciarte. Sin estrategia, el contenido es ruido.',
    color: 'from-indigo-500/15 to-indigo-600/3',
    border: 'border-indigo-500/20',
    icon_color: 'text-indigo-400',
    bg_icon: 'bg-indigo-500/10',
  },
  {
    icon: BarChart3,
    title: 'Reportes y Resultados',
    tagline: 'Números reales, decisiones mejores.',
    desc: 'Sabes exactamente qué está funcionando. Reportes mensuales con métricas de alcance, conversión y crecimiento.',
    color: 'from-violet-500/15 to-violet-600/3',
    border: 'border-violet-500/20',
    icon_color: 'text-violet-400',
    bg_icon: 'bg-violet-500/10',
  },
]

const STATS = [
  { value: 50, suffix: '+', label: 'Marcas gestionadas' },
  { value: 5000, prefix: '+', label: 'Piezas publicadas' },
  { value: 5, suffix: ' años', label: 'De experiencia' },
  { value: 98, suffix: '%', label: 'Tasa de retención' },
]

const PROCESO = [
  { num: '01', icon: Search,     title: 'Diagnóstico',  desc: 'Auditamos tu marca, tus redes y a tu competencia. Identificamos qué está fallando y qué oportunidades hay.' },
  { num: '02', icon: Lightbulb,  title: 'Estrategia',   desc: 'Construimos un plan editorial basado en datos: qué publicar, cuándo, en qué formato y con qué objetivo.' },
  { num: '03', icon: Rocket,     title: 'Producción',   desc: 'Nuestro equipo crea el contenido. Tú lo apruebas desde tu portal. Sin idas y vueltas por WhatsApp.' },
  { num: '04', icon: TrendingUp, title: 'Crecimiento',  desc: 'Medimos todo, aprendemos de cada publicación y ajustamos la estrategia para escalar lo que funciona.' },
]

const CASOS = [
  {
    brand: 'Fundación Belcorp',
    industry: 'Fundación / Retail',
    country: 'Lima, Perú',
    result_main: '+180%',
    result_label: 'engagement en comunidad',
    time: '4 meses',
    desc: 'Pasaron de publicar sin estrategia a liderar conversaciones sobre emprendimiento femenino en toda la región.',
    tags: ['Instagram', 'LinkedIn', 'Estrategia'],
    color: 'from-rose-500/10 to-rose-600/3',
    border: 'border-rose-500/15',
    dot: 'bg-rose-400',
  },
  {
    brand: 'Comunidad MSL',
    industry: 'Comunidad / Educación',
    country: 'Latinoamérica',
    result_main: '8,000+',
    result_label: 'miembros activos',
    time: '6 meses',
    desc: 'Construimos desde cero una comunidad digital de mujeres emprendedoras con presencia en 5 países.',
    tags: ['TikTok', 'Instagram', 'Comunidad'],
    color: 'from-amber-500/10 to-amber-600/3',
    border: 'border-amber-500/15',
    dot: 'bg-amber-400',
  },
  {
    brand: 'Laboratorios Suiza',
    industry: 'Salud / Farmacéutico',
    country: 'Lima, Perú',
    result_main: '+320%',
    result_label: 'alcance orgánico',
    time: '3 meses',
    desc: 'Transformamos una cuenta estancada en un canal de autoridad médica que educa y genera confianza.',
    tags: ['LinkedIn', 'Facebook', 'Contenido'],
    color: 'from-teal-500/10 to-teal-600/3',
    border: 'border-teal-500/15',
    dot: 'bg-teal-400',
  },
]

const TESTIMONIAL = {
  quote: 'KIMCE no es solo una agencia que publica. Es el equipo que entiende nuestra marca mejor que nadie. Los resultados llegaron desde el primer mes.',
  name: 'Directora de Marketing',
  brand: 'Fundación Belcorp',
  initials: 'MC',
}

const CLIENT_LOGOS = ['Belcorp', 'Comunidad MSL', 'Suiza Lab', 'Vistony', 'Vivendi', 'Aruma']

const NAV_LINKS = [
  { label: 'Servicios', href: '#servicios' },
  { label: 'Proceso', href: '#proceso' },
  { label: 'Casos', href: '#casos' },
  { label: 'Contacto', href: '#contacto' },
]

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="min-h-screen bg-[#030B1A] text-white overflow-x-hidden">

      {/* ── NAV ────────────────────────────────────────────── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#030B1A]/92 backdrop-blur-md border-b border-white/5 shadow-[0_1px_24px_rgba(0,0,0,0.5)]' : ''
      }`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Image src="/brand/logo-horizontal-blanco.png" alt="KIMCE Studio"
              width={130} height={30} className="h-7 w-auto object-contain" priority />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/55">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="hover:text-white transition-colors">{l.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all">
              Portal equipo
            </Link>
            <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
              className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-blue-900/30">
              Agenda llamada gratis
            </a>
            <button className="md:hidden p-2 text-white/60 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
              <div className="space-y-1.5">
                <span className={`block h-0.5 w-5 bg-current transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`block h-0.5 w-5 bg-current transition-all ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-5 bg-current transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-[#030B1A]/98 border-t border-white/5 px-6 py-4 space-y-3">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="block py-2 text-sm font-medium text-white/60 hover:text-white" onClick={() => setMenuOpen(false)}>{l.label}</a>
            ))}
            <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
              className="block mt-2 text-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white">
              Agenda llamada gratis
            </a>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* BG glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/7 blur-[130px]" />
          <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full bg-indigo-600/9 blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.022]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 w-full grid lg:grid-cols-2 gap-8 items-center py-20">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 mb-5"
              style={{ animation: 'fadeSlideUp 0.45s ease both' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              Agencia de Comunicación Digital · Lima, Perú
            </div>

            <h1 className="text-5xl lg:text-[3.6rem] font-bold leading-[1.06] tracking-tight"
              style={{ animation: 'fadeSlideUp 0.55s 0.08s ease both' }}>
              Tu marca merece{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                más que solo publicar.
              </span>
            </h1>

            <p className="mt-5 text-[1.05rem] text-white/50 leading-relaxed max-w-[480px]"
              style={{ animation: 'fadeSlideUp 0.55s 0.15s ease both' }}>
              KIMCE convierte tu comunicación digital en un sistema que atrae, convierte y fideliza — con estrategia, creatividad y resultados medibles desde el primer mes.
            </p>

            <div className="mt-8 flex flex-wrap gap-3"
              style={{ animation: 'fadeSlideUp 0.55s 0.22s ease both' }}>
              <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-blue-900/30">
                Agenda llamada gratis
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#casos"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all">
                Ver casos reales
              </a>
            </div>

            {/* Trust — logos inline */}
            <div className="mt-10" style={{ animation: 'fadeIn 0.6s 0.35s ease both' }}>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-white/25 uppercase mb-3">Marcas que confían en KIMCE</p>
              <div className="flex flex-wrap gap-3">
                {CLIENT_LOGOS.map(b => (
                  <span key={b}
                    className="rounded-full border border-white/8 bg-white/4 px-3.5 py-1 text-xs font-medium text-white/40">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Sphere */}
          <div className="relative h-[440px] lg:h-[560px]"
            style={{ animation: 'fadeScaleUp 1.1s 0.1s ease both' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-72 h-72 rounded-full bg-blue-600/12 blur-[70px]" />
            </div>
            <GlassSphere />
          </div>
        </div>

        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/25 text-[11px]">
          <span>Scroll</span>
          <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.025] py-10">
        <div className="mx-auto max-w-5xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.07} className="text-center">
              <p className="text-[2.4rem] font-bold leading-none bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} />
              </p>
              <p className="mt-1.5 text-xs text-white/40">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── PROCESO ────────────────────────────────────────── */}
      <section id="proceso" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="text-center mb-16">
            <p className="text-[11px] font-bold tracking-[0.22em] text-blue-400 uppercase mb-3">Cómo trabajamos</p>
            <h2 className="text-4xl font-bold tracking-tight">
              Sin caos, sin improviso.{' '}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Con un método.
              </span>
            </h2>
            <p className="mt-4 text-white/45 max-w-md mx-auto text-[0.95rem] leading-relaxed">
              Cada marca pasa por el mismo proceso. Así garantizamos que los resultados sean consistentes y escalables.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {PROCESO.map((p, i) => {
              const Icon = p.icon
              return (
                <FadeIn key={p.num} delay={i * 0.1}>
                  <div className="relative rounded-2xl border border-white/7 bg-white/3 p-6 h-full hover:border-white/15 transition-all">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="text-[11px] font-bold text-white/20 mt-2.5 tracking-widest">{p.num}</span>
                    </div>
                    <h3 className="font-bold text-white mb-2">{p.title}</h3>
                    <p className="text-[0.82rem] text-white/45 leading-relaxed">{p.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SERVICIOS ──────────────────────────────────────── */}
      <section id="servicios" className="py-24 px-6 bg-white/[0.018]">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.22em] text-indigo-400 uppercase mb-3">Qué hacemos</p>
            <h2 className="text-4xl font-bold tracking-tight">
              Todo lo que tu marca necesita,{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                en un solo equipo.
              </span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICIOS.map((s, i) => {
              const Icon = s.icon
              return (
                <FadeIn key={s.title} delay={i * 0.09}>
                  <div className={`relative h-full rounded-2xl border ${s.border} bg-gradient-to-b ${s.color} p-6 hover:border-white/20 transition-all group cursor-default`}>
                    <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.bg_icon} ${s.icon_color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${s.icon_color} mb-1.5`}>{s.tagline}</p>
                    <h3 className="font-bold text-white mb-2.5 text-[0.95rem]">{s.title}</h3>
                    <p className="text-[0.82rem] text-white/45 leading-relaxed">{s.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CASOS ──────────────────────────────────────────── */}
      <section id="casos" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.22em] text-violet-400 uppercase mb-3">Casos reales</p>
            <h2 className="text-4xl font-bold tracking-tight">
              Resultados que{' '}
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                se pueden medir.
              </span>
            </h2>
            <p className="mt-4 text-white/45 max-w-md mx-auto text-[0.95rem]">
              No prometemos. Mostramos. Estos son algunos de los resultados que hemos logrado con nuestros clientes.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {CASOS.map((c, i) => (
              <FadeIn key={c.brand} delay={i * 0.1}>
                <div className={`relative h-full rounded-3xl border ${c.border} bg-gradient-to-b ${c.color} p-7 flex flex-col`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-white text-lg leading-tight">{c.brand}</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">{c.industry} · {c.country}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {c.tags.map(t => (
                        <span key={t} className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40">{t}</span>
                      ))}
                    </div>
                  </div>

                  {/* Resultado principal */}
                  <div className="mb-4 rounded-2xl border border-white/8 bg-white/5 px-5 py-4">
                    <p className={`text-4xl font-black`}>{c.result_main}</p>
                    <p className="text-[11px] text-white/45 mt-0.5">{c.result_label}</p>
                    <p className="text-[11px] text-white/25 mt-1">en {c.time}</p>
                  </div>

                  {/* Descripción */}
                  <p className="text-[0.83rem] text-white/50 leading-relaxed flex-1">{c.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* CTA bajo casos */}
          <FadeIn delay={0.1} className="text-center mt-12">
            <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3.5 text-sm font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-blue-900/30">
              Quiero resultados así para mi marca
              <ArrowRight className="h-4 w-4" />
            </a>
          </FadeIn>
        </div>
      </section>

      {/* ── TESTIMONIAL ────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white/[0.018]">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <div className="relative rounded-3xl border border-white/8 bg-gradient-to-br from-white/5 to-white/[0.02] p-10 text-center">
              <Quote className="h-8 w-8 text-blue-500/40 mx-auto mb-6" />
              <p className="text-xl text-white/80 leading-relaxed font-light italic max-w-xl mx-auto">
                &ldquo;{TESTIMONIAL.quote}&rdquo;
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-sm font-bold">
                  {TESTIMONIAL.initials}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{TESTIMONIAL.name}</p>
                  <p className="text-xs text-white/40">{TESTIMONIAL.brand}</p>
                </div>
              </div>

              {/* Stars */}
              <div className="flex justify-center gap-1 mt-5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── PORTAL ACCESS ──────────────────────────────────── */}
      <section id="acceso" className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <FadeIn className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.22em] text-blue-400 uppercase mb-3">Portal</p>
            <h2 className="text-4xl font-bold tracking-tight">
              Un portal para{' '}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                cada tipo de acceso.
              </span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6">
            <FadeIn delay={0.05}>
              <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-b from-blue-600/10 to-blue-600/3 p-8">
                <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-blue-600/8 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400 mb-5">
                    <Users className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Equipo KIMCE</h3>
                  <p className="text-white/45 text-sm leading-relaxed mb-6">Para colaboradores. Gestión de contenidos, clientes, tareas y asistencia en un solo lugar.</p>
                  <div className="space-y-1.5 mb-7">
                    {['Gestión de contenidos', 'Coordinación de equipo', 'Solicitudes y permisos'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                  <Link href="/login"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 transition-all">
                    Acceder <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-b from-violet-600/10 to-violet-600/3 p-8">
                <div className="absolute -top-16 -left-16 w-52 h-52 rounded-full bg-violet-600/8 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400 mb-5">
                    <Globe className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Portal Cliente</h3>
                  <p className="text-white/45 text-sm leading-relaxed mb-6">Para marcas. Revisa tu calendario, aprueba contenido y envía solicitudes directamente.</p>
                  <div className="space-y-1.5 mb-7">
                    {['Calendario de contenidos', 'Aprobación de piezas', 'Solicitudes en tiempo real'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                  <Link href="/clientes/mi-marca"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 transition-all">
                    Mi portal <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── CONTACTO ───────────────────────────────────────── */}
      <section id="contacto" className="py-24 px-6 bg-white/[0.018]">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="text-[11px] font-bold tracking-[0.22em] text-blue-400 uppercase mb-3">Hablemos</p>
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              ¿Tu marca está lista para{' '}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                el siguiente nivel?
              </span>
            </h2>
            <p className="text-white/45 max-w-sm mx-auto mb-10 text-[0.95rem] leading-relaxed">
              Agenda una llamada de 30 minutos. Sin compromiso. Te contamos cómo podemos hacer crecer tu marca.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-base font-bold text-white hover:brightness-110 transition-all shadow-xl shadow-blue-900/30 mb-8">
              Agenda tu llamada gratis
              <ArrowRight className="h-5 w-5" />
            </a>

            <div className="flex items-center justify-center gap-4 mt-3">
              <a href="mailto:hola@kimcestudio.com"
                className="flex items-center gap-2 text-sm text-white/35 hover:text-white/70 transition-colors">
                <Mail className="h-4 w-4" /> hola@kimcestudio.com
              </a>
              <span className="text-white/15">·</span>
              <div className="flex items-center gap-3 text-white/30">
                <a href="https://instagram.com/kimcestudio" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors"><Instagram className="h-4 w-4" /></a>
                <a href="https://youtube.com/@kimcestudio" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors"><Youtube className="h-4 w-4" /></a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/">
            <Image src="/brand/logo-horizontal-blanco.png" alt="KIMCE Studio"
              width={100} height={24} className="h-5 w-auto object-contain opacity-40 hover:opacity-80 transition-opacity" />
          </Link>
          <nav className="flex flex-wrap justify-center gap-6 text-[11px] text-white/30 font-medium">
            {NAV_LINKS.map(l => <a key={l.label} href={l.href} className="hover:text-white/60 transition-colors">{l.label}</a>)}
            <Link href="/login" className="hover:text-white/60 transition-colors">Portal equipo</Link>
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacidad</Link>
          </nav>
          <p className="text-[11px] text-white/20">© {new Date().getFullYear()} KIMCE Studio</p>
        </div>
      </footer>

      {/* ── WHATSAPP FLOTANTE ──────────────────────────────── */}
      <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-green-900/40 hover:bg-[#1ebe5a] transition-all hover:scale-105 group">
        <svg className="h-5 w-5 fill-current flex-shrink-0" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        <span className="hidden sm:block">Agenda llamada gratis</span>
        <Phone className="sm:hidden h-4 w-4" />
      </a>

    </div>
  )
}
