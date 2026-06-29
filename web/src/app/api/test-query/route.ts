import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: invs } = await admin.from("inventory").select("id").limit(10);
  const ids = invs?.map(i => i.id) || [];
  
  const { data: c1, error: e1 } = await admin
    .from("customers")
    .select("id, metadata")
    .in("metadata->>selected_inventory_id", ids);
    
  return NextResponse.json({
    ids,
    inResult: { data: c1, error: e1 }
  });
}
