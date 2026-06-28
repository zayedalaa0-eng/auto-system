"use client";

import { useMemo, useState } from "react";

import type { BranchOption, StaffOverviewItem } from "@/lib/data";

const ROLE_OPTIONS = ["الموظف", "مدير معرض", "المدير العام"];

export function StaffAdminForm({
  staff,
  branches,
  isGeneralManager,
}: {
  staff: StaffOverviewItem[];
  branches: BranchOption[];
  isGeneralManager: boolean;
}) {
  const [instructionType, setInstructionType] = useState("message");
  const [targetBranchId, setTargetBranchId] = useState("");

  const targetBranchName = useMemo(
    () => branches.find((item) => item.id === targetBranchId)?.name ?? "",
    [branches, targetBranchId],
  );

  const showRole = instructionType === "changeRole" || instructionType === "access";
  const showBranch = isGeneralManager && (instructionType === "transfer" || instructionType === "access");
  const allowedRoleOptions = isGeneralManager
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((role) => role !== "المدير العام");

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-3">
        <select className="legacy-select flex-1" name="recipient_user_id" defaultValue="">
          <option value="" disabled>
            -- اختر الموظف (المستهدف / المنقول) --
          </option>
          {instructionType !== "transfer_customers" && (
            <option value="all">الكل (لإرسال توجيه جماعي)</option>
          )}
          {staff.map((item) => (
            <option key={item.id} value={item.id}>
              {item.full_name}
            </option>
          ))}
        </select>

        <select
          className="legacy-select flex-1"
          name="instruction_type"
          value={instructionType}
          onChange={(event) => setInstructionType(event.target.value)}
        >
          <option value="message">إرسال توجيه</option>
          {isGeneralManager ? <option value="access">تحديد الصلاحية والمعرض</option> : null}
          <option value="changeRole">تعديل صلاحية</option>
          {isGeneralManager ? <option value="transfer">نقل لمعرض</option> : null}
          <option value="transfer_customers">نقل عملاء موظف</option>
          <option value="suspend">إيقاف الحساب</option>
        </select>
      </div>

      {showRole ? (
        <div className="mb-3">
          <select className="legacy-select" name="target_role" defaultValue="">
            <option value="" disabled>
              -- اختر الصلاحية الجديدة --
            </option>
            {allowedRoleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showBranch ? (
        <div className="mb-3">
          <select
            className="legacy-select"
            name="target_branch_id"
            value={targetBranchId}
            onChange={(event) => setTargetBranchId(event.target.value)}
          >
            <option value="">-- اختر المعرض المستهدف --</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <input type="hidden" name="target_branch_name" value={targetBranchName} />
        </div>
      ) : null}
      {instructionType === "message" && (
        <div className="mb-3">
          <textarea
            name="message"
            required
            className="legacy-textarea w-full"
            rows={3}
            placeholder="اكتب التوجيه هنا ليصل كتنبيه داخلي..."
          />
        </div>
      )}

      {instructionType === "transfer_customers" && (
        <div className="mb-3">
          <select className="legacy-select w-full" name="target_user_id" defaultValue="" required>
            <option value="" disabled>
              -- اختر الموظف الجديد المستلم للعملاء --
            </option>
            {staff.map((item) => (
              <option key={`target-${item.id}`} value={item.id}>
                {item.full_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            سيتم تحويل جميع العملاء المعينين للموظف الأول ليصبحوا تحت إدارة الموظف الجديد المختار هنا.
          </p>
        </div>
      )}
    </>
  );
}
