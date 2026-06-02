import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";

/**
 * POST /api/bot-app/inventory-add
 * إضافة سيارة واحدة للمخزون من المني-آب — لجميع الموظفين
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    chat_id, model, production_year, color, price, chassis_no,
    mileage, gearbox, fuel_type, condition_label, deal_type,
    availability_status, specs, inspection, notes, owner_name, branch_id,
  } = body;

  if (!chat_id) return NextResponse.json({ error: "chat_id مطلوب" }, { status: 400 });
  if (!model?.trim()) return NextResponse.json({ error: "نوع السيارة مطلوب" }, { status: 400 });

  const admin = createAdminClient();

  const { data: user } = await admin
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("telegram_chat_id", String(chat_id))
    .eq("is_active", true)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const caps = getRoleCapabilities(user.role, user.full_name);
  const resolvedBranchId = caps.isGeneralManager
    ? (branch_id || null)
    : user.branch_id;

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
      condition_label: condition_label?.trim() || "مستعملة",
      deal_type: deal_type?.trim() || "شراء",
      availability_status: availability_status?.trim() || "متوفرة",
      specs: specs?.trim() || null,
      inspection: inspection?.trim() || null,
      notes: notes?.trim() || null,
      owner_name: owner_name?.trim() || null,
      branch_id: resolvedBranchId,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}
