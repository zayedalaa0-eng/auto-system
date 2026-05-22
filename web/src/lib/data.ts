import { hasSupabaseEnv } from "@/lib/env";
import { getRoleCapabilities, type RoleCapabilities } from "@/lib/roles";
import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DashboardProfile = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
};

export type DashboardMetric = {
  label: string;
  value: number;
  hint: string;
  tone: "sky" | "emerald" | "amber" | "rose";
};

export type CustomerItem = {
  id: string;
  full_name: string;
  phone: string;
  operation_type?: string | null;
  requested_car: string | null;
  requested_car_report?: string | null;
  sale_offer_car?: string | null;
  payment_plan?: string | null;
  status: string;
  next_follow_up_at: string | null;
  branch_name: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  branch_id?: string | null;
  source?: string | null;
  is_active?: boolean;
  last_contact_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  visit_count?: number;
};

export type InventoryItem = {
  id: string;
  model: string;
  owner_name: string | null;
  deal_type?: string | null;
  chassis_no?: string | null;
  condition_label?: string | null;
  availability_status: string;
  price: number | null;
  production_year: number | null;
  color: string | null;
  mileage?: number | null;
  specs?: string | null;
  inspection?: string | null;
  branch_name: string | null;
};

export type StatusBreakdownItem = {
  label: string;
  count: number;
};

export type BranchSnapshot = {
  branch_name: string;
  customers: number;
  inventory: number;
};

export type NotificationItem = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  recipient_label: string | null;
};

export type ReminderItem = {
  id: string;
  title: string | null;
  message: string | null;
  due_at: string | null;
  status: string;
  branch_name: string | null;
  customer_name: string | null;
  assigned_user_name: string | null;
  assigned_user_id: string | null;
  branch_id: string | null;
};

export type DashboardOverview = {
  metrics: DashboardMetric[];
  customerStatus: StatusBreakdownItem[];
  inventoryStatus: StatusBreakdownItem[];
  branches: BranchSnapshot[];
  notifications: NotificationItem[];
  reminders: ReminderItem[];
  followUps: CustomerItem[];
  recentCustomers: CustomerItem[];
  recentInventory: InventoryItem[];
};

export type NotificationsCenterItem = {
  id: string;
  title: string | null;
  message: string;
  status: string;
  notification_type: string | null;
  recipient_label: string | null;
  created_at: string;
};

export type StaffOverviewItem = {
  id: string;
  full_name: string;
  role: string;
  status: string;
  is_active: boolean;
  branch_name: string | null;
  branch_id: string | null;
  telegram_chat_id: string | null;
  total_customers: number;
  total_sales: number;
  open_followups: number;
};

export type AgendaTaskItem = {
  id: string;
  source: "reminder" | "followup" | "notification";
  label: string;
  customer_id: string | null;
  customer_name: string | null;
  branch_name: string | null;
  staff_name: string | null;
  status: string;
  message: string;
  due_at: string | null;
  recipient_user_id: string | null;
  recipient_branch_id: string | null;
  recipient_label: string | null;
};

export type AgendaOverview = {
  dueToday: number;
  overdue: number;
  reminders: AgendaTaskItem[];
  followUps: AgendaTaskItem[];
  notifications: AgendaTaskItem[];
};

export type OperationalAlertItem = {
  customer_id: string;
  customer_name: string;
  branch_name: string | null;
  staff_name: string | null;
  customer_status: string;
  requested_car: string | null;
  trade_in_id: string;
  trade_in_model: string;
  trade_in_status: string | null;
  trade_in_license_expiry: string | null;
  trade_in_missing_fields: string[];
};

export type BranchOption = {
  id: string;
  name: string;
};

export type StaffOption = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
};

