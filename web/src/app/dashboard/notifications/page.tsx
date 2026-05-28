import { Bell, Mail, RefreshCcw, Target } from "lucide-react";

import { markNotificationReadAction } from "@/app/dashboard/actions";
import { ClearNotificationsBtn } from "@/components/clear-notifications-btn";
import { StatusPill } from "@/components/status-pill";
import { getNotificationsCenter, type NotificationsCenterItem } from "@/lib/data";
import { formatDate, formatRelativeDate } from "@/lib/format";

type KindFilter = "all" | "new_customer" | "customer_update" | "sales_opportunity" | "followup" | "other";

function getNotificationKind(item: NotificationsCenterItem): KindFilter {
  const payload = item.payload ?? {};
  const source = typeof payload.source === "string" ? payload.source : "";
  const title = (item.title ?? "").trim();

  if (source === "customer_create" || title.includes("إضافة عميل")) return "new_customer";
  if (source === "customer_update" || title.includes("تحديث ملف")) return "customer_update";
  if (source === "inventory_opportunity" || title.includes("فرصة")) return "sales_opportunity";
  if (source === "manual_reminder" || item.notification_type === "manual_reminder") return "followup";
  return "other";
}

function getKindLabel(kind: KindFilter) {
  if (kind === "new_customer") return "إدخال عميل جديد";
  if (kind === "customer_update") return "تعديل بيانات";
  if (kind === "sales_opportunity") return "فرص بيع";
  if (kind === "followup") return "متابعات";
  if (kind === "other") return "أخرى";
  return "الكل";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; q?: string }>;
}) {
  const center = await getNotificationsCenter(220);
  const { kind, status, q } = await searchParams;
  const activeKind = (kind as KindFilter | undefined) ?? "all";
  const activeStatus = status ?? "all";
  const query = (q ?? "").trim().toLowerCase();

  const kindCounts = center.items.reduce<Record<KindFilter, number>>(
    (acc, item) => {
      const k = getNotificationKind(item);
      acc[k] += 1;
      return acc;
    },
    { all: center.items.length, new_customer: 0, customer_update: 0, sales_opportunity: 0, followup: 0, other: 0 },
  );

  const filtered = center.items.filter((item) => {
    const itemKind = getNotificationKind(item);
    if (activeKind !== "all" && itemKind !== activeKind) return false;
    if (activeStatus !== "all" && item.status !== activeStatus) return false;
    if (!query) return true;
    const payloadSource = typeof item.payload?.source === "string" ? item.payload.source : "";
    const haystack = `${item.title ?? ""} ${item.message} ${item.recipient_label ?? ""} ${payloadSource}`.toLowerCase();
    return haystack.includes(query);
  });

  const makeHref = (next: { kind?: string; status?: string; q?: string }) => {
    const params = new URLSearchParams();
    const finalKind = next.kind ?? activeKind;
    const finalStatus = next.status ?? activeStatus;
    const finalQ = next.q ?? q ?? "";
    if (finalKind && finalKind !== "all") params.set("kind", finalKind);
    if (finalStatus && finalStatus !== "all") params.set("status", finalStatus);
    if (finalQ.trim()) params.set("q", finalQ.trim());
    const text = params.toString();
    return text ? `/dashboard/notifications?${text}` : "/dashboard/notifications";
  };

  return (
    <div className="legacy-grid gap-6">
      <div className="legacy-card" style={{ maxWidth: "1600px", margin: "0 auto" }}>
        <div className="legacy-card-header border-b-2 border-red-500">
          <h4 className="m-0 text-2xl font-bold text-red-600">
            <Bell className="me-2 inline h-6 w-6" />
            مركز التنبيهات
          </h4>
          <div className="flex items-center gap-2">
            <span className="legacy-interactions-pill">غير مقروء: {center.unreadCount}</span>
            <a href="/dashboard/notifications" className="legacy-btn legacy-btn-danger">
              <RefreshCcw className="h-4 w-4" />
              تحديث
            </a>
            <ClearNotificationsBtn />
          </div>
        </div>

        <form method="get" action="/dashboard/notifications" className="mb-3 mt-3 grid gap-2 md:grid-cols-[1fr_180px_180px_auto]">
          <input className="legacy-input" name="q" defaultValue={q ?? ""} placeholder="بحث في التنبيهات..." />
          <select className="legacy-select" name="status" defaultValue={activeStatus}>
            <option value="all">كل الحالات</option>
            <option value="unread">غير مقروء</option>
            <option value="read">مقروء</option>
          </select>
          <select className="legacy-select" name="kind" defaultValue={activeKind}>
            <option value="all">كل الأنواع</option>
            <option value="new_customer">إدخال عميل جديد</option>
            <option value="customer_update">تعديل بيانات</option>
            <option value="sales_opportunity">فرص بيع</option>
            <option value="followup">متابعات</option>
            <option value="other">أخرى</option>
          </select>
          <button type="submit" className="legacy-btn legacy-btn-primary">تطبيق</button>
        </form>

        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", "new_customer", "customer_update", "sales_opportunity", "followup", "other"] as KindFilter[]).map((k) => (
            <a
              key={k}
              href={makeHref({ kind: k })}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                activeKind === k ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {getKindLabel(k)} ({kindCounts[k]})
            </a>
          ))}
          <a
            href={makeHref({ status: activeStatus === "unread" ? "all" : "unread" })}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              activeStatus === "unread" ? "bg-amber-500 text-slate-900" : "bg-amber-100 text-amber-800 hover:bg-amber-200"
            }`}
          >
            غير المقروء فقط
          </a>
        </div>

        <div className="space-y-2">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const isUnread = item.status === "unread";
              const kindLabel = getKindLabel(getNotificationKind(item));
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 ${isUnread ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[220px] text-sm font-bold text-slate-700">
                      {formatDate(item.created_at)} · {formatRelativeDate(item.created_at)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        {kindLabel}
                      </span>
                      <StatusPill value={item.status} />
                      {isUnread ? (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notification_id" value={item.id} />
                          <button type="submit" className="legacy-btn legacy-btn-info">
                            تمت القراءة
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                    <Mail className="h-4 w-4 text-red-500" />
                    {item.title ?? "تنبيه"}
                    {item.recipient_label ? (
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <Target className="h-4 w-4" />
                        {item.recipient_label}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm leading-7 text-slate-700">{item.message}</p>
                </div>
              );
            })
          ) : (
            <div className="empty-state">لا توجد تنبيهات مطابقة للفلاتر الحالية.</div>
          )}
        </div>
      </div>
    </div>
  );
}
