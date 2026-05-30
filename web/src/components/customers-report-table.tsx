import Link from "next/link";
import { Bell, Car } from "lucide-react";

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
            <th style={{ width: "140px" }}>المعرض / التاريخ</th>
            <th style={{ width: "160px" }}>العميل والهاتف</th>
            <th style={{ width: "150px" }}>السيارة</th>
            <th style={{ width: "140px" }}>الحالة</th>
            <th style={{ width: "130px" }}>آخر تواصل</th>
            <th style={{ width: "120px" }}>الموظف</th>
            <th style={{ width: "130px" }}>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {customers.length > 0 ? (
            customers.map((customer) => {
              const carName = carNameOnly(customer.requested_car_report ?? customer.requested_car);
              const hasSpecialRequest = (customer.requested_car_report ?? customer.requested_car ?? "").includes("طلب خاص");

              return (
                <tr key={customer.id}>
                  {/* المعرض / التاريخ */}
                  <td>
                    {customer.branch_name ? (
                      <div className="text-sm font-semibold text-rose-600">{customer.branch_name}</div>
                    ) : null}
                    <div className="mt-1 text-xs text-slate-600 font-medium">
                      {formatDate(customer.created_at ?? null)}
                    </div>
                  </td>

                  {/* العميل والهاتف */}
                  <td>
                    <div className="font-bold text-slate-900 leading-tight">{customer.full_name}</div>
                    <div className="mt-1 text-xs text-slate-500 num-val">{customer.phone}</div>
                    {customer.operation_type ? (
                      <div className="mt-1 text-xs font-semibold text-sky-600">
                        {customer.operation_type === "buyer"
                          ? "مشتري"
                          : isBuyerTradeIn(customer.operation_type)
                            ? "مشتري + استبدال"
                            : isSellOnBehalf(customer.operation_type)
                              ? "بيع بالوكالة"
                              : customer.operation_type}
                      </div>
                    ) : null}
                  </td>

                  {/* السيارة المطلوبة */}
                  <td>
                    {carName ? (
                      <div className="car-cell">
                        <Car className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="car-cell__name">{carName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                    {hasSpecialRequest ? (
                      <div className="mt-1 text-xs font-semibold text-rose-600">غير متوفرة بالمعرض</div>
                    ) : null}
                    {/* سيارة الاستبدال — لعملاء مشتري + استبدال */}
                    {isBuyerTradeIn(customer.operation_type) && customer.trade_in_model ? (
                      <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-violet-600">
                        <Car className="h-3 w-3 flex-shrink-0" />
                        <span>{customer.trade_in_model} (استبدال)</span>
                      </div>
                    ) : null}
                    {(() => {
                      const badge = tradeInStatusBadge(customer.trade_in_status, customer.operation_type);
                      return badge ? (
                        <div className={`mt-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</div>
                      ) : null;
                    })()}
                  </td>

                  {/* الحالة وموعد المتابعة */}
                  <td>
                    <StatusPill value={customer.status} />
                    {(() => {
                      const badge = inventoryAvailabilityBadge(customer.inventory_availability);
                      return badge ? (
                        <div className={`mt-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</div>
                      ) : null;
                    })()}
                    {customer.payment_method ? (
                      <div className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        💳 {customer.payment_method}
                      </div>
                    ) : null}
                    {customer.next_follow_up_at ? (
                      <div className="mt-1.5 text-xs text-slate-400">
                        {formatDate(customer.next_follow_up_at)}
                      </div>
                    ) : null}
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

                  {/* الموظف */}
                  <td>
                    <span className="text-sm font-bold text-blue-600">
                      {customer.assigned_user_name ?? "—"}
                    </span>
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
              <td colSpan={7}>
                <div className="empty-state">{emptyMessage}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
