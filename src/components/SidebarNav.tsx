import {
  Calendar,
  Home,
  Mail,
  Settings,
  Users,
  FileText,
} from "lucide-react";

const navItems = [
  { icon: Home, label: "Inicio", active: true },
  { icon: FileText, label: "Documentos" },
  { icon: Calendar, label: "Calendario" },
  { icon: Users, label: "Equipo" },
  { icon: Mail, label: "Mensajes" },
  { icon: Settings, label: "Configuración" },
];

export default function SidebarNav() {
  return (
    <div className="flex h-full w-full flex-col items-center rounded-[28px] bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32] px-3 py-6 text-white shadow-card">
      <div className="mb-10 text-sm font-semibold">doc.track</div>
      <div className="flex flex-1 flex-col items-center gap-5">
        {navItems.map(({ icon: Icon, label, active }, index) => (
          <div
            key={`${Icon.displayName ?? "icon"}-${index}`}
            className="group relative flex items-center justify-center"
          >
            <span
              className={`absolute inset-0 rounded-full bg-[#5960dc] opacity-0 blur-md transition duration-200 ${
                active ? "opacity-40 blur-md" : "group-hover:opacity-30"
              }`}
            />
            <span
              className={`absolute inset-1 rounded-full bg-[#4f56d3]/60 opacity-0 transition duration-200 ${
                active ? "opacity-70" : "group-hover:opacity-60"
              }`}
            />
            <div
              className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl transition duration-200 ease-out ${
                active
                  ? "bg-[#4f56d3] text-white shadow-glow"
                  : "bg-transparent text-white/70 group-hover:bg-[#2a3178]"
              } group-hover:scale-110`}
            >
              <Icon size={20} className="transition duration-200 group-hover:text-white" />
            </div>
            <span className="pointer-events-none absolute left-[72px] top-1/2 -translate-y-1/2 translate-x-[-4px] rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#1e2145] opacity-0 shadow-soft transition duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-8 h-12 w-12 rounded-full bg-[url('https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80')] bg-cover bg-center shadow-soft" />
    </div>
  );
}
