import { Bell, RefreshCcw } from "lucide-react";

import { ClearNotificationsBtn } from "@/components/clear-notifications-btn";
import { NotificationsList } from "@/components/notifications-list";
import { getNotificationsCenter, type NotificationsCenterItem } from "@/lib/data";

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
  searchParams: Promise<{ kind?: string; status?: string; q?: string; period?: string }>;
}) {
  const center = await getNotificationsCenter(500); // Increased limit to allow broader time search
  const { kind, status, q, period } = await searchParams;
  const activeKind = (kind as KindFilter | undefined) ?? "all";
  const activeStatus = status ?? "all";
  const activePeriod = period ?? "all";
  const query = (q ?? "").trim().toLowerCase();

  const kindCounts = center.items.reduce<Record<KindFilter, number>>(
    (acc, item) => {
      const k = getNotificationKind(item);
      acc[k] += 1;
      return acc;
    },
    { all: center.items.length, new_customer: 0, customer_update: 0, sales_opportunity: 0, followup: 0, other: 0 },
  );

  const now = new Date();
  
  const filtered = center.items.filter((item) => {
    const itemKind = getNotificationKind(item);
    if (activeKind !== "all" && itemKind !== activeKind) return false;
    if (activeStatus !== "all" && item.status !== activeStatus) return false;
    
    if (activePeriod !== "all") {
      const itemDate = new Date(item.created_at);
      const diffTime = Math.abs(now.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (activePeriod === "today" && diffDays > 1) return false;
      if (activePeriod === "last_2_days" && diffDays > 2) return false;
      if (activePeriod === "last_week" && diffDays > 7) return false;
      if (activePeriod === "last_month" && diffDays > 30) return false;
    }
    
    if (!query) return true;
    const payloadSource = typeof item.payload?.source === "string" ? item.payload.source : "";
    const haystack = `${item.title ?? ""} ${item.message} ${item.recipient_label ?? ""} ${payloadSource}`.toLowerCase();
    return haystack.includes(query);
  });

  const makeHref = (next: { kind?: string; status?: string; q?: string; period?: string }) => {
    const params = new URLSearchParams();
    const finalKind = next.kind ?? activeKind;
    const finalStatus = next.status ?? activeStatus;
    const finalPeriod = next.period ?? activePeriod;
    const finalQ = next.q ?? q ?? "";
    if (finalKind && finalKind !== "all") params.set("kind", finalKind);
    if (finalStatus && finalStatus !== "all") params.set("status", finalStatus);
    if (finalPeriod && finalPeriod !== "all") params.set("period", finalPeriod);
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

        <form method="get" action="/dashboard/notifications" className="mb-3 mt-3 grid gap-2 md:grid-cols-[1fr_140px_140px_140px_auto]">
          <input className="legacy-input" name="q" defaultValue={q ?? ""} placeholder="بحث في التنبيهات..." />
          <select className="legacy-select" name="period" defaultValue={activePeriod}>
            <option value="all">كل الأوقات</option>
            <option value="today">اليوم</option>
            <option value="last_2_days">آخر يومين</option>
            <option value="last_week">آخر أسبوع</option>
            <option value="last_month">آخر شهر</option>
          </select>
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

        <NotificationsList items={filtered} />
      </div>
    </div>
  );
}
