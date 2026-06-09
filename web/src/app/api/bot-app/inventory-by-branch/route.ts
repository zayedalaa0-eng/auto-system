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

    const [{ data: inv }, { data: branchRows }] = await Promise.all([
      admin
        .from("inventory")
        .select("id, model, chassis_no, price, color, production_year, availability_status, deal_type, owner_name, condition_label")
        .eq("branch_id", branchId)
        .not("availability_status", "in", '("مباعة","محجوزة","مسحوبة من المعرض")')
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(50),
      admin.from("branches").select("name").eq("is_active", true),
    ]);

    const branchNames = new Set((branchRows ?? []).map(b => (b.name ?? "").trim().toLowerCase()));
    // التصنيف حسب المالك: شخص → عميل، معرض/فارغ → معرض
    const isCustomerCar = (ownerName: string | null) => {
      const owner = (ownerName ?? "").trim().toLowerCase();
      return Boolean(owner) && !branchNames.has(owner);
    };

    return NextResponse.json({
      ok: true,
      inventory: (inv ?? []).map(i => ({
        id: i.id,
        // التسمية المختصرة: النوع — السنة — الحالة — اللون (بدون شاصي)
        label: [i.model, i.production_year ? String(i.production_year) : null, i.condition_label, i.color]
          .filter(Boolean).join(" — "),
        model: i.model ?? "",
        chassis_no: i.chassis_no ?? null,
        availability_status: i.availability_status ?? "",
        category: isCustomerCar(i.owner_name) ? "customer" : "showroom",
      })),
    });
  } catch (err) {
    console.error("[inventory-by-branch]", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
