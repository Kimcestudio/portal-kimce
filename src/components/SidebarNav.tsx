"use client";

import {
  Calendar,
  Home,
  Mail,
  Users,
  FileText,
  Clock,
  Shield,
  Wallet,
  BarChart3,
  LogOut,
  User,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useRole from "@/components/auth/useRole";
import { useOptionalAuth } from "@/components/auth/AuthProvider";
import { readFileAsDataUrl } from "@/services/firebase/media";

type NavItem = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  href: string;
  action?: () => void;
};

const collaboratorGeneralItems: NavItem[] = [
  { icon: Home, label: "Inicio", href: "/app/dashboard" },
  { icon: Clock, label: "Horario", href: "/app/overview" },
  { icon: Calendar, label: "Calendario", href: "/app/calendar" },
  { icon: FileText, label: "Documentos", href: "/app/documents" },
];

const collaboratorProfileItems: NavItem[] = [
  { icon: User, label: "Mi perfil", href: "/app/profile" },
  { icon: ClipboardList, label: "Historial", href: "/app/history" },
];

const adminGeneralItems: NavItem[] = [
  { icon: Home, label: "Inicio Admin", href: "/admin/dashboard" },
  { icon: Clock, label: "Horario", href: "/admin/hours" },
  { icon: Calendar, label: "Calendario", href: "/admin/calendar" },
  { icon: FileText, label: "Documentos", href: "/admin/documents" },
];

const adminItems: NavItem[] = [
  { icon: Mail, label: "Solicitudes", href: "/admin/requests" },
  { icon: Users, label: "Usuarios y Roles", href: "/admin/users" },
  { icon: Wallet, label: "Finanzas", href: "/admin/finance" },
];

const adminProfileItems: NavItem[] = [
  { icon: User, label: "Mi perfil", href: "/admin/profile" },
];

function renderNavItem(item: NavItem, isActive: boolean, key: string) {
  const Icon = item.icon;
  const content = (
    <>
      {isActive ? <span className="absolute left-0 top-2 h-8 w-1 rounded-full bg-white/80" /> : null}
      <div className="relative flex h-11 w-11 items-center justify-center">
        <span
          className={`absolute inset-0 rounded-full bg-[#5960dc] opacity-0 blur-md transition duration-200 ${
            isActive ? "opacity-40" : "group-hover/sidebar:opacity-30"
          }`}
        />
        <span
          className={`absolute inset-1 rounded-full bg-[#4f56d3]/60 opacity-0 transition duration-200 ${
            isActive ? "opacity-60" : "group-hover/sidebar:opacity-50"
          }`}
        />
        <div
          className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition duration-200 ${
            isActive
              ? "bg-[#4f56d3] text-white shadow-glow"
              : "bg-white/5 text-white/70 group-hover/sidebar:bg-[#2a3178]"
          } group-hover/sidebar:scale-110`}
        >
          <Icon size={18} className="transition duration-200 group-hover/sidebar:text-white" />
        </div>
      </div>
      <span className="whitespace-nowrap text-sm font-semibold text-white/90 opacity-0 -translate-x-2 transition-all duration-200 ease-out group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100">
        {item.label}
      </span>
    </>
  );

  if (item.action) {
    return (
      <button
        key={key}
        type="button"
        onClick={item.action}
        className="relative flex h-12 items-center gap-3 rounded-2xl px-3 text-left text-white/75 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:text-white hover:shadow-[0_8px_18px_rgba(15,23,42,0.25)]"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      key={key}
      href={item.href}
      className={`relative flex h-12 items-center gap-3 rounded-2xl px-3 transition duration-200 ease-out ${
        isActive ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
      } hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.25)]`}
    >
      {content}
    </Link>
  );
}

function Section({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="space-y-3">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</p>
      <div className="flex w-full flex-col gap-3">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return renderNavItem(item, isActive, item.href);
        })}
      </div>
    </div>
  );
}

export default function SidebarNav() {
  const role = useRole();
  const auth = useOptionalAuth();
  const signOutUser = auth?.signOutUser;
  const updateUser = auth?.updateUser;
  const user = auth?.user;

  const profileItems =
    role === "ADMIN"
      ? adminProfileItems
      : collaboratorProfileItems;

  const generalItems =
    role === "ADMIN" ? adminGeneralItems : collaboratorGeneralItems;

  return (
    <aside className="group/sidebar flex h-full w-20 shrink-0 flex-col items-center overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32] px-3 py-6 text-white shadow-[0_16px_36px_rgba(15,23,42,0.35)] transition-[width] duration-300 ease-out hover:w-56">
      <div className="mb-10 flex w-full items-center justify-center text-sm font-semibold">
        <span className="whitespace-nowrap transition-all duration-300 group-hover/sidebar:translate-x-1">
          doc.track
        </span>
      </div>
      <div className="flex w-full flex-1 flex-col gap-4">
        <Section title="GENERAL" items={generalItems} />
        {role === "ADMIN" ? (
          <div className="space-y-3 pt-2">
            <div className="mx-3 h-px bg-white/10" />
            <Section title="ADMIN" items={adminItems} />
          </div>
        ) : null}
        <div className="space-y-3 pt-2">
          <div className="mx-3 h-px bg-white/10" />
          <Section title="PROFILE" items={profileItems} />
          {signOutUser
            ? renderNavItem(
                {
                  icon: LogOut,
                  label: "Cerrar sesión",
                  href: "#",
                  action: signOutUser,
                },
                false,
                "logout"
              )
            : null}
        </div>
      </div>
      <div className="mt-8 flex w-full items-center justify-center">
        <div className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3">
          <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-white/20">
            <input
              className="absolute inset-0 opacity-0"
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file || !updateUser) return;
                try {
                  const dataUrl = await readFileAsDataUrl(file);
                  updateUser({ photoURL: dataUrl });
                } catch {
                  // ignore upload errors for now
                }
              }}
            />
            <img
              src={user?.photoURL ?? "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80"}
              alt={user?.displayName ?? "Usuario"}
              className="h-full w-full object-cover"
            />
          </label>
          <div className="flex flex-1 flex-col">
            <p className="text-sm font-semibold text-white">
              {user?.displayName ?? "Colaborador"}
            </p>
            <p className="text-xs text-white/60">{user?.position ?? "Puesto"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
