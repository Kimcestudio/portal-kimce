"use client";

import AppShell from "@/components/AppShell";
import SidebarNav from "@/components/SidebarNav";
import PageHeader from "@/components/PageHeader";

export default function ProfilePage() {
  return (
    <AppShell sidebar={<SidebarNav />}>
      <div className="flex flex-col gap-4">
        <PageHeader userName="Colaborador" />
        <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <h2 className="text-base font-semibold text-slate-900">Mi perfil</h2>
          <p className="text-xs text-slate-500">Coming soon.</p>
        </div>
      </div>
    </AppShell>
  );
}