export type CustomerLogItem = {
  id: string;
  action: string;
  details: string | null;
  actor_name: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

export type CustomerAttachmentItem = {
  id: string;
  file_name: string | null;
  file_category: string | null;
  public_url: string | null;
  storage_path?: string | null;
  created_at: string;
};

export type TradeInItem = {
  id: string;
  owner_name: string | null;
  model: string;
  price: number | null;
  chassis_no: string | null;
  color: string | null;
  production_year: number | null;
  mileage: number | null;
  specs: string | null;
  inspection: string | null;
  status: string | null;
  condition_label: string | null;
  deal_type: string | null;
  license_expiry: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  notes: string | null;
};

export type CustomerDetail = CustomerItem & {
  nickname: string | null;
  address: string | null;
  whatsapp_prefix: string | null;
  attachment_notes: string | null;
  metadata: Record<string, unknown>;
  logs: CustomerLogItem[];
  reminders: ReminderItem[];
  attachments: CustomerAttachmentItem[];
  tradeIns: TradeInItem[];
};

export type CustomerFormOptions = {
  branches: BranchOption[];
  staff: StaffOption[];
  inventoryOptions: Array<{
    id: string;
    label: string;
  }>;
  statuses: string[];
  sources: string[];
  profile: DashboardProfile | null;
  capabilities: RoleCapabilities;
};

const CUSTOMER_STATUSES = [
  "\u062c\u062f\u064a\u062f",
  "\u0642\u064a\u062f \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629",
  "\u0627\u0633\u062a\u0628\u062f\u0627\u0644 (\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645)",
  "\u0627\u0633\u062a\u0628\u062f\u0627\u0644 (\u062a\u0645\u062a \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u062a\u0642\u064a\u064a\u0645)",
  "\u062d\u062c\u0632",
  "\u0634\u0631\u0627\u0621 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0639\u0631\u0636",
  "\u062a\u0645 \u0627\u0644\u0628\u064a\u0639",
  "\u062a\u0645\u062a \u0635\u0641\u0642\u0629 \u0627\u0633\u062a\u0628\u062f\u0627\u0644",
  "\u0631\u0641\u0636 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0639\u0645\u064a\u0644",
  "\u0631\u0641\u0636 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0639\u0631\u0636",
  "\u0627\u0644\u0639\u0645\u064a\u0644 \u063a\u064a\u0631 \u0641\u0639\u0627\u0644",
];

const CUSTOMER_SOURCES = [
  "\u0627\u0644\u0645\u0639\u0631\u0636",
  "\u0648\u0627\u062a\u0633\u0627\u0628",
  "\u062a\u064a\u0644\u064a\u062c\u0631\u0627\u0645",
  "\u0625\u0639\u0644\u0627\u0646",
  "\u062a\u0648\u0635\u064a\u0629",
  "\u0641\u064a\u0633\u0628\u0648\u0643",
];

function isVirtualBranch(name: string | null | undefined) {
  const value = (name ?? "").trim();
  if (!value) return false;
  return value === "\u0627\u0644\u0634\u0631\u0643\u0629" || value === "\u0627\u0644\u0645\u062f\u064a\u0631";
}

function getRelationshipValue<T extends Record<string, unknown>>(
  relation: T | T[] | null | undefined,
) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function getRelationshipName(
  relation: { name?: string } | { name?: string }[] | null | undefined,
) {
  return getRelationshipValue(relation)?.name ?? null;
}

function getRelationshipFullName(
  relation: { full_name?: string } | { full_name?: string }[] | null | undefined,
) {
  return getRelationshipValue(relation)?.full_name ?? null;
}

function incrementCount(map: Map<string, number>, key: string | null | undefined) {
  const normalized = (key ?? "").trim() || "\u063a\u064a\u0631 \u0645\u0635\u0646\u0641";
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toSortedBreakdown(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function buildFallbackMetrics(): DashboardMetric[] {
  return [
    { label: "\u0627\u0644\u0639\u0645\u0644\u0627\u0621", value: 0, hint: "\u0633\u062a\u0638\u0647\u0631 \u0628\u0639\u062f \u0627\u0643\u062a\u0645\u0627\u0644 \u0627\u0644\u0631\u0628\u0637 \u0645\u0639 Supabase", tone: "sky" },
    { label: "\u0627\u0644\u0645\u062e\u0632\u0648\u0646", value: 0, hint: "\u0627\u0644\u0647\u064a\u0643\u0644 \u062c\u0627\u0647\u0632 \u0648\u064a\u062d\u062a\u0627\u062c \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062a\u0634\u063a\u064a\u0644", tone: "emerald" },
    { label: "\u0627\u0644\u0645\u0647\u0627\u0645", value: 0, hint: "\u0633\u062a\u0623\u062a\u064a \u0645\u0646 reminders \u0648\u0645\u0631\u0643\u0632 \u0627\u0644\u064a\u0648\u0645", tone: "amber" },
    { label: "\u063a\u064a\u0631 \u0627\u0644\u0645\u0642\u0631\u0648\u0621", value: 0, hint: "\u0645\u0631\u062a\u0628\u0637\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u062c\u062f\u0648\u0644 notifications", tone: "rose" },
  ];
}

function mapCustomerRow(item: Record<string, unknown>): CustomerItem {
  const metadata = (item.metadata as Record<string, unknown> | null) ?? {};
  const legacyEmployeeName =
    typeof metadata.legacy_employee_name === "string" ? metadata.legacy_employee_name : null;
  const rawVisitCount = item.visit_count;
  const parsedVisitCount =
    typeof rawVisitCount === "number"
      ? rawVisitCount
      : typeof rawVisitCount === "string"
        ? Number.parseInt(rawVisitCount, 10)
        : 0;

  return {
    id: String(item.id),
    full_name: String(item.full_name ?? ""),
    phone: String(item.phone ?? ""),
    operation_type: typeof metadata.operation_type === "string" ? metadata.operation_type : null,
    requested_car: (item.requested_car as string | null) ?? null,
    requested_car_report: (item.requested_car as string | null) ?? null,
    sale_offer_car: null,
    payment_plan: (item.payment_plan as string | null) ?? null,
    status: String(item.status ?? ""),
    next_follow_up_at: (item.next_follow_up_at as string | null) ?? null,
    branch_name: getRelationshipName(item.branches as { name?: string } | { name?: string }[] | null),
    assigned_user_id: (item.assigned_user_id as string | null) ?? null,
    assigned_user_name: getRelationshipFullName(
      item.app_users as { full_name?: string } | { full_name?: string }[] | null,
    ) ?? legacyEmployeeName,
    branch_id: (item.branch_id as string | null) ?? null,
    source: (item.source as string | null) ?? null,
    is_active: (item.is_active as boolean | undefined) ?? true,
    last_contact_at: (item.last_contact_at as string | null) ?? null,
    notes: (item.notes as string | null) ?? null,
    created_at: (item.created_at as string | null) ?? null,
    updated_at: (item.updated_at as string | null) ?? null,
    visit_count: Number.isFinite(parsedVisitCount) ? parsedVisitCount : 0,
  };
}

function isTradeOfferForReport(status: string | null | undefined) {
  const value = (status ?? "").trim();
  return value.includes("برسم البيع") || value.includes("عرض سيارة") || value.includes("استبدال");
}

async function enrichCustomersWithSaleOfferInReport(
  baseCustomers: CustomerItem[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (!baseCustomers.length) return baseCustomers;
  const ids = baseCustomers.map((c) => c.id);
  const { data: tradeRows } = await supabase
    .from("trade_ins")
    .select("customer_id, model, status, is_active, updated_at")
    .in("customer_id", ids)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const latestOfferByCustomer = new Map<string, string>();
  for (const row of tradeRows ?? []) {
    const customerId = String(row.customer_id ?? "");
    if (!customerId || latestOfferByCustomer.has(customerId)) continue;
    if (!isTradeOfferForReport(row.status)) continue;
    const model = String(row.model ?? "").trim();
    if (!model) continue;
    latestOfferByCustomer.set(customerId, model);
  }

  return baseCustomers.map((customer) => {
    const offerModel = latestOfferByCustomer.get(customer.id);
    if (!offerModel) return customer;
    const reportBase = (customer.requested_car ?? "").trim();
    const requested_car_report = reportBase
      ? reportBase.includes(offerModel)
        ? reportBase
        : `${reportBase} | ${offerModel}`
      : offerModel;
    return {
      ...customer,
      requested_car_report,
      sale_offer_car: offerModel,
    };
  });
}

export async function getDashboardContext() {
  if (!hasSupabaseEnv()) {
    return {
      session: null,
      profile: null as DashboardProfile | null,
    };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      session: null,
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<DashboardProfile>();

  return {
    session,
    profile: profile ?? null,
  };
}

async function getScopedProfile() {
  const { profile } = await getDashboardContext();
  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);

  return {
    profile,
    capabilities,
  };
}

function applyBranchScope(
  query: { eq: (column: string, value: string) => unknown },
  branchId: string | null | undefined,
  isGeneralManager: boolean,
  column = "branch_id",
): unknown {
  if (!isGeneralManager && branchId) {
    return query.eq(column, branchId);
  }

  return query;
}

function applyStaffScope(
  query: { eq: (column: string, value: string) => unknown },
  userId: string | null | undefined,
  isManager: boolean,
  column = "assigned_user_id",
): unknown {
  if (!isManager && userId) {
    return query.eq(column, userId);
  }

  return query;
}

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  if (!hasSupabaseEnv()) {
    return buildFallbackMetrics();
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;

  const customersCountQuery = supabase.from("customers").select("*", { count: "exact", head: true });
  const inventoryCountQuery = supabase.from("inventory").select("*", { count: "exact", head: true });
  const remindersCountQuery = supabase.from("reminders").select("*", { count: "exact", head: true }).eq("status", "pending");
  const notificationsCountQuery = supabase.from("notifications").select("*", { count: "exact", head: true }).eq("status", "unread");

  const [customersResult, inventoryResult, remindersResult, notificationsResult] = await Promise.all([
    applyBranchScope(customersCountQuery, branchId, capabilities.isGeneralManager) as typeof customersCountQuery,
    applyBranchScope(inventoryCountQuery, branchId, capabilities.isGeneralManager) as typeof inventoryCountQuery,
    applyBranchScope(
      remindersCountQuery,
      branchId,
      capabilities.isGeneralManager,
    ) as typeof remindersCountQuery,
    applyBranchScope(
      notificationsCountQuery,
      branchId,
      capabilities.isGeneralManager,
      "recipient_branch_id",
    ) as typeof notificationsCountQuery,
  ]);

  const customersCount = "count" in customersResult ? customersResult.count : 0;
  const inventoryCount = "count" in inventoryResult ? inventoryResult.count : 0;
  const remindersCount = "count" in remindersResult ? remindersResult.count : 0;
  const notificationsCount = "count" in notificationsResult ? notificationsResult.count : 0;

  return [
    { label: "\u0627\u0644\u0639\u0645\u0644\u0627\u0621", value: customersCount ?? 0, hint: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629 \u062f\u0627\u062e\u0644 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a", tone: "sky" },
    { label: "\u0627\u0644\u0645\u062e\u0632\u0648\u0646", value: inventoryCount ?? 0, hint: "\u0643\u0644 \u0627\u0644\u0645\u0631\u0643\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0644\u0629 \u0639\u0644\u0649 \u0627\u0644\u0648\u064a\u0628 \u0627\u0644\u062c\u062f\u064a\u062f", tone: "emerald" },
    { label: "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0641\u062a\u0648\u062d\u0629", value: remindersCount ?? 0, hint: "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062a\u064a \u0644\u0645 \u062a\u064f\u063a\u0644\u0642 \u0628\u0639\u062f", tone: "amber" },
    { label: "\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621\u0629", value: notificationsCount ?? 0, hint: "\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u064a\u0648\u0645\u064a \u064a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629", tone: "rose" },
  ];
}

export async function getRecentCustomers(limit = 8): Promise<CustomerItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const recentCustomersQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, metadata, branches(name), app_users(full_name)",
    );
  const { data } = await (applyBranchScope(
    recentCustomersQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
  ) as typeof recentCustomersQuery)
    .order("created_at", { ascending: false })
    .limit(limit);

  const baseCustomers = (data ?? []).map(mapCustomerRow);
  return enrichCustomersWithSaleOfferInReport(baseCustomers, supabase);
}

export async function getCustomersDirectory(limit = 120): Promise<CustomerItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const customersDirectoryQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, metadata, branches(name), app_users(full_name)",
    );
  const { data } = await (applyBranchScope(
    customersDirectoryQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
  ) as typeof customersDirectoryQuery)
    .order("updated_at", { ascending: false })
    .limit(limit);

  const baseCustomers = (data ?? []).map(mapCustomerRow);
  return enrichCustomersWithSaleOfferInReport(baseCustomers, supabase);
}

export async function getCustomersSearchResults(query: string, limit = 120): Promise<CustomerItem[]> {
  if (!hasSupabaseEnv()) return [];

  const normalized = query.trim();
  if (!normalized) return [];

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const customersSearchQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, metadata, branches(name), app_users(full_name)",
    );

  const scoped = applyBranchScope(
    customersSearchQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
  ) as typeof customersSearchQuery;

  const likeValue = `%${normalized.replace(/[%_]/g, " ")}%`;
  const { data } = await scoped
    .or(
      [
        `full_name.ilike.${likeValue}`,
        `phone.ilike.${likeValue}`,
        `requested_car.ilike.${likeValue}`,
        `status.ilike.${likeValue}`,
        `notes.ilike.${likeValue}`,
      ].join(","),
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  const baseCustomers = (data ?? []).map(mapCustomerRow);
  return enrichCustomersWithSaleOfferInReport(baseCustomers, supabase);
}

export async function getRecentInventory(limit = 8): Promise<InventoryItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const recentInventoryQuery = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, mileage, specs, inspection, branches(name)");
  const { data } = await (applyBranchScope(
    recentInventoryQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
  ) as typeof recentInventoryQuery)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((item) => ({
    id: item.id,
    model: item.model,
    owner_name: item.owner_name,
    deal_type: item.deal_type ?? null,
    chassis_no: item.chassis_no ?? null,
    condition_label: item.condition_label ?? null,
    availability_status: item.availability_status,
    price: item.price,
    production_year: item.production_year,
    color: item.color,
    mileage: item.mileage ?? null,
    specs: item.specs ?? null,
    inspection: item.inspection ?? null,
    branch_name: getRelationshipName(item.branches),
  }));
}

