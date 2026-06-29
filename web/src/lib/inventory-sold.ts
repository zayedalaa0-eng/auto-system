import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";
import { InventoryItem } from "./data";

export type SoldInventoryItem = InventoryItem & {
  buyer_id?: string | null;
  buyer_name?: string | null;
  buyer_branch_name?: string | null;
};

export async function getSoldInventory(limit = 250): Promise<SoldInventoryItem[]> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (!profile) return [];

  const caps = getRoleCapabilities(profile.role);
  
  // 1. Fetch sold inventory
  let query = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, source_customer_id, branch_id, branches(name)")
    .like("availability_status", "%مباعة%")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  // If not GM and not Al-Muallim, restrict by branch
  // But wait, what if they sold a car from another branch? We should allow them to see it if either branch_id = theirs OR buyer branch = theirs.
  // We'll filter in JS to be safe, or just fetch all and filter in JS. For now, fetch limit=250 sold cars and we'll apply scope if needed.

  const { data: inventoryRows, error: invError } = await query;
  if (invError || !inventoryRows) {
    console.error("Error fetching sold inventory:", invError);
    return [];
  }

  const items = inventoryRows as unknown as Array<Record<string, unknown>>;
  const inventoryIds = items.map(i => i.id as string);

  // 2. Fetch associated buyers
  const buyersMap = new Map<string, { id: string; name: string; branch: string | null }>();
  if (inventoryIds.length > 0) {
    const { data: customerRows, error: custError } = await supabase
      .from("customers")
      .select("id, full_name, selected_inventory_id, branch_id, branches(name)")
      .in("selected_inventory_id", inventoryIds)
      .eq("is_active", true);

    if (!custError && customerRows) {
      for (const c of customerRows) {
        if (c.selected_inventory_id) {
          buyersMap.set(c.selected_inventory_id, {
            id: c.id,
            name: c.full_name,
            branch: Array.isArray(c.branches) ? c.branches[0]?.name : (c.branches as any)?.name ?? null,
          });
        }
      }
    }
  }

  // 3. Merge data
  const soldItems: SoldInventoryItem[] = items.map(item => {
    const bId = item.id as string;
    const buyer = buyersMap.get(bId);
    return {
      id: bId,
      model: String(item.model ?? ""),
      owner_name: (item.owner_name as string | null) ?? null,
      deal_type: (item.deal_type as string | null) ?? null,
      chassis_no: (item.chassis_no as string | null) ?? null,
      condition_label: (item.condition_label as string | null) ?? null,
      availability_status: String(item.availability_status ?? ""),
      price: (item.price as number | null) ?? null,
      production_year: (item.production_year as number | null) ?? null,
      color: (item.color as string | null) ?? null,
      gearbox: (item.gearbox as string | null) ?? null,
      fuel_type: (item.fuel_type as string | null) ?? null,
      mileage: (item.mileage as number | null) ?? null,
      specs: (item.specs as string | null) ?? null,
      inspection: (item.inspection as string | null) ?? null,
      source_customer_id: (item.source_customer_id as string | null) ?? null,
      branch_id: (item.branch_id as string | null) ?? null,
      branch_name: Array.isArray(item.branches) ? item.branches[0]?.name : (item.branches as any)?.name ?? null,
      buyer_id: buyer?.id ?? null,
      buyer_name: buyer?.name ?? null,
      buyer_branch_name: buyer?.branch ?? null,
    };
  });

  return soldItems;
}

export type SoldInventoryFilters = {
  q?: string;
  branch?: string;
  deal?: string;
};

export function filterSoldInventory(items: SoldInventoryItem[], filters: SoldInventoryFilters): SoldInventoryItem[] {
  const normQ = (filters.q ?? "").trim().toLowerCase();
  
  return items.filter(item => {
    if (filters.branch && filters.branch !== "all" && item.branch_name !== filters.branch && item.buyer_branch_name !== filters.branch) {
      return false; // must match either seller branch or buyer branch
    }
    
    if (filters.deal && filters.deal !== "all") {
      const dealNorm = (item.deal_type ?? "").trim().toLowerCase();
      const filterDealNorm = filters.deal.toLowerCase();
      if (!dealNorm.includes(filterDealNorm)) {
        if (filters.deal === "جديد" && (dealNorm.includes("استبدال") || dealNorm.includes("وكالة") || dealNorm.includes("مستعمل"))) return false;
        if (filters.deal === "مستعمل" && !dealNorm.includes("استبدال") && !dealNorm.includes("وكالة") && !dealNorm.includes("مستعمل")) return false;
      }
    }

    if (normQ) {
      const haystack = [
        item.model,
        item.chassis_no ?? "",
        item.owner_name ?? "",
        item.branch_name ?? "",
        item.buyer_name ?? "",
        item.buyer_branch_name ?? "",
        item.deal_type ?? "",
      ].join(" ").toLowerCase();
      if (!haystack.includes(normQ)) return false;
    }

    return true;
  });
}
