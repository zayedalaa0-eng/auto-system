import { hasSupabaseEnv } from "@/lib/env";
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
};

export type CustomerItem = {
  id: string;
  full_name: string;
  phone: string;
  requested_car: string | null;
  status: string;
  next_follow_up_at: string | null;
  branch_name: string | null;
};

export type InventoryItem = {
  id: string;
  model: string;
  owner_name: string | null;
  availability_status: string;
  price: number | null;
  production_year: number | null;
  color: string | null;
  branch_name: string | null;
};

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

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  if (!hasSupabaseEnv()) {
    return [
      { label: "العملاء", value: 0, hint: "سيظهر العدد بعد الربط مع Supabase" },
      { label: "المخزون", value: 0, hint: "سنبدأ من الجداول التي جهزناها" },
      { label: "التذكيرات", value: 0, hint: "مرتبطة لاحقًا مع reminders" },
      { label: "الإشعارات", value: 0, hint: "مرتبطة لاحقًا مع notifications" },
    ];
  }

  const supabase = await createClient();

  const [{ count: customersCount }, { count: inventoryCount }, { count: remindersCount }, { count: notificationsCount }] =
    await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("inventory").select("*", { count: "exact", head: true }),
      supabase.from("reminders").select("*", { count: "exact", head: true }),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "unread"),
    ]);

  return [
    { label: "العملاء", value: customersCount ?? 0, hint: "من جدول customers" },
    { label: "المخزون", value: inventoryCount ?? 0, hint: "من جدول inventory" },
    { label: "التذكيرات", value: remindersCount ?? 0, hint: "من جدول reminders" },
    { label: "غير المقروءة", value: notificationsCount ?? 0, hint: "من جدول notifications" },
  ];
}

export async function getRecentCustomers(): Promise<CustomerItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, requested_car, status, next_follow_up_at, branches(name)",
    )
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((item) => ({
    id: item.id,
    full_name: item.full_name,
    phone: item.phone,
    requested_car: item.requested_car,
    status: item.status,
    next_follow_up_at: item.next_follow_up_at,
    branch_name: Array.isArray(item.branches)
      ? item.branches[0]?.name ?? null
      : (item.branches as { name?: string } | null)?.name ?? null,
  }));
}

export async function getRecentInventory(): Promise<InventoryItem[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory")
    .select(
      "id, model, owner_name, availability_status, price, production_year, color, branches(name)",
    )
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((item) => ({
    id: item.id,
    model: item.model,
    owner_name: item.owner_name,
    availability_status: item.availability_status,
    price: item.price,
    production_year: item.production_year,
    color: item.color,
    branch_name: Array.isArray(item.branches)
      ? item.branches[0]?.name ?? null
      : (item.branches as { name?: string } | null)?.name ?? null,
  }));
}
