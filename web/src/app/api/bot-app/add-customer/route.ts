import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { pushTelegramToManagers } from "@/lib/telegram/push";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chat_id, full_name, phone, status, requested_car, notes } = body;

    if (!chat_id || !full_name || !phone) {
      return NextResponse.json({ error: "الاسم والهاتف مطلوبان" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Authenticate via chat_id
    const { data: user } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("telegram_chat_id", String(chat_id))
      .eq("is_active", true)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const caps = getRoleCapabilities(user.role, user.full_name);

    // Check for duplicate phone in same branch
    const dupQuery = admin
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .eq("is_active", true);

    const { data: dup } = await (user.branch_id
      ? dupQuery.eq("branch_id", user.branch_id)
      : dupQuery.is("branch_id", null)
    ).maybeSingle();

    if (dup?.id) {
      return NextResponse.json({ error: "يوجد عميل بنفس الهاتف في المعرض" }, { status: 409 });
    }

    const { data: inserted, error } = await admin
      .from("customers")
      .insert({
        full_name: full_name.trim(),
        phone: phone.trim(),
        status: status || "عميل جديد",
        requested_car: requested_car?.trim() || null,
        notes: notes?.trim() || null,
        branch_id: user.branch_id ?? null,
        assigned_user_id: user.id,
        is_active: true,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify managers
    if (!caps.isManager) {
      void pushTelegramToManagers({
        branchId: user.branch_id,
        title: "إضافة عميل جديد (Mini App)",
        message: `أضاف <b>${user.full_name}</b> عميلاً جديداً:\n👤 ${full_name}\n📱 ${phone}\n📌 ${status || "عميل جديد"}${requested_car ? `\n🚗 ${requested_car}` : ""}`,
      });
    }

    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (err) {
    console.error("[bot-app/add-customer]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
