"use client";

import { useRef, useState } from "react";

import { toggleBranchStatusAction } from "@/app/dashboard/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function BranchToggleBtn({
  branchId,
  branchName,
  isActive,
}: {
  branchId: string;
  branchName: string;
  isActive: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={toggleBranchStatusAction}>
        <input type="hidden" name="branch_id" value={branchId} />
        <input type="hidden" name="new_status" value={String(!isActive)} />
        <button
          type="button"
          className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
            isActive
              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
          onClick={() => {
            if (isActive) {
              setShowConfirm(true);
            } else {
              formRef.current?.requestSubmit();
            }
          }}
        >
          {isActive ? "🔴 إغلاق المعرض" : "🟢 فتح المعرض مجدداً"}
        </button>
      </form>

      <ConfirmDialog
        open={showConfirm}
        title="إغلاق المعرض"
        description={`أنت على وشك إغلاق معرض "${branchName}". لن تُحذف البيانات لكن لن يتمكن الموظفون من العمل عليه.`}
        confirmLabel="إغلاق المعرض"
        variant="danger"
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
