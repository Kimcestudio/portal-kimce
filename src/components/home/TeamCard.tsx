import { MessageCircle } from "lucide-react";
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
  const onlineMembers = members.filter((member) => member.isOnline);
  const notificationNames = onlineMembers.slice(0, 2).map((member) => member.name).join(", ");
  const notificationText =
    onlineMembers.length === 1
      ? `${notificationNames} ya se encuentra conectado. Si necesitas algo, ya puedes coordinar o contactarle.`
      : onlineMembers.length > 1
        ? `${notificationNames}${onlineMembers.length > 2 ? ` y ${onlineMembers.length - 2} más` : ""} ya se encuentran conectados. Si necesitas algo, ya puedes coordinar o contactarles.`
        : "";

  return (
    <DashboardCard
      title={`Equipo (${members.length})`}
      subtitle="Colaboradores activos"
      rightSlot={hiddenCount > 0 ? <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Ver más</button> : null}
      className="lg:col-span-2"
    >
      {onlineMembers.length > 0 ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900">Disponible para coordinar</p>
              <p className="mt-1 text-sm leading-snug text-emerald-800">{notificationText}</p>
            </div>
          </div>
        </div>
      ) : null}

      {visibleMembers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aún no hay miembros para mostrar.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleMembers.map((member) => (
            <article key={member.id} className="rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <div className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <UserAvatar name={member.name} photoURL={member.photoURL} sizeClassName="h-10 w-10" />
                  {member.isOnline ? (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{member.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {member.isOnline ? "Conectado ahora" : member.role}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
