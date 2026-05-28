import { NextRequest, NextResponse } from "next/server";

import { handleTelegramUpdate } from "@/lib/telegram/handlers";

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== secret) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const update = await req.json();
    await handleTelegramUpdate(update);
  } catch (err) {
    // Log server-side but always return 200 to prevent Telegram retries
    console.error("[telegram/webhook]", err);
  }

  return NextResponse.json({ ok: true });
}
