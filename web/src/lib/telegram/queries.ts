import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities, type RoleCapabilities } from "@/lib/roles";

export type BotUser = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  capabilities: RoleCapabilities;
};

type RelationOrArray<T> = T | T[] | null;

function unwrap<T>(rel: RelationOrArray<T>): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export async function getBotUser(chatId: string): Promise<BotUser | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("telegram_chat_id", chatId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    role: data.role,
    branch_id: data.branch_id ?? null,
    capabilities: getRoleCapabilities(data.role, data.full_name),
  };
}

function applyScope<Q extends { eq: (col: string, val: string) => Q }>(
  query: Q,
  user: BotUser,
) {
  if (!user.capabilities.isGeneralManager && user.branch_id) {
    query = query.eq("branch_id", user.branch_id);
  }
  if (!user.capabilities.isManager) {
    query = query.eq("assigned_user_id", user.id);
  }
  return query;
}

export async function getTodayTasks(user: BotUser) {
  const admin = createAdminClient();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndIso = todayEnd.toISOString();

  const remindersBase = admin
    .from("reminders")
    .select("id, title, message, due_at, customers(full_name)")
    .eq("status", "pending")
    .lte("due_at", todayEndIso)
    .order("due_at", { ascending: true })
    .limit(10);

  const followupsBase = admin
    .from("customers")
    .select("id, full_name, phone, status, requested_car, next_follow_up_at")
    .eq("is_active", true)
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", todayEndIso)
    .or("status.ilike.%متابعة%,status.ilike.%حجز%")
    .order("next_follow_up_at", { ascending: true })
    .limit(10);

  let remindersQuery = remindersBase;
  let followupsQuery = followupsBase;

  if (!user.capabilities.isGeneralManager && user.branch_id) {
    remindersQuery = remindersQuery.eq("branch_id", user.branch_id) as typeof remindersQuery;
    followupsQuery = followupsQuery.eq("branch_id", user.branch_id) as typeof followupsQuery;
  }
  if (!user.capabilities.isManager) {
    remindersQuery = remindersQuery.eq("assigned_user_id", user.id) as typeof remindersQuery;
    followupsQuery = followupsQuery.eq("assigned_user_id", user.id) as typeof followupsQuery;
  }

  const [{ data: reminders }, { data: followups }] = await Promise.all([
    remindersQuery,
    followupsQuery,
  ]);

  return {
    reminders: (reminders ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      due_at: r.due_at,
      customer_name: unwrap(r.customers as RelationOrArray<{ full_name: string }>)?.full_name ?? null,
    })),
    followups: (followups ?? []).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      status: c.status,
      requested_car: c.requested_car,
      next_follow_up_at: c.next_follow_up_at,
    })),
  };
}

export async function getMyCustomers(user: BotUser) {
  const admin = createAdminClient();

  let query = admin
    .from("customers")
    .select("id, full_name, phone, status, requested_car, next_follow_up_at, branches(name)")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (!user.capabilities.isGeneralManager && user.branch_id) {
    query = query.eq("branch_id", user.branch_id) as typeof query;
  }
  if (!user.capabilities.isManager) {
    query = query.eq("assigned_user_id", user.id) as typeof query;
  }

  const { data } = await query;
  return (data ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    status: c.status,
    requested_car: c.requested_car,
    next_follow_up_at: c.next_follow_up_at,
    branch_name: unwrap(c.branches as RelationOrArray<{ name: string }>)?.name ?? null,
  }));
}

