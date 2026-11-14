"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/auth/RequireAuth";
import SidebarNav from "@/components/SidebarNav";
import SalaAlertProvider from "@/components/SalaAlertProvider";
import { useOptionalAuth } from "@/components/auth/AuthProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useOptionalAuth();
  const router = useRouter();

  // Clientes nunca entran al área /admin — sin importar la subruta
  useEffect(() => {
    if (!auth || auth.loading) return;
    if (auth.profile?.role === "client") {
      router.replace("/clientes/mi-marca");
    }
  }, [auth, router]);

  // /admin/contenidos/* es compartido entre admin y collab
  // El resto del /admin solo es para admins
  const requiredRole = pathname?.startsWith("/admin/contenidos") ? undefined : "admin";

  return (
    <RequireAuth role={requiredRole}>
      <SalaAlertProvider>
        <AppShell sidebar={<SidebarNav />}>{children}</AppShell>
      </SalaAlertProvider>
    </RequireAuth>
  );
}
