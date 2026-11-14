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
            Iniciar sesión
          </Link>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Política de privacidad</p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-950">Política de privacidad de Kimce App</h1>
        <p className="mt-4 text-sm text-slate-500">Última actualización: 11 de noviembre de 2026</p>

        <div className="mt-8 space-y-8 text-base leading-8 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">Propósito de la aplicación</h2>
            <p className="mt-2">
              Kimce App es un portal interno exclusivo para colaboradores autorizados de KIMCE Studio.
              Centraliza la gestión de asistencia, horas trabajadas, solicitudes internas, comunicados
              y calendario de equipo. El acceso está restringido a cuentas previamente aprobadas por
              un administrador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Datos que tratamos</h2>
            <p className="mt-2">
              Tratamos únicamente información necesaria para el funcionamiento del portal:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Nombre, correo electrónico y cargo del colaborador.</li>
              <li>Registros de asistencia y horas trabajadas.</li>
              <li>Solicitudes internas y comunicados.</li>
              <li>Eventos de Google Calendar cuando el colaborador decide vincular su cuenta (opcional).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Uso de Google Calendar</h2>
            <p className="mt-2">
              La vinculación con Google Calendar es completamente opcional. Si un colaborador decide
              conectar su cuenta, Kimce App solicita el permiso{" "}
              <span className="font-semibold">calendar.events</span>, que permite:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Leer los eventos del calendario personal del colaborador para mostrarlos en el portal.</li>
              <li>Crear eventos de equipo directamente en el calendario del colaborador (por ejemplo, reuniones programadas desde el portal).</li>
              <li>Actualizar o cancelar eventos que hayan sido creados desde Kimce App.</li>
            </ul>
            <p className="mt-3">
              Kimce App <span className="font-semibold">no accede</span> a contactos, correos electrónicos,
              archivos de Google Drive ni a ningún otro servicio de Google fuera del calendario. Los
              datos del calendario <span className="font-semibold">no se comparten</span> con terceros
              y se usan exclusivamente para la coordinación interna del equipo KIMCE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Almacenamiento y seguridad</h2>
            <p className="mt-2">
              Los tokens de acceso a Google Calendar se almacenan de forma cifrada en Firebase
              (Google Cloud) bajo reglas de acceso que impiden su lectura por otros colaboradores.
              Cada token es accesible únicamente por el propio usuario y por las funciones del
              servidor autorizadas para operar el calendario en su nombre.
            </p>
            <p className="mt-2">
              Nunca almacenamos contraseñas de Google ni compartimos credenciales con servicios externos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Control del usuario</h2>
            <p className="mt-2">
              El colaborador puede desconectar su Google Calendar en cualquier momento desde la
              sección de configuración del portal. Adicionalmente, puede revocar el acceso directamente
              desde{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-700"
              >
                myaccount.google.com/permissions
              </a>
              . Al revocar el acceso, Kimce App elimina el token almacenado y deja de acceder al calendario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Retención de datos</h2>
            <p className="mt-2">
              Los datos del colaborador se conservan mientras la cuenta esté activa en el portal.
              Al dar de baja una cuenta, el administrador puede solicitar la eliminación completa
              de los datos asociados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Contacto</h2>
            <p className="mt-2">
              Para consultas sobre privacidad o solicitudes de eliminación de datos, escribe a{" "}
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
