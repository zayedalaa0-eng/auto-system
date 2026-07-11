"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Building2, Calendar, CalendarClock, Car, Phone, User } from "lucide-react";

import { sendQuickReminderAction } from "@/app/dashboard/actions";
import { BranchLogo } from "@/components/branch-logo";
import { StatusPill } from "@/components/status-pill";
import type { CustomerItem } from "@/lib/data";
import { formatDate } from "@/lib/format";

/** يبحث عن حالة توفر سيارة محددة داخل خريطة كل سيارة على حدة — مطابقة جزئية مرنة بالاسم */
function findCarAvailability(carName: string, byCarMap: Record<string, string> | null | undefined): string | null {
  if (!byCarMap) return null;
  const norm = carName.trim().toLowerCase().replace(/\s+/g, " ");
  if (!norm) return null;
  for (const [key, status] of Object.entries(byCarMap)) {
    if (!key) continue;
    if (key.includes(norm) || norm.includes(key)) return status;
  }
  return null;
}

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
  
  // الاحتفاظ بكامل النص بما فيه رقم الشاصي لضمان المطابقة الدقيقة
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.ceil(customers.length / pageSize);
  const paginatedCustomers = customers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <table className="mobile-card-table premium-table">
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
          {paginatedCustomers.length > 0 ? (
            paginatedCustomers.map((customer) => {
              // قائمة السيارات المطلوبة — كل سيارة في عنصر (مع إزالة الاستبدال)
              const requestedCars = parseRequestedCars(
                customer.requested_car_report ?? customer.requested_car,
                isBuyerTradeIn(customer.operation_type) ? customer.trade_in_model : null,
              );

              return (
                <tr key={customer.id}>
                  {/* المعرض / التاريخ / الموظف */}
                  <td data-label="المعرض / الموظف" style={{ paddingInlineEnd: "8px" }}>
                    <div className="flex flex-col gap-1.5">
                      {customer.branch_name ? (
                        <div className="flex items-center gap-1.5">
                          {customer.branch_name?.includes("لمعلم") || customer.branch_name?.includes("شيري") || customer.branch_name?.includes("فورثنج") || customer.branch_name?.includes("فورثينج") || customer.branch_name?.includes("المعلم") || customer.branch_name?.includes("الفورثنك") || customer.branch_name?.includes("الشيري") ? (
                            <BranchLogo branchName={customer.branch_name} className="w-4 h-4 rounded-sm flex-shrink-0" />
                          ) : (
                            <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                          )}
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
                  <td data-label="العميل والهاتف" style={{ paddingInlineStart: "8px" }}>
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

                  {/* السيارة المطلوبة */}
                  <td data-label="السيارة المطلوبة">
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
                          {/* السيارات المطلوبة — كل سيارة في سطر مع شارة توفّرها الخاصة بها */}
                          {requestedCars.length > 0 ? (
                            requestedCars.map((rc, i) => {
                              // شارة توفر هذه السيارة بالتحديد — مطابقة بالاسم، مع رجوع للحقل القديم (أول سيارة فقط) إن لم تتوفر خريطة لكل سيارة
                              const status = findCarAvailability(rc.name, customer.inventory_availability_by_car)
                                ?? (i === 0 ? customer.inventory_availability : null);
                              const availBadge = inventoryAvailabilityBadge(status);
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
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <Car className="h-3 w-3 flex-shrink-0 text-violet-500" />
                                <span className="text-sm font-semibold text-violet-700 leading-tight">{customer.trade_in_model}</span>
                                <span className="inline-flex items-center rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-600 flex-shrink-0">استبدال</span>
                              </div>
                              {customer.trade_in_price ? (
                                <span className="inline-flex w-fit items-center rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 mt-0.5">
                                  التقييم: {customer.trade_in_price.toLocaleString("en-US")} ₪
                                </span>
                              ) : (
                                <span className="inline-flex w-fit items-center rounded-sm bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 ring-1 ring-inset ring-orange-200 mt-0.5">
                                  بانتظار التقييم
                                </span>
                              )}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>

                  {/* الحالة وتفاصيل المعاملة */}
                  <td data-label="الحالة وتفاصيل المعاملة" style={{ paddingInlineEnd: "8px" }}>
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

                  {/* المتابعات والأجندة */}
                  <td data-label="المتابعات والأجندة" style={{ paddingInlineStart: "8px" }}>
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
                  <td data-label="الإجراءات">
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 mt-auto border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            &#10094;
          </button>
          
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300 px-4">
            صفحة {currentPage} من {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            &#10095;
          </button>
        </div>
      )}
    </div>
  );
}
