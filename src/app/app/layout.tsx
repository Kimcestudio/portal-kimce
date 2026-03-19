"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/auth/RequireAuth";
import SidebarNav from "@/components/SidebarNav";
import AnnouncementPresenter from "@/components/announcements/AnnouncementPresenter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="collab">
      <AppShell sidebar={<SidebarNav />}>
        {children}
        <AnnouncementPresenter />
      </AppShell>
    </RequireAuth>
  );
}