export async function getInventoryDirectory(
  limit = 120,
  options?: { includeCrossBranchForMuallim?: boolean },
): Promise<InventoryItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const inventoryDirectoryQuery = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, mileage, specs, inspection, branches(name)");
  const { data } = await (applyBranchScope(
    inventoryDirectoryQuery,
    profile?.branch_id,
    capabilities.isGeneralManager,
  ) as typeof inventoryDirectoryQuery)
    .order("updated_at", { ascending: false })
    .limit(limit);

  const scopedItems: InventoryItem[] = (data ?? []).map((item) => ({
    id: item.id,
    model: item.model,
    owner_name: item.owner_name,
    deal_type: item.deal_type ?? null,
    chassis_no: item.chassis_no ?? null,
    condition_label: item.condition_label ?? null,
    availability_status: item.availability_status,
    price: item.price,
    production_year: item.production_year,
    color: item.color,
    mileage: item.mileage ?? null,
    specs: item.specs ?? null,
    inspection: item.inspection ?? null,
    branch_name: getRelationshipName(item.branches),
  }));

  const includeCrossBranchForMuallim = options?.includeCrossBranchForMuallim === true;
  if (!includeCrossBranchForMuallim || capabilities.isGeneralManager || !profile?.branch_id) {
    return scopedItems;
  }

  const { data: branchRow } = await supabase
    .from("branches")
    .select("name")
    .eq("id", profile.branch_id)
    .maybeSingle();
  const branchName = (branchRow?.name ?? "").trim();
  const isMuallimBranch = branchName.includes("\u0627\u0644\u0645\u0639\u0644\u0645");
  if (!isMuallimBranch) {
    return scopedItems;
  }

  const externalInventoryQuery = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, mileage, specs, inspection, branches(name), branch_id")
    .neq("branch_id", profile.branch_id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  let externalRows: Array<{
    id: string;
    model: string;
    owner_name: string | null;
    deal_type: string | null;
    chassis_no: string | null;
    condition_label: string | null;
    availability_status: string;
    price: number | null;
    production_year: number | null;
    color: string | null;
    mileage: number | null;
    specs: string | null;
    inspection: string | null;
    branches: { name?: string } | { name?: string }[] | null;
    branch_id: string | null;
  }> = [];

  if (hasSupabaseServiceRoleEnv()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("inventory")
      .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, mileage, specs, inspection, branches(name), branch_id")
      .neq("branch_id", profile.branch_id)
      .order("updated_at", { ascending: false })
      .limit(limit);
    externalRows = (data ?? []) as typeof externalRows;
  } else {
    const { data } = await externalInventoryQuery;
    externalRows = (data ?? []) as typeof externalRows;
  }

  const externalItems: InventoryItem[] = (externalRows ?? [])
    .filter((item) => {
      const deal = (item.deal_type ?? "").trim();
      const isCrossDeal =
        deal.includes("\u0627\u0633\u062a\u0628\u062f\u0627\u0644") ||
        deal.includes("\u062d\u064a\u0627\u0632\u0629") ||
        deal.includes("\u0628\u0631\u0633\u0645 \u0627\u0644\u0628\u064a\u0639");
      const status = (item.availability_status ?? "").trim().toLowerCase();
      const isAvailable =
        !status.includes("مباع") &&
        !status.includes("مباعة") &&
        !status.includes("محجوز") &&
        !status.includes("مسحوب") &&
        status !== "sold" &&
        status !== "reserved" &&
        status !== "withdrawn";
      return isCrossDeal && isAvailable;
    })
    .map((item) => ({
      id: item.id,
      model: item.model,
      owner_name: item.owner_name,
      deal_type: "\u0628\u0631\u0633\u0645 \u0627\u0644\u0628\u064a\u0639",
      chassis_no: item.chassis_no ?? null,
      condition_label: item.condition_label ?? null,
      availability_status: item.availability_status,
      price: item.price,
      production_year: item.production_year,
      color: item.color,
      mileage: item.mileage ?? null,
      specs: item.specs ?? null,
      inspection: item.inspection ?? null,
      branch_name: getRelationshipName(item.branches),
    }));

  const seen = new Set<string>();
  const merged = [...scopedItems, ...externalItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return merged;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  if (!hasSupabaseEnv()) {
    return {
      metrics: buildFallbackMetrics(),
      customerStatus: [],
      inventoryStatus: [],
      branches: [],
      notifications: [],
      reminders: [],
      followUps: [],
      recentCustomers: [],
      recentInventory: [],
    };
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;

  const dashboardCustomersQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, metadata, branches(name), app_users(full_name)",
    );
  const dashboardInventoryQuery = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, branches(name)");
  const dashboardNotificationsQuery = supabase
    .from("notifications")
    .select("id, message, status, created_at, recipient_label")
    .order("created_at", { ascending: false });
  const dashboardRemindersQuery = supabase
    .from("reminders")
    .select(
      "id, title, message, due_at, status, assigned_user_id, branch_id, branches(name), customers(full_name), app_users(full_name)",
    )
    .order("due_at", { ascending: true });

  const [
    metrics,
    { data: customerRows },
    { data: inventoryRows },
    { data: notificationRows },
    { data: reminderRows },
    recentCustomers,
    recentInventory,
  ] = await Promise.all([
    getDashboardMetrics(),
    (applyStaffScope(
      applyBranchScope(dashboardCustomersQuery, branchId, capabilities.isGeneralManager) as typeof dashboardCustomersQuery,
      userId,
      capabilities.isManager,
    ) as typeof dashboardCustomersQuery).limit(250),
    (applyBranchScope(dashboardInventoryQuery, branchId, capabilities.isGeneralManager) as typeof dashboardInventoryQuery).limit(250),
    (applyStaffScope(
      applyBranchScope(
        dashboardNotificationsQuery,
        branchId,
        capabilities.isGeneralManager,
        "recipient_branch_id",
      ) as typeof dashboardNotificationsQuery,
      userId,
      capabilities.isManager,
      "recipient_user_id",
    ) as typeof dashboardNotificationsQuery).limit(6),
    (applyStaffScope(
      applyBranchScope(dashboardRemindersQuery, branchId, capabilities.isGeneralManager) as typeof dashboardRemindersQuery,
      userId,
      capabilities.isManager,
    ) as typeof dashboardRemindersQuery).limit(8),
    getRecentCustomers(8),
    getRecentInventory(8),
  ]);

  const customerStatusMap = new Map<string, number>();
  const inventoryStatusMap = new Map<string, number>();
  const branchMap = new Map<string, BranchSnapshot>();

  const customerItems: CustomerItem[] = (customerRows ?? []).map(mapCustomerRow);
  const inventoryItems: InventoryItem[] = (inventoryRows ?? []).map((item) => ({
    id: item.id,
    model: item.model,
    owner_name: item.owner_name,
    deal_type: item.deal_type ?? null,
    chassis_no: item.chassis_no ?? null,
    condition_label: item.condition_label ?? null,
    availability_status: item.availability_status,
    price: item.price,
    production_year: item.production_year,
    color: item.color,
    branch_name: getRelationshipName(item.branches),
  }));

  for (const item of customerItems) {
    incrementCount(customerStatusMap, item.status);
    const branchName = item.branch_name ?? "\u0628\u062f\u0648\u0646 \u0641\u0631\u0639";
    const current = branchMap.get(branchName) ?? { branch_name: branchName, customers: 0, inventory: 0 };
    current.customers += 1;
    branchMap.set(branchName, current);
  }

  for (const item of inventoryItems) {
    incrementCount(inventoryStatusMap, item.availability_status);
    const branchName = item.branch_name ?? "\u0628\u062f\u0648\u0646 \u0641\u0631\u0639";
    const current = branchMap.get(branchName) ?? { branch_name: branchName, customers: 0, inventory: 0 };
    current.inventory += 1;
    branchMap.set(branchName, current);
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndTs = todayEnd.getTime();
  const followUps = [...customerItems]
    .filter((item) => {
      if (!item.next_follow_up_at) return false;
      const status = String(item.status ?? "");
      if (!status.includes("متابعة") && !status.includes("حجز")) return false;
      const time = new Date(item.next_follow_up_at).getTime();
      return !Number.isNaN(time) && time <= todayEndTs;
    })
    .sort((a, b) => {
      const left = new Date(a.next_follow_up_at ?? "").getTime();
      const right = new Date(b.next_follow_up_at ?? "").getTime();
      return left - right;
    })
    .slice(0, 6);

  return {
    metrics,
    customerStatus: toSortedBreakdown(customerStatusMap),
    inventoryStatus: toSortedBreakdown(inventoryStatusMap),
    branches: [...branchMap.values()]
      .sort((a, b) => b.customers + b.inventory - (a.customers + a.inventory))
      .slice(0, 6),
    notifications: (notificationRows ?? []).map((item) => ({
      id: item.id,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      recipient_label: item.recipient_label,
    })),
    reminders: (reminderRows ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      due_at: item.due_at,
      status: item.status,
      branch_name: getRelationshipName(item.branches),
      customer_name: getRelationshipFullName(item.customers),
      assigned_user_name: getRelationshipFullName(item.app_users),
      assigned_user_id: item.assigned_user_id ?? null,
      branch_id: item.branch_id ?? null,
    })),
    followUps,
    recentCustomers,
    recentInventory,
  };
}

