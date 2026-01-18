import {
  Calendar,
  Home,
  Mail,
  Settings,
  Users,
  FileText,
} from "lucide-react";

const navItems = [
  { icon: Home, active: true },
  { icon: FileText },
  { icon: Calendar },
  { icon: Users },
  { icon: Mail },
  { icon: Settings },
];

export default function SidebarNav() {
  return (
    <div className="flex h-full w-full flex-col items-center rounded-[28px] bg-gradient-to-b from-[#10164f] via-[#0d1445] to-[#070c32] px-3 py-6 text-white shadow-card">
      <div className="mb-10 text-sm font-semibold">doc.track</div>
      <div className="flex flex-1 flex-col items-center gap-5">
        {navItems.map(({ icon: Icon, active }, index) => (
          <div
            key={`${Icon.displayName ?? "icon"}-${index}`}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
              active
                ? "bg-[#4f56d3] shadow-glow"
                : "bg-transparent text-white/70"
            }`}
          >
            <Icon size={20} />
          </div>
        ))}
      </div>
      <div className="mt-8 h-12 w-12 rounded-full bg-[url('https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=80')] bg-cover bg-center shadow-soft" />
    </div>
  );
}
