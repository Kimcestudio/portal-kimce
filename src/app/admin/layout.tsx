"use client";

import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import SidebarCategories from "@/components/navigation/SidebarCategories";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth role="admin">
        <AppShell sidebar={<SidebarCategories />}>{children}</AppShell>
      </RequireAuth>
    </AuthProvider>
  );
}
