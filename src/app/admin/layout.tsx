"use client";

import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import SidebarNav from "@/components/SidebarNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth role="admin">
        <AppShell sidebar={<SidebarNav />}>{children}</AppShell>
      </RequireAuth>
    </AuthProvider>
  );
}
