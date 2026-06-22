import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBotUser } from "@/lib/telegram/queries";
import { handleToday } from "@/lib/telegram/handlers";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: users, error } = await admin.from("bot_users").select("*").eq("is_active", true);

    if (error) throw error;
    if (!users || users.length === 0) return NextResponse.json({ message: "No active users found." });

    let sentCount = 0;

    for (const u of users) {
      if (!u.telegram_id) continue;
      
      const botUser = await getBotUser(u.telegram_id);
      if (!botUser) continue;

      try {
        await handleToday(Number(u.telegram_id), botUser);
        sentCount++;
      } catch (e) {
        console.error("Failed to send morning briefing to", u.telegram_id, e);
      }
    }

    return NextResponse.json({ success: true, sentCount });
  } catch (error) {
    console.error("Cron Morning Briefing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
