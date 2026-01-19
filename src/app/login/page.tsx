"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";

function LoginForm() {
  const { signInUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await signInUser(email, password);
      const redirect = params.get("from");
      if (redirect) {
        router.replace(redirect);
        return;
      }
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/app/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
        <div className="mt-6 space-y-4">
          <label className="text-xs font-semibold text-slate-500">
            Correo
            <input
              className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Contraseña
            <input
              className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
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
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
