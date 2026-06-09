import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { sendMediaGroup, sendPhoto, sendVoice, escapeHtml, getAppUrl } from "./api";

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

// ─── أسماء الأحداث بالعربية ──────────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  customer_created:         "إنشاء ملف",
  customer_updated:         "تحديث البيانات",
  status_updated:           "تغيير الحالة",
  manual_reminder_created:  "إضافة تذكير",
  trade_in_saved:           "حفظ سيارة العميل",
  trade_in_archived:        "إيقاف سيارة العميل",
  sell_inventory_created:   "ربط مخزون",
  customer_reactivated:     "فتح دورة جديدة",
  customer_deleted:         "حذف الملف",
};

/** جلب آخر سجلات العميل وتنسيقها بشكل نظيف كشكل اقتباس */
export async function buildCustomerLogSection(customerId: string, limit = 5): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data: logs } = await admin
      .from("customer_logs")
      .select("action, details, actor_name, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!logs || logs.length === 0) return "";

    let section = `\n📜 <b>السجل التاريخي للملف:</b>\n<blockquote>`;
    for (const log of logs) {
      const label = ACTION_LABELS[log.action] ?? log.action;
      const ld = new Date(log.created_at);
      const date = `${String(ld.getUTCDate()).padStart(2,"0")}/${String(ld.getUTCMonth()+1).padStart(2,"0")}/${ld.getUTCFullYear()}`;
      section += `🔹 <b>${escapeHtml(label)}</b> · ${date} · ${escapeHtml(log.actor_name ?? "—")}\n`;
      if (log.details) {
        const details = escapeHtml(log.details).slice(0, 100);
        section += `   ↳ ${details}${log.details.length > 100 ? "…" : ""}\n`;
      }
    }
    section += `</blockquote>`;
    return section;
  } catch {
    return "";
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** جلب قائمة المديرين المستحقين لتلقي الإشعار */
async function getManagerRecipients(
  branchId: string | null,
): Promise<Array<{ chat_id: string; user_id: string; full_name: string; role: string }>> {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from("app_users")
    .select("id, full_name, role, branch_id, telegram_chat_id")
    .not("telegram_chat_id", "is", null)
    .eq("is_active", true);

  return (users ?? [])
    .filter((u) => {
      const caps = getRoleCapabilities(u.role, u.full_name);
      if (caps.isGeneralManager) return true;
      if (caps.isManager && !caps.isGeneralManager && branchId && u.branch_id === branchId) return true;
      return false;
    })
    .map((u) => ({
      chat_id: u.telegram_chat_id as string,
      user_id: u.id,
      full_name: u.full_name,
      role: u.role,
    }));
}

/** بناء أزرار inline لكل رسالة push مخصصة حسب نوع العملية */
function buildButtons(
  chatId: string,
  customerId: string | null,
  staffChatId?: string | null,
  opCode?: string,
): Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> {
  const appUrl = getAppUrl();
  const rows: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];

  if (customerId && appUrl) {
    let cardText = "📋 فتح بطاقة العميل";
    if (opCode === "sell_on_behalf") {
      cardText = "📋 بطاقة سيارة برسم البيع";
    } else if (opCode === "buyer_tradein_pending") {
      cardText = "📋 فتح تفاصيل الاستبدال";
    }
    rows.push([{
      text: cardText,
      web_app: { url: `${appUrl}/bot-app/customer?id=${customerId}&chat_id=${chatId}` },
    }]);
  }

  // زر السجل التاريخي الشفاف
  if (customerId) {
    rows.push([{ text: "📜 السجل التاريخي للملف", callback_data: `history:${customerId}` }]);
  }

  // زر إرسال رسالة للموظف — يظهر فقط إذا كان للموظف chat_id مربوط
  if (staffChatId && appUrl) {
    rows.push([{
      text: "💬 مراسلة الموظف المسجل",
      web_app: { url: `${appUrl}/bot-app/send-message?to_chat_id=${staffChatId}&chat_id=${chatId}&customer_id=${customerId ?? ""}` },
    }]);
  }

  rows.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);
  return rows;
}

