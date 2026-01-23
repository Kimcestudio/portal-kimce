import type {
  AdminAttendanceRecord,
  FinanceSettings,
  RequestRecord,
  UserProfile,
  WorkSchedule,
} from "@/services/firebase/types";
import { readStorage, writeStorage } from "@/services/firebase/storage";

const COLLECTION_PREFIX = "portal_firestore_";

function collectionKey(name: string) {
  return `${COLLECTION_PREFIX}${name}`;
}

export function getCollection<T>(name: string, fallback: T[] = []) {
  return readStorage<T[]>(collectionKey(name), fallback);
}

export function setCollection<T>(name: string, value: T[]) {
  writeStorage(collectionKey(name), value);
}

export function listUsers() {
  return getCollection<UserProfile>("users");
}

export function listWorkSchedules() {
  return getCollection<WorkSchedule>("workSchedules");
}

export function getWorkScheduleById(id: string) {
  return listWorkSchedules().find((schedule) => schedule.id === id) ?? null;
}

export function getUserById(uid: string) {
  return listUsers().find((user) => user.uid === uid) ?? null;
}

export function getUserByEmail(email: string) {
  return listUsers().find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function updateUser(uid: string, updates: Partial<UserProfile>) {
  const users = listUsers();
  const index = users.findIndex((user) => user.uid === uid);
  if (index === -1) return null;
  const next = { ...users[index], ...updates };
  users[index] = next;
  setCollection("users", users);
  return next;
}

export function upsertUser(profile: UserProfile) {
  const users = listUsers();
  const index = users.findIndex((user) => user.uid === profile.uid);
  if (index === -1) {
    users.push(profile);
  } else {
    users[index] = { ...users[index], ...profile };
  }
  setCollection("users", users);
  return profile;
}

export function listRequests() {
  return getCollection<RequestRecord>("requests");
}

export function updateRequest(id: string, updates: Partial<RequestRecord>) {
  const requests = listRequests();
  const index = requests.findIndex((request) => request.id === id);
  if (index === -1) return null;
  const next = { ...requests[index], ...updates };
  requests[index] = next;
  setCollection("requests", requests);
  return next;
}

export function listAttendanceRecords() {
  return getCollection<AdminAttendanceRecord>("attendance");
}

export function setAttendanceRecords(records: AdminAttendanceRecord[]) {
  setCollection("attendance", records);
}

export function getFinanceSettings() {
  return readStorage<FinanceSettings>(collectionKey("settings_finance"), {});
}

export function setFinanceSettings(settings: FinanceSettings) {
  writeStorage(collectionKey("settings_finance"), settings);
}
