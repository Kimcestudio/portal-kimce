import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <Link className="text-sm font-semibold text-indigo-600 hover:text-indigo-700" href="/">
            Kimce App
          </Link>
          <Link className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" href="/login">
            Iniciar sesión
          </Link>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Condiciones del servicio</p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-950">Condiciones del servicio de Kimce App</h1>
        <p className="mt-4 text-sm text-slate-500">Última actualización: 11 de noviembre de 2026</p>

        <div className="mt-8 space-y-8 text-base leading-8 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">1. Aceptación de las condiciones</h2>
            <p className="mt-2">
              Al acceder a Kimce App, el colaborador acepta estas condiciones de uso. El acceso está
              restringido a personas autorizadas por KIMCE Studio. Si no estás autorizado, debes
              abstenerte de usar la aplicación.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">2. Uso permitido</h2>
            <p className="mt-2">
              Kimce App es una herramienta de uso interno para colaboradores de KIMCE Studio. Está
              prohibido compartir credenciales de acceso, extraer datos del portal para fines externos
              o usar la aplicación para actividades no relacionadas con las funciones del colaborador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">3. Vinculación con Google Calendar</h2>
            <p className="mt-2">
              La integración con Google Calendar es voluntaria. Al conectar tu cuenta, autorizas a
              Kimce App a leer, crear y actualizar eventos en tu calendario personal con el único
              propósito de coordinación interna de equipo. Puedes revocar este acceso en cualquier
              momento desde tu configuración de Google o desde el portal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">4. Responsabilidades del colaborador</h2>
            <p className="mt-2">
              El colaborador es responsable de mantener la confidencialidad de sus credenciales de
              acceso y de notificar al administrador de KIMCE ante cualquier uso no autorizado de
              su cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">5. Disponibilidad del servicio</h2>
            <p className="mt-2">
              KIMCE Studio se reserva el derecho de modificar, suspender o dar de baja funcionalidades
              del portal en cualquier momento, con o sin previo aviso, según las necesidades operativas
              del equipo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">6. Privacidad</h2>
            <p className="mt-2">
              El tratamiento de datos personales se rige por la{" "}
              <Link href="/privacy" className="text-indigo-600 underline hover:text-indigo-700">
                Política de privacidad
              </Link>{" "}
              de Kimce App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">7. Contacto</h2>
            <p className="mt-2">
              Para consultas sobre estas condiciones, escribe a{" "}
              <a
                href="mailto:kimcestudio@gmail.com"
                className="text-indigo-600 underline hover:text-indigo-700"
              >
                kimcestudio@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
