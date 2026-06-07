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

  const caps = getRoleCapabilities(profile.role);
  if (!caps.isManager) return NextResponse.json({ error: "هذه العملية للمديرين فقط" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "معرّف السيارة مطلوب" }, { status: 400 });

  const admin = createAdminClient();

  // مدير الفرع يحذف فقط سيارات فرعه
  if (!caps.isGeneralManager) {
    const { data: car } = await admin.from("inventory").select("branch_id").eq("id", id).maybeSingle();
    if (car?.branch_id && car.branch_id !== profile.branch_id) {
      return NextResponse.json({ error: "لا تملك صلاحية حذف سيارة من معرض آخر" }, { status: 403 });
    }
  }

  const { error } = await admin.from("inventory").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
