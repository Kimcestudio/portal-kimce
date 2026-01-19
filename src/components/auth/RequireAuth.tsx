"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

interface RequireAuthProps {
  children: React.ReactNode;
  role?: "admin" | "collab";
}

export default function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }
    if (role && user.role !== role) {
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/app/dashboard");
    }
  }, [loading, user, role, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Redirigiendo...
      </div>
    );
  }

  if (!user.active) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-slate-700">Acceso deshabilitado</p>
        <p className="text-xs text-slate-500">Tu cuenta está inactiva. Contacta al administrador.</p>
        <button
          className="rounded-full border border-slate-200/60 px-4 py-2 text-xs font-semibold text-slate-600"
          onClick={() => {
            signOutUser();
            router.replace("/login");
          }}
          type="button"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  if (role && user.role !== role) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Redirigiendo...
      </div>
    );
  }

  return <>{children}</>;
}
