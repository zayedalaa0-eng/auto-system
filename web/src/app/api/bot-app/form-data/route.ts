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
    .select("id, model, production_year, chassis_no, color, availability_status, price")
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

  let branchesQuery = admin.from("branches").select("id, name").eq("is_active", true).order("name");
  const [{ data: inventory }, { data: staff }, { data: branches }] = await Promise.all([
    inventoryQuery,
    staffQuery,
    caps.isGeneralManager ? branchesQuery : Promise.resolve({ data: [] }),
  ]);

  const inventoryOptions = (inventory ?? [])
    .filter((item) => !isUnavailable(item.availability_status))
    .map((item) => ({
      id: item.id,
      label: [
        item.model,
        item.production_year ? `موديل:${item.production_year}` : null,
        item.chassis_no ? `شاصي:${item.chassis_no}` : null,
        item.color ?? null,
        item.price ? `${Number(item.price).toLocaleString("ar-EG")} ₪` : null,
      ]
        .filter(Boolean)
        .join(" — "),
      model: item.model,
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
