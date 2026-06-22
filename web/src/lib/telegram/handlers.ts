import { PAYMENT_METHOD_VALUES, needsPaymentMethod } from "@/lib/payment";
import {
  BTN,
  answerCallbackQuery,
  backCancelKeyboard,
  cancelKeyboard,
  escapeHtml,
  forceReplySearch,
  getAppUrl,
  getTelegramFileUrl,
  mainMenuKeyboard,
  menuInlineKeyboard,
  selectionKeyboard,
  sendChatAction,
  sendMessage,
  sendPhoto,
  sendMediaGroup,
  sendMediaWithKeyboard,
  sendMessageWithInlineKeyboard,
  sendMessageWithWebApp,
  sendMessageWithWebAppList,
} from "./api";
import {
  checkPhoneExists,
  createCustomer,
  getAgendaData,
  getAllPendingEvaluations,
  getBotUser,
  getBranches,
  getBranchReport,
  getGeneralManagerReport,
  getInventory,
  getMyCustomers,
  getNotifications,
  getStaffList,
  isMaalamManager,
  markNotificationsRead,
  searchCustomers,
  sendMessageToStaff,
  type BotUser,
} from "./queries";
import { pushTelegramVoiceToManagers, buildCustomerLogSection } from "./push";
import { clearSession, getSession, setSession } from "./sessions";
import { PHONE_LENGTH, normalizePhone } from "@/lib/phone";
import { STATUS_BY_TYPE } from "@/lib/statuses";
import { createAdminClient } from "@/lib/supabase/admin";
import { getColorEmoji } from "@/lib/colors";
import { getInventoryCarAttachments } from "@/lib/data";

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    message_id: number;
    from?: { first_name?: string; username?: string };
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
    audio?: { file_id: string; duration: number; title?: string; mime_type?: string };
    photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
    reply_to_message?: { text?: string };
    /** البيانات المُرسَلة من Mini App عبر sendData() */
    web_app_data?: { data: string; button_text: string };
  };
  /** ضغطة زر inline */
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
};

function todayLabel() {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
  const d = String(now.getUTCDate()).padStart(2, "0");
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const y = now.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

function roleLabel(user: BotUser) {
  if (user.capabilities.isGeneralManager) return "مدير عام 👑";
  if (user.capabilities.isManager) return "مدير معرض 🏢";
  return "موظف 👤";
}

function menuKeyboard(user: BotUser, isMaalamMgr = false) {
  return mainMenuKeyboard(user.capabilities.isManager, user.capabilities.isGeneralManager, isMaalamMgr);
}

// Cache: مدراء معرض لمعلم (تُحسَب مرة لكل جلسة بوت)
const maalamMgrCache = new Map<string, { value: boolean; ts: number }>();
async function checkIsMaalamMgr(userId: string): Promise<boolean> {
  const cached = maalamMgrCache.get(userId);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.value;
  const val = await isMaalamManager(userId);
  maalamMgrCache.set(userId, { value: val, ts: Date.now() });
  return val;
}

// ─── مساعدات التاريخ ────────────────────────────────────────────────────────

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateButtonLabel(label: string, n: number): string {
  return `${label} (${addDays(n)})`;
}

/** مطابقة تاريخ من زر الأيام السريعة أو نص YYYY-MM-DD */
function parseDateInput(input: string): string | null {
  // استخراج من صيغة "اسم (2026-06-04)"
  const match = input.match(/\((\d{4}-\d{2}-\d{2})\)/);
  if (match) return match[1];
  // تاريخ مكتوب يدوياً
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return input.trim();
  return null;
}

function quickDateKeyboard() {
  return selectionKeyboard([
    dateButtonLabel("📅 اليوم",       0),
    dateButtonLabel("📅 غداً",        1),
    dateButtonLabel("📅 +3 أيام",     3),
    dateButtonLabel("📅 +7 أيام ✓",  7),
    dateButtonLabel("📅 +14 يوم",    14),
    dateButtonLabel("📅 +30 يوم",    30),
  ], true, true);
}

// ─── حالات العميل حسب نوع العملية ──────────────────────────────────────────
// المصدر الموحّد: lib/statuses.ts (نفس قوائم الويب)
const STATUS_LISTS: Record<string, string[]> = STATUS_BY_TYPE;

const OP_TYPES = [
  { label: "🛒 مشتري",            value: "buyer" },
  { label: "🔄 مشتري + استبدال", value: "buyer_tradein_pending" },
  { label: "🚗 بيع بالوكالة",    value: "sell_on_behalf" },
];
const OP_LABELS = OP_TYPES.map((o) => o.label);

function getOpTypeValue(label: string) {
  return OP_TYPES.find((o) => o.label === label)?.value ?? null;
}

function getOpTypeLabel(value: string) {
  return OP_TYPES.find((o) => o.value === value)?.label ?? value;
}

function defaultFollowupDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// ─── /start & welcome ───────────────────────────────────────────────────────

export async function sendMainMenu(chatId: number | string, user: BotUser) {
  const isMaalam = await checkIsMaalamMgr(user.id);
  const role = user.capabilities.isGeneralManager
    ? "مدير عام 👑"
    : user.capabilities.isManager
      ? "مدير معرض 🏢"
      : "موظف مبيعات 👤";

  // Dynamic greeting based on Riyadh time (UTC+3)
  const hour = (new Date().getUTCHours() + 3) % 24;
  let greeting = "أهلاً بك";
  if (hour >= 5 && hour < 12) greeting = "صباح الخير ☀️";
  else if (hour >= 12 && hour < 18) greeting = "مساء الخير 🌤️";
  else greeting = "مساء الخير 🌙";

  let welcome = `${greeting}، <b>${escapeHtml(user.full_name)}</b> 👋\n\n`;
  welcome += `<blockquote>🪪 <b>الصلاحية:</b> ${role}\n`;
  if (user.branch_name) {
    welcome += `🏢 <b>المعرض:</b> ${escapeHtml(user.branch_name)}\n`;
  }
  welcome += `</blockquote>\nاختر من القائمة أدناه:`;

  // Dynamic banner based on branch
  const { getAppUrl, sendPhoto } = require('./api');
  const appUrl = getAppUrl();
  let bannerUrl = `${appUrl}/logos/lemalem.jpg`; // Default

  const branch = user.branch_name || "";
  if (branch.includes("شيري")) {
    bannerUrl = `${appUrl}/logos/chery.jpg`;
  } else if (branch.includes("فورثنج") || branch.includes("فورثينج")) {
    bannerUrl = `${appUrl}/logos/forthing.jpg`;
  }

  try {
    return await sendPhoto(chatId, bannerUrl, welcome, menuKeyboard(user, isMaalam));
  } catch (e) {
    return sendMessage(chatId, welcome, { replyMarkup: menuKeyboard(user, isMaalam) });
  }
}

async function handleStart(chatId: number, user: BotUser | null) {
  if (!user) {
    return sendMessage(
      chatId,
      `مرحباً 👋\n\nلاستخدام البوت يجب ربط حسابك أولاً.\n\n🔑 <b>معرّفك على Telegram:</b>\n<code>${chatId}</code>\n\nأرسل هذا الرقم لمدير النظام ليربطه بحسابك.`,
    );
  }

  await clearSession(String(chatId));
  return sendMainMenu(chatId, user);
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

async function handleCancel(chatId: number, user: BotUser) {
  await clearSession(String(chatId));
  const isMaalam = await checkIsMaalamMgr(user.id);
  return sendMessage(chatId, "✅ تم الإلغاء.", { replyMarkup: menuKeyboard(user, isMaalam) });
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

function formatFollowupDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yr  = d.getUTCFullYear();
    return `${day}/${mon}/${yr}`;
  } catch { return ""; }
}

export async function handleToday(chatId: number, user: BotUser) {
  await sendChatAction(chatId);

  let agenda: Awaited<ReturnType<typeof getAgendaData>>;
  try {
    agenda = await getAgendaData(user);
  } catch (err) {
    console.error("[handleToday] getAgendaData failed:", err);
    return sendMessage(
      chatId,
      "⚠️ تعذّر تحميل الأجندة. يرجى المحاولة مجدداً.",
      { replyMarkup: menuKeyboard(user) },
    );
  }

  const date = todayLabel();

  const scopeNote = user.capabilities.isGeneralManager
    ? "<i>النطاق: جميع الفروع</i>"
    : user.capabilities.isManager
      ? "<i>النطاق: فرعك</i>"
      : "<i>النطاق: ملفاتك</i>";

  let text = `📅 <b>الأجندة — ${date}</b>\n${scopeNote}\n\n`;

  // ── ملخص سريع ──────────────────────────────────────────────────────────
  const total =
    agenda.followupsToday.length +
    agenda.followupsOverdue.length +
    agenda.reminders.length +
    agenda.pendingEvaluations.length +
    agenda.incompleteTrades.length +
    agenda.licenseDue.length;

  if (total === 0) {
    text += "✅ <b>لا توجد مهام أو تنبيهات اليوم.</b>\n\nالجميع على ما يرام 🎉";
    const appUrl0 = getAppUrl();
    if (appUrl0) {
      return sendMessageWithWebApp(
        chatId,
        text,
        [{ text: "📅 فتح الأجندة التفاعلية", url: `${appUrl0}/bot-app/agenda?chat_id=${chatId}` }],
      );
    }
    return sendMessage(chatId, text, { replyMarkup: menuKeyboard(user) });
  }

  // ملخص أعداد
  const summaryParts: string[] = [];
  if (agenda.followupsToday.length > 0)   summaryParts.push(`⏰ متابعات اليوم: <b>${agenda.followupsToday.length}</b>`);
  if (agenda.followupsOverdue.length > 0)  summaryParts.push(`⚠️ متأخرة: <b>${agenda.followupsOverdue.length}</b>`);
  if (agenda.reminders.length > 0)         summaryParts.push(`🔔 تذكيرات: <b>${agenda.reminders.length}</b>`);
  if (agenda.pendingEvaluations.length > 0) summaryParts.push(`🔍 تقييم: <b>${agenda.pendingEvaluations.length}</b>`);
  if (agenda.incompleteTrades.length > 0)  summaryParts.push(`📋 بيانات ناقصة: <b>${agenda.incompleteTrades.length}</b>`);
  if (agenda.licenseDue.length > 0)        summaryParts.push(`📄 رخص: <b>${agenda.licenseDue.length}</b>`);
  text += summaryParts.join(" | ") + `\n\n`;

  // ── 1. متابعات اليوم ────────────────────────────────────────────────────
  if (agenda.followupsToday.length > 0) {
    text += `⏰ <b>متابعات اليوم (${agenda.followupsToday.length})</b>\n`;
    for (const [i, c] of agenda.followupsToday.entries()) {
      const dateStr = formatFollowupDate(c.next_follow_up_at);
      text += `<blockquote><b>${i + 1}. ${escapeHtml(c.full_name)}</b>\n`;
      if (c.phone) text += `<b>📱 الهاتف:</b> <code>${escapeHtml(c.phone)}</code>\n`;
      text += `<b>📌 الحالة:</b> ${escapeHtml(c.status)}${dateStr ? ` | 📅 ${dateStr}` : ""}\n`;
      if (c.requested_car) text += `<b>🚗 السيارة:</b> ${escapeHtml(c.requested_car)}\n`;
      text += `</blockquote>\n`;
    }
    text += "\n";
  }

  // ── 2. متابعات متأخرة ───────────────────────────────────────────────────
  if (agenda.followupsOverdue.length > 0) {
    text += `⚠️ <b>متابعات متأخرة (${agenda.followupsOverdue.length})</b>\n`;
    for (const [i, c] of agenda.followupsOverdue.entries()) {
      const dateStr = formatFollowupDate(c.next_follow_up_at);
      text += `<blockquote><b>${i + 1}. ${escapeHtml(c.full_name)}</b>\n`;
      if (c.phone) text += `<b>📱 الهاتف:</b> <code>${escapeHtml(c.phone)}</code>\n`;
      text += `<b>📌 الحالة:</b> ${escapeHtml(c.status)}${dateStr ? ` | ⏰ ${dateStr}` : ""}\n`;
      if (c.requested_car) text += `<b>🚗 السيارة:</b> ${escapeHtml(c.requested_car)}\n`;
      text += `</blockquote>\n`;
    }
    text += "\n";
  }

  // ── 3. تذكيرات معلقة ────────────────────────────────────────────────────
  if (agenda.reminders.length > 0) {
    text += `🔔 <b>تذكيرات معلقة (${agenda.reminders.length})</b>\n`;
    for (const [i, r] of agenda.reminders.entries()) {
      const label = escapeHtml(r.title ?? r.message ?? "مهمة");
      const cust = r.customer_name ? ` — ${escapeHtml(r.customer_name)}` : "";
      text += `${i + 1}. ${label}${cust}\n`;
    }
    text += "\n";
  }

  // أزرار "تم" للتذكيرات
  const reminderButtons: Array<Array<{ text: string; callback_data: string }>> = agenda.reminders
    .slice(0, 5)
    .map((r) => [{
      text: `✅ تم — ${(r.title ?? r.message ?? "تذكير").slice(0, 30)}`,
      callback_data: `done_reminder:${r.id}`,
    }]);

  // ── 4. سيارات بانتظار التقييم ───────────────────────────────────────────
  if (agenda.pendingEvaluations.length > 0) {
    text += `🔍 <b>سيارات بانتظار التقييم (${agenda.pendingEvaluations.length})</b>\n`;
    for (const [i, e] of agenda.pendingEvaluations.entries()) {
      text += `${i + 1}. <b>${escapeHtml(e.customer_name)}</b> — ${escapeHtml(e.trade_in_model)}\n`;
      if (e.trade_in_status) text += `   📌 ${escapeHtml(e.trade_in_status)}\n`;
    }
    text += "\n";
  }

  // ── 5. بيانات ناقصة ─────────────────────────────────────────────────────
  if (agenda.incompleteTrades.length > 0) {
    text += `📋 <b>سيارات بيانات ناقصة (${agenda.incompleteTrades.length})</b>\n`;
    for (const [i, t] of agenda.incompleteTrades.entries()) {
      text += `${i + 1}. <b>${escapeHtml(t.customer_name)}</b> — ${escapeHtml(t.trade_in_model)}\n`;
      text += `   ⚠️ ${t.missing_count} حقل${t.missing_count > 1 ? " ناقص" : " ناقص"}\n`;
    }
    text += "\n";
  }

  // ── 6. رخص تنتهي قريباً ────────────────────────────────────────────────
  if (agenda.licenseDue.length > 0) {
    text += `📄 <b>رخص تحتاج متابعة (${agenda.licenseDue.length})</b>\n`;
    for (const [i, l] of agenda.licenseDue.entries()) {
      const daysLabel = l.days < 0
        ? `منتهية منذ ${Math.abs(l.days)} يوم 🔴`
        : l.days === 0
          ? "تنتهي اليوم 🔴"
          : `تنتهي خلال ${l.days} يوم 🟡`;
      text += `${i + 1}. <b>${escapeHtml(l.customer_name)}</b> — ${escapeHtml(l.trade_in_model)}\n`;
      text += `   🗓 ${daysLabel}\n`;
    }
  }

  // ── تذييل ────────────────────────────────────────────────────────────────
  text = text.trimEnd();
  const footer = `\n\n<i>اضغط الزر أدناه لفتح الأجندة التفاعلية 👇</i>`;

  // Telegram limit: 4096 chars — truncate body if needed before appending footer
  const MAX_LEN = 4096;
  const footerLen = footer.length;
  if (text.length + footerLen > MAX_LEN) {
    text = text.slice(0, MAX_LEN - footerLen - 30) + "\n…\n<i>(اكتمل العرض في الأجندة)</i>";
  }
  text += footer;

  const appUrl = getAppUrl();
  const inlineRows: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];
  if (appUrl) {
    inlineRows.push([{ text: "📅 فتح الأجندة التفاعلية", web_app: { url: `${appUrl}/bot-app/agenda?chat_id=${chatId}` } }]);
  }
  // أزرار "تم" للتذكيرات (حتى 4 أزرار)
  for (const btn of reminderButtons.slice(0, 4)) inlineRows.push(btn);
  inlineRows.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

  if (inlineRows.length > 1) {
    return sendMessageWithInlineKeyboard(chatId, text, inlineRows);
  }
  return sendMessage(chatId, text, { replyMarkup: menuKeyboard(user) });
}

