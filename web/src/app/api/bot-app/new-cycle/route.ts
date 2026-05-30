import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { pushTelegramToManagers } from "@/lib/telegram/push";
import { escapeHtml } from "@/lib/telegram/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chat_id, customer_id, operation_type } = body;

    if (!chat_id || !customer_id) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const admin = createAdminClient();

    // التحقق من المستخدم
    const { data: user } = await admin
      .from("app_users")
      .select("id, full_name, role, branch_id")
      .eq("telegram_chat_id", String(chat_id))
      .eq("is_active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const caps = getRoleCapabilities(user.role, user.full_name);
    if (!caps.isManager) {
      return NextResponse.json({ error: "فتح دورة جديدة يتطلب صلاحية مدير" }, { status: 403 });
    }

    // جلب بيانات العميل الأصلي
    const { data: parent } = await admin
      .from("customers")
      .select("id, full_name, phone, branch_id, assigned_user_id, cycle_number")
      .eq("id", customer_id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });

    // المدير يمكنه فتح دورة فقط لعملاء معرضه (المدير العام مستثنى)
    if (user.role !== "general_manager" && parent.branch_id !== user.branch_id) {
      return NextResponse.json({ error: "غير مصرح — هذا العميل ينتمي لمعرض آخر" }, { status: 403 });
    }

    const opCode = (operation_type as string) || "buyer";
    const opLabel =
      opCode === "buyer" ? "مشتري" :
      opCode === "buyer_tradein_pending" ? "مشتري + استبدال" :
      "بيع بالوكالة";

    const defaultStatus =
      opCode === "sell_on_behalf" ? "عرض سيارة للبيع" :
      opCode === "buyer_tradein_pending" ? "استبدال — تحت التقييم" :
      "جديد";

    const newCycleNum = ((parent.cycle_number as number | null) ?? 1) + 1;

    // إدراج العميل الجديد
    const { data: inserted, error } = await admin
      .from("customers")
      .insert({
        full_name: parent.full_name,
        phone: parent.phone,
        branch_id: parent.branch_id,
        assigned_user_id: parent.assigned_user_id,
        operation_type: opLabel,
        status: defaultStatus,
        is_active: true,
        parent_customer_id: customer_id,
        cycle_number: newCycleNum,
        metadata: {
          operation_type_code: opCode,
          operation_type: opLabel,
          source: "mini_app_new_cycle",
          parent_customer_id: customer_id,
        },
      })
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // سجل النشاط
    await admin.from("customer_logs").insert({
      customer_id: inserted?.id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action: "customer_reactivated",
      details: `فتح دورة جديدة #${newCycleNum} — ${opLabel} — بواسطة ${user.full_name} (Mini App)`,
    });

    // إشعار المديرين
    void pushTelegramToManagers({
      branchId: user.branch_id,
      customerId: inserted?.id ?? null,
      title: "فتح دورة جديدة",
      message: `🔄 <b>${escapeHtml(user.full_name)}</b> فتح دورة متابعة جديدة للعميل:\n👤 <b>${escapeHtml(parent.full_name)}</b>\n🔖 ${escapeHtml(opLabel)}`,
    });

    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (err) {
    console.error("[new-cycle]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
