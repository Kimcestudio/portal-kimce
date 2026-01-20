"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/auth/RequireAuth";
import SidebarNav from "@/components/SidebarNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="admin">
      <AppShell sidebar={<SidebarNav />}>{children}</AppShell>
    </RequireAuth>
  );
}
