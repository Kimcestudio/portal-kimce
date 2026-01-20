"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminManagePage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Gestión</h2>
        <p className="text-xs text-slate-500">Coming soon.</p>
      </div>
    </div>
  );
}
