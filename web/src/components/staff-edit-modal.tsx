"use client";

import { useState, useTransition } from "react";
import { X, Save, UserPen } from "lucide-react";
import type { BranchOption, StaffOverviewItem } from "@/lib/data";
import { updateStaffProfileAction } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";

type Props = {
  staff: StaffOverviewItem;
  branches: BranchOption[];
};

export function StaffEditModal({ staff, branches }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="legacy-btn border flex items-center gap-2"
      >
        <UserPen className="h-4 w-4" />
        تعديل
      </button>
    );
  }

  return (
    <div
      className="legacy-album-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) setOpen(false);
      }}
    >
      <div className="legacy-album-card" style={{ maxWidth: 440, width: "95%" }}>
        <div className="legacy-album-head">
          <span style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <UserPen className="h-4 w-4 text-sky-600" />
            تعديل بيانات {staff.full_name}
          </span>
          <button
            type="button"
            className="legacy-album-close"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
            disabled={isPending}
            style={{ position: "static", width: 34, height: 34 }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="p-5 flex flex-col gap-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const res = await updateStaffProfileAction(formData);
              if (res?.error) {
                setError(res.error);
              } else {
                setOpen(false);
                router.refresh();
              }
            });
          }}
        >
          <input type="hidden" name="staff_id" value={staff.id} />

          <label className="legacy-field">
            <span className="legacy-field__label">الصلاحية (الدور)</span>
            <select
              name="role"
              className="legacy-select"
              defaultValue={staff.role}
              disabled={isPending}
            >
              <option value="موظف">موظف</option>
              <option value="مدير معرض">مدير معرض</option>
              <option value="المدير العام">المدير العام</option>
            </select>
          </label>

          <label className="legacy-field">
            <span className="legacy-field__label">الفرع المرتبط</span>
            <select
              name="branch_id"
              className="legacy-select"
              defaultValue={staff.branch_id ?? ""}
              disabled={isPending}
            >
              <option value="">بدون فرع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="legacy-inline-toggle mt-2">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={staff.status === "active" || staff.is_active === true}
              disabled={isPending}
            />
            <span style={{ fontWeight: 600 }}>حساب نشط (يمكنه تسجيل الدخول)</span>
            <span className="legacy-inline-toggle__dot" />
          </label>

          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          <div className="mt-2 flex gap-2 justify-end">
            <button
              type="button"
              className="legacy-btn border"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="legacy-btn legacy-btn-primary"
              disabled={isPending}
            >
              {isPending ? "جاري الحفظ..." : (
                <>
                  <Save className="h-4 w-4" /> حفظ التعديلات
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