// ─── My customers ───────────────────────────────────────────────────────────

async function handleMy(chatId: number, user: BotUser, messageId?: number) {
  await sendChatAction(chatId);
  const customers = await getMyCustomers(user);

  const scopeLabel = user.capabilities.isGeneralManager
    ? "جميع الفروع"
    : user.capabilities.isManager
      ? "فرعك"
      : "ملفاتك";

  if (customers.length === 0) {
    return sendMessage(chatId, `لا يوجد عملاء نشطون في ${scopeLabel} حالياً.`, {
      replyMarkup: menuKeyboard(user),
    });
  }

  const newCount = customers.filter((c) => c.status === "جديد").length;
  const followUpCount = customers.filter((c) => c.status.includes("متابعة")).length;

  let text = `👥 <b>العملاء النشطون — ${scopeLabel} (${customers.length} الأحدث):</b>\n\nاختر الفئة التي تود عرضها من الأزرار أدناه:`;

  const inlineRows: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];

  const row1 = [];
  if (newCount > 0) row1.push({ text: `🌟 جديد (${newCount})`, callback_data: "my_new" });
  if (followUpCount > 0) row1.push({ text: `🔄 قيد المتابعة (${followUpCount})`, callback_data: "my_followup" });
  if (row1.length > 0) inlineRows.push(row1);

  const row2 = [];
  row2.push({ text: `📋 عرض الكل (${customers.length})`, callback_data: "my_all" });
  inlineRows.push(row2);

  const appUrl = getAppUrl();
  if (appUrl) {
    inlineRows.push([{ text: "🔍 البحث والتصفح المتقدم", web_app: { url: `${appUrl}/bot-app/search?chat_id=${chatId}` } }]);
  }

  if (messageId) {
    try {
      const { editMessageText } = require('./api');
      return await editMessageText(chatId, messageId, text, { replyMarkup: { inline_keyboard: inlineRows } });
    } catch (e) {
      return await sendMessageWithInlineKeyboard(chatId, text, inlineRows);
    }
  }

  return sendMessageWithInlineKeyboard(chatId, text, inlineRows);
}

async function handleMyCategory(chatId: number, user: BotUser, category: string, messageId?: number, page: number = 0) {
  await sendChatAction(chatId);
  const customers = await getMyCustomers(user);

  const scopeLabel = user.capabilities.isGeneralManager
    ? "جميع الفروع"
    : user.capabilities.isManager
      ? "فرعك"
      : "ملفاتك";

  let filtered = customers;
  let title = `👥 جميع العملاء النشطين (${scopeLabel})`;

  if (category === "new") {
    filtered = customers.filter((c) => c.status === "جديد");
    title = `🌟 عملاء (جديد) — ${scopeLabel}`;
  } else if (category === "followup") {
    filtered = customers.filter((c) => c.status.includes("متابعة"));
    title = `🔄 عملاء (قيد المتابعة) — ${scopeLabel}`;
  } else if (category === "all") {
    filtered = customers;
    title = `📋 جميع العملاء (${scopeLabel})`;
  }

  if (filtered.length === 0) {
    return sendMessage(chatId, `لا يوجد عملاء في هذه الفئة حالياً.`);
  }

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const listToRender = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  let text = `<b>${title} (${filtered.length}):</b>\n\n`;
  for (let idx = 0; idx < listToRender.length; idx++) {
    const c = listToRender[idx];
    const displayNum = startIndex + idx + 1;
    text += `<blockquote><b>${displayNum}. ${escapeHtml(c.full_name)}</b>\n`;
    text += `<b>📱 الهاتف:</b> <code>${c.phone}</code>\n`;
    text += `<b>📌 الحالة:</b> ${escapeHtml(c.status)}\n`;
    if (c.requested_car) text += `<b>🚗 السيارة:</b> ${escapeHtml(c.requested_car)}\n`;
    if (user.capabilities.isGeneralManager && c.branch_name) {
      text += `<b>🏢 الفرع:</b> ${escapeHtml(c.branch_name)}\n`;
    }
    text += `</blockquote>\n`;
  }

  const buttons = [];
  const paginationRow = [];
  if (safePage > 0) paginationRow.push({ text: "⬅️ السابق", callback_data: `my_${category}_${safePage - 1}` });
  paginationRow.push({ text: `${safePage + 1} / ${totalPages}`, callback_data: "ignore" });
  if (safePage < totalPages - 1) paginationRow.push({ text: "التالي ➡️", callback_data: `my_${category}_${safePage + 1}` });
  
  if (paginationRow.length > 1) buttons.push(paginationRow);
  buttons.push([{ text: "⬅️ رجوع", callback_data: "my_customers" }]); // my_customers does not exist yet as a callback, but we will add it

  if (messageId) {
    try {
      const { editMessageText } = require('./api');
      return await editMessageText(chatId, messageId, text.trimEnd(), { replyMarkup: { inline_keyboard: buttons } });
    } catch (e) {
      return await sendMessageWithInlineKeyboard(chatId, text.trimEnd(), buttons);
    }
  }

  return sendMessageWithInlineKeyboard(chatId, text.trimEnd(), buttons);
}

// ─── Search ─────────────────────────────────────────────────────────────────

async function handleSearchPrompt(chatId: number, user: BotUser) {
  await setSession(String(chatId), "idle");
  const appUrl = getAppUrl();
  if (appUrl) {
    return sendMessageWithWebApp(
      chatId,
      "🔍 <b>البحث عن عميل</b>\n\nاضغط الزر أدناه لفتح صفحة البحث التفاعلية:",
      [{ text: "🔍 فتح صفحة البحث", url: `${appUrl}/bot-app/search?chat_id=${chatId}` }],
    );
  }
  // fallback نصي إذا لم يكن APP_URL مضبوطاً
  return sendMessage(chatId, "🔍 <b>بحث عن عميل</b>\n\nاكتب الاسم أو رقم الهاتف:", {
    replyMarkup: forceReplySearch(),
  });
}

async function handleSearchQuery(chatId: number, user: BotUser, query: string) {
  if (!query.trim()) return handleSearchPrompt(chatId, user);

  await sendChatAction(chatId);
  const results = await searchCustomers(user, query.trim());

  if (results.length === 0) {
    return sendMessage(chatId, `🔍 لا توجد نتائج لـ "<b>${escapeHtml(query)}</b>"`, {
      replyMarkup: menuKeyboard(user),
    });
  }

  let text = `🔍 <b>نتائج "${escapeHtml(query)}" (${results.length}):</b>\n\n`;
  for (const [i, c] of results.entries()) {
    text += `<blockquote><b>${i + 1}. ${escapeHtml(c.full_name)}</b>\n`;
    text += `<b>📱 الهاتف:</b> <code>${c.phone}</code>\n`;
    text += `<b>📌 الحالة:</b> ${escapeHtml(c.status)}\n`;
    if (c.requested_car) text += `<b>🚗 السيارة:</b> ${escapeHtml(c.requested_car)}\n`;
    if (user.capabilities.isGeneralManager && c.branch_name) {
      text += `<b>🏢 الفرع:</b> ${escapeHtml(c.branch_name)}\n`;
    }
    text += `</blockquote>\n`;
  }

  // عند نتيجة واحدة — نتيح إضافة ملاحظة صوتية مباشرة
  if (results.length === 1) {
    const c = results[0];
    text += `\n🎤 أرسل <b>تسجيلاً صوتياً الآن</b> لإرفاقه بملف <b>${escapeHtml(c.full_name)}</b>\nأو اضغط إلغاء للعودة.`;
    await setSession(String(chatId), "voice_note_for_customer", {
      customer_id: c.id,
      customer_name: c.full_name,
    });
    return sendMessage(chatId, text.trimEnd(), { replyMarkup: cancelKeyboard() });
  }

  return sendMessage(chatId, text.trimEnd(), { replyMarkup: menuKeyboard(user) });
}

// ─── Card Search (فتح بطاقة عميل) ──────────────────────────────────────────

async function handleCardSearchPrompt(chatId: number) {
  await setSession(String(chatId), "card_search", {});
  return sendMessage(chatId, "👤 <b>فتح بطاقة عميل</b>\n\nاكتب اسم العميل أو رقم هاتفه:", {
    replyMarkup: { force_reply: true as const, input_field_placeholder: "اكتب الاسم أو رقم الهاتف..." },
  });
}

