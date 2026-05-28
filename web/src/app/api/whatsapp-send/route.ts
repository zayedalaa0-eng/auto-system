import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTextMessage } from "@/lib/whatsapp/api";

/**
 * POST /api/whatsapp-send
 * Body: { customer_id: string, message: string }
 *
 * يجلب رقم العميل ورقم هاتف المعرض من قاعدة البيانات
 * ويرسل الرسالة عبر WhatsApp Cloud API
 */
export async function POST(req: NextRequest) {
  try {
    // ── التحقق من الجلسة ──────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { customer_id, message } = body as { customer_id?: string; message?: string };

    if (!customer_id || !message?.trim()) {
      return NextResponse.json({ error: "customer_id والرسالة مطلوبان" }, { status: 400 });
    }

    // ── جلب بيانات العميل + المعرض ───────────────────────────────────
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("full_name, phone, whatsapp_prefix, branch_id")
      .eq("id", customer_id)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }

    if (!customer.phone) {
      return NextResponse.json({ error: "لا يوجد رقم هاتف للعميل" }, { status: 422 });
    }

    // ── جلب Phone Number ID للمعرض ───────────────────────────────────
    const { data: branch, error: branchErr } = await supabase
      .from("branches")
      .select("name, whatsapp_phone_number_id")
      .eq("id", customer.branch_id)
      .maybeSingle();

    if (branchErr || !branch?.whatsapp_phone_number_id) {
      return NextResponse.json(
        { error: "المعرض لا يملك رقم واتساب بيزنس مفعّل" },
        { status: 422 }
      );
    }

    // ── بناء رقم العميل بصيغة دولية ──────────────────────────────────
    const prefix = (customer.whatsapp_prefix ?? "+966").replace(/\D/g, "");
    const phone  = customer.phone.replace(/\D/g, "");
    const to     = `${prefix}${phone}`;

    // ── الإرسال ───────────────────────────────────────────────────────
    const result = await sendTextMessage({
      phoneNumberId: branch.whatsapp_phone_number_id,
      to,
      text: message.trim(),
    });

    // ── تسجيل في سجل العميل ──────────────────────────────────────────
    await supabase.from("customer_logs").insert({
      customer_id,
      action: "whatsapp_sent",
      notes: `📱 رسالة واتساب أُرسلت من ${branch.name}: "${message.trim().slice(0, 100)}"`,
      performed_by: session.user.id,
    });

    return NextResponse.json({ success: true, message_id: result.messages?.[0]?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    console.error("[whatsapp-send]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
