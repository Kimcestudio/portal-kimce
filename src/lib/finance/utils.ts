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

export function getMonthKeyFromDate(value: unknown) {
  const dateOnly = formatDateOnly(value);
  return dateOnly ? dateOnly.slice(0, 7) : null;
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

export function getMonthLabel(monthKey: string) {
  return formatMonthLabel(monthKey);
}

export function buildMonthOptions() {
  const options = [] as { value: string; label: string }[];
  const startMonth = new Date(2026, 0, 1);
  const today = new Date();
  const endByDefault = new Date(startMonth.getFullYear(), startMonth.getMonth() + 13, 1);
  const endByToday = new Date(today.getFullYear(), today.getMonth() + 12, 1);
  const endMonth = endByToday > endByDefault ? endByToday : endByDefault;

  const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
  while (cursor <= endMonth) {
    const key = getMonthKey(cursor);
    options.push({ value: key, label: formatMonthLabel(key) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return options;
}

export function formatDateOnly(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatUtcDate(parsed);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatLocalDate(value);
  }
  if (typeof value === "object" && value) {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (candidate.toDate) {
      return formatUtcDate(candidate.toDate());
    }
    if (typeof candidate.seconds === "number") {
      return formatUtcDate(new Date(candidate.seconds * 1000));
    }
  }
  return null;
}

export function formatShortDate(value: unknown) {
  const dateOnly = formatDateOnly(value);
  if (!dateOnly) return "—";
  const parsed = new Date(`${dateOnly}T12:00:00`);
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

export function getTodayDateString() {
  return formatLocalDate(new Date());
}

export function getStatusLabel(status: "pending" | "cancelled") {
  switch (status) {
    case "cancelled":
      return "Pagado";
    default:
      return "Pendiente";
  }
}

export function getStatusTone(status: "pending" | "cancelled") {
  switch (status) {
    case "cancelled":
      return "success";
    default:
      return "warning";
  }
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
