import Link from "next/link";
import { Bell, CalendarClock, ChartBar, CircleAlert, Clock, FolderKanban, IdCard, Send, TrendingUp, TriangleAlert, UserCheck } from "lucide-react";

import { sendQuickReminderAction } from "@/app/dashboard/actions";
import { StatusPill } from "@/components/status-pill";
import { getDataQualityCounts, getDashboardOverview, getEmployeeDashboardStats, getLicenseAlertText, getOperationalAlerts } from "@/lib/data";
import { formatRelativeDate } from "@/lib/format";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function DashboardReminderBtn({
  userId,
  branchId,
  label,
  title,
  message,
}: {
  userId: string | null;
  branchId: string | null;
  label: string | null;
  title: string;
  message: string;
}) {
  if (!userId && !branchId) return null;
  return (
    <form action={sendQuickReminderAction}>
      <input type="hidden" name="recipient_user_id" value={userId ?? ""} />
      <input type="hidden" name="recipient_branch_id" value={branchId ?? ""} />
      <input type="hidden" name="recipient_label" value={label ?? ""} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="message" value={message} />
      <input type="hidden" name="redirect_to" value="/dashboard" />
      <button
        type="submit"
        title={`إشعار ${label ?? "الموظف"} عبر تيليغرام`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
      >
        <Send className="h-3.5 w-3.5" />
        إشعار الموظف
      </button>
    </form>
  );
}

export default async function DashboardPage() {
  // تحديد دور المستخدم
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: profileRow } = session
    ? await supabase.from("app_users").select("role, full_name").eq("auth_user_id", session.user.id).maybeSingle()
    : { data: null };
  const capabilities = getRoleCapabilities(profileRow?.role);
  const isEmployee = !capabilities.isManager;

  const [overview, operational, quality, empStats] = await Promise.all([
    getDashboardOverview(),
    getOperationalAlerts(),
    getDataQualityCounts(),
    isEmployee ? getEmployeeDashboardStats() : Promise.resolve(null),
  ]);
  const { active: activeCount, closed: closedCount, missingFollowup, missingRequestedCar } = quality;

  // لوحة الموظف
  if (isEmployee && empStats) {
    return (
      <div className="legacy-grid gap-6" dir="rtl">
        <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <ChartBar className="h-6 w-6 text-sky-600" />
          إحصائياتي
          {profileRow?.full_name && (
            <span className="text-base font-medium text-slate-500">— {profileRow.full_name}</span>
          )}
        </div>

        {/* بطاقات الإحصاء */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "عملاء نشطون", value: empStats.myActiveCustomers, color: "text-sky-700", bg: "bg-sky-50", border: "#0284c7" },
            { label: "صفقات مكتملة", value: empStats.mySales, color: "text-emerald-700", bg: "bg-emerald-50", border: "#059669" },
            { label: "متابعات اليوم", value: empStats.myFollowupsToday, color: "text-amber-700", bg: "bg-amber-50", border: "#d97706" },
            { label: "متأخرات", value: empStats.myOverdueFollowups, color: "text-rose-700", bg: "bg-rose-50", border: "#dc2626" },
            { label: "مهام معلقة", value: empStats.myPendingReminders, color: "text-purple-700", bg: "bg-purple-50", border: "#7c3aed" },
            { label: "نسبة التحويل", value: `${empStats.conversionRate}%`, color: "text-teal-700", bg: "bg-teal-50", border: "#0d9488" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border-r-4 p-4 ${s.bg} shadow-sm`} style={{ borderRightColor: s.border }}>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{s.label}</div>
            </div>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* المتابعات المتأخرة */}
          <div className="legacy-card">
            <div className="legacy-card-header mb-3">
              <h3 className="legacy-title flex items-center gap-2">
                <Clock className="h-4 w-4 text-rose-500" />
                متابعاتي المتأخرة
                {empStats.myOverdueFollowups > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                    {empStats.myOverdueFollowups}
                  </span>
                )}
              </h3>
            </div>
            {empStats.myOverdueList.length > 0 ? (
              <div className="space-y-2">
                {empStats.myOverdueList.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/customers?customer=${c.id}&mode=view`}
                    className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 hover:bg-rose-100 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{c.full_name}</div>
                      <div className="text-xs text-slate-500">{c.phone}</div>
                    </div>
                    <div className="text-left">
                      <StatusPill value={c.status} />
                      <div className="text-xs text-rose-600 mt-1">{formatRelativeDate(c.next_follow_up_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state text-sm">✅ لا توجد متابعات متأخرة</div>
            )}
          </div>

          {/* آخر العملاء */}
          <div className="legacy-card">
            <div className="legacy-card-header mb-3">
              <h3 className="legacy-title flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-sky-500" />
                آخر عملائي
              </h3>
            </div>
            {empStats.myRecentCustomers.length > 0 ? (
              <div className="space-y-2">
                {empStats.myRecentCustomers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/customers?customer=${c.id}&mode=view`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors"
                  >
                    <div className="font-semibold text-slate-900 text-sm">{c.full_name}</div>
                    <div className="flex items-center gap-2">
                      <StatusPill value={c.status} />
                      {c.next_follow_up_at && (
                        <span className="text-xs text-amber-600">{formatRelativeDate(c.next_follow_up_at)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state text-sm">لا يوجد عملاء بعد</div>
            )}
          </div>
        </div>

        {/* نسبة الأداء */}
        <div className="legacy-card">
          <div className="legacy-card-header mb-3">
            <h3 className="legacy-title flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              ملخص أدائي
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-2xl font-bold text-slate-700">{empStats.myActiveCustomers + empStats.myClosedCustomers}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">إجمالي العملاء</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="text-2xl font-bold text-emerald-700">{empStats.mySales}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">صفقات مكتملة</div>
            </div>
            <div className="rounded-xl bg-sky-50 p-4">
              <div className="text-2xl font-bold text-sky-700">{empStats.conversionRate}%</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">معدل التحويل</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <div className="text-2xl font-bold text-rose-700">{empStats.myOverdueFollowups}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">متأخرات تحتاج تواصل</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill value={customer.status} />
                      <DashboardReminderBtn
                        userId={customer.assigned_user_id ?? null}
                        branchId={customer.branch_id ?? null}
                        label={customer.assigned_user_name ?? null}
                        title={`متابعة: ${customer.full_name}`}
                        message={`موعد متابعة العميل ${customer.full_name} (${customer.phone}) — الحالة: ${customer.status}`}
                      />
                    </div>
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
                  <div className="flex flex-col gap-2">
                    <DashboardReminderBtn
                      userId={item.staff_id ?? null}
                      branchId={item.branch_id ?? null}
                      label={item.staff_name ?? null}
                      title={`نواقص استبدال: ${item.customer_name}`}
                      message={`يرجى إكمال بيانات الاستبدال للعميل ${item.customer_name} (${item.trade_in_model}). النواقص: ${item.trade_in_missing_fields.join("، ")}`}
                    />
                    <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=edit`} className="legacy-btn legacy-btn-danger">
                      إكمال البيانات
                    </Link>
                  </div>
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
                    <div className="flex flex-col gap-2">
                      <DashboardReminderBtn
                        userId={item.staff_id ?? null}
                        branchId={item.branch_id ?? null}
                        label={item.staff_name ?? null}
                        title={`تحديث رخصة: ${item.customer_name}`}
                        message={`يرجى تحديث رخصة سيارة العميل ${item.customer_name} (${item.trade_in_model}) — الرخصة: ${item.trade_in_license_expiry ?? "غير محدد"}`}
                      />
                      <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=edit`} className="legacy-btn legacy-btn-danger">
                        فتح وتحديث
                      </Link>
                    </div>
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
            <h3 className="legacy-title">جودة البيانات التشغيلية</h3>
            <CircleAlert className="h-5 w-5 text-sky-600" />
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">الدورات النشطة</span>
                <span className="text-lg font-extrabold text-emerald-700">{activeCount}</span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">الدورات المغلقة</span>
                <span className="text-lg font-extrabold text-slate-700">{closedCount}</span>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-800">ملفات نشطة بلا موعد متابعة</span>
                <span className="text-lg font-extrabold text-amber-700">{missingFollowup}</span>
              </div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-800">ملفات نشطة بلا سيارة مطلوبة</span>
                <span className="text-lg font-extrabold text-rose-700">{missingRequestedCar}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
