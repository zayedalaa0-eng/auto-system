"use client";

import { useRef, useState } from "react";

import { updateBranchAction } from "@/app/dashboard/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

const COUNTRY_PREFIXES = [
  { label: "السعودية +966", value: "+966" },
  { label: "الإمارات +971", value: "+971" },
  { label: "الكويت +965",  value: "+965" },
  { label: "قطر +974",     value: "+974" },
  { label: "البحرين +973", value: "+973" },
  { label: "عُمان +968",   value: "+968" },
  { label: "فلسطين +970",  value: "+970" },
  { label: "الأردن +962",  value: "+962" },
];

type Props = {
  branchId: string;
  defaultName: string;
  defaultCity: string;
  defaultWhatsappPrefix: string;
  defaultWhatsappNumber: string;
};

export function BranchEditForm({
  branchId,
  defaultName,
  defaultCity,
  defaultWhatsappPrefix,
  defaultWhatsappNumber,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form
        ref={formRef}
        action={updateBranchAction}
        className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setShowConfirm(true);
        }}
      >
        <input type="hidden" name="branch_id" value={branchId} />

        <label className="text-xs font-semibold text-sky-700">اسم المعرض</label>
        <input className="legacy-input text-sm" name="branch_name" defaultValue={defaultName} required />

        <label className="text-xs font-semibold text-sky-700">المدينة</label>
        <input className="legacy-input text-sm" name="branch_city" defaultValue={defaultCity} />

        <label className="text-xs font-semibold text-sky-700">رقم واتساب</label>
        <div className="flex gap-2" dir="ltr">
          <select
            name="branch_whatsapp_prefix"
            className="legacy-select text-sm shrink-0"
            style={{ minWidth: "140px", maxWidth: "140px" }}
            defaultValue={defaultWhatsappPrefix}
          >
            {COUNTRY_PREFIXES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            className="legacy-input text-sm flex-1"
            name="branch_whatsapp"
            defaultValue={defaultWhatsappNumber}
            placeholder="501234567"
            type="tel"
            dir="ltr"
          />
        </div>

        <div className="flex gap-2 mt-1">
          <button type="submit" className="legacy-btn legacy-btn-info flex-1 text-sm">
            💾 حفظ التعديلات
          </button>
          <a href="/dashboard/branches" className="legacy-btn border text-sm px-3 text-center">إلغاء</a>
        </div>
      </form>

      <ConfirmDialog
        open={showConfirm}
        title="تعديل بيانات المعرض"
        description="أنت على وشك تعديل بيانات المعرض بما فيها رقم واتساب. هذا سيؤثر على جميع الرسائل المُرسَلة من هذا المعرض."
        confirmLabel="حفظ التعديلات"
        variant="warning"
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          formRef.current?.dispatchEvent(
            new Event("submit-confirmed", { bubbles: true })
          );
          // إرسال الفورم مباشرة عبر action
          const fd = new FormData(formRef.current!);
          updateBranchAction(fd);
        }}
      />
    </>
  );
}
