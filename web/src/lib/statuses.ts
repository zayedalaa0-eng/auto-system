/**
 * قوائم الحالات لكل نوع عملية — ملف مستقل بدون imports سيرفر
 * يُستخدم من Client Components مباشرة دون أن يسحب next/headers
 */

export const STATUSES_BUYER = [
  "جديد",
  "قيد المتابعة",
  "حجز",
  "تمت عملية البيع",
  "رفض من قبل العميل",
  "رفض من قبل المعرض",
  "إغلاق الملف",
];

export const STATUSES_BUYER_TRADEIN = [
  "استبدال — تحت التقييم",
  "قيد المتابعة — بانتظار التقييم",
  "قيد المتابعة — تمت عملية التقييم",
  "حجز (استبدال)",
  "تمت عملية البيع + استبدال",
  "تراجع العميل عن الاستبدال",
  "رفض من قبل العميل",
  "رفض من قبل المعرض",
  "إغلاق الملف",
];

export const STATUSES_SELL_ON_BEHALF = [
  "عرض سيارة للبيع",
  "حجز (سيارة العميل)",
  "تمت عملية البيع (للعميل)",
  "شراء من قبل المعرض",
  "رفض من قبل العميل",
  "رفض من قبل المعرض",
  "سحب السيارة من البيع",
];

export const STATUS_BY_TYPE: {
  buyer: string[];
  buyer_tradein_pending: string[];
  sell_on_behalf: string[];
} = {
  buyer: STATUSES_BUYER,
  buyer_tradein_pending: STATUSES_BUYER_TRADEIN,
  sell_on_behalf: STATUSES_SELL_ON_BEHALF,
};

export const ALL_CUSTOMER_STATUSES = [
  ...new Set([...STATUSES_BUYER, ...STATUSES_BUYER_TRADEIN, ...STATUSES_SELL_ON_BEHALF]),
];

/** حالات تُغلق الملف تلقائياً */
const CLOSED_STATUSES = new Set([
  "تمت عملية البيع",
  "تمت عملية البيع + استبدال",
  "تمت عملية البيع (للعميل)",
  "شراء من قبل المعرض",
  "رفض من قبل العميل",
  "رفض من قبل المعرض",
  "إغلاق الملف",
  "تراجع العميل عن الاستبدال",
  "سحب السيارة من البيع",
  "بيع السيارة لعميل خارجي",
  "تراجع",
]);

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status);
}
