"use client";

import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import SidebarNav from "@/components/SidebarNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth role="collab">
        <AppShell sidebar={<SidebarNav />}>{children}</AppShell>
      </RequireAuth>
    </AuthProvider>
  );
}
