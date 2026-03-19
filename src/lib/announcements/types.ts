export type AnnouncementType =
  | "informativo"
  | "urgente"
  | "recordatorio"
  | "comunicado_interno"
  | "operativo";

export type AnnouncementPriority = "normal" | "important" | "urgent";

export type AnnouncementAdminStatus = "draft" | "active" | "disabled";

export type AnnouncementRuntimeStatus =
  | "draft"
  | "active"
  | "scheduled"
  | "expired"
  | "disabled";

export type AnnouncementDisplayMode = "modal" | "floating" | "banner";

export type AnnouncementFrequency = "once" | "every_login" | "daily" | "weekly" | "always";

export type AnnouncementAudienceScope = "all" | "roles" | "areas" | "users";

export interface AnnouncementAudience {
  scope: AnnouncementAudienceScope;
  roles?: string[];
  areas?: string[];
  userIds?: string[];
}

export interface AnnouncementVisibility {
  dismissible: boolean;
  reappearAfterClose: boolean;
  hideAfterViewed: boolean;
  pinned: boolean;
  durationSeconds: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  adminStatus: AnnouncementAdminStatus;
  startAt: string | null;
  endAt: string | null;
  frequency: AnnouncementFrequency;
  displayMode: AnnouncementDisplayMode;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  visibility: AnnouncementVisibility;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface AnnouncementInput
  extends Omit<Announcement, "id" | "createdAt" | "updatedAt"> {}
