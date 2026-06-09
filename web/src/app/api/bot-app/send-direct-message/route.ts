import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { from_chat_id, to_chat_id, message, customer_id } = await req.json();
  if (!from_chat_id || !to_chat_id || !message?.trim()) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const admin = createAdminClient();

  // تحقق من المرسِل
  const { data: sender } = await admin
    .from("app_users")
    .select("id, full_name, branch_id")
    .eq("telegram_chat_id", String(from_chat_id))
    .eq("is_active", true)
    .maybeSingle();
  if (!sender) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  // تحقق من المستقبِل
  const { data: recipient } = await admin
    .from("app_users")
    .select("id, full_name, telegram_chat_id")
    .eq("telegram_chat_id", String(to_chat_id))
    .eq("is_active", true)
    .maybeSingle();
  if (!recipient) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const text =
    `💬 <b>رسالة من ${sender.full_name}:</b>\n` +
    `<blockquote>${message.trim()}</blockquote>\n\n` +
    `<i>يمكنك الرد مباشرة بالضغط على الأزرار الشفافة أدناه 👇</i>`;

  const rows: Array<Array<{ text: string; web_app?: { url: string }; callback_data?: string }>> = [];
  if (customer_id && appUrl) {
    rows.push([{
      text: "📋 فتح بطاقة العميل",
      web_app: { url: `${appUrl}/bot-app/customer?id=${customer_id}&chat_id=${to_chat_id}` },
    }]);
    // زر الرد على المرسِل
    rows.push([{
      text: "💬 الرد على " + sender.full_name,
      web_app: { url: `${appUrl}/bot-app/send-message?to_chat_id=${from_chat_id}&chat_id=${to_chat_id}&customer_id=${customer_id}` },
    }]);
  }
  rows.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: to_chat_id,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: rows },
      }),
    },
  );

  if (!res.ok) return NextResponse.json({ error: "فشل الإرسال" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
