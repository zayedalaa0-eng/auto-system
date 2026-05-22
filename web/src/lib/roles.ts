export type RoleCapabilities = {
  isGeneralManager: boolean;
  isManager: boolean;
};

function normalizeRoleText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function getRoleCapabilities(role: string | null | undefined, fullName?: string | null): RoleCapabilities {
  const value = normalizeRoleText(role);
  const name = normalizeRoleText(fullName);

  const arManager = "\u0645\u062f\u064a\u0631";
  const arGeneral = "\u0639\u0627\u0645";
  const arBranch = "\u0645\u0639\u0631\u0636";
  const arGeneralManager = "\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0627\u0645";

  const hasAdminKeyword = value.includes("admin") || value.includes("owner") || value.includes("super");
  const hasManagerWord = value.includes(arManager);
  const hasGeneralWord = value.includes(arGeneral);
  const hasBranchWord = value.includes(arBranch);
  const nameMarksGeneralManager = name.includes(arGeneralManager);

  const isGeneralManager = hasAdminKeyword || (hasManagerWord && hasGeneralWord) || nameMarksGeneralManager;
  const isManager = isGeneralManager || (hasManagerWord && hasBranchWord) || value.includes("manager");

  return {
    isGeneralManager,
    isManager,
  };
}
