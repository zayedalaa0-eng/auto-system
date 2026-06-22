import Link from "next/link";
import { Bell, CalendarClock, ChartBar, CircleAlert, Clock, FolderKanban, IdCard, Send, TrendingUp, TriangleAlert, UserCheck } from "lucide-react";

import { sendQuickReminderAction } from "@/app/dashboard/actions";
import { StatusPill } from "@/components/status-pill";
import { AgendaCustomerCard } from "@/components/agenda-customer-card";
import { CustomerForm } from "@/components/customer-form";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { CustomerProfileContent } from "@/components/customer-profile-content";
import { getDataQualityCounts, getDashboardOverview, getEmployeeDashboardStats, getLicenseAlertText, getOperationalAlerts, getPendingEvaluationWithDetails, getCustomerById, getCustomerFormOptions } from "@/lib/data";
import { formatRelativeDate } from "@/lib/format";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { DashboardAccordion } from "@/components/dashboard-accordion";

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



export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; mode?: string; focus?: string }>;
}) {
  const { customer: customerId, mode, focus } = await searchParams;

  // تحديد دور المستخدم
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: profileRow } = session
    ? await supabase.from("app_users").select("role, full_name").eq("auth_user_id", session.user.id).maybeSingle()
    : { data: null };
  const capabilities = getRoleCapabilities(profileRow?.role);
  const isEmployee = !capabilities.isManager;

  const [overview, operational, quality, empStats, pendingEvaluation, selectedCustomer, options] = await Promise.all([
    getDashboardOverview(),
    getOperationalAlerts(),
    getDataQualityCounts(),
    isEmployee ? getEmployeeDashboardStats() : Promise.resolve(null),
    getPendingEvaluationWithDetails(),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
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

        <div className="flex flex-col gap-4">
          {/* آخر العملاء */}
          <DashboardAccordion title="آخر عملائي" icon={UserCheck} iconColor="text-sky-500" count={empStats.myRecentCustomers.length} badgeColor="#0284c7">
            {empStats.myRecentCustomers.length > 0 ? (
              <div className="space-y-2">
                {empStats.myRecentCustomers.map((c) => (
                  <AgendaCustomerCard
                    key={c.id} id={c.id} name={c.full_name!}
                    sub1={`📌 ${c.status}`}
                    sub2={c.next_follow_up_at ? `📅 ${formatRelativeDate(c.next_follow_up_at)}` : undefined}
                    badge="جديد" badgeColor="#0284c7" detailBasePath={"/dashboard"}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state text-sm">لا يوجد عملاء بعد</div>
            )}
          </DashboardAccordion>
        </div>

        {/* نسبة الأداء والأهداف */}
        <div className="legacy-card">
          <div className="legacy-card-header mb-3">
            <h3 className="legacy-title flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              أهدافي وملخص الأداء
            </h3>
          </div>

          {/* شريط الأهداف (KPIs) */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">الهدف الشهري للمبيعات</span>
              <span className="text-sm font-bold text-sky-600">{empStats.mySales} / 5 سيارات</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div 
                className="h-full bg-sky-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (empStats.mySales / 5) * 100)}%` }} 
              />
            </div>
            {empStats.mySales >= 5 && (
              <div className="mt-2 text-xs font-bold text-emerald-600 text-center">🎉 مبروك! لقد حققت الهدف الشهري.</div>
            )}
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
      </section>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 flex flex-col gap-4 w-full">
          <DashboardAccordion title="سيارات مطلوبة غير متوفرة" icon={CircleAlert} iconColor="text-red-500" count={overview.unavailableRequests.length} badgeColor="#ef4444">
            {overview.unavailableRequests.length > 0 ? (
              overview.unavailableRequests.map((req) => (
                <AgendaCustomerCard
                  key={req.id} id={req.id} name={req.full_name!}
                  sub1={`🚗 ${req.requested_car ?? "غير محدد"}`}
                  sub2={req.sale_offer_car ? `💡 فرصة بيع: ${req.sale_offer_car}` : `📌 غير متوفرة`}
                  badge="مطلوبة" badgeColor="#ef4444" detailBasePath={"/dashboard"} linkQuery="?mode=view"
                />
              ))
            ) : (
              <div className="empty-state">لا توجد طلبات سيارات غير متوفرة حالياً.</div>
            )}
          </DashboardAccordion>
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <div className="legacy-card sticky top-4">
            <div className="legacy-card-header">
              <h3 className="legacy-title">جودة البيانات التشغيلية</h3>
              <CircleAlert className="h-5 w-5 text-sky-600" />
            </div>
            <div className="space-y-3">
              <Link href="/dashboard/customers?status=active" className="block rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:bg-slate-50 hover:shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">الدورات النشطة</span>
                  <span className="text-lg font-extrabold text-emerald-600">{activeCount}</span>
                </div>
              </Link>
              <Link href="/dashboard/customers?status=closed" className="block rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:bg-slate-50 hover:shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">الدورات المغلقة</span>
                  <span className="text-lg font-extrabold text-slate-500 dark:text-slate-400">{closedCount}</span>
                </div>
              </Link>
              <Link href="/dashboard/customers?missing=followup" className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition hover:bg-amber-100 hover:shadow-sm dark:bg-amber-900/20 dark:border-amber-800 dark:hover:bg-amber-900/40">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-800 dark:text-amber-500">ملفات نشطة بلا موعد متابعة</span>
                  <span className="text-lg font-extrabold text-amber-600">{missingFollowup}</span>
                </div>
              </Link>
              <Link href="/dashboard/customers?missing=car" className="block rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm transition hover:bg-rose-100 hover:shadow-sm dark:bg-rose-900/20 dark:border-rose-800 dark:hover:bg-rose-900/40">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-800 dark:text-rose-400">ملفات نشطة بلا سيارة مطلوبة</span>
                  <span className="text-lg font-extrabold text-rose-600">{missingRequestedCar}</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {selectedCustomer && options ? (
        <CustomerModalShell closeHref="/dashboard" title="">
          {mode === "edit" ? (
            <CustomerForm
              customer={selectedCustomer}
              options={options}
              returnPath={`/dashboard?customer=${selectedCustomer.id}&mode=view`}
            />
          ) : (
            <CustomerProfileContent
              customer={selectedCustomer}
              options={options}
              isManager={capabilities.isManager}
              initialOpenTradeEditor={focus === "trade"}
              compactTradeOnly={focus === "trade"}
              returnPath={`/dashboard?customer=${selectedCustomer.id}&mode=view`}
            />
          )}
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
