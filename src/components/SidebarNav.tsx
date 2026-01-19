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
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  href: string;
  action?: () => void;
};

const collaboratorNavItems: NavItem[] = [
  { icon: Home, label: "Inicio", href: "/dashboard" },
  { icon: Clock, label: "Horario", href: "/attendance" },
  { icon: Calendar, label: "Calendario", href: "/calendar" },
  { icon: FileText, label: "Documentos", href: "/documents" },
  { icon: Users, label: "Equipo", href: "/team" },
];

const adminNavItems: NavItem[] = [
  { icon: Home, label: "Inicio Admin", href: "/admin" },
  { icon: Mail, label: "Solicitudes", href: "/admin/requests" },
  { icon: Users, label: "Usuarios y Roles", href: "/admin/users" },
  { icon: Wallet, label: "Finanzas", href: "/admin/finance" },
  { icon: BarChart3, label: "Reportes", href: "/admin/reports" },
];

function renderNavItem(item: NavItem, isActive: boolean, key: string, showLabel: boolean) {
  const Icon = item.icon;
  const layoutClass = showLabel ? "gap-3 px-3" : "justify-center px-0";
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
      {showLabel ? (
        <span className="whitespace-nowrap text-sm font-semibold text-white/90 opacity-0 -translate-x-2 transition-all duration-200 ease-out group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100">
          {item.label}
        </span>
      ) : null}
    </>
  );

  if (item.action) {
    return (
      <button
        key={key}
        type="button"
        onClick={item.action}
        className={`relative flex h-12 items-center rounded-2xl text-left text-white/75 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:text-white hover:shadow-[0_8px_18px_rgba(15,23,42,0.25)] ${layoutClass}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      key={key}
      href={item.href}
      className={`relative flex h-12 items-center rounded-2xl transition duration-200 ease-out ${
        isActive ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
      } hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.25)] ${layoutClass}`}
    >
      {content}
    </Link>
  );
}

function Section({ title, items, showLabel }: { title: string; items: NavItem[]; showLabel: boolean }) {
  const pathname = usePathname();
  const isActiveItem = (item: NavItem) => {
    const aliases: Record<string, string[]> = {
      "/dashboard": ["/app/dashboard"],
      "/attendance": ["/app/overview"],
      "/calendar": ["/app/calendar"],
      "/documents": ["/app/documents"],
      "/team": ["/app/team"],
      "/profile": ["/app/profile"],
      "/admin": ["/admin/dashboard"],
    };
    const extraMatches = aliases[item.href] ?? [];
    if (extraMatches.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))) {
      return true;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };
  return (
    <div className="space-y-3">
      {showLabel ? (
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</p>
      ) : null}
      <div className={`flex w-full flex-col gap-3 ${showLabel ? "" : "items-center"}`}>
        {items.map((item) => {
          const isActive = isActiveItem(item);
          return renderNavItem(item, isActive, item.href, showLabel);
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
  const [view, setView] = useState<"collaborator" | "admin">(() => {
    if (typeof window === "undefined") return "collaborator";
    const stored = window.localStorage.getItem("sidebar_view");
    return stored === "admin" ? "admin" : "collaborator";
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (role !== "ADMIN") {
      setView("collaborator");
    }
  }, [role]);

  useEffect(() => {
    if (role !== "ADMIN") return;
    window.localStorage.setItem("sidebar_view", view);
  }, [role, view]);

  const visibleNavItems = useMemo(() => {
    if (role === "ADMIN" && view === "admin") return adminNavItems;
    return collaboratorNavItems;
  }, [role, view]);

  return (
    <aside
      className="group/sidebar flex h-dvh min-h-dvh w-20 shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32] px-3 text-white shadow-[0_16px_36px_rgba(15,23,42,0.35)] transition-all duration-300 ease-out hover:w-72"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <header className="flex h-24 w-full flex-col justify-between pb-4 pt-6">
        <span className="whitespace-nowrap transition-all duration-300 group-hover/sidebar:translate-x-1">
          doc.track
        </span>
        {role === "ADMIN" ? (
          <div className="h-10">
            <div
              className={`w-full rounded-full bg-white/10 p-1 transition duration-200 ${
                isExpanded
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                <button
                  type="button"
                  onClick={() => setView("collaborator")}
                  className={`flex-1 rounded-full px-3 py-1 transition duration-200 ${
                    view === "collaborator"
                      ? "bg-[#4f56d3] text-white shadow-glow"
                      : "hover:bg-white/10"
                  }`}
                >
                  Colaborador
                </button>
                <button
                  type="button"
                  onClick={() => setView("admin")}
                  className={`flex-1 rounded-full px-3 py-1 transition duration-200 ${
                    view === "admin" ? "bg-[#4f56d3] text-white shadow-glow" : "hover:bg-white/10"
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </header>
      <nav
        className={`flex w-full flex-1 min-h-0 flex-col gap-4 py-2 pr-1 transition-transform duration-200 ${
          isExpanded ? "overflow-y-auto no-scrollbar" : "overflow-y-hidden"
        } ${isExpanded ? "translate-y-0" : "translate-y-1"}`}
      >
        <Section title="GENERAL" items={visibleNavItems} showLabel={isExpanded} />
      </nav>
      <footer className="mt-auto shrink-0 px-3 pb-4 pt-4">
        <div className="space-y-3">
          <div className="mx-3 h-px bg-white/10" />
          <Section
            title="PROFILE"
            items={[{ icon: User, label: "Mi perfil", href: "/profile" }]}
            showLabel={isExpanded}
          />
          {signOutUser
            ? renderNavItem(
                {
                  icon: LogOut,
                  label: "Cerrar sesión",
                  href: "#",
                  action: signOutUser,
                },
                false,
                "logout",
                isExpanded
              )
            : null}
        </div>
        {isExpanded ? (
          <div className="mt-3 flex w-full min-w-0 items-center gap-3 rounded-2xl bg-white/10 p-3">
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
                src={
                  user?.photoURL ??
                  "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80"
                }
                alt={user?.displayName ?? "Usuario"}
                className="h-full w-full object-cover"
              />
            </label>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-sm font-semibold text-white">
                {user?.displayName ?? "Colaborador"}
              </p>
              <p className="truncate text-xs text-white/60">{user?.position ?? "Puesto"}</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex w-full items-center justify-center">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/20">
              <img
                src={
                  user?.photoURL ??
                  "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80"
                }
                alt={user?.displayName ?? "Usuario"}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
      </footer>
    </aside>
  );
}
