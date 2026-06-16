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

function cleanCarPart(part: string): string {
  let p = part.replace(/\(?\s*طلب\s+خاص\s*\)?/gi, "");

  // تقسيم النص بناءً على أي نوع من الشرطات (العادية، الطويلة، أو المتوسطة)
  const segments = p.split(/\s*[-–—]\s*/);
  if (segments.length > 1) {
    // نبحث عن الجزء الذي يحتوي على سنة الصنع (4 أرقام)
    const yearIndex = segments.findIndex((s) => /^\d{4}$/.test(s.trim()));
    if (yearIndex !== -1) {
      // نأخذ الموديل والسنة فقط ونتجاهل ما بعدهما
      p = segments.slice(0, yearIndex + 1).join(" - ");
    } else {
      // إذا لم يكن هناك سنة، نأخذ الجزء الأول فقط
      p = segments[0];
    }
  }

  return p.trim();
}

/** يُرجع مصفوفة سيارات مطلوبة — كل سيارة باسمها وعلم "طلب خاص" */
function parseRequestedCars(
  value: string | null,
  tradeInModel?: string | null,
): Array<{ name: string; special: boolean }> {
  if (!value) return [];
  const tradeNorm = (tradeInModel ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return value
    .split("|")
    .map((raw) => {
      const special = /طلب\s+خاص/i.test(raw);
      const name = cleanCarPart(raw);
      return { name, special };
    })
    .filter((c) => {
      if (!c.name) return false;
      // إزالة سيارة الاستبدال من القائمة لتفادي التكرار
      if (tradeNorm) {
        const n = c.name.replace(/\s+/g, " ").trim().toLowerCase();
        if (n === tradeNorm || n.includes(tradeNorm) || tradeNorm.includes(n)) return false;
      }
      return true;
    });
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
            <th style={{ width: "145px", paddingInlineEnd: "8px" }}>المعرض / الموظف</th>
            <th style={{ width: "195px", paddingInlineStart: "8px" }}>العميل والهاتف</th>
            <th style={{ width: "250px" }}>السيارة</th>
            <th style={{ width: "135px", paddingInlineEnd: "8px" }}>الحالة</th>
            <th style={{ width: "95px", paddingInlineStart: "8px" }}>آخر تواصل</th>
            <th style={{ width: "90px" }}>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {customers.length > 0 ? (
            customers.map((customer) => {
              // قائمة السيارات المطلوبة — كل سيارة في عنصر (مع إزالة الاستبدال)
              const requestedCars = parseRequestedCars(
                customer.requested_car_report ?? customer.requested_car,
                isBuyerTradeIn(customer.operation_type) ? customer.trade_in_model : null,
              );

              return (
                <tr key={customer.id}>
                  {/* المعرض / التاريخ / الموظف */}
                  <td style={{ paddingInlineEnd: "8px" }}>
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
                  <td style={{ paddingInlineStart: "8px" }}>
                    <div className="flex flex-col gap-1.5">
                      {/* الاسم + أيقونة صغيرة + الكنية */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <User className="h-4 w-4 flex-shrink-0 text-sky-500" />
                        <span className="font-bold text-slate-900 text-sm leading-tight">{customer.full_name}</span>
                        {customer.nickname ? (
                          <span className="text-xs font-medium text-sky-500">({customer.nickname})</span>
                        ) : null}
                      </div>
                      {/* الهاتف */}
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 flex-shrink-0 text-slate-400" />
                        <span className="text-xs font-bold text-slate-800 num-val">{customer.phone}</span>
                      </div>
                      {/* نوع العملية */}
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

                  {/* السيارة */}
                  <td>
                    <div className="flex flex-col gap-1.5">
                      {/* بيع بالوكالة: سيارة العميل المعروضة للبيع */}
                      {isSellOnBehalf(customer.operation_type) ? (
                        customer.trade_in_model ? (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Car className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-700 leading-tight">{customer.trade_in_model}</span>
                            <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 flex-shrink-0">معروضة للبيع</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">— لم تُحدَّد —</span>
                        )
                      ) : (
                        <>
                          {/* السيارات المطلوبة — كل سيارة في سطر مع شارتها بجانبها (بدون لف) */}
                          {requestedCars.length > 0 ? (
                            requestedCars.map((rc, i) => {
                              // شارة توفر السيارة بالمخزون — تظهر على أول سيارة فقط
                              const availBadge = i === 0 ? inventoryAvailabilityBadge(customer.inventory_availability) : null;
                              return (
                                <div key={i} className="flex items-center gap-1.5 whitespace-nowrap">
                                  <Car className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                  <span className="text-sm font-semibold text-slate-700 leading-tight">{rc.name}</span>
                                  {rc.special ? (
                                    <span className="inline-flex items-center rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 flex-shrink-0">غير متوفرة بالمعرض</span>
                                  ) : availBadge ? (
                                    <span className={`inline-flex items-center text-[11px] font-semibold flex-shrink-0 ${availBadge.cls}`}>{availBadge.label}</span>
                                  ) : null}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-300">— لم تُحدَّد —</span>
                          )}

                          {/* سيارة الاستبدال */}
                          {isBuyerTradeIn(customer.operation_type) && customer.trade_in_model ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <Car className="h-3 w-3 flex-shrink-0 text-violet-500" />
                              <span className="text-sm font-semibold text-violet-700 leading-tight">{customer.trade_in_model}</span>
                              <span className="inline-flex items-center rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-600 flex-shrink-0">استبدال</span>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>

                  {/* الحالة وموعد المتابعة */}
                  <td style={{ paddingInlineEnd: "8px" }}>
                    <div className="flex flex-col gap-1.5 items-start">
                      <StatusPill value={customer.status} />
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
                  <td style={{ paddingInlineStart: "8px" }}>
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                        {formatDate(customer.last_contact_at ?? customer.updated_at ?? null)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500 px-2 py-0.5 text-[11px] font-bold text-white whitespace-nowrap">
                        تفاعلات: {customer.visit_count ?? 0}
                      </span>
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
                            value={`يرجى متابعة ملف ${customer.full_name}${requestedCars.length > 0 ? ` بخصوص ${requestedCars.map(c => c.name).join("، ")}` : ""}. الحالة: ${customer.status ?? "غير محددة"}`}
                          />
                          <input type="hidden" name="redirect_to" value={basePath} />
                          <button type="submit" className="legacy-table-icon-btn" title={`تذكير ${customer.assigned_user_name ?? "الموظف"} عبر تيليغرام`}>
                            <Bell className="h-4 w-4" />
                          </button>
                        </form>

                        {/* زر التفاصيل */}
                        <Link
                          href={`${basePath}?customer=${customer.id}&mode=view${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                          className="inline-flex h-[32px] flex-1 items-center justify-center rounded-lg bg-blue-600 px-2 text-[11px] font-bold !text-white hover:bg-blue-700 transition-colors shadow-sm"
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
