import clsx from "clsx";

type StatusPillProps = {
  value: string | null | undefined;
};

function getStatusClasses(value: string): string {
  // ── اكتملت الصفقة — أخضر ──────────────────────────────────────────────────
  if (
    value.includes("تمت عملية البيع") ||
    value.includes("شراء من قبل المعرض") ||
    value.includes("مباع") ||
    value.includes("read") // notification: read
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  // ── حجز / معروضة — أصفر ──────────────────────────────────────────────────
  if (
    value.includes("حجز") ||
    value.includes("معروضة للبيع") ||
    value.includes("عرض سيارة للبيع") ||
    value.includes("pending") ||
    value.includes("برسم البيع")
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  // ── رفض / تراجع / سحب — أحمر ────────────────────────────────────────────
  if (
    value.includes("رفض") ||
    value.includes("تراجع العميل") ||
    value.includes("سحب السيارة") ||
    value.includes("إغلاق الملف") ||
    value.includes("unread")
  ) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }

  // ── جديد — أزرق ──────────────────────────────────────────────────────────
  if (value === "جديد") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  // ── قيد المتابعة / بانتظار — أزرق سماوي ─────────────────────────────────
  if (value.includes("قيد المتابعة")) {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }

  // ── استبدال / تقييم — بنفسجي ────────────────────────────────────────────
  if (value.includes("استبدال") || value.includes("التقييم")) {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  // ── متوفرة في المخزون — سماوي ────────────────────────────────────────────
  if (value.includes("متوفرة") || value.includes("نشط")) {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }

  // ── غير متوفرة في المخزون — رمادي ────────────────────────────────────────
  if (value.includes("مباع") || value.includes("محجوز") || value.includes("مسحوب") || value.includes("حيازة")) {
    return "bg-slate-100 text-slate-500 ring-slate-200";
  }

  // ── افتراضي ───────────────────────────────────────────────────────────────
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function StatusPill({ value }: StatusPillProps) {
  const label = value?.trim() || "غير محدد";

  return (
    <span
      className={clsx(
        "inline-flex min-h-7 items-center rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        getStatusClasses(label),
      )}
    >
      {label}
    </span>
  );
}
