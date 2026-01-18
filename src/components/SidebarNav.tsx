"use client";

import {
  Calendar,
  Home,
  Mail,
  Settings,
  Users,
  FileText,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: Home, label: "Inicio", href: "/dashboard" },
  { icon: FileText, label: "Documentos", href: "/documents" },
  { icon: Calendar, label: "Calendario", href: "/calendar" },
  { icon: Clock, label: "Horario", href: "/attendance" },
  { icon: Users, label: "Equipo", href: "/team" },
  { icon: Mail, label: "Mensajes", href: "/messages" },
  { icon: Settings, label: "Configuración", href: "/settings" },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="group/sidebar flex h-full w-20 flex-col items-center overflow-hidden rounded-[28px] bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32] px-3 py-6 text-white shadow-card transition-[width] duration-300 ease-out hover:w-56">
      <div className="mb-10 flex w-full items-center justify-center text-sm font-semibold">
        <span className="whitespace-nowrap transition-all duration-300 group-hover/sidebar:translate-x-1">
          doc.track
        </span>
      </div>
      <div className="flex flex-1 w-full flex-col gap-3">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive =
            href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`flex h-12 items-center gap-3 rounded-2xl px-3 transition duration-200 ${
                isActive ? "bg-white/10" : "hover:bg-white/10"
              }`}
            >
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
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-8 flex w-full items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-[url('https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80')] bg-cover bg-center shadow-soft" />
      </div>
    </aside>
  );
}