/** إرسال رسالة مع أزرار inline */
async function sendWithButtons(
  chatId: string,
  text: string,
  customerId: string | null,
  staffChatId?: string | null,
  opCode?: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buildButtons(chatId, customerId, staffChatId, opCode) },
    }),
  });
}

// ─── بناء نصوص الرسائل ──────────────────────────────────────────────────────

function fmtD(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
}

function buildNewCustomerText(params: {
  opCode: string;
  customerName: string;
  customerPhone: string | null;
  staffName: string;
  branchName: string | null;
  status: string;
  requestedCar: string | null;
  tradeInModel: string | null;
  nextFollowUp: string | null;
}): string {
  const {
    opCode, customerName, customerPhone, staffName,
    branchName, status, requestedCar, tradeInModel, nextFollowUp,
  } = params;

  let icon = "🛒";
  let opTitle = "مشتري جديد";
  let carSectionTitle = "السيارة المطلوبة";
  if (opCode === "buyer_tradein_pending") {
    icon = "🔄";
    opTitle = "مشتري جديد + استبدال";
  } else if (opCode === "sell_on_behalf") {
    icon = "🏷️";
    opTitle = "سيارة برسم البيع — جديد";
    carSectionTitle = "السيارة المعروضة برسم البيع";
  }

  let text = `${icon} <b>${escapeHtml(opTitle)}</b>\n\n`;
  
  text += `👤 <b>بيانات العميل:</b>\n`;
  text += `<blockquote><b>الاسم:</b> ${escapeHtml(customerName)}\n`;
  if (customerPhone) {
    text += `<b>الهاتف:</b> <code>${escapeHtml(customerPhone)}</code>\n`;
  }
  if (branchName) {
    text += `<b>المعرض:</b> ${escapeHtml(branchName)}\n`;
  }
  text += `<b>الحالة:</b> ${escapeHtml(status)}</blockquote>\n\n`;

  // تفاصيل الطلب أو المعروض
  text += `🚗 <b>تفاصيل ${carSectionTitle}:</b>\n`;
  text += `<blockquote>`;
  if (opCode === "buyer_tradein_pending") {
    if (requestedCar)  text += `<b>السيارة المطلوبة:</b> ${escapeHtml(requestedCar)}\n`;
    if (tradeInModel)  text += `<b>سيارة الاستبدال:</b> ${escapeHtml(tradeInModel)}\n`;
  } else if (opCode === "sell_on_behalf") {
    if (tradeInModel)  text += `<b>موديل السيارة:</b> ${escapeHtml(tradeInModel)}\n`;
  } else {
    if (requestedCar)  text += `<b>السيارة المطلوبة:</b> ${escapeHtml(requestedCar)}\n`;
  }
  if (nextFollowUp) {
    try { text += `<b>تاريخ المتابعة:</b> ${fmtD(nextFollowUp)}\n`; } catch { /**/ }
  }
  text = text.trim() + `</blockquote>\n\n`;

  text += `👨‍💼 <b>الموظف المسؤول:</b> ${escapeHtml(staffName)}`;
  return text;
}

