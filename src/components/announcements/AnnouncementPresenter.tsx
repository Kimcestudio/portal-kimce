"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { AlertTriangle, BellRing, Clock3, Info, Megaphone, Rocket, X } from "lucide-react";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Announcement } from "@/lib/announcements/types";
import { getAnnouncementRuntimeStatus, sortAnnouncementsByPriority } from "@/lib/announcements/utils";
import { subscribeAnnouncements } from "@/services/announcements";
import { db } from "@/services/firebase/client";

type AnnouncementExposureState = {
  shownCount: number;
  lastShownAt?: string;
  lastDismissedAt?: string;
  viewed?: boolean;
  sessionShown?: string;
};

const getStorageKey = (uid: string, id: string) => `announcement_state_${uid}_${id}`;

const safeJsonParse = (value: string | null): AnnouncementExposureState => {
  if (!value) return { shownCount: 0 };
  try {
    return JSON.parse(value) as AnnouncementExposureState;
  } catch {
    return { shownCount: 0 };
  }
};

function shouldShowAnnouncement(
  announcement: Announcement,
  state: AnnouncementExposureState,
  sessionToken: string,
) {
  if (announcement.visibility.hideAfterViewed && state.viewed) return false;
  if (!announcement.visibility.reappearAfterClose && state.lastDismissedAt) return false;

  const now = Date.now();
  const lastShownTime = state.lastShownAt ? new Date(state.lastShownAt).getTime() : null;

  switch (announcement.frequency) {
    case "once":
      return state.shownCount < 1;
    case "every_login":
      return state.sessionShown !== sessionToken;
    case "daily":
      return !lastShownTime || now - lastShownTime >= 24 * 60 * 60 * 1000;
    case "weekly":
      return !lastShownTime || now - lastShownTime >= 7 * 24 * 60 * 60 * 1000;
    case "always":
      return true;
    default:
      return true;
  }
}

function matchesAudience(
  announcement: Announcement,
  user: { uid: string; role: string; area?: string | null; isActive?: boolean },
) {
  if (user.isActive === false) return false;
  const audience = announcement.audience;

  if (audience.scope === "all") return true;
  if (audience.scope === "roles") {
    return (audience.roles ?? []).includes(user.role);
  }
  if (audience.scope === "areas") {
    if (!user.area) return false;
    return (audience.areas ?? []).includes(user.area);
  }
  if (audience.scope === "users") {
    return (audience.userIds ?? []).includes(user.uid);
  }

  return false;
}

const toneByPriority: Record<
  Announcement["priority"],
  {
    shell: string;
    accent: string;
    badge: string;
  }
> = {
  normal: {
    shell: "border-indigo-100 bg-white/95 text-slate-800",
    accent: "from-indigo-500 to-[#4f56d3]",
    badge: "bg-indigo-50 text-indigo-700",
  },
  important: {
    shell: "border-amber-200 bg-white/95 text-amber-950",
    accent: "from-amber-400 to-orange-500",
    badge: "bg-amber-100 text-amber-800",
  },
  urgent: {
    shell: "border-rose-200 bg-white/95 text-rose-950",
    accent: "from-rose-500 to-fuchsia-600",
    badge: "bg-rose-100 text-rose-800",
  },
};

const typeIcon: Record<Announcement["type"], ComponentType<{ className?: string }>> = {
  informativo: Info,
  urgente: AlertTriangle,
  recordatorio: Clock3,
  comunicado_interno: Megaphone,
  operativo: Rocket,
};