export async function searchCustomers(user: BotUser, searchQuery: string) {
  const admin = createAdminClient();
  const like = `%${searchQuery.replace(/[%_]/g, " ")}%`;

  let query = admin
    .from("customers")
    .select("id, full_name, phone, status, requested_car, branches(name)")
    .or(`full_name.ilike.${like},phone.ilike.${like},requested_car.ilike.${like}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!user.capabilities.isGeneralManager && user.branch_id) {
    query = query.eq("branch_id", user.branch_id) as typeof query;
  }
  if (!user.capabilities.isManager) {
    query = query.eq("assigned_user_id", user.id) as typeof query;
  }

  const { data } = await query;
  return (data ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    status: c.status,
    requested_car: c.requested_car,
    branch_name: unwrap(c.branches as RelationOrArray<{ name: string }>)?.name ?? null,
  }));
}

async function countQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  base: any,
  branchId: string | null,
  isGeneralManager: boolean,
): Promise<number> {
  const q = !isGeneralManager && branchId ? base.eq("branch_id", branchId) : base;
  const result = await q;
  return (result as { count: number | null }).count ?? 0;
}

export async function getBranchReport(user: BotUser) {
  const admin = createAdminClient();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndIso = todayEnd.toISOString();
  const nowIso = new Date().toISOString();
  const { isGeneralManager } = user.capabilities;
  const branchId = user.branch_id;

  const [activeCustomers, availableInventory, todayFollowups, overdueFollowups] = await Promise.all([
    countQuery(
      admin.from("customers").select("*", { count: "exact", head: true }).eq("is_active", true),
      branchId,
      isGeneralManager,
    ),
    countQuery(
      admin.from("inventory").select("*", { count: "exact", head: true }).eq("availability_status", "متوفرة"),
      branchId,
      isGeneralManager,
    ),
    countQuery(
      admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", todayEndIso)
        .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
      branchId,
      isGeneralManager,
    ),
    countQuery(
      admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .not("next_follow_up_at", "is", null)
        .lt("next_follow_up_at", nowIso)
        .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
      branchId,
      isGeneralManager,
    ),
  ]);

  return { activeCustomers, availableInventory, todayFollowups, overdueFollowups };
}

export async function getGeneralManagerReport() {
  const admin = createAdminClient();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndIso = todayEnd.toISOString();
  const nowIso = new Date().toISOString();

  const [
    { data: branches },
    { count: totalCustomers },
    { count: totalInventory },
    { count: todayFollowups },
    { count: overdueFollowups },
    { count: unreadNotifications },
  ] = await Promise.all([
    admin
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    admin.from("customers").select("*", { count: "exact", head: true }).eq("is_active", true),
    admin.from("inventory").select("*", { count: "exact", head: true }).eq("availability_status", "متوفرة"),
    admin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", todayEndIso)
      .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
    admin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", nowIso)
      .or("status.ilike.%متابعة%,status.ilike.%حجز%"),
    admin.from("notifications").select("*", { count: "exact", head: true }).eq("status", "unread"),
  ]);

  // Per-branch counts
  const branchIds = (branches ?? []).map((b) => b.id);
  const branchStats: Array<{ name: string; customers: number; inventory: number }> = [];

  if (branchIds.length > 0) {
    const [{ data: custRows }, { data: invRows }] = await Promise.all([
      admin.from("customers").select("branch_id").eq("is_active", true).in("branch_id", branchIds),
      admin.from("inventory").select("branch_id").eq("availability_status", "متوفرة").in("branch_id", branchIds),
    ]);

    const custMap = new Map<string, number>();
    const invMap = new Map<string, number>();
    for (const r of custRows ?? []) {
      const bid = String(r.branch_id ?? "");
      custMap.set(bid, (custMap.get(bid) ?? 0) + 1);
    }
    for (const r of invRows ?? []) {
      const bid = String(r.branch_id ?? "");
      invMap.set(bid, (invMap.get(bid) ?? 0) + 1);
    }

    for (const b of branches ?? []) {
      branchStats.push({
        name: b.name,
        customers: custMap.get(b.id) ?? 0,
        inventory: invMap.get(b.id) ?? 0,
      });
    }
  }

  return {
    totalCustomers: totalCustomers ?? 0,
    totalInventory: totalInventory ?? 0,
    todayFollowups: todayFollowups ?? 0,
    overdueFollowups: overdueFollowups ?? 0,
    unreadNotifications: unreadNotifications ?? 0,
    branchStats,
  };
}
