"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Bell, ChevronDown, ClipboardCheck, ClipboardList, Eye, IdCard, ListChecks, MessageCircle, Send, Siren, X, Zap } from "lucide-react";

import { sendQuickReminderAction, sendEvaluationReminderAction } from "@/app/dashboard/actions";
import type { AgendaOverview, OperationalAlertItem, PendingEvaluationItem } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getRoleCapabilities } from "@/lib/roles";

type ModalKind = "tasks" | "trades" | "licenses" | "evaluation" | null;

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="legacy-btn legacy-btn-info"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      تذكير
    </button>
  );
}

function EvalReminderBtn({ label, sublabel }: { label: string; sublabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full px-3 py-2.5 text-right hover:bg-amber-50 flex items-center gap-2 disabled:opacity-50 border-b border-amber-50 last:border-0">
      {pending
        ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent shrink-0" />
        : <Bell className="h-3 w-3 text-amber-500 shrink-0" />}
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {sublabel ? <div className="text-xs text-slate-400">{sublabel}</div> : null}
      </div>
    </button>
  );
}

function EvalReminderDropdown({
  item,
  currentUserId,
  detailBasePath,
}: {
  item: PendingEvaluationItem;
  currentUserId: string | null;
  detailBasePath: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const photoUrls = item.photos.map((p) => p.public_url).join("||");

  // الموظفون المتاحون للإرسال — يُستثنى المستخدم الحالي
  const recipients = item.branch_staff.filter((s) => s.id !== currentUserId);

  // لا يوجد أحد آخر لإرساله؟
  if (recipients.length === 0) return null;

  // تسمية الدور بالعربي (تدعم العربي والإنجليزي)
  function roleLabel(role: string) {
    const c = getRoleCapabilities(role);
    if (c.isGeneralManager) return "مدير عام";
    if (c.isManager) return "مدير معرض";
    return "موظف";
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="legacy-btn legacy-btn-warning gap-1"
      >
        <Bell className="h-4 w-4" />
        تذكير
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-amber-200 bg-white shadow-lg overflow-hidden">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 text-xs font-bold text-amber-700">
            اختر من تريد تذكيره
          </div>
          {recipients.map((staff) => (
            <form
              key={staff.id}
              action={sendEvaluationReminderAction}
              onSubmit={() => setOpen(false)}
            >
              <input type="hidden" name="customer_id"       value={item.id} />
              <input type="hidden" name="customer_name"     value={item.full_name} />
              <input type="hidden" name="trade_in_model"    value={item.trade_in_model ?? ""} />
              <input type="hidden" name="branch_id"         value={item.branch_id ?? ""} />
              <input type="hidden" name="recipient_user_id" value={staff.id} />
              <input type="hidden" name="recipient_name"    value={staff.full_name} />
              <input type="hidden" name="photo_urls"        value={photoUrls} />
              <input type="hidden" name="redirect_to"       value={detailBasePath} />
              <EvalReminderBtn
                label={staff.full_name}
                sublabel={roleLabel(staff.role)}
              />
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReminderButton({
  userId,
  branchId,
  label,
  title,
  message,
  redirectTo = "/dashboard/agenda",
}: {
  userId: string | null;
  branchId: string | null;
  label: string | null;
  title: string;
  message: string;
  redirectTo?: string;
}) {
  return (
    <form action={sendQuickReminderAction}>
      <input type="hidden" name="recipient_user_id" value={userId ?? ""} />
      <input type="hidden" name="recipient_branch_id" value={branchId ?? ""} />
      <input type="hidden" name="recipient_label" value={label ?? ""} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="message" value={message} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <SubmitBtn />
    </form>
  );
}

/* ─── WhatsApp Evaluation Button ────────────────────────────────── */
function WhatsAppEvalButton({ item }: { item: PendingEvaluationItem }) {

  function buildMessage(): string {
    const line = "━━━━━━━━━━━━━━━━━━━━━━━━━━";

    const carLines = item.trade_in_model
      ? [
          line,
          "🚗 *بيانات السيارة المطلوب تقييمها*",
          line,
          item.trade_in_model      ? `▪️ *الموديل:* ${item.trade_in_model}`                                    : null,
          item.trade_in_color      ? `▪️ *اللون:* ${item.trade_in_color}`                                      : null,
          item.trade_in_year       ? `▪️ *سنة الصنع:* ${item.trade_in_year}`                                   : null,
          item.trade_in_mileage    ? `▪️ *الممشى:* ${item.trade_in_mileage.toLocaleString("en-US")} كم`        : null,
          item.trade_in_chassis    ? `▪️ *رقم الشاصي:* ${item.trade_in_chassis}`                              : null,
          item.trade_in_inspection ? `▪️ *تقرير الفحص:* ${item.trade_in_inspection}`                         : null,
          item.trade_in_status     ? `▪️ *الحالة الراهنة:* ${item.trade_in_status}`                           : null,
        ].filter(Boolean).join("\n")
      : null;

    const photosLines = item.photos.length > 0
      ? [
          ``,
          line,
          `📷 *صور السيارة (${item.photos.length}):*`,
          ...item.photos.slice(0, 5).map((p, i) => `${i + 1}. ${p.public_url}`),
        ].join("\n")
      : "";

    return [
      `🔔 *طلب تقييم سيارة*`,
      line,
      ``,
      `السادة المحترمون،`,
      `تحيةً طيبةً وبعد؛`,
      ``,
      `يُسعدنا التواصل معكم، ونأمل من سيادتكم التكرم بتقييم السيارة الموضحة بياناتها أدناه، وذلك لاتخاذ القرار المناسب بشأنها.`,
      ``,
      `نرجو مراجعة المعلومات المرفقة، والاطلاع على الصور إن وُجدت، ثم إفادتنا بـ *قيمة التقييم* في أقرب وقت ممكن حتى نتمكن من استكمال الإجراءات اللازمة.`,
      ``,
      carLines ?? `${line}\n🚗 لم تُسجَّل بيانات السيارة بعد`,
      photosLines,
      ``,
      line,
      `✅ *المطلوب:*`,
      `يُرجى التكرم بإرسال *قيمة التقييم* بالشيقل في أقرب وقت ممكن.`,
      ``,
      `شكرًا جزيلًا على تعاونكم واهتمامكم.`,
      line,
    ].filter((l) => l !== null).join("\n");
  }

  function handleClick() {
    const msg = buildMessage();
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="legacy-btn gap-1.5"
      style={{ backgroundColor: "#25D366", color: "#fff", borderColor: "#1ebe5d" }}
      title="إرسال طلب التقييم عبر واتساب"
    >
      <MessageCircle className="h-4 w-4" />
      واتساب
    </button>
  );
}

export function AgendaCenterClient({
  agenda,
  incompleteTrades,
  licenseDue,
  pendingEvaluation = [],
  initialModal = null,
  detailBasePath = "/dashboard/customers",
  showButtons = true,
  currentUserRole = "employee",
  currentUserId = null,
}: {
  agenda: AgendaOverview;
  incompleteTrades: OperationalAlertItem[];
  licenseDue: OperationalAlertItem[];
  pendingEvaluation?: PendingEvaluationItem[];
  initialModal?: ModalKind;
  detailBasePath?: string;
  showButtons?: boolean;
  currentUserRole?: string;
  currentUserId?: string | null;
}) {
  const [openModal, setOpenModal] = useState<ModalKind>(initialModal);
  const tasks = useMemo(() => [...agenda.followUps, ...agenda.reminders], [agenda.followUps, agenda.reminders]);

  return (
    <>
      {showButtons ? (
        <div className="legacy-action-strip">
          <Link href="/dashboard/agenda" className="legacy-action-pill legacy-action-pill--dark">
            <Zap className="h-4 w-4" />
            فتح مركز العمل
          </Link>

          {licenseDue.length > 0 ? (
            <button type="button" className="legacy-action-pill legacy-action-pill--rose" onClick={() => setOpenModal("licenses")}>
              <IdCard className="h-4 w-4" />
              رخص تحتاج متابعة
              <span className="legacy-count-badge">{licenseDue.length}</span>
            </button>
          ) : null}

          {incompleteTrades.length > 0 ? (
            <button type="button" className="legacy-action-pill legacy-action-pill--danger" onClick={() => setOpenModal("trades")}>
              <ClipboardList className="h-4 w-4" />
              إكمال نواقص الاستبدال
              <span className="legacy-count-badge">{incompleteTrades.length}</span>
            </button>
          ) : null}

          {pendingEvaluation.length > 0 ? (
            <button type="button" className="legacy-action-pill legacy-action-pill--info" onClick={() => setOpenModal("evaluation")}>
              <ClipboardCheck className="h-4 w-4" />
              بانتظار التقييم
              <span className="legacy-count-badge">{pendingEvaluation.length}</span>
            </button>
          ) : null}

          {tasks.length > 0 ? (
            <button type="button" className="legacy-action-pill legacy-action-pill--agenda" onClick={() => setOpenModal("tasks")}>
              <ListChecks className="h-4 w-4" />
              مهام العملاء
              <span className="legacy-count-badge">{tasks.length}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {openModal ? (
        <div className="fixed inset-0 z-[70] bg-black/40 pt-20 md:pt-24">
          <div className="mx-auto h-[calc(100vh-6rem)] w-[min(96vw,1100px)] overflow-hidden rounded-xl bg-slate-100 shadow-2xl md:h-[calc(100vh-7rem)]">
            <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 text-white ${openModal === "tasks" ? "bg-amber-500 text-slate-950" : "bg-rose-600"}`}>
              <h3 className="text-xl font-bold">
                <Siren className="me-2 inline h-5 w-5" />
                {openModal === "tasks"
                  ? "مهام العملاء بالأجندة"
                  : openModal === "trades"
                    ? "سيارات استبدال تتطلب إكمال البيانات"
                    : openModal === "evaluation"
                      ? "سيارات بانتظار التقييم"
                      : "رخص سيارات تحتاج متابعة"}
              </h3>
              <button type="button" onClick={() => setOpenModal(null)} className="rounded p-1 hover:bg-white/20">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="h-[calc(100%-56px)] overflow-auto p-4">
              <div className="space-y-3">
                {openModal === "tasks"
                  ? tasks.map((item) => (
                      <div key={`${item.source}-${item.id}`} className="rounded-lg border border-amber-300 bg-white p-4 shadow-sm">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded bg-slate-900 px-2 py-1 text-sm font-bold text-white">{item.status}</span>
                          <div className="text-sm text-slate-600">{item.due_at ? formatDate(item.due_at) : "-"}</div>
                        </div>
                        <div className="text-lg font-bold text-slate-900">{item.customer_name ?? "عميل"}</div>
                        <div className="text-sm text-slate-700">الموظف: {item.staff_name ?? "—"} | المعرض: {item.branch_name ?? "—"}</div>
                        <div className="text-sm text-blue-600">{item.message}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.customer_id ? (
                            <Link href={`${detailBasePath}?customer=${item.customer_id}&mode=view`} className="legacy-btn legacy-btn-info">
                              <Eye className="h-4 w-4" />
                              فتح الملف
                            </Link>
                          ) : null}
                          <ReminderButton
                            userId={item.recipient_user_id}
                            branchId={item.recipient_branch_id}
                            label={item.recipient_label}
                            title={`تذكير متابعة ${item.customer_name ?? "عميل"}`}
                            message={`تذكير متابعة: ${item.message}`}
                            redirectTo={detailBasePath}
                          />
                        </div>
                      </div>
                    ))
                  : null}

                {openModal === "trades"
                  ? incompleteTrades.map((item) => (
                      <div key={item.trade_in_id} className="rounded-lg border border-rose-300 bg-white p-4 shadow-sm">
                        <div className="text-lg font-bold text-blue-700">العميل: {item.customer_name}</div>
                        <div className="text-sm text-slate-700">سيارة العميل: {item.trade_in_model}</div>
                        <div className="text-sm text-slate-700">الموظف: {item.staff_name ?? "—"} | المعرض: {item.branch_name ?? "—"}</div>
                        <div className="mt-2 text-sm font-bold text-rose-700">النواقص: {item.trade_in_missing_fields.join("، ")}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ReminderButton
                            userId={item.staff_id ?? null}
                            branchId={item.branch_id ?? null}
                            label={item.staff_name ?? null}
                            title={`نواقص استبدال: ${item.customer_name}`}
                            message={`يرجى إكمال بيانات الاستبدال للسيارة ${item.trade_in_model}. النواقص: ${item.trade_in_missing_fields.join("، ")}`}
                            redirectTo={detailBasePath}
                          />
                          <Link href={`${detailBasePath}?customer=${item.customer_id}&mode=view&focus=trade`} className="legacy-btn legacy-btn-danger">
                            <ClipboardList className="h-4 w-4" />
                            إكمال البيانات
                          </Link>
                        </div>
                      </div>
                    ))
                  : null}

                {openModal === "licenses"
                  ? licenseDue.map((item) => (
                      <div key={item.trade_in_id} className="rounded-lg border border-rose-300 bg-white p-4 shadow-sm">
                        <div className="text-lg font-bold text-rose-700">{item.customer_name} | {item.trade_in_model}</div>
                        <div className="text-sm text-slate-700">الرخصة: {item.trade_in_license_expiry ?? "-"}</div>
                        <div className="text-sm text-slate-700">الموظف: {item.staff_name ?? "—"} | المعرض: {item.branch_name ?? "—"}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ReminderButton
                            userId={item.staff_id ?? null}
                            branchId={item.branch_id ?? null}
                            label={item.staff_name ?? null}
                            title={`تحديث رخصة: ${item.customer_name}`}
                            message={`يرجى تحديث رخصة سيارة العميل ${item.customer_name} (${item.trade_in_model}) — الرخصة: ${item.trade_in_license_expiry ?? "غير محدد"}`}
                            redirectTo={detailBasePath}
                          />
                          <Link href={`${detailBasePath}?customer=${item.customer_id}&mode=view&focus=trade`} className="legacy-btn legacy-btn-danger">
                            <IdCard className="h-4 w-4" />
                            فتح وتحديث
                          </Link>
                        </div>
                      </div>
                    ))
                  : null}

                {openModal === "evaluation"
                  ? pendingEvaluation.map((item) => (
                      <div key={item.id} className="rounded-lg border border-sky-300 bg-white p-4 shadow-sm">
                        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                          <div className="text-lg font-bold text-sky-700">{item.full_name}</div>
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">{item.status}</span>
                        </div>
                        {item.trade_in_model ? (
                          <div className="text-sm font-medium text-amber-700">🚗 السيارة: {item.trade_in_model}</div>
                        ) : null}
                        <div className="mt-1 text-sm text-slate-600">
                          الموظف: {item.assigned_user_name ?? "—"} | المعرض: {item.branch_name ?? "—"}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Link
                            href={`${detailBasePath}?customer=${item.id}&mode=view`}
                            className="legacy-btn legacy-btn-info"
                          >
                            <Eye className="h-4 w-4" />
                            فتح وتحديث
                          </Link>
                          <EvalReminderDropdown
                            item={item}
                            currentUserId={currentUserId}
                            detailBasePath={detailBasePath}
                          />
                          <WhatsAppEvalButton item={item} />
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
