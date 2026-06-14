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

  // ── 1. بحث عن دورة نشطة ────────────────────────────────────
  let activeQuery = supabase
    .from("customers")
    .select("id, full_name, phone, branch_id, status, operation_type, cycle_number")
    .eq("phone", phone)
    .eq("is_active", true)
    .limit(1);

  if (!capabilities.isGeneralManager) {
    if (profile?.branch_id) {
      activeQuery = activeQuery.eq("branch_id", profile.branch_id);
    } else {
      activeQuery = activeQuery.is("branch_id", null);
    }
  }

  const { data: activeCustomer } = await activeQuery.maybeSingle();

  if (activeCustomer?.id) {
    return NextResponse.json({
      exists: true,
      customer: { id: activeCustomer.id, full_name: activeCustomer.full_name },
      returning: false,
      previousCycle: null,
    });
  }

  // ── 2. بحث عن دورات مغلقة (عميل عائد) ────────────────────
  let closedQuery = supabase
    .from("customers")
    .select("id, full_name, phone, branch_id, status, operation_type, cycle_number, created_at")
    .eq("phone", phone)
    .eq("is_active", false)
    .order("cycle_number", { ascending: false })
    .limit(1);

  if (!capabilities.isGeneralManager) {
    if (profile?.branch_id) {
      closedQuery = closedQuery.eq("branch_id", profile.branch_id);
    } else {
      closedQuery = closedQuery.is("branch_id", null);
    }
  }

  const { data: latestClosed } = await closedQuery.maybeSingle();

  if (latestClosed?.id) {
    return NextResponse.json({
      exists: false,
      customer: null,
      returning: true,
      previousCycle: {
        id: latestClosed.id,
        full_name: latestClosed.full_name,
        status: latestClosed.status ?? "مغلق",
        cycle_number: latestClosed.cycle_number ?? 1,
        operation_type: latestClosed.operation_type ?? "buyer",
      },
    });
  }

  // ── 3. عميل جديد تماماً ─────────────────────────────────────
  return NextResponse.json({ exists: false, customer: null, returning: false, previousCycle: null });
}
