"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardCheck, ClipboardList, Eye, IdCard, ListChecks, Send, Siren, X, Zap } from "lucide-react";

import { sendQuickReminderAction } from "@/app/dashboard/actions";
import type { AgendaOverview, OperationalAlertItem } from "@/lib/data";
import { formatDate } from "@/lib/format";

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

export function AgendaCenterClient({
  agenda,
  incompleteTrades,
  licenseDue,
  pendingEvaluation = [],
  initialModal = null,
  detailBasePath = "/dashboard/customers",
  showButtons = true,
}: {
  agenda: AgendaOverview;
  incompleteTrades: OperationalAlertItem[];
  licenseDue: OperationalAlertItem[];
  pendingEvaluation?: Array<{
    id: string;
    full_name: string;
    requested_car: string | null;
    assigned_user_name: string | null;
    branch_name: string | null;
  }>;
  initialModal?: ModalKind;
  detailBasePath?: string;
  showButtons?: boolean;
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
                        <div className="text-lg font-bold text-sky-700">{item.full_name}</div>
                        <div className="text-sm text-slate-700">السيارة: {item.requested_car ?? "-"}</div>
                        <div className="text-sm text-slate-700">الموظف: {item.assigned_user_name ?? "—"} | المعرض: {item.branch_name ?? "—"}</div>
                        <div className="mt-3">
                          <Link href={`${detailBasePath}?customer=${item.id}&mode=view&focus=trade`} className="legacy-btn legacy-btn-info">
                            فتح وتحديث
                          </Link>
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
