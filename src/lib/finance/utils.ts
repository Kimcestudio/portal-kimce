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

export function parseMonthKeyLike(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();

  const fullDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDateMatch) return `${fullDateMatch[1]}-${fullDateMatch[2]}`;

  const slashMatch = raw.match(/^(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const year = Number(slashMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  const dashMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (dashMatch) {
    const month = Number(dashMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${dashMatch[1]}-${String(month).padStart(2, "0")}`;
    }
  }

  const localizedMatch = raw.match(/^([a-záéíóúñ]+)\s+de\s+(\d{4})$/i);
  if (localizedMatch) {
    const monthNames = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    const monthIndex = monthNames.indexOf(localizedMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      return `${localizedMatch[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
    }
  }

  return null;
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

export function getStatusLabel(status: "pending" | "paid" | "cancelled") {
  switch (status) {
    case "paid":
      return "Pagado";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendiente";
  }
}

export function getStatusTone(status: "pending" | "paid" | "cancelled") {
  switch (status) {
    case "paid":
      return "success";
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