export async function getStaffOverview(): Promise<StaffOverviewItem[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();

  const staffQuery = supabase
    .from("app_users")
    .select("id, full_name, role, status, is_active, telegram_chat_id, branch_id, branches(name)")
    .order("full_name");
  const customersQuery = supabase.from("customers").select("assigned_user_id, status, next_follow_up_at");

  const [{ data: staffRows }, { data: customerRows }] = await Promise.all([
    applyBranchScope(staffQuery, profile?.branch_id, capabilities.isGeneralManager) as typeof staffQuery,
    applyBranchScope(customersQuery, profile?.branch_id, capabilities.isGeneralManager) as typeof customersQuery,
  ]);

  const customerStats = new Map<string, { total: number; sold: number; followups: number }>();

  for (const row of customerRows ?? []) {
    if (!row.assigned_user_id) continue;

    const current = customerStats.get(row.assigned_user_id) ?? { total: 0, sold: 0, followups: 0 };
    current.total += 1;

    if (String(row.status ?? "").includes("\u062a\u0645 \u0627\u0644\u0628\u064a\u0639") || String(row.status ?? "").includes("\u0645\u0628\u0627\u0639\u0629")) {
      current.sold += 1;
    }

    if (row.next_follow_up_at) {
      current.followups += 1;
    }

    customerStats.set(row.assigned_user_id, current);
  }

  return (staffRows ?? []).map((item) => {
    const stats = customerStats.get(item.id) ?? { total: 0, sold: 0, followups: 0 };

    return {
      id: item.id,
      full_name: item.full_name,
      role: item.role,
      status: item.status,
      is_active: item.is_active,
      branch_name: getRelationshipName(item.branches),
      branch_id: item.branch_id ?? null,
      telegram_chat_id: item.telegram_chat_id,
      total_customers: stats.total,
      total_sales: stats.sold,
      open_followups: stats.followups,
    };
  });
}