async function handleCardSearchQuery(chatId: number, user: BotUser, query: string) {
  if (!query.trim()) return handleCardSearchPrompt(chatId);

  await sendChatAction(chatId);
  const results = await searchCustomers(user, query.trim());
  await clearSession(String(chatId));

  const appUrl = getAppUrl();

  if (results.length === 0) {
    return sendMessage(chatId, `👤 لا توجد نتائج لـ "<b>${escapeHtml(query)}</b>"`, {
      replyMarkup: menuKeyboard(user),
    });
  }

  // عند نتيجة واحدة — فتح المني-آب مباشرة
  if (results.length === 1) {
    const c = results[0];
    const cardUrl = `${appUrl}/bot-app/customer?id=${c.id}&chat_id=${chatId}`;
    return sendMessageWithWebApp(
      chatId,
      `👤 <b>${escapeHtml(c.full_name)}</b>\n📱 ${escapeHtml(c.phone)}\n📌 ${escapeHtml(c.status)}`,
      [{ text: "📂 فتح البطاقة", url: cardUrl }],
    );
  }

  // عدة نتائج — قائمة أزرار Mini App (حتى 8 نتائج)
  const limited = results.slice(0, 8);
  const header = `👤 <b>نتائج "${escapeHtml(query)}" (${results.length}${results.length > 8 ? "، يُعرض أول 8" : ""}):</b>\n<i>اختر العميل لفتح بطاقته:</i>`;
  const buttons = limited.map((c) => ({
    text: `${escapeHtml(c.full_name)} — ${escapeHtml(c.status)}`,
    url: `${appUrl}/bot-app/customer?id=${c.id}&chat_id=${chatId}`,
  }));
  return sendMessageWithWebAppList(chatId, header, buttons);
}

// ─── Inventory ──────────────────────────────────────────────────────────────

async function handleInventory(chatId: number, user: BotUser, messageId?: number) {
  await sendChatAction(chatId);
  const { items, branchNamesSet } = await getInventory(user);

  const scopeLabel = user.capabilities.isGeneralManager ? "جميع الفروع" : "فرعك";

  if (items.length === 0) {
    return sendMessage(chatId, `📦 لا توجد سيارات في المخزون (${scopeLabel}).`, {
      replyMarkup: menuKeyboard(user),
    });
  }

  // تقسيم المخزون
  const isCustomerCar = (item: any) => {
    const deal = item.deal_type || "";
    if (deal.includes("برسم البيع")) {
      const owner = (item.owner_name || "").trim().toLowerCase();
      return !branchNamesSet.has(owner);
    }
    if (deal.includes("استبدال")) {
      return Boolean(item.source_customer_id);
    }
    return false;
  };

  const availableNewCars: typeof items = [];
  const availableUsedCars: typeof items = [];
  const customerCars: typeof items = [];

  for (const car of items) {
    if (isCustomerCar(car)) {
      customerCars.push(car);
    } else {
      const condition = car.condition_label || "";
      const isAvailable = car.availability_status === "متوفرة";
      if (isAvailable && condition.includes("جديد")) availableNewCars.push(car);
      else if (isAvailable && !condition.includes("جديد")) availableUsedCars.push(car);
    }
  }

  let text = `📦 <b>المخزون — ${scopeLabel} (${items.length}):</b>\n\nاختر الفئة التي تود عرضها من الأزرار أدناه:`;

  const inlineRows: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];

  if (availableNewCars.length > 0) {
    inlineRows.push([{ text: `✨ السيارات المتوفرة الجديدة (${availableNewCars.length})`, callback_data: "inv_new_avail" }]);
  }
  if (availableUsedCars.length > 0) {
    inlineRows.push([{ text: `🚘 سيارات المتوفرة المستعملة (${availableUsedCars.length})`, callback_data: "inv_used_avail" }]);
  }
  if (customerCars.length > 0) {
    inlineRows.push([{ text: `✅ 👤 سيارات العملاء برسم البيع (${customerCars.length})`, callback_data: "inv_cust" }]);
  }

  inlineRows.push([{ text: `📋 عرض الكل (${items.length})`, callback_data: "inv_all" }]);

  const appUrl = getAppUrl();
  if (appUrl) {
    inlineRows.push([{ text: "➕ إضافة سيارة للمخزون", web_app: { url: `${appUrl}/bot-app/inventory-add?chat_id=${chatId}` } }]);
  }

  return sendMessageWithInlineKeyboard(chatId, text, inlineRows);
}

async function handleInventoryCategory(chatId: number, user: BotUser, category: string, messageId?: number, page: number = 0) {
  await sendChatAction(chatId);
  const { items, branchNamesSet } = await getInventory(user);

  const scopeLabel = user.capabilities.isGeneralManager ? "جميع الفروع" : "فرعك";

  const isCustomerCar = (item: any) => {
    const deal = item.deal_type || "";
    if (deal.includes("برسم البيع")) {
      const owner = (item.owner_name || "").trim().toLowerCase();
      return !branchNamesSet.has(owner);
    }
    if (deal.includes("استبدال")) {
      return Boolean(item.source_customer_id);
    }
    return false;
  };

  let filtered = items;
  let title = `📦 جميع السيارات (${scopeLabel})`;

  if (category === "new_avail") {
    filtered = items.filter((car) => !isCustomerCar(car) && (car.condition_label || "").includes("جديد") && car.availability_status === "متوفرة");
    title = `✨ السيارات المتوفرة الجديدة (${scopeLabel})`;
  } else if (category === "used_avail") {
    filtered = items.filter((car) => !isCustomerCar(car) && !(car.condition_label || "").includes("جديد") && car.availability_status === "متوفرة");
    title = `🚘 سيارات المتوفرة المستعملة (${scopeLabel})`;
  } else if (category === "cust") {
    filtered = items.filter((car) => isCustomerCar(car));
    title = `✅ 👤 سيارات العملاء برسم البيع (${scopeLabel})`;
  } else if (category === "all") {
    filtered = items;
    title = `📋 جميع السيارات في المخزون (${scopeLabel})`;
  }

  if (filtered.length === 0) {
    return sendMessage(chatId, `لا يوجد سيارات في هذه الفئة حالياً.`);
  }

  const buttons: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const listToRender = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  for (const car of listToRender) {
    const year = car.production_year ? ` ${car.production_year}` : "";
    const name = `${escapeHtml(car.model)}${year}`;
    const price = car.price ? ` | ${Number(car.price).toLocaleString("en-US")} ₪` : "";
    const colorEmoji = getColorEmoji(car.color);
    
    let prefix = "✅";
    if (car.availability_status !== "متوفرة") prefix = "❌";

    buttons.push([
      {
        text: `${prefix} ${colorEmoji} ${name}${price}`,
        callback_data: `invcar:${car.id}`
      }
    ]);
  }

  // Pagination row
  const paginationRow = [];
  if (safePage > 0) {
    paginationRow.push({ text: "⬅️ السابق", callback_data: `inv_${category}_${safePage - 1}` });
  }
  paginationRow.push({ text: `${safePage + 1} / ${totalPages}`, callback_data: "ignore" });
  if (safePage < totalPages - 1) {
    paginationRow.push({ text: "التالي ➡️", callback_data: `inv_${category}_${safePage + 1}` });
  }
  if(paginationRow.length > 1) buttons.push(paginationRow);

  buttons.push([{ text: "⬅️ رجوع", callback_data: "inventory_menu" }]);

  const text = `<b>${title} (${filtered.length}):</b>\n<i>اضغط على أي سيارة لعرض بطاقتها الكاملة 👇</i>`;

  if (messageId) {
    try {
      const { editMessageText } = require('./api');
      return await editMessageText(chatId, messageId, text, { replyMarkup: { inline_keyboard: buttons } });
    } catch (e) {
      return await sendMessageWithInlineKeyboard(chatId, text, buttons);
    }
  }

  if (messageId) {
    try {
      const { editMessageText } = require('./api');
      return await editMessageText(chatId, messageId, text, { replyMarkup: { inline_keyboard: buttons } });
    } catch (e) {
      return await sendMessageWithInlineKeyboard(chatId, text, buttons);
    }
  }
  return sendMessageWithInlineKeyboard(chatId, text, buttons);
}

async function handleSendCarCard(chatId: number, user: BotUser, carId: string) {
  await sendChatAction(chatId);
  const admin = createAdminClient();
  const { data: car } = await admin.from("inventory").select("*").eq("id", carId).single();
  if (!car) {
    return sendMessage(chatId, "❌ السيارة لم تعد موجودة أو تم بيعها.");
  }
  
  const attachments = await getInventoryCarAttachments(car.id, car.source_customer_id, car.photo_urls ?? []);
  const photos = attachments.filter((a: any) => a.isImage).map((a: any) => a.url);

  const year = car.production_year ? ` ${car.production_year}` : "";
  const name = `${escapeHtml(car.model)}${year}`;
  const price = car.price ? `💰 <b>السعر:</b> ${Number(car.price).toLocaleString("en-US")} ₪\n` : "";
  const colorEmoji = getColorEmoji(car.color);
  
  let caption = `<b>🚘 ${name}</b>\n\n`;
  caption += `🎨 <b>اللون:</b> ${colorEmoji} ${escapeHtml(car.color ?? "غير محدد")}\n`;
  if (price) caption += price;
  caption += `⛽ <b>الوقود:</b> ${escapeHtml(car.fuel_type ?? "—")} | ⚙️ <b>القير:</b> ${escapeHtml(car.gearbox ?? "—")}\n`;
  caption += `🛣 <b>العداد:</b> ${car.mileage ? Number(car.mileage).toLocaleString("en-US") + " كم" : "—"}\n`;
  caption += `📌 <b>الحالة:</b> ${escapeHtml(car.condition_label ?? "—")} | 🏷️ <b>التوفر:</b> ${escapeHtml(car.availability_status ?? "—")}\n`;
  
  if (car.specs) {
    caption += `\n📝 <b>المواصفات:</b>\n${escapeHtml(car.specs)}\n`;
  }
  if (car.inspection) {
    caption += `\n🔍 <b>الفحص:</b>\n${escapeHtml(car.inspection)}\n`;
  }
  
  const appUrl = getAppUrl();
  const inlineButtons = [];
  if (appUrl) {
    inlineButtons.push([{ text: "📋 فتح البطاقة الكاملة بالموقع", web_app: { url: `${appUrl}/dashboard/inventory?car=${car.id}` } }]);
  }
  inlineButtons.push([{ text: "⬅️ قائمة المخزون", callback_data: "inventory_menu" }]);
  
  if (photos.length > 1) {
    caption += `\n<i>📸 (مرفق ${photos.length} صور للسيارة، اضغط زر فتح البطاقة بالموقع لرؤية ألبوم الصور بالكامل)</i>`;
  }

  const replyMarkup = inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined;

  try {
    if (photos.length > 0) {
      await sendPhoto(chatId, photos[0], caption, replyMarkup);
    } else {
      await sendMessage(chatId, caption, { replyMarkup });
    }
  } catch (e) {
    console.error("Failed to send car card", e);
    await sendMessage(chatId, caption, { replyMarkup });
  }
}

// ─── Notifications ──────────────────────────────────────────────────────────

async function handleNotifications(chatId: number, user: BotUser) {
  await sendChatAction(chatId);
  const notifs = await getNotifications(user);

  if (notifs.length === 0) {
    return sendMessage(chatId, "🔔 لا توجد تنبيهات.", { replyMarkup: menuKeyboard(user) });
  }

  const unread = notifs.filter((n) => n.status === "unread");
  let text = `🔔 <b>تنبيهاتي (${notifs.length})</b>`;
  if (unread.length > 0) text += ` — <b>${unread.length} غير مقروءة</b>`;
  text += "\n\n";

  for (const [i, n] of notifs.entries()) {
    const icon = n.status === "unread" ? "🔴" : "⚪";
    const title = n.title ? escapeHtml(n.title) : "تنبيه";
    text += `${icon} ${i + 1}. <b>${title}</b>\n`;
    if (n.message) text += `   ${escapeHtml(n.message)}\n`;
    text += "\n";
  }

  if (unread.length > 0) {
    await markNotificationsRead(user);
    text += "<i>✅ تم تعليم الكل كمقروء</i>";
  }

  return sendMessage(chatId, text.trimEnd(), { replyMarkup: menuKeyboard(user) });
}

// ─── Report ─────────────────────────────────────────────────────────────────

async function handleReport(chatId: number, user: BotUser) {
  if (!user.capabilities.isManager) {
    return sendMessage(chatId, "⛔ هذا الأمر متاح للمديرين فقط.", {
      replyMarkup: menuKeyboard(user),
    });
  }

  await sendChatAction(chatId);
  const date = todayLabel();

  if (user.capabilities.isGeneralManager) {
    const report = await getGeneralManagerReport();

    let text =
      `📊 <b>التقرير الشامل — ${date}</b>\n\n` +
      `👥 إجمالي العملاء النشطين: <b>${report.totalCustomers}</b>\n` +
      `🚗 السيارات المتوفرة: <b>${report.totalInventory}</b>\n` +
      `⏰ متابعات اليوم: <b>${report.todayFollowups}</b>\n` +
      `⚠️ متابعات متأخرة: <b>${report.overdueFollowups}</b>\n` +
      `🔔 تنبيهات غير مقروءة: <b>${report.unreadNotifications}</b>\n`;

    if (report.branchStats.length > 0) {
      text += "\n📍 <b>توزيع الفروع:</b>\n";
      for (const b of report.branchStats) {
        text += `• ${escapeHtml(b.name)}: ${b.customers} عميل | ${b.inventory} سيارة\n`;
      }
    }

    return sendMessage(chatId, text, { replyMarkup: menuKeyboard(user) });
  }

  const report = await getBranchReport(user);
  return sendMessage(
    chatId,
    `📊 <b>تقرير الفرع — ${date}</b>\n\n` +
      `👥 العملاء النشطون: <b>${report.activeCustomers}</b>\n` +
      `🚗 السيارات المتوفرة: <b>${report.availableInventory}</b>\n` +
      `⏰ متابعات اليوم: <b>${report.todayFollowups}</b>\n` +
      `⚠️ متابعات متأخرة: <b>${report.overdueFollowups}</b>`,
    { replyMarkup: menuKeyboard(user) },
  );
}

