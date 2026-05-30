/**
 * طرق الدفع المتاحة — مصدر موحّد لكل الصفحات
 */
export const PAYMENT_METHODS = [
  { value: "كاش",                label: "💵 كاش" },
  { value: "تقسيط بنكي",         label: "🏦 تقسيط بنكي" },
  { value: "تأجير تمويلي",       label: "📋 تأجير تمويلي" },
  { value: "شيكات",              label: "📝 شيكات" },
  { value: "استبدال فقط",        label: "🔄 استبدال فقط" },
  { value: "استبدال + كاش",     label: "🔄 استبدال + كاش" },
  { value: "استبدال + تقسيط",   label: "🔄 استبدال + تقسيط" },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];

/** الحالات التي تستوجب إظهار حقل طريقة الدفع */
export const PAYMENT_TRIGGER_STATUSES = [
  "تمت عملية البيع",
  "تمت عملية البيع + استبدال",
  "تمت عملية البيع (للعميل)",
  "شراء من قبل المعرض",
  "حجز",
];

/** التحقق من أن الحالة تستوجب طريقة دفع */
export function needsPaymentMethod(status: string): boolean {
  return PAYMENT_TRIGGER_STATUSES.some((t) => status.includes(t));
}

/** الحصول على label مع emoji من value */
export function getPaymentLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

/** قائمة القيم فقط (للبوت) */
export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((m) => m.value);

/** قائمة Labels فقط (للعرض في Bot) */
export const PAYMENT_METHOD_LABELS = PAYMENT_METHODS.map((m) => m.label);