function buildUpdateCustomerText(params: {
  opCode: string;
  customerName: string;
  staffName: string;
  oldStatus: string;
  newStatus: string;
  nextFollowUp: string | null;
  note: string | null;
  requestedCar?: string | null;
  tradeInModel?: string | null;
}): string {
  const { opCode, customerName, staffName, oldStatus, newStatus, nextFollowUp, note, requestedCar, tradeInModel } = params;

  let icon = "🔄";
  let opTitle = "تحديث ملف العميل";
  let carSectionTitle = "السيارة المطلوبة";
  if (opCode === "buyer_tradein_pending") {
    icon = "🔁";
    opTitle = "تحديث ملف استبدال";
    carSectionTitle = "تفاصيل الاستبدال";
  } else if (opCode === "sell_on_behalf") {
    icon = "📝";
    opTitle = "تحديث سيارة برسم البيع";
    carSectionTitle = "السيارة المعروضة برسم البيع";
  }

  let text = `${icon} <b>${escapeHtml(opTitle)}</b>\n\n`;
  text += `👤 <b>العميل:</b> ${escapeHtml(customerName)}\n\n`;

  // قسم تفاصيل السيارة إن وجدت
  let carText = "";
  if (opCode === "buyer_tradein_pending") {
    if (requestedCar)  carText += `<b>السيارة المطلوبة:</b> ${escapeHtml(requestedCar)}\n`;
    if (tradeInModel)  carText += `<b>سيارة الاستبدال:</b> ${escapeHtml(tradeInModel)}\n`;
  } else if (opCode === "sell_on_behalf") {
    if (tradeInModel)  carText += `<b>موديل السيارة:</b> ${escapeHtml(tradeInModel)}\n`;
  } else {
    if (requestedCar)  carText += `<b>السيارة المطلوبة:</b> ${escapeHtml(requestedCar)}\n`;
  }
  if (carText) {
    text += `🚗 <b>تفاصيل ${carSectionTitle}:</b>\n`;
    text += `<blockquote>${carText.trim()}</blockquote>\n\n`;
  }

  text += `📌 <b>تحديثات الحالة والمتابعة:</b>\n`;
  text += `<blockquote>الحالة: ${escapeHtml(oldStatus)} ➜ <b>${escapeHtml(newStatus)}</b>\n`;
  if (nextFollowUp) {
    try { text += `<b>موعد المتابعة:</b> ${fmtD(nextFollowUp)}\n`; } catch { /**/ }
  }
  if (note) {
    text += `<b>الملاحظات المضافة:</b> ${escapeHtml(note)}\n`;
  }
  text = text.trim() + `</blockquote>\n\n`;

  text += `👨‍💼 <b>بواسطة الموظف:</b> ${escapeHtml(staffName)}`;
  return text;
}

// ─── الدوال المُصدَّرة ────────────────────────────────────────────────────────

/**
 * إشعار المديرين عند إضافة عميل جديد
 */
export async function pushNewCustomerToManagers(params: {
  branchId: string | null;
  customerId: string;
  opCode: string;
  customerName: string;
  customerPhone: string | null;
  staffName: string;
  staffUserId?: string | null;
  branchName?: string | null;
  status: string;
  requestedCar: string | null;
  tradeInModel: string | null;
  nextFollowUp: string | null;
}) {
  try {
    let branchNameResolved = params.branchName;
    if (!branchNameResolved && params.branchId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("branches").select("name")
        .eq("id", params.branchId).maybeSingle();
      branchNameResolved = data?.name ?? null;
    }

    const isMaalamBranch = branchNameResolved ? branchNameResolved.includes("المعلم") : false;
    let managers = await getManagerRecipients(params.branchId);

    // لتفادي التكرار لمدراء المعلم: إذا كان العميل استبدال فسيصلهم طلب تقييم، لذا لا نرسل لهم الإشعار العام
    if (isMaalamBranch && params.opCode === "buyer_tradein_pending") {
      managers = managers.filter(m => m.role === "general_manager");
    }

    const text = buildNewCustomerText({
      opCode: params.opCode,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      staffName: params.staffName,
      branchName: branchNameResolved ?? null,
      status: params.status,
      requestedCar: params.requestedCar,
      tradeInModel: params.tradeInModel,
      nextFollowUp: params.nextFollowUp,
    });
    // جلب chat_id الموظف المُدخِل لإضافة زر الرسالة
    let staffChatId: string | null = null;
    if (params.staffUserId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("app_users").select("telegram_chat_id")
        .eq("id", params.staffUserId).maybeSingle();
      staffChatId = (data?.telegram_chat_id as string | null) ?? null;
    }
    await Promise.allSettled(
      managers.map((m) => sendWithButtons(m.chat_id, text, params.customerId, staffChatId, params.opCode)),
    );
  } catch { /* best-effort */ }
}

/**
 * إشعار المديرين عند تحديث ملف عميل
 */
