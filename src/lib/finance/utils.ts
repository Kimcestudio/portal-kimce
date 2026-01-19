import type { FinanceTransaction } from "@/lib/finance/types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

export function buildMonthOptions(count = 6) {
  const options = [] as { value: string; label: string }[];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(date);
    options.push({ value: key, label: getMonthLabel(key) });
  }
  return options;
}

export function toMonthKey(transaction: Pick<FinanceTransaction, "date" | "monthKey">) {
  if (transaction.monthKey) return transaction.monthKey;
  return getMonthKey(new Date(transaction.date));
}

export function calcFinalAmount(transaction: Pick<FinanceTransaction, "amount" | "bonus" | "discount" | "refund">) {
  const bonus = transaction.bonus ?? 0;
  const discount = transaction.discount ?? 0;
  const refund = transaction.refund ?? 0;
  return transaction.amount + bonus - discount - refund;
}

export function getWeekIndex(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOffset = (first.getDay() + 6) % 7;
  const dayOfMonth = date.getDate() + dayOffset;
  return Math.ceil(dayOfMonth / 7);
}
