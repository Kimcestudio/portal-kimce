import type {
  Announcement,
  AnnouncementPriority,
  AnnouncementRuntimeStatus,
} from "@/lib/announcements/types";

const priorityWeight: Record<AnnouncementPriority, number> = {
  urgent: 3,
  important: 2,
  normal: 1,
};

export function getAnnouncementRuntimeStatus(
  announcement: Pick<Announcement, "adminStatus" | "startAt" | "endAt">,
  now = new Date(),
): AnnouncementRuntimeStatus {
  if (announcement.adminStatus === "draft") return "draft";
  if (announcement.adminStatus === "disabled") return "disabled";

  const nowTime = now.getTime();
  const startTime = announcement.startAt ? new Date(announcement.startAt).getTime() : null;
  const endTime = announcement.endAt ? new Date(announcement.endAt).getTime() : null;

  if (startTime && nowTime < startTime) return "scheduled";
  if (endTime && nowTime > endTime) return "expired";
  return "active";
}

export function sortAnnouncementsByPriority(items: Announcement[]) {
  return [...items].sort((a, b) => {
    const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (weightDiff !== 0) return weightDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