export async function pushCustomerUpdateToManagers(params: {
  branchId: string | null;
  customerId: string;
  opCode: string;
  customerName: string;
  staffName: string;
  staffUserId?: string | null;
  oldStatus: string;
  newStatus: string;
  nextFollowUp: string | null;
  note: string | null;
}) {
  try {
    const admin = createAdminClient();
    
    // جلب بيانات العميل والسيارات
    const { data: customer } = await admin
      .from("customers")
      .select("requested_car")
      .eq("id", params.customerId)
      .maybeSingle();

    let tradeInModel: string | null = null;
    if (params.opCode === "buyer_tradein_pending" || params.opCode === "sell_on_behalf") {
      const { data: tradeIn } = await admin
        .from("trade_ins")
        .select("model")
        .eq("customer_id", params.customerId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      tradeInModel = tradeIn?.model ?? null;
    }

    const managers = await getManagerRecipients(params.branchId);
    const text = buildUpdateCustomerText({
      opCode: params.opCode,
      customerName: params.customerName,
      staffName: params.staffName,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      nextFollowUp: params.nextFollowUp,
      note: params.note,
      requestedCar: customer?.requested_car ?? null,
      tradeInModel,
    });

    let staffChatId: string | null = null;
    if (params.staffUserId) {
      const { data } = await admin
        .from("app_users").select("telegram_chat_id")
        .eq("id", params.staffUserId).maybeSingle();
      staffChatId = (data?.telegram_chat_id as string | null) ?? null;
    }
    await Promise.allSettled(
      managers.map((m) => sendWithButtons(m.chat_id, text, params.customerId, staffChatId, params.opCode)),
    );
  } catch { /* best-effort */ }
}

/**
 * إشعار عام للمديرين (للحالات الأخرى)
 * @deprecated استخدم pushNewCustomerToManagers أو pushCustomerUpdateToManagers
 */
export async function pushTelegramToManagers({
  branchId,
  title,
  message,
  customerId = null,
}: {
  branchId: string | null;
  title: string;
  message: string;
  customerId?: string | null;
}) {
  try {
    const managers = await getManagerRecipients(branchId);
    
    // تخصيص عناوين البيع بالوكالة
    let resolvedTitle = title;
    let resolvedMessage = message;
    if (message.includes("sell_on_behalf") || message.includes("بيع بالوكالة")) {
      resolvedTitle = title.replace("استبدال", "سيارة برسم البيع").replace("تحديث ملف عميل", "تحديث سيارة برسم البيع");
    }

    const text = `🔔 <b>${escapeHtml(resolvedTitle)}</b>\n\n${resolvedMessage}`;
    await Promise.allSettled(
      managers.map((m) => sendWithButtons(m.chat_id, text, customerId)),
    );
  } catch { /* best-effort */ }
}

/**
 * إرسال رسالة تيليغرام مباشرة لموظف معين عبر user_id
 */
export async function pushTelegramToEmployee({
  userId,
  senderName,
  title,
  message,
  customerId = null,
}: {
  userId: string | null;
  senderName: string;
  title: string;
  message: string;
  customerId?: string | null;
}) {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    const { data: user } = await admin
      .from("app_users")
      .select("telegram_chat_id, full_name")
      .eq("id", userId)
      .eq("is_active", true)
      .maybeSingle();

    const chatId = user?.telegram_chat_id as string | null;
    if (!chatId) return;

    let text =
      `📋 <b>${escapeHtml(title)}</b>\n\n` +
      `${message}\n\n`;
    
    text += `<i>— أرسله: ${escapeHtml(senderName)}</i>`;

    await sendWithButtons(chatId, text, customerId);
  } catch { /* best-effort */ }
}

/**
 * إرسال تسجيل صوتي للمديرين
 */
export async function pushTelegramVoiceToManagers({
  branchId,
  caption,
  voiceUrl,
}: {
  branchId: string | null;
  caption: string;
  voiceUrl: string;
}) {
  if (!voiceUrl) return;
  try {
    const managers = await getManagerRecipients(branchId);
    await Promise.allSettled(
      managers.map((m) => sendVoice(m.chat_id, voiceUrl, caption)),
    );
  } catch { /* best-effort */ }
}

/**
 * إرسال صور السيارة للمديرين
 */
