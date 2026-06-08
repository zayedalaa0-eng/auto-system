import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chat_id");
  if (!chatId) return NextResponse.json({ name: null });
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_users").select("full_name")
    .eq("telegram_chat_id", chatId).eq("is_active", true).maybeSingle();
  return NextResponse.json({ name: data?.full_name ?? null });
}
