import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { id, model, production_year, color, price, chassis_no, mileage,
    gearbox, fuel_type, condition_label, deal_type, availability_status,
    specs, inspection, notes, owner_name } = body;

  if (!id) return NextResponse.json({ error: "معرّف السيارة مطلوب" }, { status: 400 });
  if (!model?.trim()) return NextResponse.json({ error: "نوع السيارة مطلوب" }, { status: 400 });

  const caps = getRoleCapabilities(profile.role);

  // التحقق من الملكية — الموظف يعدّل فقط سيارات فرعه
  const admin = createAdminClient();
  if (!caps.isGeneralManager) {
    const { data: car } = await admin.from("inventory").select("branch_id").eq("id", id).maybeSingle();
    if (car?.branch_id && car.branch_id !== profile.branch_id) {
      return NextResponse.json({ error: "لا تملك صلاحية تعديل سيارة من معرض آخر" }, { status: 403 });
    }
  }

  const { error } = await admin.from("inventory").update({
    model: model.trim(),
    production_year: production_year ? Number(production_year) : null,
    color: color?.trim() || null,
    price: price ? Number(price) : null,
    chassis_no: chassis_no?.trim() || null,
    mileage: mileage ? Number(mileage) : null,
    gearbox: gearbox?.trim() || null,
    fuel_type: fuel_type?.trim() || null,
    condition_label: condition_label?.trim() || null,
    deal_type: deal_type?.trim() || null,
    availability_status: availability_status?.trim() || "متوفرة",
    specs: specs?.trim() || null,
    inspection: inspection?.trim() || null,
    notes: notes?.trim() || null,
    owner_name: owner_name?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
