const getBaseUrl = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

type ReplyKeyboardMarkup = {
  keyboard: string[][];
  resize_keyboard: boolean;
  persistent?: boolean;
  one_time_keyboard?: boolean;
};

type ReplyKeyboardRemove = {
  remove_keyboard: true;
};

type ForceReply = {
  force_reply: true;
  input_field_placeholder?: string;
};

export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    parseMode?: "HTML" | "Markdown";
    replyMarkup?: ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
  },
) {
  const res = await fetch(`${getBaseUrl()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode ?? "HTML",
      ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    }),
  });
  return res.json();
}

/**
 * إرسال صورة واحدة عبر تيليجرام
 * photo: رابط عام أو file_id
 */
export async function sendPhoto(
  chatId: number | string,
  photo: string,
  caption?: string,
) {
  const res = await fetch(`${getBaseUrl()}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo,
      ...(caption ? { caption, parse_mode: "HTML" } : {}),
    }),
  });
  return res.json();
}

/**
 * إرسال مجموعة صور كألبوم (2-10 صور)
 * caption يُضاف على الصورة الأولى فقط
 */
export async function sendMediaGroup(
  chatId: number | string,
  photoUrls: string[],
  caption?: string,
) {
  const batch = photoUrls.slice(0, 10);
  const media = batch.map((url, i) => ({
    type: "photo",
    media: url,
    ...(i === 0 && caption ? { caption, parse_mode: "HTML" } : {}),
  }));
  const res = await fetch(`${getBaseUrl()}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, media }),
  });
  return res.json();
}

export async function sendChatAction(chatId: number | string, action = "typing") {
  await fetch(`${getBaseUrl()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

/**
 * إرسال رسالة صوتية عبر تيليجرام
 * voice: رابط عام أو file_id
 */
export async function sendVoice(
  chatId: number | string,
  voice: string,
  caption?: string,
) {
  const res = await fetch(`${getBaseUrl()}/sendVoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      voice,
      ...(caption ? { caption, parse_mode: "HTML" } : {}),
    }),
  });
  return res.json();
}

/**
 * إعادة توجيه رسالة صوتية مُستلَمة من مستخدم آخر
 * file_id: معرّف الملف من Telegram
 */
export async function forwardVoiceToChat(
  chatId: number | string,
  fileId: string,
  caption?: string,
) {
  return sendVoice(chatId, fileId, caption);
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Keyboards ──────────────────────────────────────────────────────────────

export const BTN = {
  TODAY:     "📋 مهام اليوم",
  MY:        "👥 عملائي",
  SEARCH:    "🔍 بحث",
  REPORT:    "📊 التقرير",
  ADD_CUST:  "➕ عميل جديد",
  INVENTORY: "📦 المخزون",
  NOTIFS:    "🔔 تنبيهاتي",
  MSG_STAFF: "📢 رسالة للموظفين",
  STAFF:     "👨‍💼 الموظفون",
  CANCEL:    "❌ إلغاء",
} as const;

export function mainMenuKeyboard(isManager: boolean, isGeneralManager: boolean): ReplyKeyboardMarkup {
  const row1 = [BTN.TODAY, BTN.MY];
  const row2 = [BTN.ADD_CUST, BTN.SEARCH];
  const row3: string[] = [BTN.INVENTORY, BTN.NOTIFS];
  const row4: string[] = [];

  if (isManager) {
    row4.push(BTN.REPORT, BTN.MSG_STAFF);
  }
  if (isGeneralManager) {
    row4.push(BTN.STAFF);
  }

  const rows = [row1, row2, row3];
  if (row4.length > 0) rows.push(row4);

  return { keyboard: rows, resize_keyboard: true, persistent: true };
}

export function selectionKeyboard(options: string[], includeCancel = true): ReplyKeyboardMarkup {
  const rows: string[][] = options.map((opt) => [opt]);
  if (includeCancel) rows.push([BTN.CANCEL]);
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: true };
}

export function cancelKeyboard(): ReplyKeyboardMarkup {
  return { keyboard: [[BTN.CANCEL]], resize_keyboard: true, one_time_keyboard: true };
}

export function removeKeyboard(): ReplyKeyboardRemove {
  return { remove_keyboard: true };
}

export function forceReplySearch(): ForceReply {
  return { force_reply: true, input_field_placeholder: "اكتب اسم العميل أو رقم هاتفه..." };
}

export function forceReplyPrompt(placeholder: string): ForceReply {
  return { force_reply: true, input_field_placeholder: placeholder };
}

// ─── Inline keyboard with Web App button ────────────────────────────────────

type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; web_app?: { url: string }; callback_data?: string }>>;
};

export async function sendMessageWithWebApp(
  chatId: number | string,
  text: string,
  buttons: Array<{ text: string; url: string }>,
) {
  const res = await fetch(`${getBaseUrl()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          buttons.map((btn) => ({ text: btn.text, web_app: { url: btn.url } })),
        ],
      } satisfies InlineKeyboardMarkup,
    }),
  });
  return res.json();
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
}
