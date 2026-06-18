import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <Link className="text-sm font-semibold text-indigo-600 hover:text-indigo-700" href="/">
            Kimce App
          </Link>
          <Link className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" href="/login">
            Iniciar sesion
          </Link>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Politica de privacidad</p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-950">Politica de privacidad de Kimce App</h1>
        <p className="mt-4 text-sm text-slate-500">Ultima actualizacion: 23 de abril de 2026</p>

        <div className="mt-8 space-y-8 text-base leading-8 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">Proposito de la aplicacion</h2>
            <p className="mt-2">
              Kimce App es un portal interno para colaboradores autorizados de KIMCE. La aplicacion
              permite gestionar asistencia, horas trabajadas, solicitudes internas, comunicados,
              presencia del equipo y proximas actividades de calendario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Datos que tratamos</h2>
            <p className="mt-2">
              Podemos tratar informacion basica del perfil del colaborador, como nombre, correo,
              cargo, estado de cuenta, registros de asistencia, solicitudes internas y eventos de
              calendario cuando el usuario decide vincular Google Calendar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Uso de Google Calendar</h2>
            <p className="mt-2">
              Si un colaborador vincula su cuenta de Google, Kimce App solicita el permiso
              <span className="font-semibold"> calendar.readonly</span> para leer sus proximos
              eventos y mostrarlos dentro del dashboard. Este acceso es individual y opcional.
            </p>
            <p className="mt-2">
              Kimce App no crea, edita ni elimina eventos de Google Calendar. Tampoco comparte los
              eventos con terceros. Los eventos se usan solamente para mostrar informacion de agenda
              al propio usuario dentro del portal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Almacenamiento y seguridad</h2>
            <p className="mt-2">
              La informacion del portal se almacena en servicios de Firebase/Google Cloud con reglas
              de acceso para usuarios autenticados y administradores autorizados. El token de Google
              Calendar se usa para consultar eventos durante la sesion del navegador y no se publica
              en paginas publicas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Control del usuario</h2>
            <p className="mt-2">
              Cada colaborador decide si vincula su calendario. El usuario puede revocar el acceso
              desde la configuracion de seguridad de su cuenta de Google cuando lo desee.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Contacto</h2>
            <p className="mt-2">
              Para consultas sobre privacidad o tratamiento de datos, contacta al administrador de
              KIMCE mediante el correo configurado como soporte de la aplicacion en Google Cloud.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
