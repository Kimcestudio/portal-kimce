"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";

function LoginForm() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(params.get("from"));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithEmail(email, password);
      if (redirectTo) {
        router.replace(redirectTo);
        return;
      }
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (redirectTo) {
        router.replace(redirectTo);
        return;
      }
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7ff] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_12px_32px_rgba(17,24,39,0.12)]"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ingresa con tu correo y contraseña para continuar.
        </p>
        <p className="mt-2 rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          El administrador debe aprobar tu acceso antes de ingresar.
        </p>
        <div className="mt-6 space-y-4">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.7 2.2 12 2.2 6.9 2.2 2.7 6.5 2.7 12s4.2 9.8 9.3 9.8c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
              </svg>
            </span>
            {googleLoading ? "Conectando..." : "Continuar con Google"}
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200/80" />
            o con correo
            <span className="h-px flex-1 bg-slate-200/80" />
          </div>
          <label className="text-xs font-semibold text-slate-500" htmlFor="login-email">
            Correo
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="text-xs font-semibold text-slate-500" htmlFor="login-password">
            Contraseña
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(79,70,229,0.3)]"
            type="submit"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
