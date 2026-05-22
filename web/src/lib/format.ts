const dateFormatter = new Intl.DateTimeFormat("ar", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const relativeFormatter = new Intl.RelativeTimeFormat("ar", {
  numeric: "auto",
});

export function formatDate(value: string | null) {
  if (!value) return "غير محدد";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return dateFormatter.format(date);
}

export function formatCurrency(value: number | null) {
  if (typeof value !== "number") return "غير محدد";
  return currencyFormatter.format(value);
}

export function formatRelativeDate(value: string | null) {
  if (!value) return "بدون موعد";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) >= 1) {
    return relativeFormatter.format(diffDays, "day");
  }

  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(diffHours) >= 1) {
    return relativeFormatter.format(diffHours, "hour");
  }

  const diffMinutes = Math.round(diffMs / (1000 * 60));
  return relativeFormatter.format(diffMinutes, "minute");
}

export function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}
