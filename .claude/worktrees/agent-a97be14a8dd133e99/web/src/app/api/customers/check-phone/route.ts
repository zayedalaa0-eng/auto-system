import { NextResponse } from "next/server";

import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function normalizePhone(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const phone = normalizePhone(url.searchParams.get("phone"));

  if (!phone) {
    return NextResponse.json({ exists: false, customer: null });
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ exists: false, customer: null }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  const capabilities = getRoleCapabilities(profile?.role, profile?.full_name);
  let query = supabase.from("customers").select("id, full_name, phone, branch_id").eq("phone", phone).limit(1);

  if (!capabilities.isGeneralManager && profile?.branch_id) {
    query = query.eq("branch_id", profile.branch_id);
  }

  const { data: customer } = await query.maybeSingle();

  return NextResponse.json({
    exists: Boolean(customer?.id),
    customer: customer ? { id: customer.id, full_name: customer.full_name } : null,
  });
}
