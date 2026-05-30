import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";
import type { CustomerItem } from "@/lib/data";

/* ── helpers ── */
function mapRow(row: Record<string, unknown>): CustomerItem {
  const branches = row.branches as { name?: string } | null;
  const appUsers = row.app_users as { full_name?: string } | null;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id:                  String(row.id ?? ""),
    full_name:           String(row.full_name ?? ""),
    phone:               String(row.phone ?? ""),
    status:              String(row.status ?? ""),
    operation_type:      row.operation_type as string | null,
    requested_car:       row.requested_car as string | null,
    next_follow_up_at:   row.next_follow_up_at as string | null,
    branch_id:           row.branch_id as string | null,
    branch_name:         branches?.name ?? null,
    assigned_user_id:    row.assigned_user_id as string | null,
    assigned_user_name:  appUsers?.full_name ?? null,
    is_active:           row.is_active as boolean,
    last_contact_at:     row.last_contact_at as string | null,
    notes:               row.notes as string | null,
    created_at:          row.created_at as string | null,
    updated_at:          row.updated_at as string | null,
    visit_count:         row.visit_count as number | undefined,
    payment_plan:        row.payment_plan as string | null,
    source:              row.source as string | null,
    payment_method:      (meta.payment_method as string | undefined) ?? null,
    requested_car_report: row.requested_car as string | null,
    sale_offer_car:      null,
    trade_in_model:      null,
    trade_in_status:     null,
    inventory_availability: null,
    selected_inventory_id: (meta.selected_inventory_id as string | undefined) ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q          = (searchParams.get("q") ?? "").trim();
    const lifecycle  = searchParams.get("lifecycle") ?? "all";   // all | active | closed
    const opType     = searchParams.get("op") ?? "all";          // all | buyer | buyer_tradein_pending | sell_on_behalf
    const statusVal  = searchParams.get("status") ?? "";
    const limit      = Math.min(Number(searchParams.get("limit") ?? "80"), 200);

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { data: userRow } = await supabase
      .from("app_users")
      .select("id, role, branch_id")
      .eq("auth_user_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!userRow) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const caps = getRoleCapabilities(userRow.role);

    /* ── build query ── */
    let query = supabase
      .from("customers")
      .select(
        "id, full_name, phone, requested_car, payment_plan, status, operation_type, next_follow_up_at, assigned_user_id, branch_id, source, is_active, last_contact_at, notes, created_at, updated_at, visit_count, metadata, branches(name), app_users(full_name)",
      );

    // نطاق الفرع
    if (!caps.isGeneralManager && userRow.branch_id) {
      query = query.eq("branch_id", userRow.branch_id) as typeof query;
    }

    // بحث نصي على قاعدة البيانات
    if (q) {
      const like = `%${q.replace(/[%_\\]/g, "")}%`;
      query = query.or(
        [
          `full_name.ilike.${like}`,
          `phone.ilike.${like}`,
          `requested_car.ilike.${like}`,
          `status.ilike.${like}`,
          `notes.ilike.${like}`,
        ].join(","),
      ) as typeof query;
    }

    // فلتر نشاط الدورة
    if (lifecycle === "active")  query = query.eq("is_active", true) as typeof query;
    if (lifecycle === "closed")  query = query.eq("is_active", false) as typeof query;

    // فلتر نوع العملية
    if (opType !== "all") {
      query = query.eq("operation_type", opType) as typeof query;
    }

    // فلتر الحالة
    if (statusVal) {
      query = query.eq("status", statusVal) as typeof query;
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const customers = (data ?? []).map(r => mapRow(r as Record<string, unknown>));

    return NextResponse.json({
      customers,
      isGeneralManager: caps.isGeneralManager,
      isManager: caps.isManager,
      total: customers.length,
    });
  } catch (err) {
    console.error("[api/customers/search]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
