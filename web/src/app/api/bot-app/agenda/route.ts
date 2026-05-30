import { type NextRequest, NextResponse } from "next/server";
import { getBotUser, getAgendaData } from "@/lib/telegram/queries";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chat_id");
  if (!chatId) return NextResponse.json({ error: "chat_id مطلوب" }, { status: 400 });

  const user = await getBotUser(chatId);
  if (!user) return NextResponse.json({ error: "غير مصرح — تأكد من ربط حسابك بالنظام" }, { status: 401 });

  try {
    const agenda = await getAgendaData(user);
    return NextResponse.json(agenda);
  } catch (err) {
    console.error("[agenda API] error:", err);
    return NextResponse.json({ error: "خطأ في جلب البيانات" }, { status: 500 });
  }
}
