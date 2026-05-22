import { NextRequest, NextResponse } from "next/server";

// Register the Telegram webhook. Call once after deployment:
// GET /api/telegram/setup?key=YOUR_SETUP_KEY
export async function GET(req: NextRequest) {
  const setupKey = process.env.TELEGRAM_SETUP_KEY;
  if (setupKey) {
    const provided = new URL(req.url).searchParams.get("key");
    if (provided !== setupKey) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 500 });
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""
  ).replace(/\/+$/, "");

  if (!appUrl) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_APP_URL to your deployed URL (e.g. https://your-app.vercel.app)" },
      { status: 500 },
    );
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      ...(secret ? { secret_token: secret } : {}),
    }),
  });

  const result = await res.json();
  return NextResponse.json({ webhook_url: webhookUrl, telegram_response: result });
}
