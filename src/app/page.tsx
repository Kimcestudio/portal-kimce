"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(user.role === "admin" ? "/admin/dashboard" : "/dashboard");
  }, [router, user, loading]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Cargando...
    </div>
  );
}
