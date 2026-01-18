"use client";

import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import SidebarCategories from "@/components/navigation/SidebarCategories";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth role="collab">
        <AppShell sidebar={<SidebarCategories />}>{children}</AppShell>
      </RequireAuth>
    </AuthProvider>
  );
}