export async function pushTelegramPhotosToManagers({
  branchId,
  caption,
  photoUrls,
  customerId = null,
}: {
  branchId: string | null;
  caption: string;
  photoUrls: string[];
  customerId?: string | null;
}) {
  if (photoUrls.length === 0) return;
  try {
    const managers = await getManagerRecipients(branchId);
    await Promise.allSettled(
      managers.map(async (m) => {
        if (photoUrls.length === 1) {
          await sendPhoto(m.chat_id, photoUrls[0], caption);
        } else {
          for (let i = 0; i < photoUrls.length; i += 10) {
            const batch = photoUrls.slice(i, i + 10);
            await sendMediaGroup(m.chat_id, batch, i === 0 ? caption : undefined);
          }
        }
        // رسالة تفاصيل مع أزرار بعد الصور
        if (customerId) {
          await sendWithButtons(m.chat_id, `🖼 <b>صور مرفقة بالملف</b>\n\n${escapeHtml(caption)}`, customerId);
        }
      }),
    );
  } catch { /* best-effort */ }
}

// ─── إشعار طلب التقييم لمدير معرض المعلم ───────────────────────────────────

async function getMaalamManagerChatIds(): Promise<Array<{ chat_id: string; user_id: string; full_name: string }>> {
  const admin = createAdminClient();
  const { data: branches } = await admin
    .from("branches")
    .select("id, name")
    .ilike("name", "%المعلم%")
    .eq("is_active", true);

  if (!branches || branches.length === 0) return [];
  const branchIds = branches.map((b) => b.id);

  const { data: managers } = await admin
    .from("app_users")
    .select("id, full_name, role, telegram_chat_id")
    .in("branch_id", branchIds)
    .not("telegram_chat_id", "is", null)
    .eq("is_active", true);

  return (managers ?? [])
    .filter((u) => {
      const caps = getRoleCapabilities(u.role, u.full_name);
      return caps.isManager;
    })
    .map((u) => ({
      chat_id: u.telegram_chat_id as string,
      user_id: u.id,
      full_name: u.full_name,
    }));
}

/**
 * إرسال طلب تقييم سيارة لمدير معرض المعلم مع الصور والأزرار
 */