// ─── Staff list (GM only) ────────────────────────────────────────────────────

async function handleStaff(chatId: number, user: BotUser) {
  if (!user.capabilities.isManager) {
    return sendMessage(chatId, "⛔ هذا الأمر متاح للمديرين فقط.", {
      replyMarkup: menuKeyboard(user),
    });
  }

  await sendChatAction(chatId);
  const staff = await getStaffList(user);

  if (staff.length === 0) {
    return sendMessage(chatId, "👨‍💼 لا يوجد موظفون.", { replyMarkup: menuKeyboard(user) });
  }

  const scopeLabel = user.capabilities.isGeneralManager ? "جميع الفروع" : "فرعك";
  let text = `👨‍💼 <b>الموظفون — ${scopeLabel} (${staff.length}):</b>\n\n`;

  for (const [i, s] of staff.entries()) {
    const roleMap: Record<string, string> = {
      general_manager: "مدير عام 👑",
      manager: "مدير معرض 🏢",
      employee: "موظف 👤",
    };
    const roleStr = roleMap[s.role] ?? escapeHtml(s.role);
    text += `${i + 1}. <b>${escapeHtml(s.full_name)}</b> — ${roleStr}\n`;
    if (user.capabilities.isGeneralManager && s.branch_name) {
      text += `   🏢 ${escapeHtml(s.branch_name)}\n`;
    }
    text += "\n";
  }

  return sendMessage(chatId, text.trimEnd(), { replyMarkup: menuKeyboard(user) });
}

// ─── Evaluation Requests (مدير معرض لمعلم) ─────────────────────────────────

async function handleEvalRequests(chatId: number, user: BotUser) {
  const isAllowed = await checkIsMaalamMgr(user.id);
  if (!isAllowed && !user.capabilities.isGeneralManager) {
    return sendMessage(chatId, "⛔ هذا الأمر مخصص لمدير معرض لمعلم فقط.", {
      replyMarkup: menuKeyboard(user),
    });
  }

  await sendChatAction(chatId);
  const items = await getAllPendingEvaluations();

  if (items.length === 0) {
    return sendMessage(
      chatId,
      "✅ <b>لا توجد سيارات بانتظار التقييم</b>\n\nجميع طلبات التقييم المعلقة أُنجزت. 🎉",
      { replyMarkup: menuKeyboard(user, true) },
    );
  }

  // إرسال رسالة الملخص أولاً
  await sendMessage(
    chatId,
    `🔍 <b>طلبات التقييم المعلقة — ${items.length} سيارة</b>\n<i>يُعرض كل طلب كبطاقة مستقلة أدناه 👇</i>`,
    { replyMarkup: menuKeyboard(user, true) },
  );

  const appUrl = getAppUrl();

  // إرسال بطاقة مستقلة لكل سيارة
  for (const [i, e] of items.entries()) {
    await sendChatAction(chatId);

    // ── النص الكامل للرسالة النصية (بدون حد) ───────────────────────────────
    let fullText =
      `🚘 <b>بطاقة تقييم #${i + 1}</b>\n\n` +
      `👤 <b>صاحب السيارة:</b>\n` +
      `<blockquote><b>الاسم:</b> ${escapeHtml(e.customer_name)}\n` +
      (e.customer_phone ? `<b>الهاتف:</b> <code>${escapeHtml(e.customer_phone)}</code>\n` : "") +
      (e.branch_name ? `<b>الفرع:</b> ${escapeHtml(e.branch_name)}\n` : "") +
      (e.staff_name ? `<b>المُدخِل:</b> ${escapeHtml(e.staff_name)}` : "") +
      `</blockquote>\n\n` +
      `🚗 <b>تفاصيل السيارة:</b>\n` +
      `<blockquote><b>الموديل:</b> ${escapeHtml(e.model)}\n` +
      (e.color ? `<b>اللون:</b> ${escapeHtml(e.color)}\n` : "") +
      (e.production_year ? `<b>سنة الصنع:</b> ${e.production_year}\n` : "") +
      (e.mileage ? `<b>الكيلومترات:</b> ${e.mileage.toLocaleString("en-US")} كم\n` : "") +
      (e.chassis_no ? `<b>رقم الشاصي:</b> <code>${escapeHtml(e.chassis_no)}</code>\n` : "") +
      (e.inspection ? `<b>الفحص:</b> ${escapeHtml(e.inspection)}\n` : "") +
      (e.specs ? `<b>المواصفات:</b> ${escapeHtml(e.specs)}\n` : "") +
      (e.notes ? `<b>ملاحظات:</b> ${escapeHtml(e.notes)}\n` : "") +
      (e.status ? `<b>الحالة:</b> ${escapeHtml(e.status)}\n` : "") +
      `</blockquote>\n\n` +
      `<i>اضغط الزر أدناه لإرسال قيمة التقييم للموظف 👇</i>`;

    const callbackData = `er:${e.trade_in_id}`;
    const inlineButtons: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [
      [{ text: "✍️ إرسال قيمة التقييم للموظف", callback_data: callbackData }],
    ];
    if (appUrl) {
      const evalCardUrl = `${appUrl}/bot-app/eval-card?trade_id=${e.trade_in_id}&customer_id=${e.customer_id}&chat_id=${chatId}`;
      inlineButtons.push([{ text: "📋 فتح البطاقة الكاملة مع الصور", web_app: { url: evalCardUrl } }]);
      const customerCardUrl = `${appUrl}/bot-app/customer?id=${e.customer_id}&chat_id=${chatId}`;
      inlineButtons.push([{ text: "👤 بطاقة العميل الكاملة", web_app: { url: customerCardUrl } }]);
    }
    inlineButtons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);
    const replyMarkupInline = { inline_keyboard: inlineButtons };

    let finalCaption = fullText;
    if (e.photo_urls.length > 1) {
      finalCaption += `\n\n📸 <i>(هذه البطاقة تحتوي على ${e.photo_urls.length} صور)</i>`;
    }

    try {
      await sendMediaWithKeyboard(chatId, e.photo_urls, finalCaption, inlineButtons);
    } catch (err) {
      console.error(`[evalCards] card ${i + 1} send failed:`, err);
      await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
    }

    // تأخير بسيط بين البطاقات لتفادي rate limit
    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/** معالجة رد التقييم عبر زر inline */
async function handleEvalReplyCallback(chatId: number, user: BotUser, tradeInId: string) {
  const admin = createAdminClient();

  // جلب بيانات الموظف المُدخِل من trade_in → customer → assigned_user
  const { data: tradeRow } = await admin
    .from("trade_ins")
    .select("model, customers(full_name, assigned_user_id, app_users(telegram_chat_id))")
    .eq("id", tradeInId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custRel = (tradeRow as any)?.customers;
  const custData = Array.isArray(custRel) ? custRel[0] : custRel;
  const staffRel = custData?.app_users;
  const staffData = Array.isArray(staffRel) ? staffRel[0] : staffRel;

  const submitterUserId  = custData?.assigned_user_id ?? "";
  const submitterChatId  = staffData?.telegram_chat_id ?? "";
  const tradeModel       = (tradeRow as { model?: string | null })?.model ?? "—";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerName     = custData?.full_name ?? "العميل";

  await setSession(String(chatId), "eval_reply_price", {
    eval_trade_in_id:       tradeInId,
    eval_submitter_user_id: submitterUserId,
    eval_submitter_chat_id: submitterChatId,
  });

  return sendMessage(
    chatId,
    `✍️ <b>إدخال قيمة التقييم</b>\n\n` +
    `👤 <b>${escapeHtml(customerName)}</b>\n` +
    `🚗 <b>${escapeHtml(tradeModel)}</b>\n\n` +
    `اكتب <b>قيمة التقييم بالشيقل</b> (أرقام فقط):`,
    { replyMarkup: cancelKeyboard() },
  );
}

async function handleEvalReplyPrice(chatId: number, user: BotUser, input: string, sessionData: Record<string, string>) {
  const price = Number(input.replace(/[,،\s]/g, "").trim());
  if (!price || price <= 0 || Number.isNaN(price)) {
    return sendMessage(chatId, "⚠️ أدخل مبلغاً صحيحاً بالشيقل (أرقام فقط):", { replyMarkup: cancelKeyboard() });
  }

  const tradeInId       = sessionData.eval_trade_in_id;
  const submitterUserId = sessionData.eval_submitter_user_id;
  const submitterChatId = sessionData.eval_submitter_chat_id;

  await clearSession(String(chatId));
  await sendChatAction(chatId);

  const admin = createAdminClient();

  // تحديث سعر التقييم بدقة عبر trade_in_id
  const { error } = await admin
    .from("trade_ins")
    .update({ price, status: "تم التقييم" })
    .eq("id", tradeInId);

  if (error) {
    return sendMessage(chatId, `⚠️ تعذّر حفظ قيمة التقييم: ${escapeHtml(error.message)}`, {
      replyMarkup: menuKeyboard(user, true),
    });
  }

  // جلب اسم العميل من trade_in
  const { data: tradeRow } = await admin
    .from("trade_ins")
    .select("model, customers(full_name)")
    .eq("id", tradeInId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custRel = (tradeRow as any)?.customers;
  const customerName = (Array.isArray(custRel) ? custRel[0]?.full_name : custRel?.full_name) ?? "العميل";
  const tradeModel = (tradeRow as { model?: string | null })?.model ?? "";

  const priceFormatted = price.toLocaleString("en-US");

  // تأكيد للمُقيِّم مع زر القائمة
  await sendMessage(
    chatId,
    `✅ <b>تم إرسال قيمة التقييم بنجاح</b>\n\n` +
    `👤 <b>بيانات التقييم:</b>\n` +
    `<blockquote><b>العميل:</b> ${escapeHtml(customerName)}\n` +
    (tradeModel ? `<b>السيارة:</b> ${escapeHtml(tradeModel)}\n` : "") +
    `<b>قيمة التقييم:</b> <b>${priceFormatted} ₪</b></blockquote>\n\n` +
    `<i>سيتلقّى الموظف المسؤول إشعاراً فورياً بهذه القيمة.</i>`,
    { replyMarkup: menuKeyboard(user, true) },
  );

  // إشعار للموظف المُدخِل مع زر بطاقة العميل
  const notifyTarget = submitterChatId || null;
  if (notifyTarget) {
    const evalMsg =
      `💰 <b>تم تقييم سيارة العميل بنجاح</b>\n\n` +
      `👤 <b>تفاصيل التقييم المستلم:</b>\n` +
      `<blockquote><b>العميل:</b> ${escapeHtml(customerName)}\n` +
      (tradeModel ? `<b>الموديل:</b> ${escapeHtml(tradeModel)}\n` : "") +
      `<b>قيمة التقييم:</b> <b>${priceFormatted} ₪</b>\n` +
      `<b>المُقيِّم:</b> ${escapeHtml(user.full_name)}</blockquote>\n\n` +
      `<i>تمّ تحديث الملف تلقائياً. يمكنك فتح البطاقة للاطلاع على كامل التفاصيل.</i>`;

    // جلب customer_id من trade_in لبناء رابط البطاقة
    const { data: tiForCard } = await admin
      .from("trade_ins")
      .select("customer_id")
      .eq("id", tradeInId)
      .maybeSingle();
    const custIdForCard = (tiForCard as { customer_id?: string | null } | null)?.customer_id ?? null;

    const appUrl = getAppUrl();
    const inlineForEmployee: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [];
    if (custIdForCard && appUrl) {
      inlineForEmployee.push([{
        text: "📋 فتح بطاقة العميل",
        web_app: { url: `${appUrl}/bot-app/customer?id=${custIdForCard}&chat_id=${notifyTarget}` },
      }]);
    }
    inlineForEmployee.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: Number(notifyTarget),
          text: evalMsg,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineForEmployee },
        }),
      });
    } catch { /* best-effort */ }
  }

  // إشعار عبر قاعدة البيانات للموظف
  if (submitterUserId) {
    await admin.from("notifications").insert({
      recipient_user_id: submitterUserId,
      title: "تم تقييم السيارة",
      message: `تمّ تقييم سيارة${tradeModel ? ` (${tradeModel})` : ""} للعميل ${customerName} بقيمة ${priceFormatted} شيقل — بواسطة ${user.full_name}`,
      notification_type: "evaluation",
      status: "unread",
      created_by_user_id: user.id,
    });
  }
}

