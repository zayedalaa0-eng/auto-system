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
  const { id, ...fields } = body;

  if (!id) return NextResponse.json({ error: "معرّف السيارة مطلوب" }, { status: 400 });

  const caps = getRoleCapabilities(profile.role);
  const admin = createAdminClient();

  // السماح لمدير معرض لمعلم بتعديل كل السيارات التي تظهر له
  const { data: userBranch } = await admin.from("branches").select("name").eq("id", profile.branch_id).maybeSingle();
  const isMuallim = userBranch?.name?.includes("لمعلم") ?? false;

  // التحقق من الصلاحيات
  if (!caps.isGeneralManager && !isMuallim) {
    const { data: car } = await admin.from("inventory").select("branch_id").eq("id", id).maybeSingle();
    if (car?.branch_id && car.branch_id !== profile.branch_id) {
      return NextResponse.json({ error: "لا تملك صلاحية تعديل سيارة من معرض آخر" }, { status: 403 });
    }
  }

  // بناء payload من الحقول المُرسَلة فقط (partial update)
  const ALLOWED = ["model","production_year","color","price","chassis_no","mileage",
    "gearbox","fuel_type","condition_label","deal_type","availability_status",
    "specs","inspection","notes","owner_name"];

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of ALLOWED) {
    if (key in fields) {
      const v = fields[key];
      if (key === "production_year" || key === "price" || key === "mileage") {
        payload[key] = v !== null && v !== undefined && v !== "" ? Number(v) : null;
      } else if (typeof v === "string") {
        payload[key] = v.trim() || null;
      } else {
        payload[key] = v ?? null;
      }
    }
  }

  // إذا أُرسل model تأكد أنه غير فارغ
  if ("model" in payload && !payload.model) {
    return NextResponse.json({ error: "نوع السيارة لا يمكن أن يكون فارغاً" }, { status: 400 });
  }

  const { error } = await admin.from("inventory").update(payload).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
