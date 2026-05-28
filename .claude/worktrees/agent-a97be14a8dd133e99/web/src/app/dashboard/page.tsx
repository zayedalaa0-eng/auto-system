import Link from "next/link";
import { Bell, CalendarClock, ChartBar, CircleAlert, FolderKanban, IdCard, TriangleAlert } from "lucide-react";

import { StatusPill } from "@/components/status-pill";
import { getDashboardOverview, getLicenseAlertText, getOperationalAlerts } from "@/lib/data";
import { formatRelativeDate } from "@/lib/format";

export default async function DashboardPage() {
  const [overview, operational] = await Promise.all([getDashboardOverview(), getOperationalAlerts()]);

  return (
    <div className="legacy-grid gap-6">
      <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
        <ChartBar className="h-6 w-6 text-sky-600" />
        لوحة الإحصائيات الشاملة
      </div>

      <section className="legacy-grid legacy-grid-stats">
        {overview.metrics.map((metric) => (
          <div key={metric.label} className="stat-card">
            <div className="text-4xl font-bold text-slate-900">{metric.value}</div>
            <div className="mt-2 font-bold text-slate-500">{metric.label}</div>
          </div>
        ))}
        <div className="stat-card" style={{ borderRightColor: "#ef4444" }}>
          <div className="text-4xl font-bold text-rose-600">{operational.incompleteTrades.length}</div>
          <div className="mt-2 font-bold text-slate-500">نواقص الاستبدال</div>
        </div>
        <div className="stat-card" style={{ borderRightColor: "#f59e0b" }}>
          <div className="text-4xl font-bold text-amber-600">{operational.licenseDue.length}</div>
          <div className="mt-2 font-bold text-slate-500">تنبيهات الرخص</div>
        </div>
      </section>

      <section className="legacy-grid legacy-grid-2">
        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">أقرب المتابعات</h3>
            <CalendarClock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-3">
            {overview.followUps.length > 0 ? (
              overview.followUps.map((customer) => (
                <div key={customer.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">{customer.full_name}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {customer.branch_name ?? "بدون فرع"} | {customer.phone}
                      </div>
                    </div>
                    <StatusPill value={customer.status} />
                  </div>
                  <div className="mt-2 text-sm text-slate-700">
                    السيارة: {customer.requested_car ?? "غير محدد"} | الموعد: {formatRelativeDate(customer.next_follow_up_at)}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد متابعات مجدولة بعد.</div>
            )}
          </div>
        </div>

        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">المهام والتنبيهات القادمة</h3>
            <FolderKanban className="h-5 w-5 text-sky-600" />
          </div>
          <div className="space-y-3">
            {overview.reminders.length > 0 ? (
              overview.reminders.map((reminder) => (
                <div key={reminder.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-900">{reminder.title ?? "تذكير بدون عنوان"}</div>
                    <StatusPill value={reminder.status} />
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {reminder.customer_name ?? "بدون عميل"} | {reminder.branch_name ?? "بدون فرع"}
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{reminder.message ?? "لا توجد ملاحظات إضافية."}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد مهام ظاهرة حاليًا.</div>
            )}
          </div>
        </div>
      </section>

      <section className="legacy-grid legacy-grid-2">
        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">نواقص الاستبدال</h3>
            <TriangleAlert className="h-5 w-5 text-red-500" />
          </div>
          <div className="space-y-3">
            {operational.incompleteTrades.length > 0 ? (
              operational.incompleteTrades.slice(0, 6).map((item) => (
                <div key={item.trade_in_id} className="trade-issue-card">
                  <div>
                    <h6 className="fw-bold text-primary mb-1">{item.customer_name}</h6>
                    <div className="small text-muted fw-bold">{item.trade_in_model}</div>
                    <div className="small text-muted fw-bold">الموظف: {item.staff_name ?? "بدون موظف"} | المعرض: {item.branch_name ?? "بدون فرع"}</div>
                    <div className="mt-2 text-sm font-semibold text-rose-700">النواقص: {item.trade_in_missing_fields.join("، ")}</div>
                  </div>
                  <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=edit`} className="legacy-btn legacy-btn-danger">
                    إكمال البيانات
                  </Link>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد نواقص استبدال حاليًا.</div>
            )}
          </div>
        </div>

        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">تنبيهات الرخص</h3>
            <IdCard className="h-5 w-5 text-danger" />
          </div>
          <div className="space-y-3">
            {operational.licenseDue.length > 0 ? (
              operational.licenseDue.slice(0, 6).map((item) => (
                <div key={item.trade_in_id} className="license-due-card">
                  <div className="d-flex justify-content-between gap-3 align-items-center flex-wrap">
                    <div>
                      <h6 className="fw-bold text-danger mb-1">{getLicenseAlertText(item.trade_in_license_expiry)}</h6>
                      <div className="fw-bold text-dark">{item.customer_name} | {item.trade_in_model}</div>
                      <div className="license-due-card__meta">
                        الرخصة: {item.trade_in_license_expiry ?? "-"} | الموظف: {item.staff_name ?? "بدون موظف"} | المعرض: {item.branch_name ?? "بدون فرع"}
                      </div>
                    </div>
                    <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=edit`} className="legacy-btn legacy-btn-danger">
                      فتح وتحديث
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد رخص تحتاج متابعة.</div>
            )}
          </div>
        </div>
      </section>

      <section className="legacy-grid legacy-grid-2">
        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">آخر التنبيهات</h3>
            <Bell className="h-5 w-5 text-red-500" />
          </div>
          <div className="space-y-3">
            {overview.notifications.length > 0 ? (
              overview.notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-bold text-slate-900">{notification.recipient_label ?? "تنبيه عام"}</div>
                    <StatusPill value={notification.status} />
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{notification.message}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد تنبيهات بعد.</div>
            )}
          </div>
        </div>

        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">ملاحظة تشغيلية</h3>
            <CircleAlert className="h-5 w-5 text-sky-600" />
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-8 text-slate-800">
            الصفحة أصبحت أقرب للأصل في مركز العمل نفسه: بطاقات الأجندة، نواقص الاستبدال، وتنبيهات الرخص باتت ظاهرة مباشرة بدل أن تبقى موزعة أو مخفية.
          </div>
        </div>
      </section>
    </div>
  );
}