/** معالجة أمر النص: "تقييم 1 45000" */
async function handleEvalTextCommand(chatId: number, user: BotUser, text: string) {
  const isAllowed = await checkIsMaalamMgr(user.id);
  if (!isAllowed && !user.capabilities.isGeneralManager) return;

  // تقييم [رقم_الترتيب] [المبلغ]
  const match = text.match(/^تقييم\s+(\d+)\s+([\d,،.]+)/);
  if (!match) return;

  const idx = parseInt(match[1], 10) - 1;
  const price = Number(match[2].replace(/[,،.]/g, "").trim());

  if (isNaN(idx) || idx < 0 || isNaN(price) || price <= 0) {
    return sendMessage(chatId, "⚠️ صيغة غير صحيحة. مثال: <code>تقييم 1 45000</code>", { replyMarkup: menuKeyboard(user, true) });
  }

  await sendChatAction(chatId);
  const items = await getAllPendingEvaluations();

  if (idx >= items.length) {
    return sendMessage(chatId, `⚠️ لا يوجد طلب بالرقم ${idx + 1}.`, { replyMarkup: menuKeyboard(user, true) });
  }

  const item = items[idx];
  const admin = createAdminClient();

  await admin.from("trade_ins").update({ price, status: "تم التقييم" }).eq("id", item.trade_in_id);

  const priceFormatted = price.toLocaleString("en-US");

  await sendMessage(
    chatId,
    `✅ تم حفظ التقييم: <b>${escapeHtml(item.model)}</b> — <b>${priceFormatted} ₪</b>`,
    { replyMarkup: menuKeyboard(user, true) },
  );

  // إشعار للموظف
  if (item.staff_chat_id) {
    try {
      await sendMessage(
        Number(item.staff_chat_id),
        `✅ <b>تم تقييم السيارة</b>\n\n` +
        `👤 العميل: <b>${escapeHtml(item.customer_name)}</b>\n` +
        `🚗 السيارة: <b>${escapeHtml(item.model)}</b>\n` +
        `💰 قيمة التقييم: <b>${priceFormatted} ₪</b>\n` +
        `👨‍💼 المُقيِّم: <b>${escapeHtml(user.full_name)}</b>`,
      );
    } catch { /* best-effort */ }
  }

  if (item.staff_name) {
    await admin.from("notifications").insert({
      title: "تم تقييم السيارة",
      message: `سيارة العميل ${item.customer_name} (${item.model}) قُيِّمت بـ ${priceFormatted} شيقل`,
      notification_type: "evaluation",
      status: "unread",
      created_by_user_id: user.id,
    });
  }
}

// ─── Web App Data (sendData from Mini App) ────────────────────────────────────

async function handleWebAppData(chatId: number, user: BotUser, rawData: string) {
  await clearSession(String(chatId));
  try {
    const data = JSON.parse(rawData) as { action?: string; id?: string; name?: string };
    const appUrl = getAppUrl();

    if (data.action === "customer_saved" && data.id) {
      const customerName = data.name ? escapeHtml(data.name) : "العميل";
      const cardUrl = appUrl ? `${appUrl}/bot-app/customer?id=${data.id}&chat_id=${chatId}` : null;

      if (cardUrl) {
        await sendMessageWithWebApp(
          chatId,
          `✅ <b>تم حفظ العميل بنجاح!</b>\n👤 <b>${customerName}</b>\n\nاضغط لفتح بطاقة العميل:`,
          [{ text: "👤 فتح البطاقة", url: cardUrl }],
        );
      } else {
        await sendMessage(chatId, `✅ <b>تم حفظ العميل <b>${customerName}</b> بنجاح!</b>`);
      }
      return sendMessage(chatId, "اختر من القائمة:", { replyMarkup: menuKeyboard(user) });
    }

    if (data.action === "customer_updated") {
      const customerName = data.name ? escapeHtml(data.name) : "العميل";
      return sendMessage(
        chatId,
        `✅ <b>تم تحديث ملف ${customerName} بنجاح!</b>`,
        { replyMarkup: menuKeyboard(user) },
      );
    }

    if (data.action === "close") {
      return sendMessage(chatId, "🏠 القائمة الرئيسية:", { replyMarkup: menuKeyboard(user) });
    }
  } catch { /* تجاهل خطأ JSON */ }

  return sendMessage(chatId, "✅ تمت العملية بنجاح.", { replyMarkup: menuKeyboard(user) });
}

// ─── Back navigation handler ─────────────────────────────────────────────────

async function handleBack(chatId: number, user: BotUser) {
  const session = await getSession(String(chatId));
  const state = session.state;
  const d = session.data as Record<string, string>;
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;

  switch (state) {
    case "add_cust_name":
    case "add_cust_phone_exists":
      await setSession(String(chatId), "add_cust_phone", {});
      return sendMessage(chatId, "🔹 <b>الخطوة 1/9</b> — أدخل <b>رقم الهاتف</b>:", { replyMarkup: cancelKeyboard() });

    case "add_cust_nickname":
      await setSession(String(chatId), "add_cust_name", d);
      return sendMessage(chatId, `🔹 <b>الخطوة 2/${total}</b> — أعد إدخال <b>الاسم</b> (3 أحرف على الأقل):`, { replyMarkup: cancelKeyboard() });

    case "add_cust_optype":
      await setSession(String(chatId), "add_cust_nickname", d);
      return sendMessage(chatId, `🔹 <b>الخطوة 3/${total}</b> — أعد إدخال <b>الكنية/المدينة</b> (أو <code>-</code> للتخطي):`, { replyMarkup: cancelKeyboard() });

    case "add_cust_branch":
      await setSession(String(chatId), "add_cust_optype", d);
      return sendMessage(chatId, `🔹 <b>الخطوة 4/${total}</b> — أعد اختيار <b>نوع العملية</b>:`, { replyMarkup: selectionKeyboard(OP_LABELS, true, false) });

    case "add_cust_car":
    case "add_cust_trade_car": {
      if (isGM) {
        const branches: Array<{ id: string; name: string }> = d._branches ? (JSON.parse(d._branches) as Array<{ id: string; name: string }>) : [];
        await setSession(String(chatId), "add_cust_branch", d);
        return sendMessage(chatId, `🔹 <b>الخطوة 5/${total}</b> — أعد اختيار <b>المعرض</b>:`, { replyMarkup: selectionKeyboard(branches.map(b => b.name), true, false) });
      }
      await setSession(String(chatId), "add_cust_optype", d);
      return sendMessage(chatId, `🔹 <b>الخطوة 4/${total}</b> — أعد اختيار <b>نوع العملية</b>:`, { replyMarkup: selectionKeyboard(OP_LABELS, true, false) });
    }

    case "add_cust_status": {
      const prevCarState = d.cust_optype === "sell_on_behalf" ? "add_cust_trade_car" : "add_cust_car";
      const stepNum = isGM ? 6 : 5;
      await setSession(String(chatId), prevCarState, d);
      return sendMessage(chatId, `🔹 <b>الخطوة ${stepNum}/${total}</b> — أعد إدخال <b>السيارة</b>:`, { replyMarkup: backCancelKeyboard() });
    }

    case "add_cust_payment": {
      const statusList2 = STATUS_LISTS[d.cust_optype] ?? STATUS_LISTS.buyer;
      await setSession(String(chatId), "add_cust_status", d);
      return sendMessage(chatId, `🔹 <b>الخطوة ${isGM ? 7 : 6}/${total}</b> — أعد اختيار <b>الحالة</b>:`, { replyMarkup: selectionKeyboard(statusList2, true, false) });
    }

    case "add_cust_notes": {
      const statusList = STATUS_LISTS[d.cust_optype] ?? STATUS_LISTS.buyer;
      if (d.cust_status && needsPaymentMethod(d.cust_status)) {
        await setSession(String(chatId), "add_cust_payment", d);
        return sendMessage(chatId, `💳 <b>أعد اختيار طريقة الدفع:</b>`, { replyMarkup: selectionKeyboard(PAYMENT_METHOD_VALUES, true, true) });
      }
      await setSession(String(chatId), "add_cust_status", d);
      return sendMessage(chatId, `🔹 <b>الخطوة ${isGM ? 7 : 6}/${total}</b> — أعد اختيار <b>الحالة</b>:`, { replyMarkup: selectionKeyboard(statusList, true, false) });
    }

    case "add_cust_followup":
      await setSession(String(chatId), "add_cust_notes", d);
      return sendMessage(chatId, `🔹 <b>الخطوة ${isGM ? 8 : 7}/${total}</b> — أعد إدخال <b>الملاحظات</b> (أو <code>-</code> للتخطي):`, { replyMarkup: backCancelKeyboard() });

    case "add_cust_confirm":
      await setSession(String(chatId), "add_cust_followup", d);
      return sendMessage(chatId, `🔹 <b>الخطوة ${isGM ? 9 : 8}/${total}</b> — أعد تحديد <b>موعد المتابعة</b>:`, { replyMarkup: quickDateKeyboard() });

    default:
      // لا توجد خطوة سابقة — العودة للقائمة
      await clearSession(String(chatId));
      return sendMessage(chatId, "🏠 القائمة الرئيسية:", { replyMarkup: menuKeyboard(user) });
  }
}

// ─── Add Customer Wizard ─────────────────────────────────────────────────────

async function handleAddCustomerStart(chatId: number, user: BotUser) {
  await setSession(String(chatId), "add_cust_phone", {});
  return sendMessage(
    chatId,
    "➕ <b>إضافة عميل</b>\n\n🔹 <b>الخطوة 1/9</b> — أدخل <b>رقم الهاتف</b> (10 أرقام بالضبط):",
    { replyMarkup: cancelKeyboard() },
  );
}

// الخطوة 1 — رقم الهاتف مع فحص 10 أرقام والتحقق من الوجود
async function handleAddCustPhone(chatId: number, user: BotUser, phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length !== PHONE_LENGTH) {
    return sendMessage(
      chatId,
      `⚠️ رقم الهاتف يجب أن يكون <b>${PHONE_LENGTH} أرقام</b> بالضبط.\n\nأعد إدخال الرقم:`,
      { replyMarkup: cancelKeyboard() },
    );
  }

  await sendChatAction(chatId);
  const existing = await checkPhoneExists(normalized);

  if (existing) {
    // ── رقم موجود: رسالة واحدة تجمع المعلومات + الخيارات ──────────────
    await setSession(String(chatId), "add_cust_phone_exists", { checked_phone: normalized, existing_id: existing.id });
    const carInfo = existing.requested_car ? `\n🚗 ${escapeHtml(existing.requested_car)}` : "";
    const closedNote = existing.is_active === false ? "\n<i>⚫ ملف مغلق</i>" : "";
    const appUrl = getAppUrl();

    if (appUrl && existing.id) {
      // رسالة تجمع معلومات العميل + زر فتح البطاقة
      await sendMessageWithWebApp(
        chatId,
        `⚠️ <b>هذا الرقم مسجل مسبقاً</b>${closedNote}\n\n` +
        `👤 <b>${escapeHtml(existing.full_name)}</b>\n` +
        `📌 ${escapeHtml(existing.status)}${carInfo}\n\n` +
        `اضغط الزر لفتح بطاقة العميل، أو اختر من الأزرار أدناه:`,
        [{ text: "👤 فتح بطاقة العميل", url: `${appUrl}/bot-app/customer?id=${existing.id}&chat_id=${chatId}` }],
      );
    } else {
      await sendMessage(
        chatId,
        `⚠️ <b>هذا الرقم مسجل مسبقاً</b>${closedNote}\n\n` +
        `👤 <b>${escapeHtml(existing.full_name)}</b>\n` +
        `📌 ${escapeHtml(existing.status)}${carInfo}`,
      );
    }

    // رسالة ثانية بالخيارات المتاحة
    return sendMessage(
      chatId,
      `ماذا تريد أن تفعل؟`,
      { replyMarkup: selectionKeyboard(["📱 إدخال رقم آخر"], true, true) },
    );
  }

  // ── رقم جديد: رسالة واحدة تشرح الخيارين ──────────────────────────────
  await setSession(String(chatId), "add_cust_name", { cust_phone: normalized });
  const appUrl = getAppUrl();

  if (appUrl) {
    // رسالة واحدة: زر المني-آب + تعليمات للمتابعة خطوة بخطوة
    return sendMessageWithWebApp(
      chatId,
      `✅ الرقم <b>${escapeHtml(normalized)}</b> غير مسجل.\n\n` +
      `📋 <b>الفورم الكامل</b> (الأسرع) — اضغط الزر الأزرق ↑\n\n` +
      `✏️ أو <b>اكتب اسم العميل</b> هنا للمتابعة خطوة بخطوة:`,
      [{ text: "📋 فتح الفورم الكامل", url: `${appUrl}/bot-app/add-customer?chat_id=${chatId}&phone=${encodeURIComponent(normalized)}` }],
    );
  }

  return sendMessage(
    chatId,
    `✅ الرقم <b>${escapeHtml(normalized)}</b> غير مسجل.\n\n🔹 الخطوة 2/9 — أدخل <b>اسم العميل</b> (3 أحرف على الأقل):`,
    { replyMarkup: backCancelKeyboard() },
  );
}

