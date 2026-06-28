import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { sendMessage, sendPhoto } from "@/lib/telegram/api";

/**
 * GET  /api/reports/daily-evening  ← Vercel Cron يُرسل GET (مجدول الساعة 16:00 UTC أي 7:00 م بتوقيت الرياض)
 * POST /api/reports/daily-evening  ← للاختبار اليدوي
 */
export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}

async function handler(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[daily-evening] CRON_SECRET غير مضبوط — الوصول محظور");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date();

    // نطاق اليوم بتوقيت الرياض (UTC+3)
    const riyadhOffset = 3 * 60 * 60 * 1000;
    const riyadhNow = new Date(now.getTime() + riyadhOffset);
    
    // عدم الإرسال يوم الجمعة (5)
    const isFriday = riyadhNow.getUTCDay() === 5;
    if (isFriday) {
      return NextResponse.json({ sent: 0, skipped: "friday" });
    }

    const [{ data: users }, { data: branches }] = await Promise.all([
      admin
        .from("app_users")
        .select("id, full_name, role, branch_id, telegram_chat_id, is_active")
        .eq("is_active", true)
        .not("telegram_chat_id", "is", null),
      admin.from("branches").select("id, name").eq("is_active", true),
    ]);

    const branchNames = new Map<string, string>(
      (branches ?? []).map((b) => [b.id, b.name]),
    );

    let sentCount = 0;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

    for (const u of (users ?? [])) {
      const caps = getRoleCapabilities(u.role, u.full_name);
      const branchName = u.branch_id ? (branchNames.get(u.branch_id) ?? "المعرض") : "المعرض";
      
      let managerName = "إدارة المعرض";
      let logoFile = "lemalem.jpg";

      if (branchName.includes("لمعلم")) {
        managerName = "ناجي الأشهب \"أبو قصي\"";
        logoFile = "lemalem.jpg";
      } else if (branchName.includes("فورثنج")) {
        managerName = "راجي الأشهب \"أبو رامي\"";
        logoFile = "forthing.jpg";
      } else if (branchName.includes("شيري")) {
        managerName = "رجائي الأشهب \"أبو رضا\"";
        logoFile = "chery.jpg";
      }

      const isManagerOrGeneralManager = caps.isManager || caps.isGeneralManager;

      let title = "أهلاً";
      if (isManagerOrGeneralManager) {
         if (u.full_name?.includes("علاء")) title = "أهلاً بالسيد";
         else if (u.full_name?.includes("فخرية")) title = "أهلاً بالسيدة";
         else if (u.full_name?.includes("منال")) title = "أهلاً بالسيدة";
         else title = "أهلاً";
      }

      let msg = "";
      msg += `🌙 <b>مساء الخير</b>\n\n`;
      msg += `${title} <b>${u.full_name}</b>،\n`;
      msg += `نتمنى لك مساءً جميلاً ووقتاً ممتعاً بعد يوم عمل حافل بالإنجازات. ☕✨\n\n`;

      if (isManagerOrGeneralManager) {
        msg += `— <b>مجلس الإدارة</b>\n`;
      } else {
        msg += `— <b>${managerName}</b>\n`;
        msg += `🏢 ${branchName}\n`;
      }

      const photoUrl = appUrl ? `${appUrl}/logos/${logoFile}` : null;
      try {
        if (photoUrl) {
          await sendPhoto(u.telegram_chat_id as string, photoUrl, msg);
        } else {
          await sendMessage(u.telegram_chat_id as string, msg);
        }
        sentCount++;
      } catch (err) {
        console.error("Failed to send evening message to", u.full_name, err);
      }
    }

    return NextResponse.json({ sent: sentCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
