import Link from "next/link";

import { Bell, CalendarClock, ClipboardCheck, Eye, IdCard, Send, TriangleAlert } from "lucide-react";

import {
  completeReminderAction,
  markNotificationReadAction,
  sendQuickReminderAction,
} from "@/app/dashboard/actions";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { DashboardAccordion } from "@/components/dashboard-accordion";
import { AgendaCustomerCard } from "@/components/agenda-customer-card";
import { getAgendaOverview, getLicenseAlertText, getOperationalAlerts, getPendingEvaluationWithDetails, getCustomerById, getCustomerFormOptions } from "@/lib/data";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { CustomerProfileContent } from "@/components/customer-profile-content";
import { CustomerForm } from "@/components/customer-form";

function ReminderButton({
  userId,
  branchId,
  label,
  title,
  message,
  variant = "sky",
  redirectTo = "/dashboard/agenda",
}: {
  userId: string | null;
  branchId: string | null;
  label: string | null;
  title: string;
  message: string;
  variant?: "sky" | "warning";
  redirectTo?: string;
}) {
  const className =
    variant === "warning"
      ? "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
      : "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-100";

  return (
    <form action={sendQuickReminderAction}>
      <input type="hidden" name="recipient_user_id" value={userId ?? ""} />
      <input type="hidden" name="recipient_branch_id" value={branchId ?? ""} />
      <input type="hidden" name="recipient_label" value={label ?? ""} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="message" value={message} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <button type="submit" className={className}>
        <Send className="h-4 w-4" />
        تذكير الموظف
      </button>
    </form>
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; mode?: string; focus?: string }>;
}) {
  const { customer: customerId, mode, focus } = await searchParams;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: profileRow } = session
    ? await supabase.from("app_users").select("role, full_name").eq("auth_user_id", session.user.id).maybeSingle()
    : { data: null };
  const capabilities = getRoleCapabilities(profileRow?.role);

  const [agenda, operational, pendingEvaluation, selectedCustomer, options] = await Promise.all([
    getAgendaOverview(), 
    getOperationalAlerts(),
    getPendingEvaluationWithDetails(),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
  ]);

  return (
    <div className="legacy-grid gap-6">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">مركز العمل اليومي</h2>
          <p className="text-sm text-slate-500 mt-1">
            المهام والمتابعات، نواقص الاستبدال، والتذكيرات السريعة
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="مستحقة اليوم" value={agenda.dueToday} hint="المهام والمتابعات التي يجب فتحها اليوم." tone="amber" icon={<CalendarClock className="h-5 w-5" />} />
        <MetricCard label="متأخرة" value={agenda.overdue} hint="العناصر التي تجاوزت وقتها وتحتاج إجراء سريع." tone="rose" icon={<Bell className="h-5 w-5" />} />
        <MetricCard label="ملفات غير مكتملة" value={agenda.incompleteCustomers.length} hint="ملفات عملاء تم حفظها بدون نوع عملية وتحتاج إكمال البيانات." tone="amber" icon={<ClipboardCheck className="h-5 w-5" />} />
        <MetricCard label="نواقص الاستبدال" value={operational.incompleteTrades.length} hint="ملفات تم الاتفاق على استبدالها وتحتاج استكمال بيانات السيارة." tone="sky" icon={<TriangleAlert className="h-5 w-5" />} />
      </section>

      <div className="flex flex-col gap-4">
        {/* ملفات غير مكتملة */}
        <DashboardAccordion title="ملفات عملاء غير مكتملة" icon={ClipboardCheck} iconColor="text-amber-500" count={agenda.incompleteCustomers.length} badgeColor="#f59e0b">
          {agenda.incompleteCustomers.length > 0 ? (
            <div className="space-y-2">
              {agenda.incompleteCustomers.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/agenda?customer=${item.id}&mode=view`}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition hover:bg-amber-100"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-amber-900">{item.full_name}</div>
                    <div className="text-xs text-amber-700 flex gap-3">
                      <span>📱 {item.phone}</span>
                      {item.staff_name && <span>👤 {item.staff_name}</span>}
                      {item.branch_name && <span>🏢 {item.branch_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <Eye className="h-4 w-4" />
                    فتح وإكمال
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state text-sm">لا توجد ملفات غير مكتملة حاليًا.</div>
          )}
        </DashboardAccordion>

        {/* أقرب المتابعات */}
        <DashboardAccordion title="أقرب المتابعات" icon={CalendarClock} iconColor="text-amber-500" count={agenda.followUps.length} badgeColor="#f59e0b">
          {agenda.followUps.length > 0 ? (
            <div className="space-y-2">
              {agenda.followUps.map((customer) => (
                <AgendaCustomerCard
                  key={customer.id} id={customer.customer_id!} name={customer.customer_name!}
                  sub1={`📌 ${customer.status}${customer.due_at ? ` · 📅 ${formatRelativeDate(customer.due_at)}` : ""}`}
                  sub2={customer.message ? `🚗 ${customer.message}` : undefined}
                  badge="متابعة" badgeColor="#f59e0b" detailBasePath={"/dashboard/agenda"}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">لا توجد متابعات مجدولة بعد.</div>
          )}
        </DashboardAccordion>

        {/* المهام والتنبيهات القادمة */}
        <DashboardAccordion title="المهام والتنبيهات القادمة" icon={CalendarClock} iconColor="text-sky-600" count={agenda.reminders.length} badgeColor="#0284c7">
          {agenda.reminders.length > 0 ? (
            <div className="space-y-2">
              {agenda.reminders.map((reminder) => (
                <div key={reminder.id} style={{
                  padding: "10px 12px", borderRadius: 10,
                  border: "1px solid #dcfce7", background: "#f0fdf4", marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>
                    🔔 تذكير
                  </div>
                  {reminder.customer_name && (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                      👤 {reminder.customer_name}
                    </div>
                  )}
                  {reminder.message && (
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                      {reminder.message}
                    </div>
                  )}
                  <div className="text-left mt-2">
                    {reminder.customer_id && (
                      <Link href={`/dashboard/agenda?customer=${reminder.customer_id}&mode=view`} style={{
                        display: "inline-block", fontSize: 11, color: "#16a34a",
                        textDecoration: "none", border: "1px solid #bbf7d0",
                        borderRadius: 6, padding: "3px 8px", background: "#dcfce7",
                      }}>فتح الملف ↗</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">لا توجد مهام ظاهرة حاليًا.</div>
          )}
        </DashboardAccordion>

        {/* سيارات بانتظار التقييم */}
        <DashboardAccordion title="سيارات بانتظار التقييم" icon={ClipboardCheck} iconColor="text-yellow-600" count={pendingEvaluation.length} badgeColor="#ca8a04">
          {pendingEvaluation.length > 0 ? (
            <div className="space-y-2">
              {pendingEvaluation.map(e => (
                <AgendaCustomerCard
                  key={e.id} id={e.id} name={e.full_name}
                  sub1={`🚗 ${e.trade_in_model}`}
                  sub2={e.trade_in_status ? `📌 ${e.trade_in_status}` : undefined}
                  badge="بانتظار التقييم" badgeColor="#ca8a04" detailBasePath={"/dashboard/agenda"} linkQuery="?mode=view&focus=trade"
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">لا توجد سيارات بانتظار التقييم حاليًا.</div>
          )}
        </DashboardAccordion>

        {/* نواقص الاستبدال */}
        <DashboardAccordion title="نواقص الاستبدال" icon={TriangleAlert} iconColor="text-red-500" count={operational.incompleteTrades.length} badgeColor="#ef4444">
          {operational.incompleteTrades.length > 0 ? (
            <div className="space-y-2">
              {operational.incompleteTrades.map((item) => (
                <AgendaCustomerCard
                  key={item.trade_in_id} id={item.customer_id!} name={item.customer_name!}
                  sub1={`🚗 ${item.trade_in_model}`}
                  sub2={`⚠️ ${item.trade_in_missing_fields.length} حقل ناقص`}
                  badge={`${item.trade_in_missing_fields.length} ناقص`} badgeColor="#ef4444" detailBasePath={"/dashboard/agenda"} linkQuery="?mode=view&focus=trade"
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">لا توجد نواقص استبدال حاليًا.</div>
          )}
        </DashboardAccordion>
        
        {/* تنبيهات الرخص */}
        <DashboardAccordion title="تنبيهات الرخص" icon={IdCard} iconColor="text-amber-600" count={operational.licenseDue.length} badgeColor="#d97706">
          {operational.licenseDue.length > 0 ? (
            <div className="space-y-2">
              {operational.licenseDue.map((item) => (
                <AgendaCustomerCard
                  key={item.trade_in_id} id={item.customer_id!} name={item.customer_name!}
                  sub1={`🚗 ${item.trade_in_model}`}
                  sub2={`🗓 ${item.trade_in_license_expiry}`}
                  badge="قريبة الإنتهاء" badgeColor="#d97706" detailBasePath={"/dashboard/agenda"} linkQuery="?mode=view&focus=trade"
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">لا توجد رخص تحتاج متابعة حاليًا.</div>
          )}
        </DashboardAccordion>

        {/* التنبيهات غير المقروءة */}
        <DashboardAccordion title="التنبيهات غير المقروءة" icon={Bell} iconColor="text-red-500" count={agenda.notifications.length} badgeColor="#ef4444">
          {agenda.notifications.length > 0 ? (
            <div className="space-y-2">
              {agenda.notifications.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{item.recipient_label ?? "تنبيه عام"}</div>
                    <StatusPill value={item.status} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{item.message}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-500">{formatRelativeDate(item.due_at)}</div>
                    <div className="flex flex-wrap gap-2">
                      <ReminderButton
                        userId={item.recipient_user_id}
                        branchId={item.recipient_branch_id}
                        label={item.recipient_label}
                        title="تذكير بخصوص تنبيه سابق"
                        message={`متابعة للتنبيه السابق: ${item.message}`}
                      />
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="notification_id" value={item.id} />
                        <input type="hidden" name="redirect_to" value="/dashboard/agenda" />
                        <button type="submit" className="legacy-btn legacy-btn-info">
                          تمّت القراءة
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state text-sm">لا توجد تنبيهات غير مقروءة.</div>
          )}
        </DashboardAccordion>

        {/* المهام الرسمية */}
        <DashboardAccordion title="المهام الرسمية" icon={ClipboardCheck} iconColor="text-sky-600" count={agenda.reminders.length} badgeColor="#0284c7">
          {agenda.reminders.length > 0 ? (
            <div className="space-y-2">
              {agenda.reminders.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-[var(--panel-soft)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{item.customer_name ?? "مهمة عامة"}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {item.staff_name ?? "بدون موظف"} • {item.branch_name ?? "بدون فرع"}
                      </div>
                    </div>
                    <StatusPill value={item.status} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{item.message}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-500">
                      {formatDate(item.due_at)} • {formatRelativeDate(item.due_at)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.customer_id ? (
                        <Link href={`/dashboard/agenda?customer=${item.customer_id}&mode=view`} className="legacy-btn legacy-btn-info">
                          فتح الملف
                        </Link>
                      ) : null}
                      <ReminderButton
                        userId={item.recipient_user_id}
                        branchId={item.recipient_branch_id}
                        label={item.recipient_label}
                        title={`تذكير بخصوص ${item.customer_name ?? "المهمة"}`}
                        message={`تذكير من الأجندة: ${item.message}`}
                      />
                      <form action={completeReminderAction}>
                        <input type="hidden" name="reminder_id" value={item.id} />
                        <input type="hidden" name="redirect_to" value="/dashboard/agenda" />
                        <button type="submit" className="legacy-btn legacy-btn-success">
                          تم التنفيذ
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state text-sm">لا توجد مهام مفتوحة حاليًا.</div>
          )}
        </DashboardAccordion>
      </div>

      {selectedCustomer && options ? (
        <CustomerModalShell closeHref="/dashboard/agenda" title="">
          {mode === "edit" ? (
            <CustomerForm
              customer={selectedCustomer}
              options={options}
              returnPath={`/dashboard/agenda?customer=${selectedCustomer.id}&mode=view`}
            />
          ) : (
            <CustomerProfileContent
              customer={selectedCustomer}
              options={options}
              isManager={capabilities.isManager}
              initialOpenTradeEditor={focus === "trade"}
              compactTradeOnly={focus === "trade"}
              returnPath={`/dashboard/agenda?customer=${selectedCustomer.id}&mode=view`}
            />
          )}
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
