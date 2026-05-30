import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId   = searchParams.get("chat_id");
    const branchId = searchParams.get("branch_id");

    if (!chatId || !branchId) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const admin = createAdminClient();

    // التحقق من الصلاحية
    const { data: user } = await admin
      .from("app_users")
      .select("id, role")
      .eq("telegram_chat_id", chatId)
      .eq("is_active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { data: inv } = await admin
      .from("inventory")
      .select("id, model, chassis_no, price, color, production_year, availability_status")
      .eq("branch_id", branchId)
      .not("availability_status", "in", '("مباعة","محجوزة","مسحوبة من المعرض")')
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      ok: true,
      inventory: (inv ?? []).map(i => ({
        id: i.id,
        label: `${i.model ?? ""}${i.chassis_no ? ` — شاصي: ${i.chassis_no}` : ""}${i.color ? ` — ${i.color}` : ""}${i.price ? ` — ${i.price.toLocaleString()} ₪` : ""}`,
        model: i.model ?? "",
        chassis_no: i.chassis_no ?? null,
        availability_status: i.availability_status ?? "",
      })),
    });
  } catch (err) {
    console.error("[inventory-by-branch]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
