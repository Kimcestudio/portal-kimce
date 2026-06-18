"use client";

import Link from "next/link";
import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { Building2, Mail, Phone, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import UserAvatar from "@/components/common/UserAvatar";
import { db } from "@/services/firebase/client";
import type { UserProfile } from "@/services/firebase/types";

type DirectoryMember = UserProfile & {
  lastSeenAt?: string;
};

function normalizeTimestamp(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const candidate = value as { toDate?: () => Date };
  if (candidate.toDate) return candidate.toDate().toISOString();
  return null;
}

function isRecentlyOnline(person: DirectoryMember) {
  if (person.onlineStatus !== "online" || !person.lastSeenAt) return false;
  const lastSeen = new Date(person.lastSeenAt).getTime();
  if (Number.isNaN(lastSeen)) return false;
  return Date.now() - lastSeen <= 5 * 60 * 1000;
}

export default function TeamPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<DirectoryMember[]>([]);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "online" | "offline">("all");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  useEffect(() => {
    const usersRef = collection(db, "userDirectory");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            uid: (data.uid ?? docSnap.id) as string,
            email: (data.email ?? "") as string,
            displayName: (data.displayName ?? "Usuario") as string,
            photoURL: (data.photoURL ?? "") as string,
            role: (data.role ?? "collab") as UserProfile["role"],
            position: (data.position ?? "") as string,
            area: (data.area ?? null) as string | null,
            active: (data.active ?? data.isActive ?? true) as boolean,
            approved: (data.approved ?? false) as boolean,
            isActive: (data.isActive ?? data.active ?? true) as boolean,
            phone: (data.phone ?? "") as string,
            birthDate: (data.birthDate ?? "") as string,
            employmentStartDate: (data.employmentStartDate ?? "") as string,
            onlineStatus: (data.onlineStatus ?? "offline") as "online" | "offline",
            lastSeenAt: (normalizeTimestamp(data.lastSeenAt) ?? data.lastSeenAt ?? "") as string,
          } satisfies DirectoryMember;
        });
        setPeople(next);
      },
      () => setPeople([]),
    );

    return () => unsubscribe();
  }, []);

  const areaOptions = useMemo(() => {
    const values = people
      .map((person) => (person.area ?? person.position ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return [...new Set(values)];
  }, [people]);

  const directory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return people
      .filter((person) => person.approved === true && person.isActive !== false)
      .filter((person) => {
        const bucket = (person.area ?? person.position ?? "").trim();
        const online = isRecentlyOnline(person);

        const matchesSearch =
          !normalizedSearch ||
          `${person.displayName} ${person.email} ${person.position} ${bucket}`.toLowerCase().includes(normalizedSearch);
        const matchesArea = areaFilter === "all" || bucket === areaFilter;
        const matchesAvailability =
          availabilityFilter === "all" ||
          (availabilityFilter === "online" ? online : !online);

        return matchesSearch && matchesArea && matchesAvailability;
      })
      .sort((a, b) => {
        const onlineDiff = Number(isRecentlyOnline(b)) - Number(isRecentlyOnline(a));
        if (onlineDiff !== 0) return onlineDiff;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [areaFilter, availabilityFilter, people, search]);

  const selectedMember =
    directory.find((person) => person.uid === selectedUid) ??
    directory.find((person) => person.uid === user?.uid) ??
    directory[0] ??
    null;

  const onlineCount = directory.filter((person) => isRecentlyOnline(person)).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Equipo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Directorio interno para ubicar rápido a cada colaborador, su área y disponibilidad.
            </p>
          </div>

          <div className="grid min-w-[260px] gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Directorio</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{directory.length}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Conectados</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{onlineCount}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Áreas</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">{areaOptions.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <label className="block text-sm font-medium text-slate-700">
                Buscar
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200/80 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    className="w-full bg-transparent text-sm text-slate-700 outline-none"
                    placeholder="Nombre, correo, puesto"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Área
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none"
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {areaOptions.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Disponibilidad
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200/80 px-3 py-2 text-sm text-slate-700 outline-none"
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as "all" | "online" | "offline")}
                >
                  <option value="all">Todos</option>
                  <option value="online">Conectados</option>
                  <option value="offline">No conectados</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {directory.length ? (
              directory.map((person) => {
                const online = isRecentlyOnline(person);
                const bucket = (person.area ?? person.position ?? "").trim() || "Sin asignar";
                const selected = selectedMember?.uid === person.uid;

                return (
                  <button
                    key={person.uid}
                    type="button"
                    onClick={() => setSelectedUid(person.uid)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-violet-300 bg-violet-50/70"
                        : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <UserAvatar name={person.displayName} photoURL={person.photoURL} sizeClassName="h-12 w-12" />
                        {online ? (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{person.displayName}</p>
                        <p className="truncate text-xs text-slate-500">{person.position || "Sin puesto asignado"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {bucket}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              online ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {online ? "Conectado" : "Disponible por directorio"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white px-4 py-8 text-sm text-slate-500 md:col-span-2 2xl:col-span-3">
                No encontramos colaboradores con esos filtros.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4 flex items-center gap-3">
              <UserAvatar
                name={selectedMember?.displayName}
                photoURL={selectedMember?.photoURL}
                sizeClassName="h-14 w-14"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">
                  {selectedMember?.displayName ?? "Selecciona un miembro"}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {selectedMember?.position || "Sin puesto asignado"}
                </p>
              </div>
            </div>

            {selectedMember ? (
              <div className="space-y-3 text-sm text-slate-600">
                <div className="rounded-xl border border-slate-200/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Área</p>
                  <p className="mt-1 font-medium text-slate-800">
                    {(selectedMember.area ?? selectedMember.position ?? "").trim() || "Sin asignar"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Correo</p>
                  <p className="mt-1 break-all font-medium text-slate-800">{selectedMember.email || "Sin correo"}</p>
                </div>

                <div className="rounded-xl border border-slate-200/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Disponibilidad</p>
                  <p className="mt-1 font-medium text-slate-800">
                    {isRecentlyOnline(selectedMember) ? "Conectado ahora" : "No conectado actualmente"}
                  </p>
                </div>

                {selectedMember.phone ? (
                  <div className="rounded-xl border border-slate-200/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Teléfono</p>
                    <p className="mt-1 font-medium text-slate-800">{selectedMember.phone}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedMember.email ? (
                    <a
                      href={`mailto:${selectedMember.email}`}
                      className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      <Mail className="h-4 w-4" />
                      Escribir correo
                    </a>
                  ) : null}

                  {selectedMember.phone ? (
                    <a
                      href={`tel:${selectedMember.phone}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Phone className="h-4 w-4" />
                      Llamar
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-slate-500">
                Cuando selecciones un miembro, aquí verás su ficha rápida de contacto.
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <h3 className="text-base font-semibold text-slate-900">Atajos útiles</h3>
            <div className="mt-4 space-y-3">
              <Link
                href="/app/calendar"
                className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-4 py-3 text-sm text-slate-700 transition hover:border-violet-200 hover:bg-violet-50/40"
              >
                <Building2 className="h-4 w-4 text-violet-500" />
                Ver calendario del equipo
              </Link>
              <Link
                href="/app/dashboard"
                className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-4 py-3 text-sm text-slate-700 transition hover:border-violet-200 hover:bg-violet-50/40"
              >
                <Users className="h-4 w-4 text-violet-500" />
                Volver al panel principal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
