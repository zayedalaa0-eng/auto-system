import Link from "next/link";
import { Bell, Building2, Calendar, CalendarClock, Car, Phone, User } from "lucide-react";

import { sendQuickReminderAction } from "@/app/dashboard/actions";
import { StatusPill } from "@/components/status-pill";
import type { CustomerItem } from "@/lib/data";
import { formatDate } from "@/lib/format";

function inventoryAvailabilityBadge(status: string | null | undefined) {
  const s = (status ?? "").trim();
  if (!s) return null;
  if (s.includes("محجوزة")) return { label: "🟡 سيارة محجوزة", cls: "text-amber-600" };
  if (s.includes("مباعة"))  return { label: "🔴 سيارة مباعة",  cls: "text-rose-600"  };
  if (s.includes("مسحوبة")) return { label: "⚪ سيارة مسحوبة", cls: "text-slate-400"  };
  if (s.includes("متوفرة")) return { label: "🟢 سيارة متوفرة", cls: "text-emerald-600" };
  return { label: `📦 ${s}`, cls: "text-slate-500" };
}

// التحقق من نوع العملية بالكود أو التسمية العربية (توافق مع السجلات القديمة)
function isSellOnBehalf(opType: string | null | undefined) {
  return opType === "sell_on_behalf" || opType === "بيع بالوكالة";
}
function isBuyerTradeIn(opType: string | null | undefined) {
  return opType === "buyer_tradein_pending" || opType === "buyer_tradein_evaluated" || opType === "مشتري + استبدال";
}

// يظهر فقط لعملاء بيع بالوكالة — معلومة إضافية عن سيارة العميل
function tradeInStatusBadge(status: string | null | undefined, opType: string | null | undefined) {
  if (!isSellOnBehalf(opType)) return null;
  const s = (status ?? "").trim();
  if (!s) return null;
  if (s.includes("برسم البيع")) return { label: "🚗 برسم البيع",    cls: "text-amber-600" };
  if (s.includes("عرض سيارة") || s.includes("معروضة")) return { label: "🚗 عرض سيارة للبيع", cls: "text-amber-600" };
  return null;
}

