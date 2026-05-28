"use client";

import { useRef, useState } from "react";
import { KeyRound, Send, UserPlus } from "lucide-react";

import {
  dispatchStaffInstructionAction,
  inviteStaffMemberAction,
  sendStaffPasswordRecoveryAction,
} from "@/app/dashboard/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StaffAdminForm } from "@/components/staff-admin-form";
import type { BranchOption, StaffOverviewItem } from "@/lib/data";

type Action = "invite" | "password" | "instruction";

const ACTIONS: { value: Action; label: string; icon: React.ElementType; color: string }[] = [
  { value: "invite",      label: "تعيين موظف جديد",           icon: UserPlus, color: "sky"   },
  { value: "password",    label: "إرسال رابط تغيير كلمة المرور", icon: KeyRound, color: "amber" },
  { value: "instruction", label: "إرسال توجيه للموظفين",       icon: Send,     color: "red"   },
];

type Props = {
  staff: StaffOverviewItem[];
  branches: BranchOption[];
  isGeneralManager: boolean;
};

export function StaffActionsForm({ staff, branches, isGeneralManager }: Props) {
  const [action, setAction] = useState<Action>("invite");
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const current = ACTIONS.find((a) => a.value === action)!;

  const borderColor =
    action === "invite"      ? "border-sky-500"   :
    action === "password"    ? "border-amber-500"  :
                               "border-red-500";

  const titleColor =
    action === "invite"      ? "text-sky-700"   :
    action === "password"    ? "text-amber-700"  :
                               "text-red-600";

  const btnClass =
    action === "invite"      ? "legacy-btn-info"    :
    action === "password"    ? "legacy-btn-warning"  :
                               "legacy-btn-danger";

  const btnLabel =
    action === "invite"      ? "إنشاء الحساب وإرسال رابط التفعيل" :
    action === "password"    ? "إرسال رابط تغيير كلمة المرور"      :
                               "تنفيذ فورًا";

  const formAction =
    action === "invite"      ? inviteStaffMemberAction           :
    action === "password"    ? sendStaffPasswordRecoveryAction    :
                               dispatchStaffInstructionAction;

  // الإجراءات الحرجة التي تحتاج تأكيد
  const needsConfirm = action === "instruction";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!needsConfirm) return;
    e.preventDefault();
    setShowConfirm(true);
  }

  return (
    <>
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className={`legacy-card border-t-4 ${borderColor}`}
    >

      {/* ── اختيار الإجراء ── */}
      <div className="mb-5 flex flex-wrap gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const isActive = action === a.value;
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => setAction(a.value)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? a.color === "sky"   ? "border-sky-400 bg-sky-50 text-sky-700 shadow-sm"
                  : a.color === "amber" ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm"
                  :                       "border-red-400 bg-red-50 text-red-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* ── عنوان ── */}
      <h5 className={`mb-4 text-lg font-bold ${titleColor} flex items-center gap-2`}>
        <current.icon className="h-5 w-5" />
        {current.label}
      </h5>

      {/* ── حقول تعيين موظف جديد ── */}
      {action === "invite" && (
        <div className="grid gap-3">
          <input className="legacy-input" name="full_name" placeholder="الاسم الكامل" required />
          <input className="legacy-input" name="email" type="email" placeholder="البريد الإلكتروني" required />
          <input className="legacy-input" name="phone" placeholder="الهاتف (اختياري)" />
          <select className="legacy-select" name="role" required defaultValue="">
            <option value="" disabled>اختر الدور</option>
            <option value="موظف">موظف</option>
            <option value="مدير معرض">مدير معرض</option>
            <option value="المدير العام">المدير العام</option>
          </select>
          <select className="legacy-select" name="branch_id" defaultValue="">
            <option value="">بدون معرض</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── حقول إرسال رابط كلمة المرور ── */}
      {action === "password" && (
        <div className="grid gap-3">
          <input
            className="legacy-input"
            name="email"
            type="email"
            placeholder="بريد الموظف الإلكتروني"
            required
          />
          <p className="text-xs text-slate-400">
            سيُرسَل رابط لتغيير كلمة المرور إلى بريد الموظف مباشرة.
          </p>
        </div>
      )}

      {/* ── حقول إرسال توجيه ── */}
      {action === "instruction" && (
        <div className="grid gap-3">
          <StaffAdminForm
            staff={staff}
            branches={branches}
            isGeneralManager={isGeneralManager}
          />
          <input type="hidden" name="recipient_mode" value="single" />
          <textarea
            name="message"
            required
            className="legacy-textarea"
            rows={3}
            placeholder="اكتب التوجيه هنا ليصل كتنبيه داخلي..."
          />
        </div>
      )}

      <button className={`legacy-btn ${btnClass} mt-5 w-full`} type="submit">
        {btnLabel}
      </button>
    </form>

    <ConfirmDialog
      open={showConfirm}
      title="إرسال توجيه للموظفين"
      description="أنت على وشك إرسال توجيه إداري. سيصل كتنبيه داخلي للموظف أو الموظفين المختارين فوراً."
      confirmLabel="إرسال التوجيه"
      variant="warning"
      onClose={() => setShowConfirm(false)}
      onConfirm={() => {
        setShowConfirm(false);
        formRef.current?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: false }));
      }}
    />
    </>
  );
}
