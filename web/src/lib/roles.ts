export type RoleCapabilities = {
  isGeneralManager: boolean;
  isManager: boolean;
  isGlobalView?: boolean;
};

/**
 * قيم enum الأدوار المعتمدة في قاعدة البيانات.
 * الأولوية الأولى دائماً: المطابقة الحرفية للـ enum قبل أي منطق نصي.
 */
export const ROLE_ENUM = {
  GENERAL_MANAGER: "general_manager",
  MANAGER:         "manager",
  BRANCH_MANAGER:  "branch_manager",
  EMPLOYEE:        "employee",
} as const;

export type RoleEnum = typeof ROLE_ENUM[keyof typeof ROLE_ENUM];

function normalizeRoleText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * يحدّد صلاحيات المستخدم بناءً على حقل role فقط.
 * الأولوية:
 *   1. مطابقة enum صارمة (general_manager / manager / branch_manager / employee)
 *   2. مطابقة نصية عربية كـ fallback للقيم القديمة
 *
 * المعامل _fullName محفوظ للتوافق مع الاستدعاءات القديمة ولا يُستخدم.
 */
export function getRoleCapabilities(role: string | null | undefined, _fullName?: string | null): RoleCapabilities {
  const value = normalizeRoleText(role);

  // ── 1. مطابقة enum صارمة (الأسرع والأكثر أماناً) ────────────────────────
  if (value === ROLE_ENUM.GENERAL_MANAGER || value === "super_admin" || value === "owner") {
    return { isGeneralManager: true, isManager: true };
  }
  if (value === ROLE_ENUM.MANAGER || value === ROLE_ENUM.BRANCH_MANAGER || value === "branch manager") {
    return { isGeneralManager: false, isManager: true };
  }
  if (value === ROLE_ENUM.EMPLOYEE || value === "staff") {
    return { isGeneralManager: false, isManager: false };
  }

  // ── 2. Fallback: مطابقة نصية عربية للقيم القديمة ────────────────────────
  const hasAdminKeyword = value.includes("admin") || value.includes("owner") || value.includes("super");
  const hasManagerWord  = value.includes("مدير");
  const hasGeneralWord  = value.includes("عام");
  const hasBranchWord   = value.includes("معرض");

  const isGeneralManager = hasAdminKeyword || (hasManagerWord && hasGeneralWord);
  const isManager = isGeneralManager || (hasManagerWord && hasBranchWord) || value.includes("manager");

  return { isGeneralManager, isManager };
}
