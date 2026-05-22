const getBaseUrl = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

type ReplyKeyboardMarkup = {
  keyboard: string[][];
  resize_keyboard: boolean;
  persistent: boolean;
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
    replyMarkup?: ReplyKeyboardMarkup | ForceReply;
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

export async function sendChatAction(chatId: number | string, action = "typing") {
  await fetch(`${getBaseUrl()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Keyboards ──────────────────────────────────────────────────────────────

export const BTN = {
  TODAY:  "📋 مهام اليوم",
  MY:     "👥 عملائي",
  SEARCH: "🔍 بحث",
  REPORT: "📊 التقرير",
} as const;

export function mainMenuKeyboard(isManager: boolean): ReplyKeyboardMarkup {
  const rows: string[][] = [
    [BTN.TODAY, BTN.MY],
    isManager ? [BTN.REPORT, BTN.SEARCH] : [BTN.SEARCH],
  ];
  return { keyboard: rows, resize_keyboard: true, persistent: true };
}

export function forceReplySearch(): ForceReply {
  return { force_reply: true, input_field_placeholder: "اكتب اسم العميل أو رقم هاتفه..." };
}
