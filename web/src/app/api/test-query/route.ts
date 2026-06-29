import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: invs } = await admin.from("inventory").select("id").limit(10);
  const ids = invs?.map(i => i.id) || [];
  
  const orQuery = ids.map(id => `metadata->>selected_inventory_id.eq.${id}`).join(",");
  const { data: c1, error: e1 } = await admin
    .from("customers")
    .select("id, metadata, operation_type")
    .or(orQuery);
    
  return NextResponse.json({
    carIds: ids,
    orQuery,
    totalCustomers: c1?.length,
    error: e1
  });
}