export async function getAgendaOverview(): Promise<AgendaOverview> {
  if (!hasSupabaseEnv()) {
    return {
      dueToday: 0,
      overdue: 0,
      reminders: [],
      followUps: [],
      notifications: [],
    };
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;
  const now = Date.now();
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const todayTs = today.getTime();

  const agendaRemindersQuery = supabase
    .from("reminders")
    .select(
      "id, customer_id, title, message, due_at, status, assigned_user_id, branch_id, branches(name), customers(full_name), app_users(full_name)",
    )
    .eq("status", "pending");
  const agendaFollowupsQuery = supabase
    .from("customers")
    .select(
      "id, full_name, status, requested_car, next_follow_up_at, assigned_user_id, branch_id, branches(name), app_users(full_name)",
    )
    .not("next_follow_up_at", "is", null);
  const agendaNotificationsQuery = supabase
    .from("notifications")
    .select("id, message, status, created_at, recipient_user_id, recipient_branch_id, recipient_label")
    .eq("status", "unread");

  const [{ data: reminderRows }, { data: followUpRows }, { data: notificationRows }] = await Promise.all([
    (applyStaffScope(
      applyBranchScope(
        agendaRemindersQuery,
        branchId,
        capabilities.isGeneralManager,
      ) as typeof agendaRemindersQuery,
      userId,
      capabilities.isManager,
    ) as typeof agendaRemindersQuery)
      .order("due_at", { ascending: true })
      .limit(16),
    (applyStaffScope(
      applyBranchScope(
        agendaFollowupsQuery,
        branchId,
        capabilities.isGeneralManager,
      ) as typeof agendaFollowupsQuery,
      userId,
      capabilities.isManager,
    ) as typeof agendaFollowupsQuery)
      .order("next_follow_up_at", { ascending: true })
      .limit(16),
    (applyStaffScope(
      applyBranchScope(
        agendaNotificationsQuery,
        branchId,
        capabilities.isGeneralManager,
        "recipient_branch_id",
      ) as typeof agendaNotificationsQuery,
      userId,
      capabilities.isManager,
      "recipient_user_id",
    ) as typeof agendaNotificationsQuery)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const reminders: AgendaTaskItem[] = (reminderRows ?? [])
    .map((item) => ({
      id: item.id,
      source: "reminder" as const,
      label: "مهمة أجندة",
      customer_id: item.customer_id ?? null,
      customer_name: getRelationshipFullName(item.customers),
      branch_name: getRelationshipName(item.branches),
      staff_name: getRelationshipFullName(item.app_users),
      status: item.status,
      message: item.message ?? item.title ?? "مهمة بدون وصف",
      due_at: item.due_at,
      recipient_user_id: item.assigned_user_id ?? null,
      recipient_branch_id: item.branch_id ?? null,
      recipient_label: getRelationshipFullName(item.app_users) ?? getRelationshipName(item.branches),
    }))
    .filter((item) => {
      if (!item.due_at) return true;
      const time = new Date(item.due_at).getTime();
      return !Number.isNaN(time) && time <= todayTs;
    });

  const followUps: AgendaTaskItem[] = (followUpRows ?? [])
    .filter((item) => String(item.status ?? "").includes("متابعة") || String(item.status ?? "").includes("حجز"))
    .filter((item) => {
      if (!item.next_follow_up_at) return false;
      const time = new Date(item.next_follow_up_at).getTime();
      return !Number.isNaN(time) && time <= todayTs;
    })
    .map((item) => ({
      id: item.id,
      source: "followup" as const,
      label: "تواصل اليوم",
      customer_id: item.id,
      customer_name: item.full_name,
      branch_name: getRelationshipName(item.branches),
      staff_name: getRelationshipFullName(item.app_users),
      status: item.status,
      message: item.requested_car ?? "ملف بدون سيارة محددة",
      due_at: item.next_follow_up_at,
      recipient_user_id: item.assigned_user_id ?? null,
      recipient_branch_id: item.branch_id ?? null,
      recipient_label: getRelationshipFullName(item.app_users) ?? getRelationshipName(item.branches),
    }));

  const notifications: AgendaTaskItem[] = (notificationRows ?? []).map((item) => ({
    id: item.id,
    source: "notification",
    label: "\u062a\u0646\u0628\u064a\u0647 \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621",
    customer_id: null,
    customer_name: null,
    branch_name: item.recipient_label,
    staff_name: item.recipient_label,
    status: item.status,
    message: item.message,
    due_at: item.created_at,
    recipient_user_id: item.recipient_user_id ?? null,
    recipient_branch_id: item.recipient_branch_id ?? null,
    recipient_label: item.recipient_label ?? null,
  }));

  const dueToday = [...reminders, ...followUps].filter((item) => {
    if (!item.due_at) return false;
    const time = new Date(item.due_at).getTime();
    return !Number.isNaN(time) && time <= todayTs && time >= now - 1000 * 60 * 60 * 24;
  }).length;

  const overdue = [...reminders, ...followUps].filter((item) => {
    if (!item.due_at) return false;
    const time = new Date(item.due_at).getTime();
    return !Number.isNaN(time) && time < now;
  }).length;

  return {
    dueToday,
    overdue,
    reminders,
    followUps,
    notifications,
  };
}

export async function getNotificationsCenter(limit = 120): Promise<{
  unreadCount: number;
  items: NotificationsCenterItem[];
}> {
  if (!hasSupabaseEnv()) {
    return { unreadCount: 0, items: [] };
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;

  const unreadCountQuery = supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("status", "unread");

  const centerQuery = supabase
    .from("notifications")
    .select("id, title, message, status, notification_type, recipient_user_id, recipient_branch_id, recipient_label, created_at");

  const scopedUnread = applyBranchScope(
    unreadCountQuery,
    branchId,
    capabilities.isGeneralManager,
    "recipient_branch_id",
  ) as typeof unreadCountQuery;
  const scopedCenter = applyBranchScope(
    centerQuery,
    branchId,
    capabilities.isGeneralManager,
    "recipient_branch_id",
  ) as typeof centerQuery;

  const userScopedCenter = applyStaffScope(
    scopedCenter,
    userId,
    capabilities.isManager,
    "recipient_user_id",
  ) as typeof scopedCenter;

  const userScopedUnread = applyStaffScope(
    scopedUnread,
    userId,
    capabilities.isManager,
    "recipient_user_id",
  ) as typeof scopedUnread;

  const [{ count }, { data }] = await Promise.all([
    userScopedUnread,
    userScopedCenter.order("created_at", { ascending: false }).limit(limit),
  ]);

  return {
    unreadCount: count ?? 0,
    items: (data ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? null,
      message: item.message,
      status: item.status,
      notification_type: item.notification_type ?? null,
      recipient_label: item.recipient_label ?? null,
      created_at: item.created_at,
    })),
  };
}

export async function getCustomerFormOptions(): Promise<CustomerFormOptions> {
  if (!hasSupabaseEnv()) {
    return {
      branches: [],
      staff: [],
      inventoryOptions: [],
      statuses: CUSTOMER_STATUSES,
      sources: CUSTOMER_SOURCES,
      profile: null,
      capabilities: { isGeneralManager: false, isManager: false },
    };
  }

  const { profile, capabilities } = await getScopedProfile();
  const supabase = await createClient();
  const inventoryBaseQuery = supabase
    .from("inventory")
    .select("id, model, chassis_no, production_year, availability_status, deal_type, condition_label, branch_id, branches(name)")
    .order("model");
  const [{ data: branches }, { data: staff }, { data: inventoryScoped }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("is_active", true)
      .order("full_name"),
    (applyBranchScope(
      inventoryBaseQuery,
      profile?.branch_id,
      capabilities.isGeneralManager,
    ) as typeof inventoryBaseQuery),
  ]);

  const normalizeStatus = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  const AR_SOLD = "\u0645\u0628\u0627\u0639";
  const AR_SOLD_F = "\u0645\u0628\u0627\u0639\u0629";
  const AR_RESERVED = "\u0645\u062d\u062c\u0648\u0632";
  const AR_WITHDRAWN = "\u0645\u0633\u062d\u0648\u0628";
  const AR_MUALLIM = "\u0627\u0644\u0645\u0639\u0644\u0645";
  const AR_DEAL_SWAP = "\u0627\u0633\u062a\u0628\u062f\u0627\u0644";
  const AR_DEAL_HIAZA = "\u062d\u064a\u0627\u0632\u0629";
  const AR_DEAL_CONSIGN = "\u0628\u0631\u0633\u0645 \u0627\u0644\u0628\u064a\u0639";
  const AR_USED = "\u0645\u0633\u062a\u0639\u0645\u0644\u0629";
  const isAvailable = (value: string | null | undefined) => {
    const status = normalizeStatus(value);
    if (!status) return true;
    if (status.includes(AR_SOLD) || status.includes(AR_SOLD_F)) return false;
    if (status.includes(AR_RESERVED)) return false;
    if (status.includes(AR_WITHDRAWN)) return false;
    if (status === "sold" || status === "reserved" || status === "withdrawn") return false;
    return true;
  };
  const toOption = (item: { id: string; model: string; production_year: number | null; chassis_no: string | null }) => ({
    id: item.id,
    label: `${item.model}${item.production_year ? ` - موديل:${item.production_year}` : ""}${item.chassis_no ? ` - شاصي:${item.chassis_no}` : ""}`,
  });

  let inventoryOptions = (inventoryScoped ?? [])
    .filter((item) => isAvailable(item.availability_status))
    .map(toOption);

  if (!capabilities.isGeneralManager && profile?.branch_id) {
    const { data: branchRow } = await supabase
      .from("branches")
      .select("name")
      .eq("id", profile.branch_id)
      .maybeSingle();
    const isMuallimBranch = (branchRow?.name ?? "").includes(AR_MUALLIM);
    if (isMuallimBranch) {
      let externalRows: Array<{
        id: string;
        model: string;
        chassis_no: string | null;
        production_year: number | null;
        availability_status: string;
        deal_type: string | null;
        condition_label: string | null;
        branch_id: string | null;
      }> = [];

      if (hasSupabaseServiceRoleEnv()) {
        const admin = createAdminClient();
        const { data } = await admin
          .from("inventory")
          .select("id, model, chassis_no, production_year, availability_status, deal_type, condition_label, branch_id")
          .neq("branch_id", profile.branch_id)
          .order("model");
        externalRows = (data ?? []) as typeof externalRows;
      } else {
        const { data } = await supabase
          .from("inventory")
          .select("id, model, chassis_no, production_year, availability_status, deal_type, condition_label, branch_id")
          .neq("branch_id", profile.branch_id)
          .order("model");
        externalRows = (data ?? []) as typeof externalRows;
      }

      const externalOptions = (externalRows ?? [])
        .filter((item) => isAvailable(item.availability_status))
        .filter((item) => {
          const deal = (item.deal_type ?? "").trim();
          return deal.includes(AR_DEAL_SWAP) || deal.includes(AR_DEAL_HIAZA) || deal.includes(AR_DEAL_CONSIGN);
        })
        .map(toOption);

      const seen = new Set<string>();
      inventoryOptions = [...inventoryOptions, ...externalOptions].filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    }
  }

  return {
    branches: (branches ?? [])
      .filter((item) => !isVirtualBranch(item.name))
      .map((item) => ({ id: item.id, name: item.name })),
    staff: (staff ?? []).map((item) => ({
      id: item.id,
      full_name: item.full_name,
      role: item.role,
      branch_id: item.branch_id ?? null,
    })),
    inventoryOptions,
    statuses: CUSTOMER_STATUSES,
    sources: CUSTOMER_SOURCES,
    profile,
    capabilities,
  };
}

export async function getCustomerById(customerId: string): Promise<CustomerDetail | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const customerQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, requested_car, payment_plan, status, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, nickname, address, whatsapp_prefix, attachment_notes, metadata, branches(name), app_users(full_name)",
    )
    .eq("id", customerId);

  const [{ data: customer }, { data: logs }, { data: reminders }, { data: attachments }, { data: tradeIns }] =
    await Promise.all([
      (applyBranchScope(customerQuery, branchId, capabilities.isGeneralManager) as typeof customerQuery).maybeSingle(),
      supabase
        .from("customer_logs")
        .select("id, action, details, actor_name, next_follow_up_at, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reminders")
        .select(
          "id, title, message, due_at, status, assigned_user_id, branch_id, branches(name), customers(full_name), app_users(full_name)",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("customer_attachments")
        .select("id, file_name, file_category, public_url, storage_path, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("trade_ins")
        .select(
          "id, owner_name, model, price, chassis_no, color, production_year, mileage, specs, inspection, status, condition_label, deal_type, license_expiry, is_active, metadata, notes",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (!customer) return null;

  const base = mapCustomerRow(customer);
  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (item) => {
      let resolvedUrl = item.public_url ?? null;
      if (!resolvedUrl && item.storage_path) {
        const signed = await supabase.storage.from("customer-attachments").createSignedUrl(item.storage_path, 60 * 60);
        if (!signed.error) {
          resolvedUrl = signed.data.signedUrl;
        }
      }

      return {
        id: item.id,
        file_name: item.file_name,
        file_category: item.file_category,
        public_url: resolvedUrl,
        storage_path: item.storage_path ?? null,
        created_at: item.created_at,
      };
    }),
  );

  return {
    ...base,
    nickname: customer.nickname ?? null,
    address: customer.address ?? null,
    whatsapp_prefix: customer.whatsapp_prefix ?? null,
    attachment_notes: customer.attachment_notes ?? null,
    metadata: (customer.metadata as Record<string, unknown> | null) ?? {},
    logs: (logs ?? []).map((item) => ({
      id: item.id,
      action: item.action,
      details: item.details,
      actor_name: item.actor_name,
      next_follow_up_at: item.next_follow_up_at,
      created_at: item.created_at,
    })),
    reminders: (reminders ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      due_at: item.due_at,
      status: item.status,
      branch_name: getRelationshipName(item.branches),
      customer_name: getRelationshipFullName(item.customers),
      assigned_user_name: getRelationshipFullName(item.app_users),
      assigned_user_id: item.assigned_user_id ?? null,
      branch_id: item.branch_id ?? null,
    })),
    attachments: attachmentsWithUrls,
    tradeIns: (tradeIns ?? []).map((item) => ({
      id: item.id,
      owner_name: item.owner_name,
      model: item.model,
      price: item.price,
      chassis_no: item.chassis_no ?? null,
      color: item.color,
      production_year: item.production_year,
      mileage: item.mileage ?? null,
      specs: item.specs ?? null,
      inspection: item.inspection ?? null,
      status: item.status,
      condition_label: item.condition_label,
      deal_type: item.deal_type,
      license_expiry: item.license_expiry ?? null,
      is_active: item.is_active ?? true,
      metadata: (item.metadata as Record<string, unknown> | null) ?? {},
      notes: item.notes,
    })),
  };
}

