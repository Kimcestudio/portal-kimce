"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "@/components/auth/AuthProvider";

function CallbackContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage("Acceso denegado. Puedes intentarlo de nuevo desde tu perfil.");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No se recibió el código de autorización de Google.");
      return;
    }

    const fns = getFunctions(undefined, "us-central1");
    const exchange = httpsCallable<{ code: string; state: string | null }, { success: boolean; email: string }>(
      fns,
      "gcalOAuthExchangeCode",
    );

    exchange({ code, state })
      .then((result) => {
        setStatus("success");
        setMessage(`Calendario conectado como ${result.data.email}`);
        setTimeout(() => router.replace("/app/calendar"), 2500);
      })
      .catch((err: { message?: string }) => {
        setStatus("error");
        setMessage(err.message ?? "No se pudo conectar el calendario. Intenta de nuevo.");
      });
  }, [user, loading, searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_8px_32px_rgba(17,24,39,0.10)] text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
            <p className="text-sm font-medium text-slate-600">Conectando tu Google Calendar…</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-900">Calendario conectado</p>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
            <p className="mt-3 text-xs text-slate-400">Redirigiendo al calendario…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-900">Error al conectar</p>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
            <button
              type="button"
              onClick={() => router.replace("/app/calendar")}
              className="mt-5 w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Volver al calendario
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GcalCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