function carNameOnly(value: string | null) {
  if (!value) return null;
  const cleaned = value
    .split("|")
    .map((part) =>
      part
        .replace(/\(?\s*طلب\s+خاص\s*\)?/gi, "")
        .replace(/\s*-\s*موديل\s*:?\s*[^|]+/gi, "")
        .replace(/\s*-\s*model\s*:?\s*[^|]+/gi, "")
        .replace(/\s*-\s*شاصي\s*:\s*[^|]+/gi, "")
        .replace(/\s*-\s*chassis\s*:\s*[^|]+/gi, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" | ")
    .trim();
  return cleaned || null;
}

export function CustomersReportTable({
  customers,
  basePath,
  emptyMessage,
  query = "",
  includeEdit = false,
}: {
  customers: CustomerItem[];
  basePath: "/dashboard/customers" | "/dashboard/management" | "/dashboard/search";
  emptyMessage: string;
  query?: string;
  includeEdit?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="premium-table">
        <thead className="legacy-standard-head">
          <tr>
            <th style={{ width: "170px" }}>المعرض / الموظف</th>
            <th style={{ width: "160px" }}>العميل والهاتف</th>
            <th style={{ width: "160px" }}>السيارة</th>
            <th style={{ width: "150px" }}>الحالة</th>
            <th style={{ width: "130px" }}>آخر تواصل</th>
            <th style={{ width: "130px" }}>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {customers.length > 0 ? (
            customers.map((customer) => {
              const carName = carNameOnly(customer.requested_car_report ?? customer.requested_car);
              const hasSpecialRequest = (customer.requested_car_report ?? customer.requested_car ?? "").includes("طلب خاص");

              // كشف تطابق السيارة المطلوبة مع سيارة الاستبدال (لتفادي التكرار)
              const normCar = (carName ?? "").replace(/\s+/g, " ").trim().toLowerCase();
              const normTrade = (customer.trade_in_model ?? "").replace(/\s+/g, " ").trim().toLowerCase();
              const carDuplicatesTradeIn =
                isBuyerTradeIn(customer.operation_type) &&
                normCar.length > 0 && normTrade.length > 0 &&
                (normCar === normTrade || normCar.includes(normTrade) || normTrade.includes(normCar));
              // نُظهر السيارة المطلوبة في الأعلى فقط إذا لم تكن مكررة مع الاستبدال
              const showRequestedCar = Boolean(carName) && !carDuplicatesTradeIn;

              return (
                <tr key={customer.id}>
                  {/* المعرض / التاريخ / الموظف */}
                  <td>
                    <div className="flex flex-col gap-1.5">
                      {customer.branch_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                          <span className="text-sm font-bold text-rose-600">{customer.branch_name}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 flex-shrink-0 text-slate-400" />
                        <span className="text-xs text-slate-500 font-medium">{formatDate(customer.created_at ?? null)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                        <span className="text-xs font-bold text-blue-600 truncate">{customer.assigned_user_name ?? "—"}</span>
                      </div>
                    </div>
                  </td>

                  {/* العميل والهاتف */}
                  <td>
                    <div className="flex flex-col gap-1.5">
                      <div className="font-bold text-slate-900 text-sm leading-tight">{customer.full_name}</div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 flex-shrink-0 text-slate-400" />
                        <span className="text-xs text-slate-500 num-val">{customer.phone}</span>
                      </div>
                      {customer.operation_type ? (
                        <span className="inline-flex w-fit items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-600">
                          {customer.operation_type === "buyer"
                            ? "🛒 مشتري"
                            : isBuyerTradeIn(customer.operation_type)
                              ? "🔄 مشتري + استبدال"
                              : isSellOnBehalf(customer.operation_type)
                                ? "🤝 بيع بالوكالة"
                                : customer.operation_type}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* السيارة المطلوبة */}
                  <td>
                    <div className="flex flex-col gap-1.5">
                      {/* السيارة المطلوبة — تُخفى إذا تطابقت مع الاستبدال */}
                      {showRequestedCar ? (
                        <div className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                          <span className="text-sm font-semibold text-slate-700 leading-tight">{carName}</span>
                        </div>
                      ) : !isBuyerTradeIn(customer.operation_type) && !carName ? (
                        <span className="text-xs text-slate-300">— لم تُحدَّد —</span>
                      ) : null}
                      {hasSpecialRequest && showRequestedCar ? (
                        <span className="inline-flex w-fit items-center rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-600">
                          ⚠️ غير متوفرة بالمعرض
                        </span>
                      ) : null}
                      {/* سيارة الاستبدال */}
                      {isBuyerTradeIn(customer.operation_type) && customer.trade_in_model ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1">
                          <Car className="h-3 w-3 flex-shrink-0 text-violet-500" />
                          <span className="text-xs font-semibold text-violet-700">{customer.trade_in_model}</span>
                          <span className="text-[10px] text-violet-400">(استبدال)</span>
                        </div>
                      ) : isBuyerTradeIn(customer.operation_type) && !carName ? (
                        <span className="text-xs text-slate-300">— لم تُحدَّد —</span>
                      ) : null}
                      {(() => {
                        const badge = tradeInStatusBadge(customer.trade_in_status, customer.operation_type);
                        return badge ? (
                          <span className={`text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                        ) : null;
                      })()}
                    </div>
                  </td>

                  {/* الحالة وموعد المتابعة */}
                  <td>
                    <div className="flex flex-col gap-1.5 items-start">
                      <StatusPill value={customer.status} />
                      {(() => {
                        const badge = inventoryAvailabilityBadge(customer.inventory_availability);
                        return badge ? (
                          <span className={`text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                        ) : null;
                      })()}
                      {customer.payment_method ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          💳 {customer.payment_method}
                        </span>
                      ) : null}
                      {customer.next_follow_up_at ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-1">
                          <CalendarClock className="h-3 w-3 flex-shrink-0 text-sky-500" />
                          <span className="text-xs font-semibold text-sky-700">{formatDate(customer.next_follow_up_at)}</span>
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* آخر تواصل */}
                  <td>
                    <div className="text-xs font-semibold text-emerald-700">
                      {formatDate(customer.last_contact_at ?? customer.updated_at ?? null)}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-cyan-500 px-2 py-0.5 text-xs font-bold text-white">
                      تفاعلات: {customer.visit_count ?? 0}
                    </div>
                  </td>

                  {/* الإجراءات */}
                  <td>
                    <div className="flex flex-col gap-1.5 items-center">
                      <div className="flex gap-1.5 items-center">
                        {/* زر التذكير */}
                        <form action={sendQuickReminderAction}>
                          <input type="hidden" name="recipient_user_id" value={customer.assigned_user_id ?? ""} />
                          <input type="hidden" name="recipient_branch_id" value={customer.branch_id ?? ""} />
                          <input type="hidden" name="recipient_label" value={customer.assigned_user_name ?? customer.branch_name ?? ""} />
                          <input type="hidden" name="title" value={`تذكير بمتابعة ${customer.full_name}`} />
                          <input
                            type="hidden"
                            name="message"
                            value={`يرجى متابعة ملف ${customer.full_name}${carName ? ` بخصوص ${carName}` : ""}. الحالة: ${customer.status ?? "غير محددة"}`}
                          />
                          <input type="hidden" name="redirect_to" value={basePath} />
                          <button type="submit" className="legacy-table-icon-btn" title={`تذكير ${customer.assigned_user_name ?? "الموظف"} عبر تيليغرام`}>
                            <Bell className="h-4 w-4" />
                          </button>
                        </form>

                        {/* زر التفاصيل */}
                        <Link
                          href={`${basePath}?customer=${customer.id}&mode=view${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                          className="legacy-table-btn legacy-table-btn--view"
                        >
                          التفاصيل
                        </Link>
                      </div>

                      {/* زر التعديل (للمديرين) */}
                      {includeEdit ? (
                        <Link
                          href={`${basePath}?customer=${customer.id}&mode=edit${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                          className="legacy-table-btn legacy-table-btn--edit w-full justify-center"
                        >
                          تعديل
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6}>
                <div className="empty-state">{emptyMessage}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