export default function AnnouncementPresenter() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [area, setArea] = useState<string | null>(null);
  const [isUserActive, setIsUserActive] = useState(true);
  const [sessionToken] = useState(() => `${Date.now()}`);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeAnnouncements(setAnnouncements, () => {
      setAnnouncements([]);
      setActiveAnnouncement(null);
    });
    const unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as DocumentData;
      setArea(data.area ?? null);
      setIsUserActive(data.isActive ?? data.active ?? true);
    });

    return () => {
      unsubscribe();
      unsubscribeProfile();
    };
  }, [user?.uid]);

  const eligibleAnnouncements = useMemo(() => {
    if (!user?.uid) return [];

    const runtimeActive = announcements.filter((item) => getAnnouncementRuntimeStatus(item) === "active");
    const visible = runtimeActive.filter((item) =>
      matchesAudience(item, {
        uid: user.uid,
        role: user.role,
        area,
        isActive: isUserActive,
      }),
    );

    return sortAnnouncementsByPriority(visible);
  }, [announcements, area, isUserActive, user]);

  useEffect(() => {
    if (!user?.uid || eligibleAnnouncements.length === 0) {
      setActiveAnnouncement(null);
      return;
    }

    const next = eligibleAnnouncements.find((item) => {
      const state = safeJsonParse(window.localStorage.getItem(getStorageKey(user.uid, item.id)));
      return shouldShowAnnouncement(item, state, sessionToken);
    });

    setActiveAnnouncement(next ?? null);
  }, [eligibleAnnouncements, sessionToken, user?.uid]);

  useEffect(() => {
    if (!activeAnnouncement || !user?.uid) return;

    const key = getStorageKey(user.uid, activeAnnouncement.id);
    const state = safeJsonParse(window.localStorage.getItem(key));
    const nowIso = new Date().toISOString();
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...state,
        shownCount: (state.shownCount ?? 0) + 1,
        lastShownAt: nowIso,
        sessionShown: sessionToken,
      } satisfies AnnouncementExposureState),
    );

    if (activeAnnouncement.visibility.durationSeconds > 0 && !activeAnnouncement.visibility.pinned) {
      const timeout = setTimeout(() => {
        setActiveAnnouncement(null);
      }, activeAnnouncement.visibility.durationSeconds * 1000);
      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [activeAnnouncement, sessionToken, user?.uid]);

  const handleClose = () => {
    if (!activeAnnouncement || !user?.uid) return;

    const key = getStorageKey(user.uid, activeAnnouncement.id);
    const state = safeJsonParse(window.localStorage.getItem(key));
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...state,
        viewed: true,
        lastDismissedAt: new Date().toISOString(),
      } satisfies AnnouncementExposureState),
    );

    setActiveAnnouncement(null);
  };

  if (!activeAnnouncement || !user?.uid) return null;

  const tone = toneByPriority[activeAnnouncement.priority];
  const TypeIcon = typeIcon[activeAnnouncement.type] ?? BellRing;
  const cardClass = `w-full overflow-hidden rounded-3xl border shadow-[0_20px_45px_rgba(15,23,42,0.25)] backdrop-blur ${tone.shell}`;
  const closeEnabled = activeAnnouncement.visibility.dismissible;

  if (activeAnnouncement.displayMode === "banner") {
    return (
      <div className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-3xl">
        <div className={cardClass}>
          <div className={`h-1.5 w-full bg-gradient-to-r ${tone.accent}`} />
          <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 rounded-xl p-2 ${tone.badge}`}>
                <TypeIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{activeAnnouncement.type}</p>
                <h3 className="text-base font-bold">{activeAnnouncement.title}</h3>
                <p className="mt-1 text-sm leading-relaxed">{activeAnnouncement.message}</p>
              </div>
            </div>
            {closeEnabled ? (
              <button type="button" onClick={handleClose} className="rounded-xl border border-current/20 p-2 transition hover:scale-105">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (activeAnnouncement.displayMode === "floating") {
    return (
      <div className="fixed bottom-6 right-6 z-[60] w-full max-w-sm px-4 sm:px-0">
        <div className={cardClass}>
          <div className={`h-1.5 w-full bg-gradient-to-r ${tone.accent}`} />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 rounded-xl p-2 ${tone.badge}`}>
                  <TypeIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{activeAnnouncement.type}</p>
                  <h3 className="text-base font-bold">{activeAnnouncement.title}</h3>
                </div>
              </div>
              {closeEnabled ? (
                <button type="button" onClick={handleClose} className="rounded-xl border border-current/20 p-2 transition hover:scale-105">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed">{activeAnnouncement.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4">
      <div className={`${cardClass} max-w-[64rem]`}>
        <div className={`h-2 w-full bg-gradient-to-r ${tone.accent}`} />
        <div className="p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className={`mt-1 rounded-2xl p-2.5 ${tone.badge}`}>
                <TypeIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em]">{activeAnnouncement.type}</p>
                <h3 className="text-[3rem] font-bold leading-none">{activeAnnouncement.title}</h3>
              </div>
            </div>
            {closeEnabled ? (
              <button type="button" onClick={handleClose} className="rounded-2xl border border-current/20 p-2.5 transition hover:scale-105">
                <X className="h-7 w-7" />
              </button>
            ) : null}
          </div>
          <p className="mt-6 text-[2.8rem] leading-[1.28]">{activeAnnouncement.message}</p>
        </div>
      </div>
    </div>
  );
}
