"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Bell, ChevronDown, ChevronUp, ClipboardCheck, ClipboardList, Eye, IdCard, ListChecks, MessageCircle, Send, Siren, X, Zap, Check } from "lucide-react";

import { sendQuickReminderAction, sendEvaluationReminderAction, sendEvaluationReplyAction } from "@/app/dashboard/actions";
import type { AgendaOverview, OperationalAlertItem, PendingEvaluationItem } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getRoleCapabilities } from "@/lib/roles";
import { CarGalleryViewer } from "./car-gallery-viewer";

type ModalKind = "tasks" | "trades" | "licenses" | "evaluation" | "full_agenda" | null;

function arabicDate(): string {
  const now = new Date(Date.now() + 3*60*60*1000);
  return `${String(now.getUTCDate()).padStart(2,"0")}/${String(now.getUTCMonth()+1).padStart(2,"0")}/${now.getUTCFullYear()}`;
}

function AgendaSection({
  title, icon, count, color, children, defaultOpen = false,
}: {
  title: string; icon: string; count: number; color: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${color}33`,
      background: "#fff", overflow: "hidden", marginBottom: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "12px 14px",
          background: `${color}0d`, border: "none", cursor: "pointer",
          textAlign: "right",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title}</span>
          <span style={{
            background: color, color: "#fff", borderRadius: 20,
            padding: "2px 9px", fontSize: 12, fontWeight: 700,
          }}>{count}</span>
        </div>
        <span style={{ fontSize: 16, color, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </button>
      {open && <div style={{ padding: "10px 14px 14px" }}>{children}</div>}
    </div>
  );
}

function AgendaCustomerCard({
  id, name, sub1, sub2, badge, badgeColor, detailBasePath,
}: {
  id: string; name: string; sub1?: string; sub2?: string;
  badge?: string; badgeColor?: string; detailBasePath: string;
}) {
  const cardUrl = `${detailBasePath}?customer=${id}&mode=view`;
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0",
      background: "#f8fafc", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{name}</div>
          {sub1 && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{sub1}</div>}
          {sub2 && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>{sub2}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {badge && (
            <span style={{
              background: badgeColor ?? "#e2e8f0", color: "#fff",
              borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
              whiteSpace: "nowrap",
            }}>{badge}</span>
          )}
          <Link
            href={cardUrl}
            style={{
              display: "inline-block", fontSize: 11, color: "#2563eb",
              textDecoration: "none", border: "1px solid #bfdbfe",
              borderRadius: 6, padding: "3px 8px", background: "#eff6ff",
            }}
          >
            فتح الملف ↗
          </Link>
        </div>
      </div>
    </div>
  );
}

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

function SaveEvaluationBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="legacy-btn legacy-btn-primary shrink-0"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      حفظ التقييم
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
  const [expandedEvalId, setExpandedEvalId] = useState<string | null>(null);
  const tasks = useMemo(() => [...agenda.followUps, ...agenda.reminders], [agenda.followUps, agenda.reminders]);

  const tzOffset = 3 * 60 * 60 * 1000;
  const localNow = new Date(Date.now() + tzOffset);
  const todayStr = localNow.toISOString().slice(0, 10);
  const todayStart = new Date(todayStr + "T00:00:00.000Z").getTime() - tzOffset;

  const followupsToday = useMemo(() => agenda.followUps.filter(f => {
    if (!f.due_at) return false;
    const time = new Date(f.due_at).getTime();
    return time >= todayStart;
  }), [agenda.followUps, todayStart]);

  const followupsOverdue = useMemo(() => agenda.followUps.filter(f => {
    if (!f.due_at) return false;
    const time = new Date(f.due_at).getTime();
    return time < todayStart;
  }), [agenda.followUps, todayStart]);

  return (
    <>
      {showButtons ? (
        <div className="legacy-action-strip">
          <button type="button" className="legacy-action-pill legacy-action-pill--dark" onClick={() => setOpenModal("full_agenda")}>
            <Zap className="h-4 w-4" />
            فتح مركز العمل
          </button>

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

      {openModal === "full_agenda" ? (
        <div className="mt-4 flex flex-col bg-[#f1f5f9] font-sans rounded-xl overflow-hidden border border-slate-200 shadow-sm transition-all" dir="rtl">
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
            padding: "18px 16px 16px",
            color: "#fff",
            position: "relative",
            flexShrink: 0
          }}>
            <button type="button" onClick={() => setOpenModal(null)} className="absolute left-4 top-4 rounded-full p-1.5 bg-white/10 hover:bg-white/20 text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
            <div style={{ fontSize: 22, marginBottom: 2 }}>📅</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>الأجندة</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{arabicDate()}</div>
          </div>

          {/* Body */}
          <div className="flex-1 p-4 pt-3 space-y-4">
            {/* Summary Bar */}
            <div style={{
              background: "#fff", borderRadius: 12, padding: "10px 14px",
              marginBottom: 14, border: "1px solid #e2e8f0",
              display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
            }}>
              {followupsToday.length > 0 && (
                <span style={{ background: "#eff6ff", color: "#2563eb", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  ⏰ {followupsToday.length} متابعة اليوم
                </span>
              )}
              {followupsOverdue.length > 0 && (
                <span style={{ background: "#fff7ed", color: "#ea580c", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  ⚠️ {followupsOverdue.length} متأخرة
                </span>
              )}
              {agenda.reminders.length > 0 && (
                <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  🔔 {agenda.reminders.length} تذكير
                </span>
              )}
              {pendingEvaluation.length > 0 && (
                <span style={{ background: "#fefce8", color: "#ca8a04", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  🔍 {pendingEvaluation.length} تقييم
                </span>
              )}
              {incompleteTrades.length > 0 && (
                <span style={{ background: "#fdf4ff", color: "#9333ea", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  📋 {incompleteTrades.length} ناقصة
                </span>
              )}
              {licenseDue.length > 0 && (
                <span style={{ background: "#fff1f2", color: "#e11d48", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  📄 {licenseDue.length} رخصة
                </span>
              )}
              {agenda.notifications && agenda.notifications.length > 0 && (
                <span style={{ background: "#ecfeff", color: "#0891b2", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  📩 {agenda.notifications.length} تنبيه
                </span>
              )}
            </div>

            {/* Sections */}
            <AgendaSection title="متابعات اليوم" icon="⏰" count={followupsToday.length} color="#2563eb">
              {followupsToday.map(c => (
                <AgendaCustomerCard
                  key={c.id} id={c.customer_id!} name={c.customer_name!}
                  sub1={`📌 ${c.status}${c.due_at ? ` · 📅 ${formatDate(c.due_at)}` : ""}`}
                  sub2={c.message ? `🚗 ${c.message}` : undefined}
                  badge="متابعة اليوم" badgeColor="#2563eb" detailBasePath={detailBasePath}
                />
              ))}
            </AgendaSection>

            <AgendaSection title="متابعات متأخرة" icon="⚠️" count={followupsOverdue.length} color="#ea580c">
              {followupsOverdue.map(c => {
                const overdueDays = c.due_at ? Math.floor((Date.now() - new Date(c.due_at).getTime()) / 86400000) : 0;
                return (
                  <AgendaCustomerCard
                    key={c.id} id={c.customer_id!} name={c.customer_name!}
                    sub1={`📌 ${c.status}`}
                    sub2={`⏰ متأخر ${overdueDays} يوم${c.message ? ` · 🚗 ${c.message}` : ""}`}
                    badge={`${overdueDays}d`} badgeColor="#ea580c" detailBasePath={detailBasePath}
                  />
                );
              })}
            </AgendaSection>

            <AgendaSection title="تذكيرات معلقة" icon="🔔" count={agenda.reminders.length} color="#16a34a">
              {agenda.reminders.map(r => (
                <div key={r.id} style={{
                  padding: "10px 12px", borderRadius: 10,
                  border: "1px solid #dcfce7", background: "#f0fdf4", marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>
                    🔔 {r.message ?? "تذكير"}
                  </div>
                  {r.customer_name && (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                      👤 {r.customer_name}
                    </div>
                  )}
                  {r.due_at && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      📅 {formatDate(r.due_at)}
                    </div>
                  )}
                  <div className="text-left mt-2">
                    <Link href={`${detailBasePath}?customer=${r.customer_id}&mode=view`} style={{
                      display: "inline-block", fontSize: 11, color: "#16a34a",
                      textDecoration: "none", border: "1px solid #bbf7d0",
                      borderRadius: 6, padding: "3px 8px", background: "#dcfce7",
                    }}>فتح الملف ↗</Link>
                  </div>
                </div>
              ))}
            </AgendaSection>

            <AgendaSection title="سيارات بانتظار التقييم" icon="🔍" count={pendingEvaluation.length} color="#ca8a04">
              {pendingEvaluation.map(e => (
                <AgendaCustomerCard
                  key={e.id} id={e.id} name={e.full_name}
                  sub1={`🚗 ${e.trade_in_model}`}
                  sub2={e.trade_in_status ? `📌 ${e.trade_in_status}` : undefined}
                  badge="بانتظار التقييم" badgeColor="#ca8a04" detailBasePath={detailBasePath}
                />
              ))}
            </AgendaSection>

            <AgendaSection title="سيارات بيانات ناقصة" icon="📋" count={incompleteTrades.length} color="#9333ea">
              {incompleteTrades.map(t => (
                <AgendaCustomerCard
                  key={t.trade_in_id} id={t.customer_id!} name={t.customer_name!}
                  sub1={`🚗 ${t.trade_in_model}`}
                  sub2={`⚠️ ${t.trade_in_missing_fields.length} حقل ناقص`}
                  badge={`${t.trade_in_missing_fields.length} ناقص`} badgeColor="#9333ea" detailBasePath={detailBasePath}
                />
              ))}
            </AgendaSection>

            <AgendaSection title="رخص تحتاج متابعة" icon="📄" count={licenseDue.length} color="#e11d48">
              {licenseDue.map(l => (
                <AgendaCustomerCard
                  key={l.trade_in_id} id={l.customer_id!} name={l.customer_name!}
                  sub1={`🚗 ${l.trade_in_model}`}
                  sub2={`🗓 ${l.trade_in_license_expiry}`}
                  badge="قريبة الإنتهاء" badgeColor="#e11d48" detailBasePath={detailBasePath}
                />
              ))}
            </AgendaSection>

            {/* التنبيهات غير المقروءة */}
            <AgendaSection title="تنبيهات غير مقروءة" icon="📩" count={agenda.notifications?.length || 0} color="#0891b2">
              {agenda.notifications?.map(item => (
                <div key={item.id} style={{
                  padding: "12px 14px", borderRadius: 10,
                  border: "1px solid #cffafe", background: "#ecfeff", marginBottom: 8,
                  display: "flex", flexDirection: "column", gap: 6
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#164e63", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{item.recipient_label ?? "تنبيه نظام"}</span>
                    {item.status === "unread" && (
                      <span style={{ background: "#06b6d4", color: "#fff", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: "bold" }}>
                        جديد
                      </span>
                    )}
                  </div>
                  <div 
                    style={{ fontSize: 13, color: "#0891b2", lineHeight: 1.5, wordBreak: "break-word" }}
                    dangerouslySetInnerHTML={{ __html: item.message }} 
                  />
                  <div style={{ fontSize: 11, color: "#06b6d4", marginTop: 2 }}>
                    {item.due_at ? formatDate(item.due_at) : ""}
                  </div>
                </div>
              ))}
            </AgendaSection>
          </div>
        </div>
      ) : null}

      {openModal && openModal !== "full_agenda" ? (
        <div className="fixed inset-0 z-[70] bg-black/40 pt-20 md:pt-24">
          <div className="mx-auto h-[calc(100vh-6rem)] w-[min(96vw,1100px)] overflow-hidden rounded-xl bg-slate-100 shadow-2xl md:h-[calc(100vh-7rem)] flex flex-col relative">
            <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 text-white ${openModal === "tasks" ? "bg-amber-500 text-slate-950" : "bg-rose-600"}`}>
              <h3 className="text-xl font-bold">
                <Siren className="me-2 inline h-5 w-5" />
                {openModal === "tasks"
                  ? "مهام العملاء بالأجندة"
                  : openModal === "trades"
                    ? "سيارات استبدال تتطلب إكمال البيانات"
                    : openModal === "evaluation"
                      ? "سيارات بانتظار التقييم"
                      : openModal === "licenses"
                        ? "رخص سيارات تحتاج متابعة"
                        : ""}
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
                  ? (
                    <div className="space-y-3">
                      {pendingEvaluation.map((item) => {
                        return (
                          <div key={item.id} className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <button 
                              type="button" 
                              onClick={() => setExpandedEvalId(item.id)}
                              className="w-full text-right p-4 bg-sky-50 hover:bg-sky-100 flex items-center justify-between transition-colors"
                            >
                              <div>
                                <div className="text-lg font-bold text-sky-800">{item.full_name}</div>
                                <div className="text-sm font-medium text-amber-700 mt-1">🚗 {item.trade_in_model ?? "مركبة"} • {item.branch_name ?? "—"}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-900 border border-sky-200 shadow-sm hidden sm:inline-block">
                                  {item.status}
                                </span>
                                <span className="legacy-btn legacy-btn-primary shadow-sm pointer-events-none">
                                  فتح التقييم
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                  : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* النافذة المنبثقة المنفصلة لبيانات التقييم */}
      {expandedEvalId && (() => {
        const item = pendingEvaluation?.find((x) => x.id === expandedEvalId);
        if (!item) return null;
        const photosList = item.photos.map((p) => p.public_url).filter(Boolean) as string[];

        return (
          <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[96vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
              
              {/* ترويسة النافذة المنبثقة */}
              <div className="flex items-start justify-between bg-sky-700 text-white p-3 md:p-4 shrink-0 shadow-sm z-10">
                <div className="space-y-1">
                  <div className="font-bold text-lg leading-tight">
                    تقييم سيارة السيد/ة: {item.full_name} {item.phone ? ` - ${item.phone}` : ""}
                  </div>
                  <div className="text-sky-200 text-sm font-medium">
                    🚗 {item.trade_in_model ?? "مركبة"}
                  </div>
                  <div className="text-sky-300 text-xs flex items-center gap-1">
                    👤 الموظف: {item.assigned_user_name ?? "—"}
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setExpandedEvalId(null)} 
                  className="rounded-full p-1.5 hover:bg-sky-600 transition-colors bg-sky-800/50 text-white shrink-0"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* المحتوى القابل للتمرير */}
              <div className="overflow-y-auto flex-1 bg-slate-50 p-0 md:p-2">
                <div className="bg-white md:rounded-xl md:shadow-sm overflow-hidden md:border md:border-slate-200">
                  {/* 1. معرض الصور بالكامل في الأعلى */}
                  <div className="bg-slate-50 border-b border-slate-200 p-2">
                    <CarGalleryViewer photos={photosList} carLabel={item.trade_in_model ?? "مركبة العميل"} />
                  </div>

                  {/* 2. تفاصيل العميل والسيارة (على شكل بطاقة منسقة) */}
                  <div className="p-4 md:p-5">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1.5 shadow-inner">
                      <div className="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-1">
                        🚗 بيانات المركبة
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        {item.trade_in_model ? <div><span className="text-slate-500">الموديل:</span> <span className="font-medium text-slate-800">{item.trade_in_model}</span></div> : null}
                        {item.trade_in_color ? <div><span className="text-slate-500">اللون:</span> <span className="font-medium text-slate-800">{item.trade_in_color}</span></div> : null}
                        {item.trade_in_year ? <div><span className="text-slate-500">سنة الصنع:</span> <span className="font-medium text-slate-800">{item.trade_in_year}</span></div> : null}
                        {item.trade_in_mileage ? <div><span className="text-slate-500">الممشى:</span> <span className="font-medium text-slate-800">{item.trade_in_mileage.toLocaleString("en-US")}</span></div> : null}
                      </div>
                      {item.trade_in_inspection ? (
                        <div className="mt-1 pt-1 border-t border-slate-200">
                          <span className="text-slate-500">الفحص:</span> <span className="font-medium text-slate-800">{item.trade_in_inspection}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* 3. تفاصيل السيارة المطلوبة والملاحظات */}
                    {item.requested_car || item.notes ? (
                      <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-sm space-y-2 shadow-inner">
                        <div className="font-semibold text-indigo-800 border-b border-indigo-100 pb-1 mb-1 flex items-center gap-1">
                          <ClipboardList className="h-4 w-4" /> السيارة المطلوبة أو ملاحظات
                        </div>
                        {item.requested_car ? <div><span className="text-slate-500 font-medium">السيارة المطلوبة:</span> <span className="font-bold text-slate-800">{item.requested_car}</span></div> : null}
                        {item.notes ? (
                          <div>
                            <span className="text-slate-500 font-medium block mb-1">ملاحظات:</span> 
                            <div className="space-y-2 mt-1">
                              {item.notes.split(/(?=\[تحديث )/).map((notePart, idx) => {
                                const txt = notePart.trim();
                                if (!txt) return null;
                                return (
                                  <div key={idx} className="bg-white p-2 rounded-md border border-indigo-100 text-slate-700 shadow-sm leading-relaxed whitespace-pre-wrap text-xs sm:text-sm">
                                    {txt}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    


                    {/* نموذج إدخال التقييم المباشر */}
                    <form action={(formData) => {
                       sendEvaluationReplyAction(formData);
                       setExpandedEvalId(null);
                    }} className="mt-4 p-4 bg-sky-50 border border-sky-100 rounded-xl shadow-inner">
                      <div className="text-sm font-bold text-sky-900 mb-2 flex items-center gap-1">
                         إدخال قيمة التقييم النهائية:
                      </div>
                      <input type="hidden" name="customer_id" value={item.id} />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          type="number" 
                          name="price" 
                          placeholder="سعر التقييم (شيقل)" 
                          className="legacy-input flex-1 bg-white border-sky-200 focus:border-sky-500 focus:ring-sky-500 text-lg py-2" 
                          required 
                        />
                        <SaveEvaluationBtn />
                      </div>
                    </form>
                  </div>

                  {/* 4. الأزرار في الأسفل */}
                  <div className="bg-slate-100 border-t border-slate-200 p-3 md:p-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`${detailBasePath}?customer=${item.id}&mode=view`}
                      className="legacy-btn legacy-btn-info flex-1 justify-center py-2"
                      onClick={() => setExpandedEvalId(null)}
                    >
                      <Eye className="h-5 w-5" />
                      فتح الملف الكامل
                    </Link>
                    <EvalReminderDropdown
                      item={item}
                      currentUserId={currentUserId}
                      detailBasePath={detailBasePath}
                    />
                    <WhatsAppEvalButton item={item} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