function getTradeMissingFields(item: {
  model?: string | null;
  color?: string | null;
  production_year?: number | null;
  mileage?: number | null;
  specs?: string | null;
  inspection?: string | null;
  price?: number | null;
  chassis_no?: string | null;
  license_expiry?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const missing: string[] = [];
  const valueOrEmpty = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const numberMissing = (value: number | null | undefined) => value == null || Number.isNaN(value) || value <= 0;

  if (!valueOrEmpty(item.model)) missing.push("\u0646\u0648\u0639 \u0627\u0644\u0633\u064a\u0627\u0631\u0629");
  if (!valueOrEmpty(item.color)) missing.push("\u0627\u0644\u0644\u0648\u0646");
  if (numberMissing(item.production_year)) missing.push("\u0633\u0646\u0629 \u0627\u0644\u062a\u0635\u0646\u064a\u0639");
  if (numberMissing(item.mileage)) missing.push("\u0627\u0644\u0639\u062f\u0627\u062f");
  if (!valueOrEmpty(item.specs)) missing.push("\u0627\u0644\u0645\u0648\u0627\u0635\u0641\u0627\u062a");
  if (!valueOrEmpty(item.inspection)) missing.push("\u0627\u0644\u0641\u062d\u0635");
  if (numberMissing(item.price)) missing.push("\u0633\u0639\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645");
  if (!valueOrEmpty(item.chassis_no)) missing.push("\u0627\u0644\u0634\u0627\u0635\u064a");
  if (!valueOrEmpty(item.license_expiry)) missing.push("\u062a\u0627\u0631\u064a\u062e \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0631\u062e\u0635\u0629");

  const fuel = valueOrEmpty(item.metadata?.fuel);
  const gear = valueOrEmpty(item.metadata?.gear);
  if (!fuel) missing.push("\u0646\u0648\u0639 \u0627\u0644\u0648\u0642\u0648\u062f");
  if (!gear) missing.push("\u0646\u0627\u0642\u0644 \u0627\u0644\u062d\u0631\u0643\u0629");

  return missing;
}

export function getLicenseAlertText(licenseExpiry: string | null) {
  if (!licenseExpiry) return null;

  const target = new Date(licenseExpiry);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return `\u0627\u0644\u0631\u062e\u0635\u0629 \u0645\u0646\u062a\u0647\u064a\u0629 \u0645\u0646\u0630 ${Math.abs(days)} \u064a\u0648\u0645`;
  if (days <= 30) return `\u0627\u0644\u0631\u062e\u0635\u0629 \u062a\u0646\u062a\u0647\u064a \u062e\u0644\u0627\u0644 ${days} \u064a\u0648\u0645`;
  return null;
}

export async function getOperationalAlerts(): Promise<{
  incompleteTrades: OperationalAlertItem[];
  licenseDue: OperationalAlertItem[];
}> {
  if (!hasSupabaseEnv()) {
    return {
      incompleteTrades: [],
      licenseDue: [],
    };
  }

  const supabase = await createClient();
  const { profile, capabilities } = await getScopedProfile();
  const branchId = profile?.branch_id ?? null;
  const userId = profile?.id ?? null;

  const customersQuery = supabase
    .from("customers")
    .select(
      "id, full_name, status, requested_car, branch_id, branches(name), app_users(full_name), trade_ins(id, model, status, license_expiry, color, production_year, mileage, specs, inspection, price, chassis_no, is_active, metadata)",
    );

  const { data } = await (applyStaffScope(
    applyBranchScope(customersQuery, branchId, capabilities.isGeneralManager) as typeof customersQuery,
    userId,
    capabilities.isManager,
  ) as typeof customersQuery).limit(250);

  const incompleteTrades: OperationalAlertItem[] = [];
  const licenseDue: OperationalAlertItem[] = [];
  const REJECT_WORD = "\u0631\u0641\u0636";
  const BACK_OUT_WORD = "\u062a\u0631\u0627\u062c\u0639";
  const SOLD_OUT_WORD = "\u0628\u064a\u0639 \u0627\u0644\u0633\u064a\u0627\u0631\u0629 \u0644\u0639\u0645\u064a\u0644 \u062e\u0627\u0631\u062c\u064a";

  for (const customer of data ?? []) {
    const tradeList = Array.isArray(customer.trade_ins) ? customer.trade_ins : [];

    for (const trade of tradeList) {
      if (!trade?.id) continue;

      const alertBase: OperationalAlertItem = {
        customer_id: customer.id,
        customer_name: customer.full_name,
        branch_name: getRelationshipName(customer.branches),
        staff_name: getRelationshipFullName(customer.app_users),
        customer_status: customer.status,
        requested_car: customer.requested_car ?? null,
        trade_in_id: trade.id,
        trade_in_model: trade.model,
        trade_in_status: trade.status ?? null,
        trade_in_license_expiry: trade.license_expiry ?? null,
        trade_in_missing_fields: getTradeMissingFields(trade),
      };

      const isActiveTrade = Boolean(trade?.is_active);
      const tradeStatus = (trade.status ?? "").trim();
      const isClosedForMissingFlow =
        tradeStatus.includes(REJECT_WORD) || tradeStatus.includes(BACK_OUT_WORD) || tradeStatus.includes(SOLD_OUT_WORD);

      if (isActiveTrade && !isClosedForMissingFlow && alertBase.trade_in_missing_fields.length > 0) {
        incompleteTrades.push(alertBase);
      }

      // License alerts should remain visible until the license-expiry date itself changes.
      // Do not hide them based on trade activity/status updates.
      if (getLicenseAlertText(trade.license_expiry ?? null)) {
        licenseDue.push(alertBase);
      }
    }
  }

  return {
    incompleteTrades,
    licenseDue,
  };
}

