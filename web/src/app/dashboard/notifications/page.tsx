import { Bell, Mail, RefreshCcw, Target } from "lucide-react";

import { clearNotificationsCenterAction, markNotificationReadAction } from "@/app/dashboard/actions";
import { StatusPill } from "@/components/status-pill";
import { getNotificationsCenter } from "@/lib/data";
import { formatDate, formatRelativeDate } from "@/lib/format";

export default async function NotificationsPage() {
  const center = await getNotificationsCenter(160);

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
            <form action={clearNotificationsCenterAction}>
              <button type="submit" className="legacy-btn legacy-btn-secondary">
                حذف الكل
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-2">
          {center.items.length > 0 ? (
            center.items.map((item) => {
              const isUnread = item.status === "unread";
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 ${isUnread ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[220px] text-sm font-bold text-slate-700">
                      {formatDate(item.created_at)} • {formatRelativeDate(item.created_at)}
                    </div>
                    <div className="flex items-center gap-2">
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
                    {item.notification_type ? <span className="text-slate-500">• {item.notification_type}</span> : null}
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
            <div className="empty-state">لا توجد تنبيهات حاليًا.</div>
          )}
        </div>
      </div>
    </div>
  );
}
