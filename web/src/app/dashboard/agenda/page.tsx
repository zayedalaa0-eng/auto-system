import Link from "next/link";

import { Bell, CalendarClock, ClipboardCheck, Eye, IdCard, Send, TriangleAlert } from "lucide-react";

import {
  completeReminderAction,
  markNotificationReadAction,
  sendQuickReminderAction,
} from "@/app/dashboard/actions";
import { AgendaCenterClient } from "@/components/agenda-center-client";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { getAgendaOverview, getLicenseAlertText, getOperationalAlerts } from "@/lib/data";
import { formatDate, formatRelativeDate } from "@/lib/format";

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

export default async function AgendaPage() {
  const [agenda, operational] = await Promise.all([getAgendaOverview(), getOperationalAlerts()]);

  return (
    <div className="legacy-grid gap-6">
      <section className="legacy-card">
        <p className="text-sm font-medium text-slate-500">مهام العملاء</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">مركز العمل اليومي</h2>
        <p className="mt-3 max-w-4xl text-sm leading-8 text-slate-600">
          هنا اقتربنا أكثر من روح الداشبورد الأصلية: مهام اليوم، نواقص الاستبدال، تنبيهات الرخص، والتذكيرات السريعة من نفس الشاشة.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="مستحقة اليوم" value={agenda.dueToday} hint="المهام والمتابعات التي يجب فتحها اليوم." tone="amber" icon={<CalendarClock className="h-5 w-5" />} />
        <MetricCard label="متأخرة" value={agenda.overdue} hint="العناصر التي تجاوزت وقتها وتحتاج إجراء سريع." tone="rose" icon={<Bell className="h-5 w-5" />} />
        <MetricCard label="ملفات غير مكتملة" value={agenda.incompleteCustomers.length} hint="ملفات عملاء تم حفظها بدون نوع عملية وتحتاج إكمال البيانات." tone="amber" icon={<ClipboardCheck className="h-5 w-5" />} />
        <MetricCard label="نواقص الاستبدال" value={operational.incompleteTrades.length} hint="ملفات تم الاتفاق على استبدالها وتحتاج استكمال بيانات السيارة." tone="sky" icon={<TriangleAlert className="h-5 w-5" />} />
      </section>

      <section className="legacy-card">
        <AgendaCenterClient
          agenda={agenda}
          incompleteTrades={operational.incompleteTrades}
          licenseDue={operational.licenseDue}
        />
      </section>

      {/* ── ملفات غير مكتملة ── */}
      {agenda.incompleteCustomers.length > 0 && (
        <section className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">⚠️ ملفات عملاء غير مكتملة ({agenda.incompleteCustomers.length})</h3>
            <ClipboardCheck className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-sm text-slate-500 mb-4">هذه الملفات تم حفظها بدون تحديد نوع العملية — يرجى فتحها وإكمال البيانات.</p>
          <div className="space-y-2">
            {agenda.incompleteCustomers.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/customers?customer=${item.id}&mode=view`}
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
        </section>
      )}

      <section className="legacy-grid legacy-grid-2">
        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">مهام العملاء بالأجندة</h3>
            <CalendarClock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-4">
            {agenda.followUps.length > 0 ? (
              agenda.followUps.map((item) => (
                <div key={item.id} className="agenda-task-card">
                  <div className="d-flex justify-content-between gap-3 align-items-start flex-wrap">
                    <div>
                      <div className="badge bg-dark mb-2">{item.source === "followup" ? "تواصل اليوم" : "مهمة"}</div>
                      <h6 className="fw-bold text-dark mb-1">{item.customer_name ?? "عميل بدون اسم"}</h6>
                      <div className="small fw-bold text-muted">الموظف: {item.staff_name ?? "بدون موظف"} | المعرض: {item.branch_name ?? "بدون فرع"}</div>
                      <div className="small fw-bold text-primary mt-1">السيارة: {item.message || "-"}</div>
                      <div className="small text-muted mt-1">
                        الحالة: {item.status} {item.due_at ? `| الموعد: ${formatDate(item.due_at)}` : ""}
                      </div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap justify-content-end">
                      {item.customer_id ? (
                        <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=view`} className="legacy-btn legacy-btn-info">
                          <Eye className="h-4 w-4" />
                          فتح الملف
                        </Link>
                      ) : null}
                      <ReminderButton
                        userId={item.recipient_user_id}
                        branchId={item.recipient_branch_id}
                        label={item.recipient_label}
                        title={`متابعة: ${item.customer_name ?? "عميل"}`}
                        message={`متابعة اليوم مطلوبة للحالة: ${item.status} | ${item.message}`}
                        variant="warning"
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد مهام أجندة حاليًا.</div>
            )}
          </div>
        </div>

        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">نواقص الاستبدال</h3>
            <TriangleAlert className="h-5 w-5 text-red-500" />
          </div>
          <div className="space-y-4">
            {operational.incompleteTrades.length > 0 ? (
              operational.incompleteTrades.map((item) => (
                <div key={item.trade_in_id} className="trade-issue-card">
                  <div>
                    <h6 className="fw-bold text-primary mb-1">العميل: {item.customer_name}</h6>
                    <div className="small text-muted fw-bold">سيارة العميل: {item.trade_in_model}</div>
                    <div className="small text-muted fw-bold">الموظف: {item.staff_name ?? "بدون موظف"} | المعرض: {item.branch_name ?? "بدون فرع"}</div>
                    <div className="mt-2 text-sm font-semibold text-rose-700">النواقص: {item.trade_in_missing_fields.join("، ")}</div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <ReminderButton
                      userId={null}
                      branchId={null}
                      label={item.staff_name}
                      title={`نواقص استبدال: ${item.customer_name}`}
                      message={`يرجى إكمال بيانات الاستبدال للسيارة ${item.trade_in_model}. النواقص الحالية: ${item.trade_in_missing_fields.join("، ")}`}
                      variant="warning"
                    />
                    <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=edit`} className="legacy-btn legacy-btn-danger">
                      إكمال البيانات
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد بيانات نواقص حاليًا.</div>
            )}
          </div>
        </div>
      </section>

      <section className="legacy-grid legacy-grid-2">
        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">تنبيهات الرخص</h3>
            <IdCard className="h-5 w-5 text-danger" />
          </div>
          <div className="space-y-4">
            {operational.licenseDue.length > 0 ? (
              operational.licenseDue.map((item) => (
                <div key={item.trade_in_id} className="license-due-card">
                  <div className="d-flex justify-content-between gap-3 align-items-center flex-wrap">
                    <div>
                      <h6 className="fw-bold text-danger mb-1">{getLicenseAlertText(item.trade_in_license_expiry)}</h6>
                      <div className="fw-bold text-dark">{item.customer_name} | {item.trade_in_model}</div>
                      <div className="license-due-card__meta">
                        الرخصة: {item.trade_in_license_expiry ?? "-"} | الموظف: {item.staff_name ?? "بدون موظف"} | المعرض: {item.branch_name ?? "بدون فرع"}
                      </div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      <ReminderButton
                        userId={item.staff_id ?? null}
                        branchId={item.branch_id ?? null}
                        label={item.staff_name ?? null}
                        title={`تحديث رخصة: ${item.customer_name}`}
                        message={`يرجى تحديث رخصة سيارة العميل ${item.customer_name} (${item.trade_in_model}) — الرخصة تنتهي: ${item.trade_in_license_expiry ?? "غير محدد"}`}
                        variant="warning"
                      />
                      <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=edit`} className="legacy-btn legacy-btn-danger">
                        فتح وتحديث
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد رخص تحتاج متابعة حاليًا.</div>
            )}
          </div>
        </div>

        <div className="legacy-card">
          <div className="legacy-card-header">
            <h3 className="legacy-title">التنبيهات غير المقروءة</h3>
            <Bell className="h-5 w-5 text-red-500" />
          </div>
          <div className="space-y-4">
            {agenda.notifications.length > 0 ? (
              agenda.notifications.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
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
              ))
            ) : (
              <div className="empty-state">لا توجد تنبيهات غير مقروءة.</div>
            )}
          </div>
        </div>
      </section>

      <section className="legacy-card">
        <div className="legacy-card-header">
          <h3 className="legacy-title">المهام الرسمية</h3>
          <ClipboardCheck className="h-5 w-5 text-sky-600" />
        </div>
        <div className="space-y-4">
          {agenda.reminders.length > 0 ? (
            agenda.reminders.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-slate-200 bg-[var(--panel-soft)] p-4">
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
                      <Link href={`/dashboard/customers?customer=${item.customer_id}&mode=view`} className="legacy-btn legacy-btn-info">
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
            ))
          ) : (
            <div className="empty-state">لا توجد مهام reminders مفتوحة حاليًا.</div>
          )}
        </div>
      </section>
    </div>
  );
}
