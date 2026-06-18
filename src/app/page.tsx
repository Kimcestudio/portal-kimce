import Link from "next/link";
import Image from "next/image";
import { CalendarDays, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";

const features = [
  {
    title: "Control de asistencia",
    description: "Registro de fichajes, horas trabajadas, objetivos semanales y solicitudes internas.",
    icon: Clock3,
  },
  {
    title: "Coordinacion del equipo",
    description: "Vista de colaboradores activos, presencia reciente y accesos rapidos para coordinar trabajo.",
    icon: Users,
  },
  {
    title: "Eventos del calendario",
    description: "Cada colaborador puede vincular su propio Google Calendar para ver sus proximos eventos en el dashboard.",
    icon: CalendarDays,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <Image
              src="/brand/logo-horizontal-azul.png"
              alt="Kimce Studio"
              width={170}
              height={38}
              className="h-9 w-auto object-contain"
              priority
            />
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Portal interno para colaboradores KIMCE</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <Link className="text-slate-600 hover:text-indigo-600" href="/privacy">
              Politica de privacidad
            </Link>
            <Link className="rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" href="/login">
              Iniciar sesion
            </Link>
          </nav>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <h2 className="text-4xl font-semibold leading-tight text-slate-950">
            Kimce App ayuda al equipo a gestionar asistencia, solicitudes y eventos de trabajo.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            La aplicacion centraliza informacion operativa para colaboradores autorizados: fichajes,
            horas, permisos, comunicados, estado del equipo y proximas actividades. El acceso al
            calendario de Google es opcional, individual y de solo lectura.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700" href="/login">
              Entrar al portal
            </Link>
            <Link className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600" href="/privacy">
              Ver privacidad
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Uso de Google Calendar</h3>
              <p className="text-sm text-slate-500">Permiso solicitado: lectura de calendario.</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            {[
              "Cada colaborador vincula su propia cuenta si desea ver eventos en el dashboard.",
              "Kimce App no crea, edita ni elimina eventos de Google Calendar.",
              "Los eventos se usan para mostrar proximas actividades dentro del portal.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-14 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