// معالجة حالة الرقم الموجود مسبقاً
async function handleAddCustPhoneExists(chatId: number, user: BotUser, answer: string) {
  if (answer === "📱 إدخال رقم آخر") {
    await setSession(String(chatId), "add_cust_phone", {});
    return sendMessage(chatId, "🔹 الخطوة 1/9 — أدخل <b>رقم الهاتف</b> الجديد (10 أرقام):", { replyMarkup: cancelKeyboard() });
  }
  await clearSession(String(chatId));
  return sendMessage(chatId, "✅ تم الإلغاء.", { replyMarkup: menuKeyboard(user) });
}

// الخطوة 2 — الاسم
async function handleAddCustName(chatId: number, user: BotUser, name: string, sessionData: Record<string, string>) {
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  if (name.trim().length < 3) {
    return sendMessage(chatId, "⚠️ الاسم يجب أن يكون <b>3 أحرف على الأقل</b>. أعد الإدخال:", {
      replyMarkup: backCancelKeyboard(),
    });
  }
  await setSession(String(chatId), "add_cust_nickname", { ...sessionData, cust_name: name.trim() });
  return sendMessage(
    chatId,
    `✅ الاسم: <b>${escapeHtml(name.trim())}</b>\n\n🔹 <b>الخطوة 3/${total}</b> — أدخل <b>الكنية / المدينة</b>\n(أو أرسل <code>-</code> للتخطي):`,
    { replyMarkup: backCancelKeyboard() },
  );
}

// الخطوة 3 — الكنية
async function handleAddCustNickname(chatId: number, user: BotUser, nickname: string, sessionData: Record<string, string>) {
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  const val = nickname.trim() === "-" ? "" : nickname.trim();
  await setSession(String(chatId), "add_cust_optype", { ...sessionData, cust_nickname: val });
  return sendMessage(
    chatId,
    `🔹 <b>الخطوة 4/${total}</b> — اختر <b>نوع العملية</b>:`,
    { replyMarkup: selectionKeyboard(OP_LABELS, true, true) },
  );
}

// الخطوة 4 — نوع العملية
async function handleAddCustOpType(chatId: number, user: BotUser, answer: string, sessionData: Record<string, string>) {
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  const opType = getOpTypeValue(answer);
  if (!opType) {
    return sendMessage(chatId, "⚠️ اختر نوع العملية من القائمة:", {
      replyMarkup: selectionKeyboard(OP_LABELS, true, true),
    });
  }
  const nextData = { ...sessionData, cust_optype: opType };

  // المدير العام يختار المعرض
  if (isGM) {
    await sendChatAction(chatId);
    const branches = await getBranches();
    const branchNames = branches.map((b) => b.name);
    await setSession(String(chatId), "add_cust_branch", {
      ...nextData,
      _branches: JSON.stringify(branches),
    });
    return sendMessage(
      chatId,
      `🔹 <b>الخطوة 5/${total}</b> — اختر <b>المعرض</b>:`,
      { replyMarkup: selectionKeyboard(branchNames, true, true) },
    );
  }

  return proceedToCarStep(chatId, user, { ...nextData, cust_branch_id: user.branch_id ?? "" }, 5);
}

// الخطوة 5 (للمدير العام) — المعرض
async function handleAddCustBranch(chatId: number, user: BotUser, branchName: string, sessionData: Record<string, string>) {
  const branches: Array<{ id: string; name: string }> = sessionData._branches
    ? (JSON.parse(sessionData._branches) as Array<{ id: string; name: string }>)
    : [];
  const branch = branches.find((b) => b.name === branchName);
  if (!branch) {
    return sendMessage(chatId, "⚠️ اختر المعرض من القائمة:", {
      replyMarkup: selectionKeyboard(branches.map((b) => b.name), true, true),
    });
  }
  return proceedToCarStep(chatId, user, { ...sessionData, cust_branch_id: branch.id, _branches: "" }, 6);
}

// الانتقال لخطوة السيارة حسب نوع العملية
async function proceedToCarStep(chatId: number, user: BotUser, sessionData: Record<string, string>, stepNum: number) {
  const opType = sessionData.cust_optype;

  const isGM2 = user.capabilities.isGeneralManager;
  const total2 = isGM2 ? 10 : 9;

  if (opType === "sell_on_behalf") {
    await setSession(String(chatId), "add_cust_trade_car", sessionData);
    return sendMessage(
      chatId,
      `🔹 <b>الخطوة ${stepNum}/${total2}</b> — أدخل <b>نوع سيارة العميل</b> (المراد بيعها):\n<i>مثال: تويوتا كامري 2020</i>\n\nأو أرسل <code>-</code> للتخطي:`,
      { replyMarkup: backCancelKeyboard() },
    );
  }

  // مشتري / مشتري+استبدال — جلب السيارات المتوفرة
  await sendChatAction(chatId);
  const { items: allCars } = await getInventory(user);
  const available = allCars
    .filter((c) => c.availability_status === "متوفرة")
    .slice(0, 8);

  await setSession(String(chatId), "add_cust_car", sessionData);

  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;

  if (available.length > 0) {
    const carOptions = available.map(
      (c) => `🚗 ${c.model}${c.production_year ? ` ${c.production_year}` : ""}${c.color ? ` — ${c.color}` : ""}`,
    );
    carOptions.push("✏️ إدخال يدوي");
    carOptions.push("⏭ تخطي");
    return sendMessage(
      chatId,
      `🔹 <b>الخطوة ${stepNum}/${total}</b> — اختر <b>السيارة المطلوبة</b> من المخزون أو أدخل يدوياً:`,
      { replyMarkup: selectionKeyboard(carOptions, true, true) },
    );
  }

  // لا توجد سيارات متوفرة — إدخال يدوي
  return sendMessage(
    chatId,
    `🔹 <b>الخطوة ${stepNum}/${total}</b> — أدخل <b>السيارة المطلوبة</b>:\n<i>مثال: كيا سيراتو 2022</i>\n\nأو أرسل <code>-</code> للتخطي:`,
    { replyMarkup: backCancelKeyboard() },
  );
}

// خطوة السيارة المطلوبة (مشتري/استبدال)
async function handleAddCustCar(chatId: number, user: BotUser, car: string, sessionData: Record<string, string>) {
  const trimmed = car.trim();

  // "✏️ إدخال يدوي" → اطلب نصاً
  if (trimmed === "✏️ إدخال يدوي") {
    return sendMessage(
      chatId,
      "أدخل اسم السيارة المطلوبة:\n<i>مثال: كيا سيراتو 2022</i>",
      { replyMarkup: cancelKeyboard() },
    );
  }

  // تخطي
  const carVal =
    trimmed === "⏭ تخطي" || trimmed === "-"
      ? ""
      : trimmed.startsWith("🚗 ")
        ? trimmed.slice("🚗 ".length)  // تنظيف emoji من زر القائمة
        : trimmed;

  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  await setSession(String(chatId), "add_cust_status", { ...sessionData, cust_car: carVal });
  return askForStatus(chatId, sessionData.cust_optype, isGM ? 7 : 6, total);
}

// خطوة سيارة العميل (بيع بالوكالة)
async function handleAddCustTradeCar(chatId: number, user: BotUser, car: string, sessionData: Record<string, string>) {
  const carVal = car.trim() === "-" ? "" : car.trim();
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  await setSession(String(chatId), "add_cust_status", { ...sessionData, cust_trade_car: carVal });
  return askForStatus(chatId, sessionData.cust_optype, isGM ? 7 : 6, total);
}

function askForStatus(chatId: number, opType: string, stepNum: number, total: number) {
  const statuses = STATUS_LISTS[opType] ?? STATUS_LISTS.buyer;
  return sendMessage(
    chatId,
    `🔹 <b>الخطوة ${stepNum}/${total}</b> — اختر <b>حالة العميل</b>:`,
    { replyMarkup: selectionKeyboard(statuses, true, true) },
  );
}

// خطوة الحالة
async function handleAddCustStatus(chatId: number, user: BotUser, status: string, sessionData: Record<string, string>) {
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  const validStatuses = STATUS_LISTS[sessionData.cust_optype] ?? STATUS_LISTS.buyer;
  if (!validStatuses.includes(status)) {
    return sendMessage(chatId, "⚠️ اختر الحالة من القائمة:", {
      replyMarkup: selectionKeyboard(validStatuses, true, true),
    });
  }
  const newData = { ...sessionData, cust_status: status };
  if (needsPaymentMethod(status)) {
    await setSession(String(chatId), "add_cust_payment", newData);
    return sendMessage(
      chatId,
      `✅ الحالة: <b>${escapeHtml(status)}</b>\n\n💳 <b>اختر طريقة الدفع:</b>`,
      { replyMarkup: selectionKeyboard(PAYMENT_METHOD_VALUES, true, true) },
    );
  }
  await setSession(String(chatId), "add_cust_notes", newData);
  return sendMessage(
    chatId,
    `✅ الحالة: <b>${escapeHtml(status)}</b>\n\n🔹 <b>الخطوة ${isGM ? 8 : 7}/${total}</b> — أدخل <b>الملاحظات</b>\n(أو أرسل <code>-</code> للتخطي):`,
    { replyMarkup: backCancelKeyboard() },
  );
}

// خطوة طريقة الدفع (تظهر فقط عند حالات البيع/الحجز)
async function handleAddCustPayment(chatId: number, user: BotUser, payment: string, sessionData: Record<string, string>) {
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 11 : 10;
  const validPayment = payment.trim() === "-" ? "" : payment.trim();
  if (validPayment && !PAYMENT_METHOD_VALUES.includes(validPayment as (typeof PAYMENT_METHOD_VALUES)[number])) {
    return sendMessage(chatId, "⚠️ اختر طريقة الدفع من القائمة:", {
      replyMarkup: selectionKeyboard(PAYMENT_METHOD_VALUES, true, true),
    });
  }
  await setSession(String(chatId), "add_cust_notes", { ...sessionData, cust_payment: validPayment });
  return sendMessage(
    chatId,
    `✅ طريقة الدفع: <b>${escapeHtml(validPayment || "—")}</b>\n\n🔹 <b>الخطوة ${isGM ? 9 : 8}/${total}</b> — أدخل <b>الملاحظات</b>\n(أو أرسل <code>-</code> للتخطي):`,
    { replyMarkup: backCancelKeyboard() },
  );
}

// خطوة الملاحظات
async function handleAddCustNotes(chatId: number, user: BotUser, notes: string, sessionData: Record<string, string>) {
  const notesVal = notes.trim() === "-" ? "" : notes.trim();
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  await setSession(String(chatId), "add_cust_followup", { ...sessionData, cust_notes: notesVal });
  return sendMessage(
    chatId,
    `🔹 <b>الخطوة ${isGM ? 9 : 8}/${total}</b> — اختر <b>تاريخ المتابعة القادمة</b>:\n<i>أو اكتب التاريخ يدوياً: YYYY-MM-DD</i>`,
    { replyMarkup: quickDateKeyboard() },
  );
}

// خطوة تاريخ المتابعة
async function handleAddCustFollowup(chatId: number, user: BotUser, dateStr: string, sessionData: Record<string, string>) {
  const trimmed = dateStr.trim();
  let followup: string | null = null;

  // محاولة تحليل التاريخ (من زر أو نص)
  if (trimmed !== "-" && trimmed) {
    followup = parseDateInput(trimmed);
    if (!followup) {
      return sendMessage(
        chatId,
        `⚠️ صيغة غير صحيحة. اختر من الأزرار أو اكتب <code>YYYY-MM-DD</code>:`,
        { replyMarkup: quickDateKeyboard() },
      );
    }
  }
  if (!followup) followup = defaultFollowupDate();
  const finalData = { ...sessionData, cust_followup: followup };
  await setSession(String(chatId), "add_cust_confirm", finalData);
  return showWizardSummary(chatId, user, finalData);
}

