import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { STATUS_BY_TYPE } from "@/lib/statuses";

function isUnavailable(status: string | null) {
  const s = (status ?? "").toLowerCase();
  return s.includes("مباع") || s.includes("محجوز") || s.includes("مسحوب");
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chat_id");
  if (!chatId) return NextResponse.json({ error: "chat_id مطلوب" }, { status: 400 });

  const admin = createAdminClient();

  const { data: user } = await admin
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("telegram_chat_id", chatId)
    .eq("is_active", true)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const caps = getRoleCapabilities(user.role, user.full_name);

  // Inventory scoped to branch
  let inventoryQuery = admin
    .from("inventory")
    .select("id, model, production_year, chassis_no, color, availability_status, price, deal_type, owner_name")
    .eq("is_active", true)
    .order("model");

  if (!caps.isGeneralManager && user.branch_id) {
    inventoryQuery = inventoryQuery.eq("branch_id", user.branch_id) as typeof inventoryQuery;
  }

  // Staff scoped to branch (for assigned_user_id)
  let staffQuery = admin
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("is_active", true)
    .order("full_name");

  if (!caps.isGeneralManager && user.branch_id) {
    staffQuery = staffQuery.eq("branch_id", user.branch_id) as typeof staffQuery;
  }

  // نجلب كل المعارض دائماً (للتصنيف) — والمدير العام يستخدمها أيضاً في الواجهة
  const branchesQuery = admin.from("branches").select("id, name").eq("is_active", true).order("name");
  const [{ data: inventory }, { data: staff }, { data: branches }] = await Promise.all([
    inventoryQuery,
    staffQuery,
    branchesQuery,
  ]);

  // أسماء المعارض (لتمييز سيارات المعرض عن سيارات العملاء)
  const branchNames = new Set((branches ?? []).map((b) => (b.name ?? "").trim().toLowerCase()));

  // التصنيف حسب المالك:
  // • مالك شخص (غير فارغ وليس اسم معرض) → سيارة عميل
  // • مالك معرض أو فارغ → سيارة معرض
  const isCustomerCar = (_dealType: string | null, ownerName: string | null) => {
    const owner = (ownerName ?? "").trim().toLowerCase();
    return Boolean(owner) && !branchNames.has(owner);
  };

  const inventoryOptions = (inventory ?? [])
    .filter((item) => !isUnavailable(item.availability_status))
    .map((item) => ({
      id: item.id,
      label: [
        item.model,
        item.production_year ? `موديل:${item.production_year}` : null,
        item.chassis_no ? `شاصي:${item.chassis_no}` : null,
        item.color ?? null,
        item.price ? `${Number(item.price).toLocaleString("en-US")} ₪` : null,
      ]
        .filter(Boolean)
        .join(" — "),
      model: item.model,
      // تصنيف: سيارات المعرض أو سيارات العملاء
      category: isCustomerCar(item.deal_type, item.owner_name) ? "customer" : "showroom",
    }));

  return NextResponse.json({
    statusesByType: STATUS_BY_TYPE,
    inventoryOptions,
    staff: (staff ?? []).map((s) => ({ id: s.id, full_name: s.full_name })),
    branches: (branches ?? []).map((b) => ({ id: b.id, name: b.name })),
    currentUserId: user.id,
    isManager: caps.isManager,
    isGeneralManager: caps.isGeneralManager,
  });
}
