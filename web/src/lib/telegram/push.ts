import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { sendMediaGroup, sendPhoto, sendVoice, escapeHtml, getAppUrl } from "./api";

const SEP = "━━━━━━━━━━━━━━━━━━━━";
const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

// ─── helpers ────────────────────────────────────────────────────────────────

/** جلب قائمة المديرين المستحقين لتلقي الإشعار */
async function getManagerRecipients(
  branchId: string | null,
): Promise<Array<{ chat_id: string; user_id: string; full_name: string }>> {
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
    }));
}

/** بناء أزرار inline لكل رسالة push */
function buildButtons(
  chatId: string,
  customerId: string | null,
): Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> {
  const appUrl = getAppUrl();
  const rows: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];

  if (customerId && appUrl) {
    rows.push([{
      text: "📋 فتح بطاقة العميل",
      web_app: { url: `${appUrl}/bot-app/customer?id=${customerId}&chat_id=${chatId}` },
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
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buildButtons(chatId, customerId) },
    }),
  });
}

// ─── بناء نصوص الرسائل ──────────────────────────────────────────────────────

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
  if (opCode === "buyer_tradein_pending") { icon = "🔄"; opTitle = "مشتري جديد — مع استبدال"; }
  else if (opCode === "sell_on_behalf")   { icon = "🤝"; opTitle = "ملف بيع بالوكالة جديد"; }

  let text =
    `${icon} <b>${opTitle}</b>\n${SEP}\n\n` +
    `👤 <b>الاسم:</b> ${escapeHtml(customerName)}\n`;

  if (customerPhone) text += `📱 <b>الهاتف:</b> ${escapeHtml(customerPhone)}\n`;
  if (branchName)    text += `🏢 <b>الفرع:</b> ${escapeHtml(branchName)}\n`;

  text += `\n${SEP}\n`;

  if (opCode === "buyer_tradein_pending") {
    if (requestedCar)  text += `🚗 <b>السيارة المطلوبة:</b> ${escapeHtml(requestedCar)}\n`;
    if (tradeInModel)  text += `🔁 <b>سيارة الاستبدال:</b> ${escapeHtml(tradeInModel)}\n`;
  } else if (opCode === "sell_on_behalf") {
    if (tradeInModel)  text += `🚗 <b>موديل السيارة:</b> ${escapeHtml(tradeInModel)}\n`;
  } else {
    if (requestedCar)  text += `🚗 <b>السيارة المطلوبة:</b> ${escapeHtml(requestedCar)}\n`;
  }

  text += `📌 <b>الحالة:</b> ${escapeHtml(status)}\n`;

  if (nextFollowUp) {
    try {
      const d = new Date(nextFollowUp).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
      text += `📅 <b>موعد المتابعة:</b> ${d}\n`;
    } catch { /* ignore */ }
  }

  text += `\n${SEP}\n👨‍💼 <b>الموظف المسؤول:</b> ${escapeHtml(staffName)}`;

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
}): string {
  const { opCode, customerName, staffName, oldStatus, newStatus, nextFollowUp, note } = params;

  let icon = "🔄";
  let opTitle = "تحديث ملف مشتري";
  if (opCode === "buyer_tradein_pending") { icon = "🔁"; opTitle = "تحديث ملف استبدال"; }
  else if (opCode === "sell_on_behalf")   { icon = "📝"; opTitle = "تحديث ملف بيع بالوكالة"; }

  let text =
    `${icon} <b>${opTitle}</b>\n${SEP}\n\n` +
    `👤 <b>العميل:</b> ${escapeHtml(customerName)}\n` +
    `📌 <b>الحالة:</b> ${escapeHtml(oldStatus)} ← <b>${escapeHtml(newStatus)}</b>\n`;

  if (nextFollowUp) {
    try {
      const d = new Date(nextFollowUp).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
      text += `📅 <b>موعد المتابعة:</b> ${d}\n`;
    } catch { /* ignore */ }
  }

  if (note) text += `📝 <b>ملاحظة:</b> ${escapeHtml(note)}\n`;

  text += `\n${SEP}\n👨‍💼 <b>بواسطة:</b> ${escapeHtml(staffName)}`;

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
  branchName: string | null;
  status: string;
  requestedCar: string | null;
  tradeInModel: string | null;
  nextFollowUp: string | null;
}) {
  try {
    const managers = await getManagerRecipients(params.branchId);
    const text = buildNewCustomerText(params);
    await Promise.allSettled(
      managers.map((m) => sendWithButtons(m.chat_id, text, params.customerId)),
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
  oldStatus: string;
  newStatus: string;
  nextFollowUp: string | null;
  note: string | null;
}) {
  try {
    const managers = await getManagerRecipients(params.branchId);
    const text = buildUpdateCustomerText(params);
    await Promise.allSettled(
      managers.map((m) => sendWithButtons(m.chat_id, text, params.customerId)),
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
    const text = `🔔 <b>${escapeHtml(title)}</b>\n${SEP}\n\n${message}`;
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

    const text =
      `📋 <b>${escapeHtml(title)}</b>\n${SEP}\n\n` +
      `${message}\n\n` +
      `${SEP}\n<i>— أرسله: ${escapeHtml(senderName)}</i>`;

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
          await sendWithButtons(m.chat_id, `🖼 <b>صور مرفقة</b>\n${SEP}\n\n${escapeHtml(caption)}`, customerId);
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
}) {
  try {
    const managers = await getMaalamManagerChatIds();
    if (managers.length === 0) return;

    const appUrl = getAppUrl();

    // ── النص الكامل ──────────────────────────────────────────────────────────
    let fullText =
      `🔁 <b>طلب تقييم سيارة — استبدال</b>\n${SEP}\n\n` +
      `👤 <b>صاحب السيارة:</b> ${escapeHtml(customerName)}\n`;
    if (customerPhone) fullText += `📱 <b>الهاتف:</b> ${escapeHtml(customerPhone)}\n`;
    if (branchName)    fullText += `🏢 <b>الفرع:</b> ${escapeHtml(branchName)}\n`;
    fullText += `👨‍💼 <b>المُدخِل:</b> ${escapeHtml(submitterName)}\n`;
    fullText += `\n${SEP}\n`;
    fullText += `🚗 <b>الموديل:</b> ${escapeHtml(car.model)}\n`;
    if (car.color)           fullText += `🎨 <b>اللون:</b> ${escapeHtml(car.color)}\n`;
    if (car.production_year) fullText += `📅 <b>سنة الصنع:</b> ${car.production_year}\n`;
    if (car.mileage)         fullText += `🛣 <b>المسافة المقطوعة:</b> ${car.mileage.toLocaleString("en-US")} كم\n`;
    if (car.chassis_no)      fullText += `🔢 <b>رقم الشاصي:</b> ${escapeHtml(car.chassis_no)}\n`;
    if (car.inspection)      fullText += `🔍 <b>حالة الفحص:</b> ${escapeHtml(car.inspection)}\n`;
    if (car.specs)           fullText += `⚙️ <b>المواصفات:</b> ${escapeHtml(car.specs)}\n`;
    if (car.notes)           fullText += `📝 <b>ملاحظات:</b> ${escapeHtml(car.notes)}\n`;
    fullText += `\n${SEP}\n<i>يُرجى الضغط على الزر أدناه لإرسال قيمة التقييم للموظف 👇</i>`;

    // ── caption مختصر للصور ───────────────────────────────────────────────────
    let photoCaption = `🔁 <b>استبدال — ${escapeHtml(car.model)}</b>\n👤 ${escapeHtml(customerName)}`;
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
            [{ text: "✍️ إرسال قيمة التقييم للموظف", callback_data: callbackData }],
            ...(evalCardUrl ? [[{ text: "📋 فتح البطاقة الكاملة مع الصور", web_app: { url: evalCardUrl } }]] : []),
            ...(customerCardUrl ? [[{ text: "👤 بطاقة العميل الكاملة", web_app: { url: customerCardUrl } }]] : []),
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