function showWizardSummary(chatId: number, user: BotUser, d: Record<string, string>) {
  let summary = `📋 <b>ملخص العميل الجديد:</b>\n\n`;
  summary += `📱 الهاتف: <b>${escapeHtml(d.cust_phone ?? "")}</b>\n`;
  summary += `👤 الاسم: <b>${escapeHtml(d.cust_name ?? "")}</b>\n`;
  if (d.cust_nickname) summary += `🏷 الكنية: <b>${escapeHtml(d.cust_nickname)}</b>\n`;
  summary += `🔖 نوع العملية: <b>${getOpTypeLabel(d.cust_optype ?? "")}</b>\n`;
  summary += `📌 الحالة: <b>${escapeHtml(d.cust_status ?? "")}</b>\n`;
  if (d.cust_car)       summary += `🚗 السيارة المطلوبة: <b>${escapeHtml(d.cust_car)}</b>\n`;
  if (d.cust_trade_car) summary += `🚗 سيارة العميل: <b>${escapeHtml(d.cust_trade_car)}</b>\n`;
  if (d.cust_payment)   summary += `💳 طريقة الدفع: <b>${escapeHtml(d.cust_payment)}</b>\n`;
  if (d.cust_notes)     summary += `📝 الملاحظات: <b>${escapeHtml(d.cust_notes)}</b>\n`;
  summary += `📅 المتابعة: <b>${d.cust_followup ?? ""}</b>\n`;
  const isGM = user.capabilities.isGeneralManager;
  const total = isGM ? 10 : 9;
  summary += `\n🔹 <b>الخطوة ${total}/${total}</b> — هل تريد الحفظ؟`;

  return sendMessage(chatId, summary, {
    replyMarkup: selectionKeyboard(["✅ حفظ"], true, true),
  });
}

// تأكيد الحفظ
async function handleAddCustConfirm(chatId: number, user: BotUser, answer: string, sessionData: Record<string, string>) {
  if (answer !== "✅ حفظ") {
    await clearSession(String(chatId));
    return sendMessage(chatId, "❌ تم الإلغاء.", { replyMarkup: menuKeyboard(user) });
  }

  await sendChatAction(chatId);
  const branchId = sessionData.cust_branch_id || user.branch_id || null;

  const { error } = await createCustomer(user, {
    full_name:        sessionData.cust_name ?? "",
    phone:            sessionData.cust_phone ?? "",
    nickname:         sessionData.cust_nickname || null,
    operation_type:   sessionData.cust_optype ?? "buyer",
    status:           sessionData.cust_status ?? "جديد",
    requested_car:    sessionData.cust_car || null,
    trade_in_model:   sessionData.cust_trade_car || null,
    payment_method:   sessionData.cust_payment || null,
    notes:            sessionData.cust_notes || null,
    next_follow_up_at: sessionData.cust_followup || null,
    branch_id:        branchId,
  });

  await clearSession(String(chatId));

  if (error) {
    return sendMessage(chatId, `⚠️ خطأ في الحفظ: ${escapeHtml(String(error.message))}`, {
      replyMarkup: menuKeyboard(user),
    });
  }

  return sendMessage(
    chatId,
    `✅ <b>تم إضافة العميل بنجاح!</b>\n\n` +
    `👤 ${escapeHtml(sessionData.cust_name ?? "")}\n` +
    `📱 ${escapeHtml(sessionData.cust_phone ?? "")}\n` +
    `🔖 ${getOpTypeLabel(sessionData.cust_optype ?? "")}`,
    { replyMarkup: menuKeyboard(user) },
  );
}

// ─── Send Message to Staff Wizard ────────────────────────────────────────────

async function handleMsgStaffStart(chatId: number, user: BotUser) {
  if (!user.capabilities.isManager) {
    return sendMessage(chatId, "⛔ هذا الأمر متاح للمديرين فقط.", {
      replyMarkup: menuKeyboard(user),
    });
  }

  await sendChatAction(chatId);
  const staff = await getStaffList(user);

  // Filter out self
  const others = staff.filter((s) => s.id !== user.id);

  if (others.length === 0) {
    return sendMessage(chatId, "👨‍💼 لا يوجد موظفون آخرون لإرسال رسالة إليهم.", {
      replyMarkup: menuKeyboard(user),
    });
  }

  await setSession(String(chatId), "msg_pick_recipient", {});
  const names = others.map((s) => s.full_name);
  return sendMessage(
    chatId,
    "📢 <b>إرسال رسالة للموظفين</b>\n\nاختر المستلم:",
    { replyMarkup: selectionKeyboard(names) },
  );
}

async function handleMsgPickRecipient(
  chatId: number,
  user: BotUser,
  recipientName: string,
) {
  await sendChatAction(chatId);
  const staff = await getStaffList(user);
  const recipient = staff.find((s) => s.full_name === recipientName);

  if (!recipient) {
    const names = staff.filter((s) => s.id !== user.id).map((s) => s.full_name);
    return sendMessage(chatId, "⚠️ اختر من القائمة:", {
      replyMarkup: selectionKeyboard(names),
    });
  }

  await setSession(String(chatId), "msg_write", {
    msg_recipient_id: recipient.id,
    msg_recipient_name: recipient.full_name,
  });

  return sendMessage(
    chatId,
    `📢 <b>رسالة إلى: ${escapeHtml(recipient.full_name)}</b>\n\nاكتب الرسالة:`,
    { replyMarkup: cancelKeyboard() },
  );
}

async function handleMsgWrite(
  chatId: number,
  user: BotUser,
  message: string,
  sessionData: Record<string, string>,
) {
  if (!message.trim()) {
    return sendMessage(chatId, "⚠️ الرسالة لا يمكن أن تكون فارغة. اكتب الرسالة:", {
      replyMarkup: cancelKeyboard(),
    });
  }

  await sendChatAction(chatId);
  const { telegram_chat_id } = await sendMessageToStaff(
    user,
    sessionData.msg_recipient_id,
    message.trim(),
  );

  await clearSession(String(chatId));

  // Forward via Telegram if the recipient has a linked chat
  if (telegram_chat_id) {
    await sendMessage(
      Number(telegram_chat_id),
      `📢 <b>رسالة من ${escapeHtml(user.full_name)}</b>\n\n${escapeHtml(message.trim())}`,
    );
  }

  return sendMessage(
    chatId,
    `✅ <b>تم إرسال الرسالة إلى ${escapeHtml(sessionData.msg_recipient_name)}.</b>`,
    { replyMarkup: menuKeyboard(user) },
  );
}

// ─── Voice message handler ────────────────────────────────────────────────────

const VOICE_BUCKET = "voice-notes";
const PHOTO_BUCKET = "customer-attachments";

