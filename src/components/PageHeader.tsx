"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useOptionalAuth } from "@/components/auth/AuthProvider";

const sectionLabels: Record<string, string> = {
  "/dashboard": "Inicio",
  "/attendance": "Horario",
  "/calendar": "Calendario",
  "/team": "Equipo",
  "/messages": "Mensajes",
  "/settings": "Configuración",
};

interface PageHeaderProps {
  userName?: string;
  rightSlot?: ReactNode;
}

function resolveSection(pathname: string) {
  const exact = sectionLabels[pathname];
  if (exact) return exact;
  const match = Object.keys(sectionLabels).find((key) =>
    key !== "/" ? pathname.startsWith(`${key}/`) : pathname === key
  );
  return match ? sectionLabels[match] : "Inicio";
}

export default function PageHeader({ userName, rightSlot }: PageHeaderProps) {
  const pathname = usePathname();
  const section = resolveSection(pathname);
  const auth = useOptionalAuth();
  const profile = auth?.profile ?? auth?.user;
  const authUser = auth?.authUser ?? null;
  const resolvedName = profile?.displayName ?? authUser?.email ?? userName ?? "Usuario";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Hola, {resolvedName} 👋</h1>
        <p className="text-sm text-muted">Este es tu portal de {section}.</p>
      </div>
      {rightSlot ?? null}
    </div>
  );
}