export async function pushEvaluationRequestToMaalamManager({
  tradeInId,
  customerId,
  customerName,
  customerPhone,
  submitterName,
  branchName,
  car,
  photoUrls = [],
  opCode,
}: {
  tradeInId: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  submitterUserId: string;
  submitterName: string;
  submitterChatId: string | null;
  branchName: string | null;
  car: {
    model: string;
    color?: string | null;
    production_year?: number | null;
    mileage?: number | null;
    chassis_no?: string | null;
    inspection?: string | null;
    specs?: string | null;
    notes?: string | null;
  };
  photoUrls?: string[];
  opCode?: string | null;
}) {
  try {
    const managers = await getMaalamManagerChatIds();
    if (managers.length === 0) return;

    const appUrl = getAppUrl();
    const isConsignment = opCode === "sell_on_behalf";
    const titleText = isConsignment ? "سيارة برسم البيع — جديد" : "طلب تقييم سيارة — استبدال";
    const emoji = isConsignment ? "🏷️" : "🔁";

    // ── النص الكامل ──────────────────────────────────────────────────────────
    let fullText =
      `${emoji} <b>${titleText}</b>\n\n` +
      `👤 <b>بيانات مقدم الطلب:</b>\n` +
      `<blockquote><b>صاحب السيارة:</b> ${escapeHtml(customerName)}\n` +
      (customerPhone ? `<b>الهاتف:</b> <code>${escapeHtml(customerPhone)}</code>\n` : "") +
      (branchName ? `<b>الفرع:</b> ${escapeHtml(branchName)}\n` : "") +
      `</blockquote>\n\n` +
      `🚗 <b>تفاصيل سيارة العميل:</b>\n` +
      `<blockquote><b>الموديل:</b> ${escapeHtml(car.model)}\n` +
      (car.color ? `<b>اللون:</b> ${escapeHtml(car.color)}\n` : "") +
      (car.production_year ? `<b>سنة الصنع:</b> ${car.production_year}\n` : "") +
      (car.mileage ? `<b>المسافة:</b> ${car.mileage.toLocaleString("en-US")} كم\n` : "") +
      (car.chassis_no ? `<b>رقم الشاصي:</b> <code>${escapeHtml(car.chassis_no)}</code>\n` : "") +
      (car.inspection ? `<b>الفحص:</b> ${escapeHtml(car.inspection)}\n` : "") +
      (car.specs ? `<b>المواصفات:</b> ${escapeHtml(car.specs)}\n` : "") +
      (car.notes ? `<b>ملاحظات:</b> ${escapeHtml(car.notes)}\n` : "") +
      `</blockquote>\n\n` +
      (isConsignment
        ? `<i>يُرجى الضغط على الزر أدناه لتحديد سعر السيارة للموظف 👇</i>\n\n`
        : `<i>يُرجى الضغط على الزر أدناه لإرسال قيمة التقييم للموظف 👇</i>\n\n`) +
      `👨‍💼 <b>المُدخِل:</b> ${escapeHtml(submitterName)}`;

    // ── caption مختصر للصور ───────────────────────────────────────────────────
    let photoCaption = isConsignment
      ? `🏷️ <b>برسم البيع — ${escapeHtml(car.model)}</b>\n👤 ${escapeHtml(customerName)}`
      : `🔁 <b>استبدال — ${escapeHtml(car.model)}</b>\n👤 ${escapeHtml(customerName)}`;
    if (customerPhone)       photoCaption += ` | 📱 ${escapeHtml(customerPhone)}`;
    if (car.color)           photoCaption += `\n🎨 ${escapeHtml(car.color)}`;
    if (car.production_year) photoCaption += ` | 📅 ${car.production_year}`;
    if (car.mileage)         photoCaption += ` | 🛣 ${car.mileage.toLocaleString("en-US")} كم`;
    if (car.chassis_no)      photoCaption += `\n🔢 ${escapeHtml(car.chassis_no)}`;
    if (submitterName)       photoCaption += `\n👨‍💼 ${escapeHtml(submitterName)}`;

    const callbackData = `er:${tradeInId}`;

    await Promise.allSettled(
      managers.map(async (m) => {
        const evalCardUrl = appUrl
          ? `${appUrl}/bot-app/eval-card?trade_id=${tradeInId}&customer_id=${customerId}&chat_id=${m.chat_id}`
          : null;
        const customerCardUrl = appUrl
          ? `${appUrl}/bot-app/customer?id=${customerId}&chat_id=${m.chat_id}`
          : null;

        const markup = {
          inline_keyboard: [
            [{ text: isConsignment ? "✍️ تحديد سعر السيارة للموظف" : "✍️ إرسال قيمة التقييم للموظف", callback_data: callbackData }],
            ...(evalCardUrl ? [[{ text: "📋 فتح البطاقة الكاملة مع الصور", web_app: { url: evalCardUrl } }]] : []),
            ...(customerCardUrl ? [[{ text: "👤 بطاقة العميل الكاملة", web_app: { url: customerCardUrl } }]] : []),
            [{ text: "📜 السجل التاريخي للملف", callback_data: `history:${customerId}` }],
            [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }],
          ],
        };

        // إرسال الصور أولاً إن وُجدت
        if (photoUrls.length === 1) {
          const r = await fetch(`https://api.telegram.org/bot${token()}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: m.chat_id, photo: photoUrls[0], caption: photoCaption, parse_mode: "HTML" }),
          });
          const rj = await r.json() as { ok: boolean };
          if (!rj.ok) {
            // فشل إرسال الصورة → نرسل النص فقط
            await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: m.chat_id, text: fullText, parse_mode: "HTML", reply_markup: markup }),
            });
            return;
          }
        } else if (photoUrls.length > 1) {
          const media = photoUrls.slice(0, 10).map((url, idx) => ({
            type: "photo", media: url,
            ...(idx === 0 ? { caption: photoCaption + `\n📷 ${photoUrls.length} صور`, parse_mode: "HTML" } : {}),
          }));
          await fetch(`https://api.telegram.org/bot${token()}/sendMediaGroup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: m.chat_id, media }),
          });
        }

        // رسالة التفاصيل الكاملة + الأزرار (دائماً)
        await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: m.chat_id, text: fullText, parse_mode: "HTML", reply_markup: markup }),
        });
      }),
    );
  } catch { /* best-effort */ }
}
