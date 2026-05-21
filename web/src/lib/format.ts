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
