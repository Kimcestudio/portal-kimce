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
    <div className="group flex h-full w-20 flex-col items-center overflow-hidden rounded-[28px] bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32] px-3 py-6 text-white shadow-card transition-[width] duration-300 ease-out hover:w-56">
      <div className="mb-10 flex w-full items-center justify-center text-sm font-semibold">
        <span className="whitespace-nowrap transition-all duration-300 group-hover:translate-x-1">
          doc.track
        </span>
      </div>
      <div className="flex flex-1 w-full flex-col gap-3">
        {navItems.map(({ icon: Icon, label, active }, index) => (
          <div
            key={`${Icon.displayName ?? "icon"}-${index}`}
            className={`flex items-center gap-4 rounded-2xl px-3 py-2 transition duration-200 ${
              active ? "bg-white/10" : "hover:bg-white/10"
            }`}
          >
            <div className="relative flex h-11 w-11 items-center justify-center">
              <span
                className={`absolute inset-0 rounded-full bg-[#5960dc] opacity-0 blur-md transition duration-200 ${
                  active ? "opacity-40" : "group-hover:opacity-30"
                }`}
              />
              <span
                className={`absolute inset-1 rounded-full bg-[#4f56d3]/60 opacity-0 transition duration-200 ${
                  active ? "opacity-60" : "group-hover:opacity-50"
                }`}
              />
              <div
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition duration-200 ${
                  active
                    ? "bg-[#4f56d3] text-white shadow-glow"
                    : "bg-white/5 text-white/70 group-hover:bg-[#2a3178]"
                } group-hover:scale-110`}
              >
                <Icon size={18} className="transition duration-200 group-hover:text-white" />
              </div>
            </div>
            <span className="text-sm font-medium text-white/90 opacity-0 translate-x-[-6px] transition duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-8 flex w-full items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-[url('https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80')] bg-cover bg-center shadow-soft" />
      </div>
    </div>
  );
}
