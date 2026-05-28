import { NextRequest, NextResponse } from "next/server";

import { handleTelegramUpdate } from "@/lib/telegram/handlers";

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secret) {
    // في بيئة الإنتاج يجب ضبط TELEGRAM_WEBHOOK_SECRET — نرفض الطلب تلقائياً
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.warn("[telegram/webhook] ⚠️ TELEGRAM_WEBHOOK_SECRET غير مضبوط — مقبول فقط في بيئة التطوير");
  } else {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== secret) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const update = await req.json();
    await handleTelegramUpdate(update);
  } catch (err) {
    // نُسجّل الخطأ جهة الخادم ونُعيد 200 لمنع Telegram من إعادة المحاولة
    console.error("[telegram/webhook]", err);
  }

  return NextResponse.json({ ok: true });
}
