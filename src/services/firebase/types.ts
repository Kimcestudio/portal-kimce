export type UserRole = "collab" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  position: string;
  workScheduleId?: string;
  active: boolean;
  approved?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export type WorkScheduleDays = {
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  sun: number;
};

export interface WorkSchedule {
  id: string;
  name: string;
  weeklyMinutes: number;
  days: WorkScheduleDays;
}

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface RequestRecord {
  id: string;
  type: string;
  date: string;
  endDate?: string;
  hours?: number;
  reason: string;
  status: RequestStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface AttendanceBreak {
  startAt: string;
  endAt: string | null;
}

export interface AdminAttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  breaks: AttendanceBreak[];
  notes: string | null;
  totalMinutes: number;
  status: "OPEN" | "CLOSED";
}

export interface FinanceSettings {
  financeKey?: string;
  financeKeyHash?: string;
}
