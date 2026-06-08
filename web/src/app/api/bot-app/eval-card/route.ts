import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const chatId    = searchParams.get("chat_id");
  const tradeId   = searchParams.get("trade_id");
  const customerId = searchParams.get("customer_id");

  if (!chatId) return NextResponse.json({ error: "chat_id مطلوب" }, { status: 400 });
  if (!tradeId && !customerId) return NextResponse.json({ error: "trade_id أو customer_id مطلوب" }, { status: 400 });

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
  if (!caps.isManager) return NextResponse.json({ error: "هذه الصفحة للمديرين فقط" }, { status: 403 });

  // جلب بيانات trade-in
  const tradeQuery = tradeId
    ? admin.from("trade_ins").select("id, model, color, production_year, mileage, chassis_no, inspection, specs, notes, status, price, customer_id").eq("id", tradeId).maybeSingle()
    : admin.from("trade_ins").select("id, model, color, production_year, mileage, chassis_no, inspection, specs, notes, status, price, customer_id").eq("customer_id", customerId!).is("price", null).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: trade } = await tradeQuery;
  if (!trade) return NextResponse.json({ error: "لم يُعثر على طلب التقييم" }, { status: 404 });

  // جلب بيانات العميل
  const { data: customer } = await admin
    .from("customers")
    .select("id, full_name, phone, branch_id, assigned_user_id, branches(name), app_users(id, full_name, telegram_chat_id)")
    .eq("id", trade.customer_id)
    .maybeSingle();

  // جلب الصور مع signed URLs
  const { data: attachments } = await admin
    .from("customer_attachments")
    .select("id, file_name, public_url, storage_path, mime_type, file_category, created_at")
    .eq("customer_id", trade.customer_id)
    .in("file_category", ["trade_photo", "trade_files_photos", "trade_inspection", "trade_license", "trade_insurance"])
    .order("created_at", { ascending: true })
    .limit(20);

  const photos: Array<{ url: string; category: string | null }> = [];
  for (const att of attachments ?? []) {
    let url = att.public_url as string | null;
    if (!url && att.storage_path) {
      const path = (att.storage_path as string).replace(/^customer-attachments\//, "");
      const { data: signed } = await admin.storage.from("customer-attachments").createSignedUrl(path, 3600);
      url = signed?.signedUrl ?? null;
    }
    if (url) photos.push({ url, category: att.file_category as string | null });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custAny = customer as any;
  const branchName = Array.isArray(custAny?.branches) ? custAny.branches[0]?.name : custAny?.branches?.name ?? null;
  const staffArr = Array.isArray(custAny?.app_users) ? custAny.app_users : (custAny?.app_users ? [custAny.app_users] : []);
  const staff = staffArr[0] ?? null;

  return NextResponse.json({
    trade,
    customer: customer ? {
      id: customer.id,
      full_name: customer.full_name,
      phone: customer.phone,
      branch_name: branchName,
      staff_name: staff?.full_name ?? null,
      staff_user_id: staff?.id ?? null,
      staff_chat_id: staff?.telegram_chat_id ?? null,
    } : null,
    photos,
    viewer: { id: user.id, full_name: user.full_name },
  });
}

export async function POST(req: NextRequest) {
  // إرسال قيمة التقييم من المني-آب
  const body = await req.json();
  const { chat_id, trade_id, customer_id, price } = body as {
    chat_id: string; trade_id: string; customer_id: string; price: number;
  };

  if (!chat_id || !trade_id || !price || price <= 0) {
    return NextResponse.json({ error: "بيانات ناقصة أو غير صحيحة" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: user } = await admin
    .from("app_users")
    .select("id, full_name, role")
    .eq("telegram_chat_id", chat_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  // تحديث سعر التقييم
  const { error } = await admin
    .from("trade_ins")
    .update({ price, status: "تم التقييم" })
    .eq("id", trade_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // جلب بيانات العميل للإشعار
  const { data: custRow } = await admin
    .from("customers")
    .select("full_name, assigned_user_id, app_users(telegram_chat_id, full_name)")
    .eq("id", customer_id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custAny = custRow as any;
  const staffChatId = Array.isArray(custAny?.app_users)
    ? custAny.app_users[0]?.telegram_chat_id
    : custAny?.app_users?.telegram_chat_id ?? null;

  // إشعار Telegram للموظف المُدخِل
  if (staffChatId) {
    const priceFormatted = price.toLocaleString("en-US");
    const SEP = "━━━━━━━━━━━━━━━━━━━━";
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

    const inlineButtons: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];
    if (customer_id && appUrl) {
      inlineButtons.push([{
        text: "📋 فتح بطاقة العميل",
        web_app: { url: `${appUrl}/bot-app/customer?id=${customer_id}&chat_id=${staffChatId}` },
      }]);
    }
    inlineButtons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: staffChatId,
        text:
          `💰 <b>تم تقييم السيارة</b>\n${SEP}\n\n` +
          `👤 <b>العميل:</b> ${custRow?.full_name ?? "—"}\n` +
          `✅ <b>قيمة التقييم:</b> ${priceFormatted} ₪\n` +
          `👨‍💼 <b>المُقيِّم:</b> ${user.full_name}\n\n` +
          `${SEP}\n<i>تمّ تحديث الملف — اضغط لفتح بطاقة العميل 👇</i>`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineButtons },
      }),
    });
  }

  // إشعار قاعدة البيانات
  if (custRow?.assigned_user_id) {
    await admin.from("notifications").insert({
      recipient_user_id: custRow.assigned_user_id,
      title: "تم تقييم السيارة",
      message: `سيارة العميل ${custRow.full_name ?? ""} قُيِّمت بـ ${price.toLocaleString("en-US")} شيقل — بواسطة ${user.full_name}`,
      notification_type: "evaluation",
      status: "unread",
      created_by_user_id: user.id,
    });
  }

  return NextResponse.json({ success: true });
}
