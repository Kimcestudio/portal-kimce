import { getFinanceSettings, setFinanceSettings } from "@/services/firebase/db";
import { clearSession, readSession, writeSession } from "@/services/firebase/storage";

const SESSION_KEY = "finance_unlock";

type FinanceSession = {
  expiresAt: number;
};

export function isFinanceUnlocked() {
  const stored = readSession<FinanceSession | null>(SESSION_KEY, null);
  if (!stored) return false;
  return Date.now() < stored.expiresAt;
}

export async function verifyFinanceKey(candidate: string) {
  const settings = getFinanceSettings();
  if (settings.financeKeyHash) {
    const hash = await hashFinanceKey(candidate);
    return hash === settings.financeKeyHash;
  }
  if (settings.financeKey) {
    return candidate === settings.financeKey;
  }
  return false;
}

export function unlockFinance(ttlMinutes = 15) {
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  writeSession(SESSION_KEY, { expiresAt });
}

export function lockFinance() {
  clearSession(SESSION_KEY);
}

export function ensureFinanceKey(value: string) {
  const settings = getFinanceSettings();
  if (!settings.financeKey && !settings.financeKeyHash) {
    setFinanceSettings({ financeKey: value });
  }
}

async function hashFinanceKey(value: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return value;
  }
  const data = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}
