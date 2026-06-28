import type { CustomerItem } from "@/lib/data";

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

export function matchesCustomerQuery(customer: CustomerItem, query: string) {
  const needle = normalize(query);
  if (!needle) return true;

  const haystack = [
    customer.full_name,
    customer.phone,
    customer.requested_car ?? "",
    customer.requested_car_report ?? "",
    customer.sale_offer_car ?? "",
    customer.assigned_user_name ?? "",
    customer.branch_name ?? "",
    customer.status ?? "",
    customer.operation_type ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

export type CustomerSearchField =
  | "all"
  | "name"
  | "phone"
  | "car"
  | "status"
  | "staff"
  | "branch"
  | "operation";

export function matchesCustomerQueryByField(
  customer: CustomerItem,
  query: string,
  field: CustomerSearchField = "all",
) {
  const needle = normalize(query);
  if (!needle) return true;
  if (field === "all") return matchesCustomerQuery(customer, query);

  const pick = (value: string | null | undefined) => normalize(value).includes(needle);
  if (field === "name") return pick(customer.full_name);
  if (field === "phone") return pick(customer.phone);
  if (field === "car") return pick(customer.requested_car) || pick(customer.requested_car_report) || pick(customer.sale_offer_car);
  if (field === "status") return pick(customer.status);
  if (field === "staff") return pick(customer.assigned_user_name);
  if (field === "branch") return pick(customer.branch_name);
  if (field === "operation") return pick(customer.operation_type);
  return matchesCustomerQuery(customer, query);
}

export type CustomerReportFilters = {
  q?: string;
  field?: CustomerSearchField;
  customer_name?: string;
  lifecycle?: "all" | "active" | "closed";
  status?: string;
  period?: string;
  overdue?: boolean;
  user?: string;
  branch?: string;
  scope?: string;
};

function applyFilters(customers: CustomerItem[], filters: CustomerReportFilters): CustomerItem[] {
  const now = new Date();

  return customers.filter((customer) => {
    // scope: موعد المتابعة فقط
    if (filters.scope === "followups" && !customer.next_follow_up_at) return false;

    // بحث نصي
    if (filters.q && !matchesCustomerQueryByField(customer, filters.q, filters.field ?? "all")) return false;

    // الحالة
    if (filters.status && filters.status !== "all") {
      if (normalize(customer.status) !== normalize(filters.status)) return false;
    }

    // نشاط الدورة
    if (filters.lifecycle && filters.lifecycle !== "all") {
      const isActiveCycle = customer.is_active !== false;
      if (filters.lifecycle === "active" && !isActiveCycle) return false;
      if (filters.lifecycle === "closed" && isActiveCycle) return false;
    }

    // اسم العميل
    if (filters.customer_name && filters.customer_name !== "all") {
      if (normalize(customer.full_name) !== normalize(filters.customer_name)) return false;
    }

    // الفترة الزمنية (على آخر تواصل أو آخر تحديث)
    if (filters.period && filters.period !== "all") {
      const contactStr = customer.last_contact_at ?? customer.updated_at ?? customer.created_at;
      if (!contactStr) return false;
      const contactDate = new Date(contactStr);
      if (isNaN(contactDate.getTime())) return false;
      const diffDays = (now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24);
      if (filters.period === "today" && diffDays > 1) return false;
      if (filters.period === "2days" && diffDays > 2) return false;
      if (filters.period === "week" && diffDays > 7) return false;
      if (filters.period === "month" && diffDays > 30) return false;
    }

    // المتابعة المتأخرة
    if (filters.overdue) {
      if (!customer.next_follow_up_at) return false;
      const followUp = new Date(customer.next_follow_up_at);
      if (isNaN(followUp.getTime()) || followUp >= now) return false;
    }

    // الموظف (تقرير الإدارة)
    if (filters.user && filters.user !== "all") {
      if (normalize(customer.assigned_user_name) !== normalize(filters.user)) return false;
    }

    // الفرع (تقرير الإدارة)
    if (filters.branch && filters.branch !== "all") {
      if (normalize(customer.branch_name) !== normalize(filters.branch)) return false;
    }

    return true;
  });
}

// ── Overload: string (backward compat for search page) ──────────────────────
export function filterCustomersForReport(customers: CustomerItem[], query: string): CustomerItem[];
// ── Overload: object (customers + management pages) ──────────────────────────
export function filterCustomersForReport(
  customers: CustomerItem[],
  filters: CustomerReportFilters,
): CustomerItem[];
export function filterCustomersForReport(
  customers: CustomerItem[],
  filtersOrQuery: string | CustomerReportFilters,
): CustomerItem[] {
  if (typeof filtersOrQuery === "string") {
    return applyFilters(customers, { q: filtersOrQuery });
  }
  return applyFilters(customers, filtersOrQuery);
}

// ── Helpers for building chip data ───────────────────────────────────────────

export type StatusChipOption = {
  value: string;
  count: number;
};

/** Returns unique statuses with counts from a customer list */
export function buildStatusOptions(customers: CustomerItem[]): StatusChipOption[] {
  const counts = new Map<string, number>();
  for (const c of customers) {
    const s = (c.status ?? "غير محدد").trim();
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

/** Count of customers whose follow-up date is in the past */
export function countOverdue(customers: CustomerItem[]): number {
  const now = new Date();
  return customers.filter((c) => {
    if (!c.next_follow_up_at) return false;
    const d = new Date(c.next_follow_up_at);
    return !isNaN(d.getTime()) && d < now;
  }).length;
}

/** Unique assigned user names sorted alphabetically */
export function buildUserOptions(customers: CustomerItem[]): string[] {
  return [...new Set(customers.map((c) => c.assigned_user_name ?? "").filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ar"),
  );
}

/** Unique customer names sorted alphabetically */
export function buildCustomerNameOptions(customers: CustomerItem[]): string[] {
  return [...new Set(customers.map((c) => c.full_name ?? "").filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ar"),
  );
}

/** Unique branch names sorted alphabetically */
export function buildBranchOptions(customers: CustomerItem[]): string[] {
  return [...new Set(customers.map((c) => c.branch_name ?? "").filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ar"),
  );
}
