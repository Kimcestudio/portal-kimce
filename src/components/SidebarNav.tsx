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

const navItems = [
  { icon: Home, label: "Inicio", href: "/dashboard", active: true },
  { icon: FileText, label: "Documentos", href: "/dashboard" },
  { icon: Calendar, label: "Calendario", href: "/dashboard" },
  { icon: Clock, label: "Horario", href: "/attendance" },
  { icon: Users, label: "Equipo", href: "/dashboard" },
  { icon: Mail, label: "Mensajes", href: "/dashboard" },
  { icon: Settings, label: "Configuración", href: "/dashboard" },
];

export default function SidebarNav() {
  return (
    <aside
      className="
        group shrink-0
        flex h-full w-20 hover:w-56
        flex-col items-center
        overflow-hidden
        rounded-[28px]
        bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32]
        px-3 py-6 text-white
        shadow-card
        transition-all duration-300 ease-out
      "
    >
      {/* Logo */}
      <div className="mb-10 flex w-full items-center justify-center text-sm font-semibold">
        <span className="whitespace-nowrap transition-all duration-300 group-hover:translate-x-1">
          doc.track
        </span>
      </div>

      {/* Nav items */}
      <div className="flex flex-1 w-full flex-col gap-3">
        {navItems.map(({ icon: Icon, label, href, active }, index) => (
          <Link
            key={`${label}-${index}`}
            href={href}
            className={`flex h-12 w-full items-center gap-3 rounded-2xl px-3 transition duration-200 ${
              active ? "bg-white/10" : "hover:bg-white/10"
            }`}
          >
            <div className="relative flex h-11 w-11 items-center justify-center">
              {/* Glow */}
              <span
                className={`absolute inset-0 rounded-full bg-[#5960dc] blur-md transition duration-200 ${
                  active ? "opacity-40" : "opacity-0 group-hover:opacity-30"
                }`}
              />
              <span
                className={`absolute inset-1 rounded-full bg-[#4f56d3]/60 transition duration-200 ${
                  active ? "opacity-60" : "opacity-0 group-hover:opacity-50"
                }`}
              />

              {/* Icon */}
              <div
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition duration-200
                  ${
                    active
                      ? "bg-[#4f56d3] text-white shadow-glow"
                      : "bg-white/5 text-white/70 group-hover:bg-[#2a3178]"
                  }
                  group-hover:scale-110
                `}
              >
                <Icon size={18} className="transition duration-200 group-hover:text-white" />
              </div>
            </div>

            {/* Label (INSIDE sidebar) */}
            <span
              className="
                whitespace-nowrap text-sm font-semibold text-white/90
                opacity-0 -translate-x-2
                transition-all duration-200 ease-out
                group-hover:opacity-100 group-hover:translate-x-0
              "
            >
              {label}
            </span>
          </Link>
        ))}
      </div>

      {/* Avatar */}
      <div className="mt-8 flex w-full items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-[url('https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80')] bg-cover bg-center shadow-soft" />
      </div>
    </aside>
  );
}