async function handleVoiceMessage(
  chatId: number,
  user: BotUser,
  voice: NonNullable<NonNullable<TelegramUpdate["message"]>["voice"]>,
) {
  const durationSec = voice.duration;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  // ── تحقق من وجود جلسة ربط بعميل محدد ──
  const session = await getSession(String(chatId));
  if (session.state === "voice_note_for_customer" && session.data.customer_id) {
    const customerId = session.data.customer_id;
    const customerName = session.data.customer_name ?? "عميل";
    await clearSession(String(chatId));

    try {
      // تحميل الملف من Telegram
      const fileUrl = await getTelegramFileUrl(voice.file_id);
      if (fileUrl) {
        const resp = await fetch(fileUrl);
        const buffer = Buffer.from(await resp.arrayBuffer());
        const ext = (voice.mime_type ?? "audio/ogg").includes("mp4") ? "m4a" : "ogg";
        const fileName = `bot_voice_${Date.now()}.${ext}`;
        const storagePath = `${customerId}/${fileName}`;

        const admin = createAdminClient();

        // ضمان وجود الـ bucket (voice-notes عام)
        try {
          const { data: bkt } = await admin.storage.getBucket(VOICE_BUCKET);
          if (!bkt) await admin.storage.createBucket(VOICE_BUCKET, { public: true, fileSizeLimit: 52428800 });
        } catch { /* ignored */ }

        const { error: upErr } = await admin.storage
          .from(VOICE_BUCKET)
          .upload(storagePath, buffer, { contentType: voice.mime_type ?? "audio/ogg", upsert: false });

        if (upErr) {
          console.error("[voiceNote] storage upload failed:", upErr.message);
        } else {
          const { data: { publicUrl } } = admin.storage.from(VOICE_BUCKET).getPublicUrl(storagePath);

          // حفظ في customer_attachments
          const { error: attErr } = await admin.from("customer_attachments").insert({
            customer_id: customerId,
            file_name: fileName,
            file_category: "voice_note",
            storage_path: `${VOICE_BUCKET}/${storagePath}`,
            public_url: publicUrl,
            mime_type: voice.mime_type ?? "audio/ogg",
            file_size_bytes: voice.file_size ?? buffer.length,
            uploaded_by_user_id: user.id,
            metadata: { source: "telegram_bot", duration_sec: durationSec },
          });

          if (attErr) console.error("[voiceNote] customer_attachments insert failed:", attErr.message, attErr.details);

          // تسجيل في customer_logs
          const { error: logErr } = await admin.from("customer_logs").insert({
            customer_id: customerId,
            action: "voice_note_added",
            details: `🎤 تسجيل صوتي من البوت — المدة: ${durationStr} — بواسطة ${user.full_name}`,
            actor_user_id: user.id,
            actor_name: user.full_name,
          });

          if (logErr) console.error("[voiceNote] customer_logs insert failed:", logErr.message);

          if (!attErr) {
            return sendMessage(
              chatId,
              `✅ <b>تم حفظ التسجيل الصوتي (${durationStr})</b> في ملف <b>${escapeHtml(customerName)}</b> وظهر في السجل التاريخي.`,
              { replyMarkup: menuKeyboard(user) },
            );
          }
        }
      }
    } catch (err) {
      console.error("[voiceNote] failed:", err);
    }

    return sendMessage(
      chatId,
      `⚠️ تعذّر حفظ التسجيل الصوتي في ملف العميل. حاول مرة أخرى.`,
      { replyMarkup: menuKeyboard(user) },
    );
  }

  // ── لا يوجد عميل محدد — أرسل للمديرين كما كان ──
  void pushTelegramVoiceToManagers({
    branchId: user.branch_id ?? null,
    caption:
      `🎤 <b>رسالة صوتية من البوت</b>\n` +
      `👤 الموظف: ${escapeHtml(user.full_name)}\n` +
      `⏱ المدة: ${durationStr}`,
    voiceUrl: voice.file_id,
  });

  const appUrl = getAppUrl();
  if (appUrl) {
    return sendMessageWithWebApp(
      chatId,
      `✅ <b>تم استلام تسجيلك الصوتي (${durationStr})</b>\n\nتم إرساله للمدير.\n💡 ابحث عن عميل أولاً لإرفاق التسجيل بملفه.`,
      [{ text: "🌐 فتح النظام", url: `${appUrl}/dashboard` }],
    );
  }

  return sendMessage(
    chatId,
    `✅ <b>تم استلام تسجيلك الصوتي (${durationStr})</b>\n\nتم إرساله للمدير.\n💡 ابحث عن عميل أولاً لإرفاق التسجيل بملفه.`,
    { replyMarkup: menuKeyboard(user) },
  );
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate) {
  // ── Callback query (inline button press) ──────────────────────────────────
  if (update.callback_query) {
    const cq     = update.callback_query;
    const chatId = cq.message?.chat.id ?? cq.from.id;
    let toastText = undefined;
    if (cq.data?.startsWith("inv_")) toastText = "⏳ جاري جلب السيارات...";
    else if (cq.data?.startsWith("invcar:")) toastText = "⏳ جاري إعداد البطاقة...";
    else if (cq.data?.startsWith("my_")) toastText = "⏳ جاري جلب العملاء...";
    else if (cq.data?.startsWith("history:")) toastText = "⏳ جاري جلب السجل...";
    else if (cq.data === "inventory_menu") toastText = "🏠 العودة للمخزون";
    else if (cq.data === "main_menu") toastText = "🏠 القائمة الرئيسية";
    await answerCallbackQuery(cq.id, toastText);

    let user: BotUser | null = null;
    try { user = await getBotUser(String(chatId)); } catch { /* */ }
    if (!user) return;

    if (cq.data === "main_menu") {
      let toastText = "🏠 القائمة الرئيسية";
      await answerCallbackQuery(cq.id, toastText);
      await clearSession(String(chatId));
      return sendMainMenu(chatId, user);
    }

    // زر "تم" للتذكير
    if (cq.data?.startsWith("done_reminder:")) {
      const reminderId = cq.data.slice("done_reminder:".length);
      const appUrl = getAppUrl();
      if (appUrl) {
        await fetch(`${appUrl}/api/bot-app/reminder-done`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: String(chatId), reminder_id: reminderId }),
        });
      }
      return sendMessage(chatId, "✅ تم وضع علامة \"منجز\" على التذكير.", { replyMarkup: menuKeyboard(user) });
    }

    // زر "إرسال قيمة التقييم" من رسالة التقييم
    if (cq.data?.startsWith("er:")) {
      const tradeInId = cq.data.slice(3); // "er:" = 3 chars
      return handleEvalReplyCallback(chatId, user, tradeInId);
    }
    // دعم الصيغة القديمة للتوافق (eval_reply:tradeId:...:...)
    if (cq.data?.startsWith("eval_reply:")) {
      const parts = cq.data.slice("eval_reply:".length).split(":");
      return handleEvalReplyCallback(chatId, user, parts[0] ?? "");
    }

    // زر السجل التاريخي للملف
    if (cq.data?.startsWith("history:")) {
      const customerId = cq.data.slice("history:".length);
      const logSection = await buildCustomerLogSection(customerId, 10);
      const text = logSection.trim() !== ""
        ? logSection
        : "📜 لا يوجد سجل تاريخي متوفر لهذا الملف حالياً.";
      const messageId = cq.message?.message_id;
      return sendMessage(chatId, text, {
        replyToMessageId: messageId,
      });
    }

    // أزرار فئات المخزون (سيارات جديدة، مستعملة، متوفرة...)
    if (cq.data?.startsWith("inv_")) {
      const parts = cq.data.split("_");
      // Format: inv_{category}_{page} or just inv_{category}
      const category = parts[1] + (parts[2] && !parseInt(parts[2]) ? "_" + parts[2] : ""); // handle "new_avail" etc
      const pageStr = parts[parts.length - 1];
      const page = !isNaN(parseInt(pageStr)) ? parseInt(pageStr) : 0;
      let actualCat = cq.data.slice(4);
      if(!isNaN(parseInt(pageStr))) actualCat = cq.data.slice(4, cq.data.lastIndexOf("_"));
      return handleInventoryCategory(chatId, user, actualCat, cq.message?.message_id, page);
    }

    // العودة لقائمة المخزون الرئيسية
        if (cq.data === "my_customers") {
      return handleMy(chatId, user, cq.message?.message_id);
    }

    if (cq.data === "inventory_menu") {
      return handleInventory(chatId, user, cq.message?.message_id);
    }

    // زر سيارة محددة في المخزون
    if (cq.data?.startsWith("invcar:")) {
      const carId = cq.data.slice("invcar:".length);
      return handleSendCarCard(chatId, user, carId);
    }

    // أزرار فئات عملائي
    if (cq.data?.startsWith("my_")) {
      const parts = cq.data.split("_");
      const pageStr = parts[parts.length - 1];
      const page = !isNaN(parseInt(pageStr)) ? parseInt(pageStr) : 0;
      let actualCat = cq.data.slice(3);
      if(!isNaN(parseInt(pageStr))) actualCat = cq.data.slice(3, cq.data.lastIndexOf("_"));
      return handleMyCategory(chatId, user, actualCat, cq.message?.message_id, page);
    }

    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;

  // ── /start — before auth ─────────────────────────────────────────
  if (message.text?.trim() === "/start") {
    const user = await getBotUser(String(chatId)).catch(() => null);
    return handleStart(chatId, user);
  }

  // ── Authenticate ──
  let user: BotUser | null = null;
  try {
    user = await getBotUser(String(chatId));
  } catch {
    return sendMessage(chatId, "⚠️ تعذر الاتصال بالنظام. حاول لاحقاً.");
  }

  if (!user) {
    return sendMessage(
      chatId,
      `⚠️ حسابك غير مرتبط بالنظام.\n\n🔑 <b>معرّفك:</b> <code>${chatId}</code>\n\nأرسل هذا الرقم لمدير النظام.`,
    );
  }

  // ── Voice / Audio message ──────────────────────────────────────────
  if (message.voice) {
    return handleVoiceMessage(chatId, user, message.voice);
  }
  if (message.audio) {
    return handleVoiceMessage(chatId, user, {
      file_id: message.audio.file_id,
      duration: message.audio.duration,
      mime_type: message.audio.mime_type,
    });
  }

  // ── Photo message ─────────────────────────────────────────────────
  if (message.photo && message.photo.length > 0) {
    const session = await getSession(String(chatId));
    if (session.state === "voice_note_for_customer" && session.data.customer_id) {
      const customerId = session.data.customer_id;
      const customerName = session.data.customer_name ?? "عميل";
      // Don't clear session — allow more photos or voice to follow
      try {
        const admin = createAdminClient();
        // Use highest resolution photo
        const photo = message.photo[message.photo.length - 1];
        const fileUrl = await getTelegramFileUrl(photo.file_id);
        if (fileUrl) {
          const resp = await fetch(fileUrl);
          const buffer = Buffer.from(await resp.arrayBuffer());
          const storagePath = `photos/${customerId}/bot_${Date.now()}.jpg`;
          const { error: upErr } = await admin.storage
            .from(PHOTO_BUCKET)
            .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false });
          if (!upErr) {
            // رابط موقَّع لمدة سنة (الصور خاصة)
            const { data: signData } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 365);
            const publicUrl = signData?.signedUrl ?? admin.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
            await admin.from("customer_attachments").insert({
              customer_id: customerId,
              file_name: `bot_photo_${Date.now()}.jpg`,
              file_category: "trade_photo",
              storage_path: `${PHOTO_BUCKET}/${storagePath}`,
              public_url: publicUrl,
              mime_type: "image/jpeg",
              file_size_bytes: buffer.length,
              uploaded_by_user_id: user.id,
              metadata: { source: "telegram_bot" },
            });
            await admin.from("customer_logs").insert({
              customer_id: customerId,
              action: "photo_added",
              details: `📷 صورة مرفقة من البوت — بواسطة ${user.full_name}`,
              actor_user_id: user.id,
              actor_name: user.full_name,
            });
            return sendMessage(
              chatId,
              `✅ تم حفظ الصورة في ملف <b>${escapeHtml(customerName)}</b> وظهرت في السجل التاريخي.\n\nيمكنك إرسال المزيد من الصور أو تسجيل صوتي لنفس العميل.`,
              { replyMarkup: menuKeyboard(user) },
            );
          }
        }
      } catch (err) {
        console.error("[photoHandler] failed:", err);
      }
      return sendMessage(chatId, `⚠️ تعذّر حفظ الصورة. حاول مرة أخرى.`, { replyMarkup: menuKeyboard(user) });
    }
    // No customer context — prompt to search first
    return sendMessage(
      chatId,
      `📷 لإرفاق صورة بملف عميل، ابحث عن العميل أولاً باستخدام زر البحث.`,
      { replyMarkup: menuKeyboard(user) },
    );
  }

  // ── Mini App sendData callback ────────────────────────────────────────
  if (message.web_app_data) {
    return handleWebAppData(chatId, user, message.web_app_data.data);
  }

  if (!message.text) return;
  const text = message.text.trim();

  // ── Cancel always works ──
  if (text === BTN.CANCEL) {
    return handleCancel(chatId, user);
  }

  // ── Home always works (إلغاء + قائمة رئيسية) ──
  if (text === BTN.HOME) {
    await clearSession(String(chatId));
    return sendMessage(chatId, "🏠 القائمة الرئيسية:", { replyMarkup: menuKeyboard(user) });
  }

  // ── Read session state ──
  const session = await getSession(String(chatId));

  // ── Back in wizard ──
  if (text === BTN.BACK && session.state !== "idle") {
    return handleBack(chatId, user);
  }

  // ── Wizard state machine ──
  if (session.state !== "idle") {
    // أزرار القائمة الرئيسية تكسر الـ wizard وتُنفَّذ مباشرة
    const MENU_BUTTONS: string[] = [BTN.TODAY, BTN.MY, BTN.SEARCH, BTN.CARD, BTN.INVENTORY, BTN.NOTIFS, BTN.REPORT, BTN.ADD_CUST, BTN.MSG_STAFF, BTN.STAFF, BTN.EVAL];
    if (MENU_BUTTONS.includes(text)) {
      await clearSession(String(chatId));
      // لا نرجع هنا — نترك الكود يتابع لـ switch الأزرار أدناه
    } else {

    const d = session.data as Record<string, string>;
    switch (session.state) {
      case "card_search":
        return handleCardSearchQuery(chatId, user, text);
      case "add_cust_phone":
        return handleAddCustPhone(chatId, user, text);
      case "add_cust_phone_exists":
        return handleAddCustPhoneExists(chatId, user, text);
      case "add_cust_name":
        return handleAddCustName(chatId, user, text, d);
      case "add_cust_nickname":
        return handleAddCustNickname(chatId, user, text, d);
      case "add_cust_optype":
        return handleAddCustOpType(chatId, user, text, d);
      case "add_cust_branch":
        return handleAddCustBranch(chatId, user, text, d);
      case "add_cust_car":
        return handleAddCustCar(chatId, user, text, d);
      case "add_cust_trade_car":
        return handleAddCustTradeCar(chatId, user, text, d);
      case "add_cust_status":
        return handleAddCustStatus(chatId, user, text, d);
      case "add_cust_payment":
        return handleAddCustPayment(chatId, user, text, d);
      case "add_cust_notes":
        return handleAddCustNotes(chatId, user, text, d);
      case "add_cust_followup":
        return handleAddCustFollowup(chatId, user, text, d);
      case "add_cust_confirm":
        return handleAddCustConfirm(chatId, user, text, d);
      case "msg_pick_recipient":
        return handleMsgPickRecipient(chatId, user, text);
      case "msg_write":
        return handleMsgWrite(chatId, user, text, d);
      case "eval_reply_price":
        return handleEvalReplyPrice(chatId, user, text, d);
      case "voice_note_for_customer":
        // المستخدم أرسل نصاً بدل صوت — ننبهه
        return sendMessage(
          chatId,
          `⚠️ أرسل <b>رسالة صوتية</b> لإرفاقها بملف <b>${escapeHtml(d.customer_name ?? "العميل")}</b>، أو اضغط إلغاء.`,
          { replyMarkup: cancelKeyboard() },
        );
    }
    } // end else (not a menu button)
  }

  // ── Handle search reply (ForceReply response) ──
  if (message.reply_to_message?.text?.includes("اكتب الاسم أو رقم الهاتف")) {
    if (session.state === "card_search") {
      return handleCardSearchQuery(chatId, user, text);
    }
    return handleSearchQuery(chatId, user, text);
  }

  // ── Button presses (Reply Keyboard) ──
  switch (text) {
    case BTN.TODAY:
      return handleToday(chatId, user);
    case BTN.MY:
      return handleMy(chatId, user);
    case BTN.CARD:
      return handleCardSearchPrompt(chatId);
    case BTN.SEARCH:
      return handleSearchPrompt(chatId, user);
    case BTN.REPORT:
      return handleReport(chatId, user);
    case BTN.ADD_CUST:
      return handleAddCustomerStart(chatId, user);
    case BTN.INVENTORY:
      return handleInventory(chatId, user);
    case BTN.NOTIFS:
      return handleNotifications(chatId, user);
    case BTN.MSG_STAFF:
      return handleMsgStaffStart(chatId, user);
    case BTN.STAFF:
      return handleStaff(chatId, user);
    case BTN.EVAL:
      return handleEvalRequests(chatId, user);
  }

  // ── Text commands (fallback) ──
  const [rawCmd, ...args] = text.split(" ");
  const cmd = rawCmd.split("@")[0].toLowerCase();

  switch (cmd) {
    case "/today":
      return handleToday(chatId, user);
    case "/my":
      return handleMy(chatId, user);
    case "/search":
      return args.length
        ? handleSearchQuery(chatId, user, args.join(" "))
        : handleSearchPrompt(chatId, user);
    case "/report":
      return handleReport(chatId, user);
    case "/add":
      return handleAddCustomerStart(chatId, user);
    case "/inventory":
      return handleInventory(chatId, user);
    case "/notifs":
      return handleNotifications(chatId, user);
    case "/staff":
      return handleStaff(chatId, user);
    case "/eval":
      return handleEvalRequests(chatId, user);
    default:
      // أمر نصي: "تقييم رقم مبلغ"
      if (/^تقييم\s+\d+\s+[\d,،.]+/.test(text)) {
        return handleEvalTextCommand(chatId, user, text);
      }
      return sendMessage(
        chatId,
        "اختر من القائمة أدناه 👇",
        { replyMarkup: menuKeyboard(user) },
      );
  }
}
