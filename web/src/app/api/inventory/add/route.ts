import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";

/**
 * POST /api/inventory/add
 * إضافة سيارة واحدة للمخزون — متاح لجميع الموظفين
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const caps = getRoleCapabilities(profile.role, profile.full_name);

  const body = await req.json();
  const {
    model, production_year, color, price, chassis_no,
    mileage, gearbox, fuel_type, condition_label, deal_type,
    availability_status, specs, inspection, notes,
    branch_id: bodyBranchId, owner_name,
  } = body;

  if (!model?.trim()) {
    return NextResponse.json({ error: "نوع السيارة مطلوب" }, { status: 400 });
  }

  // تحديد الفرع: المدير العام يختار، البقية فرعهم
  const resolvedBranchId = caps.isGeneralManager
    ? (bodyBranchId || null)
    : profile.branch_id;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("inventory")
    .insert({
      model: model.trim(),
      production_year: production_year ? Number(production_year) : null,
      color: color?.trim() || null,
      price: price ? Number(price) : null,
      chassis_no: chassis_no?.trim() || null,
      mileage: mileage ? Number(mileage) : null,
      gearbox: gearbox?.trim() || null,
      fuel_type: fuel_type?.trim() || null,
      condition_label: condition_label?.trim() || null,
      deal_type: deal_type?.trim() || "شراء",
      availability_status: availability_status?.trim() || "متوفرة",
      specs: specs?.trim() || null,
      inspection: inspection?.trim() || null,
      notes: notes?.trim() || null,
      branch_id: resolvedBranchId,
      owner_name: owner_name?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}
