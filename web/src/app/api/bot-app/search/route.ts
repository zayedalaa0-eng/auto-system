import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";

/**
 * GET /api/bot-app/search
 * بحث عن العملاء حسب الاسم أو رقم الهاتف أو اللقب
 * النطاق: الموظف العادي يرى فرعه فقط، المدير يرى كل الفروع
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const chatId = searchParams.get("chat_id");
  const q      = (searchParams.get("q") ?? "").trim();
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit  = 20;
  const offset = (page - 1) * limit;

  if (!chatId) return NextResponse.json({ error: "chat_id مطلوب" }, { status: 400 });
  if (q.length < 2)  return NextResponse.json({ error: "أدخل حرفين على الأقل" }, { status: 400 });

  const admin = createAdminClient();

  // التحقق من المستخدم
  const { data: user } = await admin
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("telegram_chat_id", chatId)
    .eq("is_active", true)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const caps = getRoleCapabilities(user.role, user.full_name);

  // بناء الاستعلام
  let query = admin
    .from("customers")
    .select("id, full_name, nickname, phone, status, next_follow_up_at, is_active, branch_id, assigned_user_id, operation_type")
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,nickname.ilike.%${q}%`)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // تصفية حسب الفرع للموظف العادي
  const isGlobal = caps.isGeneralManager && !user.branch_id;
  if (!isGlobal) {
    if (user.branch_id) {
      query = query.eq("branch_id", user.branch_id);
    } else if (!caps.isManager) {
      // الموظف العادي: عملاء فرعه فقط، إذا لم يكن له فرع نربطه بـ assigned_user_id
      query = query.eq("assigned_user_id", user.id);
    }
  }

  const { data: customers, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    customers: customers ?? [],
    page,
    hasMore: (customers ?? []).length === limit,
    viewer: { id: user.id, role: user.role, isManager: caps.isManager, isGeneralManager: caps.isGeneralManager },
  });
}
