"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
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

const toneByPriority: Record<Announcement["priority"], string> = {
  normal: "border-slate-200 bg-white text-slate-800",
  important: "border-amber-200 bg-amber-50 text-amber-900",
  urgent: "border-rose-200 bg-rose-50 text-rose-900",
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

    const unsubscribe = subscribeAnnouncements(setAnnouncements);
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

  const cardClass = `w-full rounded-2xl border p-4 shadow-xl ${toneByPriority[activeAnnouncement.priority]}`;
  const closeEnabled = activeAnnouncement.visibility.dismissible;

  if (activeAnnouncement.displayMode === "banner") {
    return (
      <div className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-3xl">
        <div className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em]">{activeAnnouncement.type}</p>
              <h3 className="text-base font-bold">{activeAnnouncement.title}</h3>
              <p className="mt-1 text-sm leading-relaxed">{activeAnnouncement.message}</p>
            </div>
            {closeEnabled ? (
              <button type="button" onClick={handleClose} className="rounded-lg border border-current/30 p-1">
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em]">{activeAnnouncement.type}</p>
              <h3 className="text-base font-bold">{activeAnnouncement.title}</h3>
              <p className="mt-1 text-sm leading-relaxed">{activeAnnouncement.message}</p>
            </div>
            {closeEnabled ? (
              <button type="button" onClick={handleClose} className="rounded-lg border border-current/30 p-1">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4">
      <div className={`${cardClass} max-w-lg`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em]">{activeAnnouncement.type}</p>
            <h3 className="text-lg font-bold">{activeAnnouncement.title}</h3>
          </div>
          {closeEnabled ? (
            <button type="button" onClick={handleClose} className="rounded-lg border border-current/30 p-1">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed">{activeAnnouncement.message}</p>
      </div>
    </div>
  );
}
