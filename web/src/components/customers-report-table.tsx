import Link from "next/link";
import { Bell } from "lucide-react";

import { sendQuickReminderAction } from "@/app/dashboard/actions";
import { StatusPill } from "@/components/status-pill";
import type { CustomerItem } from "@/lib/data";
import { formatDate } from "@/lib/format";

function carNameOnly(value: string | null) {
  if (!value) return "—";
  return (
    value
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
      .trim() || "—"
  );
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
    <div className="overflow-x-auto">
      <table className="premium-table">
        <thead className="legacy-standard-head">
          <tr>
            <th>التاريخ / المعرض</th>
            <th>الموظف</th>
            <th>العميل والهاتف</th>
            <th>السيارات المطلوبة</th>
            <th>الحالة (موعد المراجعة)</th>
            <th>آخر تواصل وتفاعلات</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {customers.length > 0 ? (
            customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <div className="font-semibold text-slate-900">{formatDate(customer.created_at ?? null)}</div>
                  <div className="mt-1 text-sm text-rose-500">{customer.branch_name ?? "بدون فرع"}</div>
                </td>
                <td className="font-bold text-blue-600">{customer.assigned_user_name ?? "—"}</td>
                <td>
                  <div className="font-bold text-slate-900">{customer.full_name}</div>
                  <div className="mt-1 text-sm text-slate-500">{customer.phone}</div>
                  {customer.operation_type ? <div className="mt-1 text-xs font-bold text-sky-700">{customer.operation_type}</div> : null}
                </td>
                <td>
                  <div className="legacy-car-pill">{carNameOnly(customer.requested_car_report ?? customer.requested_car)}</div>
                  {(customer.requested_car_report ?? customer.requested_car ?? "").includes("طلب خاص") ? (
                    <div className="mt-1 text-xs font-bold text-rose-700">مطلوبة غير متوفرة حاليا</div>
                  ) : null}
                  {customer.sale_offer_car ? <div className="mt-1 text-xs font-bold text-amber-700">معروضة للبيع</div> : null}
                </td>
                <td>
                  <div className="space-y-2">
                    <StatusPill value={customer.status} />
                    <div className="text-sm text-slate-500">{formatDate(customer.next_follow_up_at)}</div>
                  </div>
                </td>
                <td>
                  <div className="legacy-contact-meta">{formatDate(customer.last_contact_at ?? customer.updated_at ?? null)}</div>
                  <div className="legacy-interactions-pill">تفاعلات: {customer.visit_count ?? 0}</div>
                </td>
                <td>
                  <div className="legacy-table-actions">
                    <form action={sendQuickReminderAction}>
                      <input type="hidden" name="recipient_user_id" value={customer.assigned_user_id ?? ""} />
                      <input type="hidden" name="recipient_branch_id" value={customer.branch_id ?? ""} />
                      <input type="hidden" name="recipient_label" value={customer.assigned_user_name ?? customer.branch_name ?? ""} />
                      <input type="hidden" name="title" value={`تذكير بمتابعة ${customer.full_name}`} />
                      <input
                        type="hidden"
                        name="message"
                        value={`يرجى متابعة ملف ${customer.full_name}${customer.requested_car_report ?? customer.requested_car ? ` بخصوص ${carNameOnly(customer.requested_car_report ?? customer.requested_car)}` : ""}.`}
                      />
                      <button type="submit" className="legacy-table-icon-btn" title="تذكير الموظف">
                        <Bell className="h-4 w-4" />
                      </button>
                    </form>
                    <Link
                      href={`${basePath}?customer=${customer.id}&mode=view${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                      className="legacy-table-btn legacy-table-btn--view"
                    >
                      التفاصيل
                    </Link>
                    {includeEdit ? (
                      <Link
                        href={`${basePath}?customer=${customer.id}&mode=edit${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                        className="legacy-table-btn legacy-table-btn--edit"
                      >
                        تعديل
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
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
