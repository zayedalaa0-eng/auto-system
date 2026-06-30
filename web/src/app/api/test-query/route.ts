import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();

  // 1. Fetch 5 sold inventory items
  const { data: invs } = await admin
    .from("inventory")
    .select("id, model, availability_status")
    .like("availability_status", "%مباعة%")
    .limit(5);

  const ids = invs?.map(i => i.id) || [];

  // 2. Sample customers - check metadata structure
  const { data: allCusts } = await admin
    .from("customers")
    .select("id, full_name, operation_type, metadata, created_by_user_id")
    .limit(5);

  // 3. Try exact JSON path query (works if metadata is jsonb)
  let jsonbResult: any = null;
  let jsonbError: any = null;
  if (ids.length > 0) {
    const { data, error } = await admin
      .from("customers")
      .select("id, full_name, metadata")
      .filter("metadata->>selected_inventory_id", "eq", ids[0]);
    jsonbResult = data;
    jsonbError = error;
  }

  // 4. Try text cast
  let textResult: any = null;
  let textError: any = null;
  if (ids.length > 0) {
    const { data, error } = await admin
      .from("customers")
      .select("id, full_name, metadata")
      .textSearch("metadata::text", ids[0]);
    textResult = data?.length;
    textError = error;
  }

  // 5. Try fetching ALL customers and filter in memory
  const { data: allCusts2, error: allErr } = await admin
    .from("customers")
    .select("id, full_name, operation_type, metadata, created_by_user_id")
    .not("is_active", "eq", false);
  
  const matchedInMemory = (allCusts2 ?? []).filter(c => {
    let meta: any = c.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { return false; }
    }
    return meta && ids.includes(meta.selected_inventory_id);
  });

  return NextResponse.json({
    soldCars: invs?.map(i => ({ id: i.id, model: i.model })),
    totalSoldCarIds: ids.length,
    
    sampleCustomers: allCusts?.map(c => ({
      id: c.id,
      name: c.full_name,
      op_type: c.operation_type,
      metadata_type: typeof c.metadata,
      metadata_keys: c.metadata && typeof c.metadata === 'object' ? Object.keys(c.metadata as any) : [],
      selected_inv_id: typeof c.metadata === 'object' ? (c.metadata as any)?.selected_inventory_id : 
                       typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata).selected_inventory_id } catch { return 'PARSE_ERR' } })() : null,
    })),

    jsonbQuery: {
      testedWithId: ids[0],
      count: jsonbResult?.length ?? 0,
      error: jsonbError,
      results: jsonbResult,
    },

    inMemoryFilter: {
      totalCustomersFetched: allCusts2?.length ?? 0,
      fetchError: allErr,
      matchedCount: matchedInMemory.length,
      matched: matchedInMemory.map(c => ({
        id: c.id,
        name: c.full_name,
        op: c.operation_type,
        sel_inv: typeof c.metadata === 'object' ? (c.metadata as any)?.selected_inventory_id : null,
      }))
    }
  });
}
