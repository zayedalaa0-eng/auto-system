import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { chat_id, reminder_id } = await req.json();
  if (!chat_id || !reminder_id) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const admin = createAdminClient();
  const { data: user } = await admin
    .from("app_users").select("id").eq("telegram_chat_id", String(chat_id)).eq("is_active", true).maybeSingle();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { error } = await admin.from("reminders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reminder_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
