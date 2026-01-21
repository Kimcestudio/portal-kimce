"use client";

import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { readFileAsDataUrl } from "@/services/firebase/media";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
}

const collabGeneral: NavItem[] = [
  { label: "Overview", href: "/app/overview", icon: LayoutDashboard },
];

const collabProfile: NavItem[] = [
  { label: "Mi perfil", href: "/app/profile", icon: User },
  { label: "Historial", href: "/app/history", icon: Calendar },
];

const adminGeneral: NavItem[] = [
  { label: "Overview", href: "/admin/overview", icon: LayoutDashboard },
];

const adminSection: NavItem[] = [
  { label: "Horarios", href: "/admin/hours", icon: ClipboardList },
  { label: "Solicitudes", href: "/admin/requests", icon: ShieldCheck },
  { label: "Usuarios & Roles", href: "/admin/users", icon: Users },
  { label: "Finanzas", href: "/admin/finance", icon: Wallet },
];

const adminProfile: NavItem[] = [{ label: "Mi perfil", href: "/admin/profile", icon: User }];

function Section({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition duration-200 ease-out ${
                isActive
                  ? "bg-white/15 text-white shadow-[0_8px_20px_rgba(15,23,42,0.25)]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {isActive ? (
                <span className="absolute left-0 h-5 w-1 rounded-full bg-white" />
              ) : null}
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function SidebarCategories() {
  const { user, signOutUser, updateUser } = useAuth();

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await readFileAsDataUrl(file);
      updateUser({ photoURL: result });
    } catch {
      // ignore upload errors for now
    }
  };

  if (!user) return null;

  const general = user.role === "admin" ? adminGeneral : collabGeneral;
  const admin = user.role === "admin" ? adminSection : [];
  const profile = user.role === "admin" ? adminProfile : collabProfile;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col rounded-[28px] border border-white/10 bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32] p-5 text-white shadow-[0_16px_36px_rgba(15,23,42,0.35)]">
      <div className="mb-8 text-lg font-semibold text-white">doc.track</div>
      <div className="flex flex-1 flex-col gap-6">
        <Section title="GENERAL" items={general} />
        {admin.length > 0 ? <Section title="ADMIN" items={admin} /> : null}
        <Section title="PROFILE" items={profile} />
      </div>
      <div className="mt-6 rounded-2xl bg-white/10 p-3">
        <div className="flex items-center gap-3">
          <label className="relative h-12 w-12 cursor-pointer overflow-hidden rounded-full border border-white/20">
            <input
              id="sidebar-avatar-input"
              className="absolute inset-0 opacity-0"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
            />
            <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
          </label>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{user.displayName}</p>
            <p className="text-xs text-white/60">{user.position}</p>
          </div>
        </div>
        <button
          className="mt-3 w-full rounded-lg border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          type="button"
          onClick={() => {
            const input = document.getElementById("sidebar-avatar-input") as HTMLInputElement | null;
            input?.click();
          }}
        >
          Cambiar foto
        </button>
        <button
          className="mt-3 flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white"
          onClick={signOutUser}
          type="button"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
