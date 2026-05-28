import { redirect } from "next/navigation";
import { Send, UsersRound } from "lucide-react";

import {
  sendQuickReminderAction,
  updateTelegramChatIdAction,
} from "@/app/dashboard/actions";
import { StaffActionsForm } from "@/components/staff-actions-form";
import { getCustomerFormOptions, getStaffOverview } from "@/lib/data";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

type StaffPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  // ── حماية الصفحة: المديرون فقط ──────────────────────────────────────────
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const { data: profile } = await supabase
    .from("app_users").select("role").eq("auth_user_id", session.user.id).maybeSingle();
  if (!getRoleCapabilities(profile?.role).isManager) redirect("/dashboard/unauthorized");

  const [staff, options] = await Promise.all([getStaffOverview(), getCustomerFormOptions()]);
  const params = (await searchParams) ?? {};
  const notice = typeof params.staff_notice === "string" ? decodeURIComponent(params.staff_notice) : null;
  const error = typeof params.staff_error === "string" ? decodeURIComponent(params.staff_error) : null;

  return (
    <div className="legacy-grid gap-6">
      <h4 className="mb-0 text-2xl font-bold text-slate-800">
        <UsersRound className="me-2 inline h-6 w-6 text-sky-600" />
        إدارة الموظفين
      </h4>

      {notice ? <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800">{notice}</div> : null}
      {error ? <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800">{error}</div> : null}

      <StaffActionsForm
        staff={staff}
        branches={options.branches}
        isGeneralManager={options.capabilities.isGeneralManager}
      />

      <h5 className="mt-2 text-xl font-bold text-sky-700">أداء الموظفين وإحصائياتهم</h5>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {staff.length > 0 ? (
          staff.map((emp) => {
            const convRate = emp.total_customers > 0 ? Math.round((emp.total_sales / emp.total_customers) * 100) : 0;

            return (
              <div key={emp.id} className="legacy-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h5 className="m-0 text-lg font-bold text-slate-900">{emp.full_name}</h5>
                  <span className="rounded-full border px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">{emp.role}</span>
                </div>

                <div className="mb-3 text-sm font-bold text-slate-500">{emp.branch_name ?? "بدون فرع"}</div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-slate-50 p-2">
                    <div className="text-2xl font-bold text-sky-700">{emp.total_customers}</div>
                    <div className="text-xs font-bold text-slate-500">عميل</div>
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <div className="text-2xl font-bold text-emerald-700">{emp.total_sales}</div>
                    <div className="text-xs font-bold text-slate-500">بيع</div>
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <div className="text-2xl font-bold text-cyan-700">{convRate}%</div>
                    <div className="text-xs font-bold text-slate-500">تحويل</div>
                  </div>
                </div>

                <div className="mt-4 rounded border bg-slate-50 p-3 text-sm text-slate-700">
                  <div>حالة الحساب: {emp.status}</div>
                  <div className="mt-1">المتابعات المفتوحة: {emp.open_followups}</div>
                    <div className="mt-1">Telegram: {emp.telegram_chat_id ?? "غير مربوط"}</div>
                </div>

                <form action={updateTelegramChatIdAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="staff_id" value={emp.id} />
                  <input
                    className="legacy-input flex-1 text-sm"
                    name="telegram_chat_id"
                    placeholder="معرّف Telegram"
                    defaultValue={emp.telegram_chat_id ?? ""}
                  />
                  <button type="submit" className="legacy-btn legacy-btn-info shrink-0 px-3 text-sm">
                    ربط
                  </button>
                </form>

                <form action={sendQuickReminderAction} className="mt-3">
                  <input type="hidden" name="recipient_user_id" value={emp.id} />
                  <input type="hidden" name="recipient_branch_id" value={emp.branch_id ?? ""} />
                  <input type="hidden" name="recipient_label" value={emp.full_name} />
                  <input type="hidden" name="title" value={`تذكير إلى ${emp.full_name}`} />
                  <input type="hidden" name="message" value={`تذكير سريع للموظف ${emp.full_name} بخصوص المتابعات المفتوحة والعملاء الحاليين.`} />
                  <button type="submit" className="legacy-btn legacy-btn-info w-full">
                    <Send className="h-4 w-4" />
                    إرسال تذكير داخلي
                  </button>
                </form>
              </div>
            );
          })
        ) : (
          <div className="empty-state md:col-span-2 xl:col-span-3">لا توجد بيانات موظفين بعد.</div>
        )}
      </div>
    </div>
  );
}
