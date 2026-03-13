import UserAvatar from "@/components/common/UserAvatar";
import DashboardCard from "@/components/home/DashboardCard";
import type { HomeTeamMember } from "@/lib/homeDashboardMocks";

interface TeamCardProps {
  members: HomeTeamMember[];
  visibleCount?: number;
}

export default function TeamCard({ members, visibleCount = 8 }: TeamCardProps) {
  const visibleMembers = members.slice(0, visibleCount);
  const hiddenCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <DashboardCard
      title={`Equipo (${members.length})`}
      subtitle="Colaboradores activos"
      rightSlot={hiddenCount > 0 ? <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Ver más</button> : null}
      className="lg:col-span-2"
    >
      {visibleMembers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aún no hay miembros para mostrar.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleMembers.map((member) => (
            <article key={member.id} className="rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <div className="flex items-center gap-2">
                <UserAvatar name={member.name} photoURL={member.photoURL} sizeClassName="h-10 w-10" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{member.name}</p>
                  <p className="truncate text-xs text-slate-500">{member.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
