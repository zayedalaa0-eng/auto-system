import clsx from "clsx";

type StatusPillProps = {
  value: string | null | undefined;
};

function getStatusClasses(value: string) {
  if (value.includes("مباعة") || value.includes("تم البيع") || value.includes("read")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (value.includes("حجز") || value.includes("pending") || value.includes("قيد")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (value.includes("رفض") || value.includes("غير") || value.includes("unread")) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }

  if (value.includes("متوفرة") || value.includes("نشط")) {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function StatusPill({ value }: StatusPillProps) {
  const label = value?.trim() || "غير محدد";

  return (
    <span
      className={clsx(
        "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        getStatusClasses(label),
      )}
    >
      {label}
    </span>
  );
}
