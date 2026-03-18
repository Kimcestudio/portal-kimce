import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/services/firebase/client";
import type { Announcement, AnnouncementInput } from "@/lib/announcements/types";

const announcementsRef = collection(db, "announcements");

const normalizeAnnouncement = (id: string, data: DocumentData): Announcement => ({
  id,
  title: data.title ?? "",
  message: data.message ?? "",
  type: data.type ?? "informativo",
  adminStatus: data.adminStatus ?? "draft",
  startAt: data.startAt ?? null,
  endAt: data.endAt ?? null,
  frequency: data.frequency ?? "once",
  displayMode: data.displayMode ?? "modal",
  priority: data.priority ?? "normal",
  audience: {
    scope: data.audience?.scope ?? "all",
    roles: Array.isArray(data.audience?.roles) ? data.audience.roles : [],
    areas: Array.isArray(data.audience?.areas) ? data.audience.areas : [],
    userIds: Array.isArray(data.audience?.userIds) ? data.audience.userIds : [],
  },
  visibility: {
    dismissible: data.visibility?.dismissible ?? true,
    reappearAfterClose: data.visibility?.reappearAfterClose ?? false,
    hideAfterViewed: data.visibility?.hideAfterViewed ?? false,
    pinned: data.visibility?.pinned ?? false,
    durationSeconds: Number(data.visibility?.durationSeconds ?? 0),
  },
  createdAt: data.createdAt ?? new Date(0).toISOString(),
  updatedAt: data.updatedAt ?? data.createdAt ?? new Date(0).toISOString(),
  createdBy: data.createdBy ?? null,
  updatedBy: data.updatedBy ?? null,
});

export function subscribeAnnouncements(onChange: (items: Announcement[]) => void) {
  const announcementsQuery = query(announcementsRef, orderBy("updatedAt", "desc"));

  return onSnapshot(announcementsQuery, (snapshot) => {
    const normalized = snapshot.docs.map((item) => normalizeAnnouncement(item.id, item.data()));
    onChange(normalized);
  });
}

export async function createAnnouncement(input: AnnouncementInput) {
  const now = new Date().toISOString();
  const payload = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(announcementsRef, payload);
  return { ...payload, id: ref.id } as Announcement;
}

export async function updateAnnouncement(id: string, input: Partial<AnnouncementInput>) {
  await updateDoc(doc(db, "announcements", id), {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteAnnouncement(id: string) {
  await deleteDoc(doc(db, "announcements", id));
}
