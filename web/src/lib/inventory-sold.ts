import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";
import { InventoryItem } from "./data";

export type SoldInventoryItem = InventoryItem & {
  buyer_id?: string | null;
  buyer_name?: string | null;
  buyer_branch_name?: string | null;
  buyer_operation_type?: string | null;
  buyer_trade_in_model?: string | null;
  buyer_creator_name?: string | null;
  deal_date?: string | null;
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
  const { data: inventoryRows, error: invError } = await supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, source_customer_id, branch_id, branches(name), updated_at")
    .like("availability_status", "%مباعة%")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (invError || !inventoryRows) {
    console.error("Error fetching sold inventory:", invError);
    return [];
  }

  const items = inventoryRows as unknown as Array<Record<string, unknown>>;
  const inventoryIds = items.map(i => i.id as string);

  // 2. Fetch associated buyers using chunked orQuery (confirmed working via metadata JSONB path)
  const buyersMap = new Map<string, {
    id: string;
    name: string;
    branch: string | null;
    op_type: string | null;
    trade_in_model: string | null;
    creator_name: string | null;
  }>();

  if (inventoryIds.length > 0) {
    const chunkSize = 40;
    const allCustomers: any[] = [];

    for (let i = 0; i < inventoryIds.length; i += chunkSize) {
      const chunk = inventoryIds.slice(i, i + chunkSize);
      const orQuery = chunk
        .map(id => `metadata->>selected_inventory_id.eq.${id}`)
        .join(",");

      const { data: chunkData, error: chunkError } = await supabase
        .from("customers")
        .select("id, full_name, operation_type, metadata, branch_id, assigned_user_id, branches(name), app_users(full_name)")
        .or(orQuery);

      if (chunkError) {
        console.error("Error fetching customers chunk:", chunkError);
      } else if (chunkData) {
        allCustomers.push(...chunkData);
      }
    }

    if (allCustomers.length > 0) {
      // Fetch latest trade-ins for these buyers
      const buyerIds = allCustomers.map(c => c.id);
      const { data: tradeRows } = await supabase
        .from("trade_ins")
        .select("customer_id, model, updated_at")
        .in("customer_id", buyerIds)
        .order("updated_at", { ascending: false });

      const latestTradeByCustomer = new Map<string, string>();
      for (const row of tradeRows ?? []) {
        const cid = String(row.customer_id ?? "");
        const model = String(row.model ?? "").trim();
        if (model && !latestTradeByCustomer.has(cid)) {
          latestTradeByCustomer.set(cid, model);
        }
      }

      // Salesperson name comes from app_users join in the select query

      // Map each customer to their selected_inventory_id
      for (const c of allCustomers) {
        let meta: Record<string, unknown> | null = null;
        if (typeof c.metadata === "string") {
          try { meta = JSON.parse(c.metadata); } catch { continue; }
        } else if (c.metadata && typeof c.metadata === "object") {
          meta = c.metadata as Record<string, unknown>;
        }

        const selId = meta?.selected_inventory_id as string | undefined;
        if (!selId) continue;

        const opType =
          (c.operation_type as string | null) ??
          (meta?.operation_type_code as string | null) ??
          (meta?.operation_type as string | null) ??
          null;

        // Get salesperson name from joined app_users relation
        const salespersonName: string | null = Array.isArray(c.app_users)
          ? (c.app_users[0]?.full_name ?? null)
          : (c.app_users as any)?.full_name ?? null;

        buyersMap.set(selId, {
          id: c.id,
          name: c.full_name,
          branch: Array.isArray(c.branches)
            ? c.branches[0]?.name
            : (c.branches as any)?.name ?? null,
          op_type: opType,
          trade_in_model: latestTradeByCustomer.get(c.id) ?? null,
          creator_name: salespersonName,
        });
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
      branch_name: Array.isArray(item.branches)
        ? item.branches[0]?.name
        : (item.branches as any)?.name ?? null,
      buyer_id: buyer?.id ?? null,
      buyer_name: buyer?.name ?? null,
      buyer_branch_name: buyer?.branch ?? null,
      buyer_operation_type: buyer?.op_type ?? null,
      buyer_trade_in_model: buyer?.trade_in_model ?? null,
      buyer_creator_name: buyer?.creator_name ?? null,
      deal_date: (item.updated_at as string | null) ?? null,
    };
  });

  return soldItems;
}

export type SoldInventoryFilters = {
  q?: string;
  branch?: string;
  deal?: string;
};

export function filterSoldInventory(
  items: SoldInventoryItem[],
  filters: SoldInventoryFilters
): SoldInventoryItem[] {
  const normQ = (filters.q ?? "").trim().toLowerCase();

  return items.filter(item => {
    if (
      filters.branch &&
      filters.branch !== "all" &&
      item.branch_name !== filters.branch &&
      item.buyer_branch_name !== filters.branch
    ) {
      return false;
    }

    if (filters.deal && filters.deal !== "all") {
      const d = (item.deal_type ?? "").toLowerCase();
      const opType = (item.buyer_operation_type ?? "").toLowerCase();

      let badge = "مشتري";
      if (d.includes("وكالة") || d.includes("برسم البيع")) {
        badge = "وكالة";
      } else if (
        opType.includes("trade") ||
        opType.includes("استبدال") ||
        d.includes("استبدال") ||
        d.includes("حيازة")
      ) {
        badge = "استبدال";
      }

      if (filters.deal !== badge) return false;
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
        item.buyer_creator_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normQ)) return false;
    }

    return true;
  });
}
