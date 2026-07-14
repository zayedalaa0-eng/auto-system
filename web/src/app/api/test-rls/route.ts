import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();

  const query = admin.from("inventory").select("id, model, deal_type, branch_id");
  
  // Try the exact string used in applyBranchScope
  // branchId is let's say hardcoded or we just test the in syntax
  const orString1 = 'deal_type.in.(استبدال,برسم البيع)';
  
  const { data: d1, error: e1 } = await admin.from("inventory").select("id, model, deal_type").or(orString1);
  
  const orString2 = 'deal_type.in.("استبدال","برسم البيع")';
  const { data: d2, error: e2 } = await admin.from("inventory").select("id, model, deal_type").or(orString2);

  return NextResponse.json({
    test1: { d1: d1?.length, e1 },
    test2: { d2: d2?.length, e2 },
  });
}
