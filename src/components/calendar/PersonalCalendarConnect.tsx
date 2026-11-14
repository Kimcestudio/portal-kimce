"use client";

import { useEffect, useState } from "react";
import { Calendar, ExternalLink, Link2Off, Loader2, RefreshCw } from "lucide-react";
import { disconnectOAuth, getOAuthStatus, getOAuthUrl, type GCalOAuthStatus } from "@/services/googleCalendarOAuth";
import { getStoredSession } from "@/services/firebase/auth";

interface Props {
  onConnected?: () => void;
  onDisconnected?: () => void;
  compact?: boolean;
}

export default function PersonalCalendarConnect({ onConnected, onDisconnected, compact = false }: Props) {
  const [status, setStatus] = useState<GCalOAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOAuthStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const session = getStoredSession();
      const url = await getOAuthUrl({ loginHint: session?.email ?? undefined });
      window.location.href = url;
    } catch (err) {
      setError((err as { message?: string })?.message ?? "No se pudo iniciar la conexión.");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectOAuth();
      setStatus({ connected: false });
      onDisconnected?.();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "No se pudo desconectar el calendario.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        Verificando calendario…
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {status?.connected ? (
          <>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Calendar size={11} />
              {status.email}
            </span>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-rose-200 hover:text-rose-500 disabled:opacity-50"
              title="Desconectar calendario"
            >
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Link2Off size={12} />}
            </button>
            <button
              type="button"
              onClick={() => { onConnected?.(); }}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-sky-500"
              title="Refrescar eventos"
            >
              <RefreshCw size={12} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200 disabled:opacity-50"
          >
            {connecting ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
            {connecting ? "Redirigiendo…" : "Conectar mi calendario"}
          </button>
        )}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-sky-500" />
            <h3 className="text-sm font-semibold text-slate-900">Mi Google Calendar</h3>
            {status?.connected ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Conectado</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Sin conectar</span>
            )}
          </div>
          {status?.connected ? (
            <p className="mt-0.5 text-xs text-slate-500">{status.email} · Tus eventos personales aparecen solo a ti.</p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              Conecta tu Google Calendar para ver tus eventos personales en el portal y recibir invitaciones de equipo.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status?.connected ? (
            <>
              <button
                type="button"
                onClick={() => onConnected?.()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={12} />
                Actualizar
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Link2Off size={12} />}
                Desconectar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {connecting ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              {connecting ? "Redirigiendo a Google…" : "Conectar mi Google Calendar"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      )}
    </div>
  );
}
