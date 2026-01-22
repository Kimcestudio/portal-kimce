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

  if (process.env.NODE_ENV !== "production") {
    console.log("[auth] access guard", { uid: user.uid, user });
  }

  const approved = user.approved ?? true;
  const isActive = user.isActive ?? true;

  if (approved !== true) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-slate-700">Tu acceso aún no está habilitado</p>
        <p className="text-xs text-slate-500">Tu acceso está pendiente de aprobación.</p>
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

  if (isActive === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-slate-700">Tu cuenta está desactivada</p>
        <p className="text-xs text-slate-500">Contacta al administrador para reactivar tu cuenta.</p>
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
