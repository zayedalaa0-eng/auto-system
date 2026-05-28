import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { pushTelegramToManagers } from "@/lib/telegram/push";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      chat_id,
      full_name,
      phone,
      status,
      requested_car,
      source,
      notes,
      next_follow_up_at,
      payment_plan,
      assigned_user_id,
    } = body;

    if (!chat_id || !full_name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "الاسم ورقم الهاتف مطلوبان" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: user } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("telegram_chat_id", String(chat_id))
      .eq("is_active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const caps = getRoleCapabilities(user.role, user.full_name);

    // Duplicate phone check
    const dupQuery = admin
      .from("customers")
      .select("id")
      .eq("phone", phone.trim())
      .eq("is_active", true);

    const { data: dup } = await (user.branch_id
      ? dupQuery.eq("branch_id", user.branch_id)
      : dupQuery.is("branch_id", null)
    ).maybeSingle();

    if (dup?.id) {
      return NextResponse.json(
        { error: "يوجد عميل نشط بنفس رقم الهاتف في هذا المعرض" },
        { status: 409 },
      );
    }

    const resolvedStatus = status?.trim() || "جديد";
    const isClosedStatus =
      resolvedStatus.includes("العميل غير فعال") ||
      resolvedStatus.includes("تم البيع") ||
      resolvedStatus.includes("تمت صفقة استبدال") ||
      resolvedStatus.includes("رفض");

    const resolvedAssignedUser =
      caps.isManager && assigned_user_id ? assigned_user_id : user.id;

    const { data: inserted, error } = await admin
      .from("customers")
      .insert({
        full_name: full_name.trim(),
        phone: phone.trim(),
        status: resolvedStatus,
        requested_car: requested_car?.trim() || null,
        source: source?.trim() || null,
        notes: notes?.trim() || null,
        payment_plan: payment_plan?.trim() || null,
        next_follow_up_at:
          !isClosedStatus && next_follow_up_at ? new Date(next_follow_up_at).toISOString() : null,
        branch_id: user.branch_id ?? null,
        assigned_user_id: resolvedAssignedUser,
        is_active: !isClosedStatus,
      })
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log
    await admin.from("customer_logs").insert({
      customer_id: inserted?.id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action: "customer_created",
      details: `تم إنشاء ملف العميل ${full_name.trim()} عبر بوت Telegram.`,
    });

    // Notify managers (only if actor is not a manager)
    if (!caps.isManager) {
      void pushTelegramToManagers({
        branchId: user.branch_id,
        title: "إضافة عميل جديد (Mini App)",
        message: `أضاف <b>${user.full_name}</b> عميلاً جديداً:\n👤 ${full_name.trim()}\n📱 ${phone.trim()}\n📌 ${resolvedStatus}${requested_car ? `\n🚗 ${requested_car.trim()}` : ""}`,
      });
    }

    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (err) {
    console.error("[bot-app/add-customer]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
