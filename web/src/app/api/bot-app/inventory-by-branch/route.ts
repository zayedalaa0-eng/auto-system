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
      .select("id, role, branch_id")
      .eq("telegram_chat_id", chatId)
      .eq("is_active", true)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const [{ data: inv }, { data: branchRows }] = await Promise.all([
      admin
        .from("inventory")
        .select("id, model, chassis_no, price, color, production_year, availability_status, deal_type, owner_name, condition_label, branch_id")
        .eq("branch_id", branchId)
        .not("availability_status", "in", '("مباعة","محجوزة","مسحوبة من المعرض")')
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(200), // increased limit since we will filter in memory
      admin.from("branches").select("id, name").eq("is_active", true),
    ]);

    const branchNames = new Set((branchRows ?? []).map(b => (b.name ?? "").trim().toLowerCase()));
    
    // Check user branch name
    const userBranchRow = (branchRows ?? []).find(b => b.id === user.branch_id);
    const isMuallimBranch = (userBranchRow?.name ?? "").includes("المعلم");
    
    // التصنيف حسب المالك: شخص → عميل، معرض/فارغ → معرض
    const isCustomerCar = (ownerName: string | null) => {
      const owner = (ownerName ?? "").trim().toLowerCase();
      return Boolean(owner) && !branchNames.has(owner);
    };

    // فلترة النتائج حسب الصلاحيات
    let filteredInv = inv ?? [];
    const isOtherBranch = user.branch_id !== branchId;
    
    if (isOtherBranch) {
      if (isMuallimBranch) {
        filteredInv = filteredInv.filter((it) => {
          const deal = (it.deal_type ?? "").trim();
          const cond = (it.condition_label ?? "").trim();
          const isCustomer = isCustomerCar(it.owner_name);
          return deal === "برسم البيع" || deal === "بيع بالوكالة" || cond === "مستعمل" || isCustomer;
        });
      } else {
        // الموظف العادي لا يرى مخزون الفروع الأخرى في المني-آب
        filteredInv = [];
      }
    }

    return NextResponse.json({
      ok: true,
      inventory: filteredInv.map(i => ({
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
