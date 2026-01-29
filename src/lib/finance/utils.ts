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

export function buildMonthOptions(count = 13) {
  const options = [] as { value: string; label: string }[];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = getMonthKey(date);
    options.push({ value: key, label: formatMonthLabel(key) });
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
      return "Cancelado";
    default:
      return "Pendiente";
  }
}

export function getStatusTone(status: "pending" | "cancelled") {
  switch (status) {
    case "cancelled":
      return "danger";
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
