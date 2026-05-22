import {
  BTN,
  escapeHtml,
  forceReplySearch,
  mainMenuKeyboard,
  sendChatAction,
  sendMessage,
} from "./api";
import {
  getBotUser,
  getBranchReport,
  getGeneralManagerReport,
  getMyCustomers,
  getTodayTasks,
  searchCustomers,
  type BotUser,
} from "./queries";

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    reply_to_message?: { text?: string };
  };
};

function arabicDate() {
  return new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function roleLabel(user: BotUser) {
  if (user.capabilities.isGeneralManager) return "مدير عام 👑";
  if (user.capabilities.isManager) return "مدير معرض 🏢";
  return "موظف 👤";
}

// ─── /start & welcome ───────────────────────────────────────────────────────

async function handleStart(chatId: number, user: BotUser | null) {
  if (!user) {
    return sendMessage(
      chatId,
      `مرحباً 👋\n\nلاستخدام البوت يجب ربط حسابك أولاً.\n\n🔑 <b>معرّفك على Telegram:</b>\n<code>${chatId}</code>\n\nأرسل هذا الرقم لمدير النظام ليربطه بحسابك.`,
    );
  }

  return sendMessage(
    chatId,
    `أهلاً <b>${escapeHtml(user.full_name)}</b> 👋\n${roleLabel(user)}\n\nاختر من القائمة أدناه:`,
    { replyMarkup: mainMenuKeyboard(user.capabilities.isManager) },
  );
}

// ─── Today ──────────────────────────────────────────────────────────────────

async function handleToday(chatId: number, user: BotUser) {
  await sendChatAction(chatId);
  const { reminders, followups } = await getTodayTasks(user);
  const date = arabicDate();

  const scopeNote = user.capabilities.isGeneralManager
    ? "<i>جميع الفروع</i>"
    : user.capabilities.isManager
      ? "<i>فرعك</i>"
      : "<i>ملفاتك</i>";

  let text = `📋 <b>مهام اليوم — ${date}</b>\n${scopeNote}\n\n`;

  if (followups.length > 0) {
    text += `⏰ <b>متابعات اليوم (${followups.length}):</b>\n`;
    for (const [i, c] of followups.entries()) {
      const car = c.requested_car ? ` | ${escapeHtml(c.requested_car)}` : "";
      text += `${i + 1}. <b>${escapeHtml(c.full_name)}</b>${car}\n   📱 ${c.phone}\n`;
    }
    text += "\n";
  } else {
    text += "✅ لا توجد متابعات مجدولة اليوم\n\n";
  }

  if (reminders.length > 0) {
    text += `🔔 <b>تذكيرات معلقة (${reminders.length}):</b>\n`;
    for (const [i, r] of reminders.entries()) {
      const label = escapeHtml(r.title ?? r.message ?? "مهمة");
      const cust = r.customer_name ? ` — ${escapeHtml(r.customer_name)}` : "";
      text += `${i + 1}. ${label}${cust}\n`;
    }
  } else {
    text += "✅ لا توجد تذكيرات معلقة";
  }

  return sendMessage(chatId, text, {
    replyMarkup: mainMenuKeyboard(user.capabilities.isManager),
  });
}

// ─── My customers ───────────────────────────────────────────────────────────

async function handleMy(chatId: number, user: BotUser) {
  await sendChatAction(chatId);
  const customers = await getMyCustomers(user);

  const scopeLabel = user.capabilities.isGeneralManager
    ? "جميع الفروع"
    : user.capabilities.isManager
      ? "فرعك"
      : "ملفاتك";

  if (customers.length === 0) {
    return sendMessage(chatId, `لا يوجد عملاء نشطون في ${scopeLabel} حالياً.`, {
      replyMarkup: mainMenuKeyboard(user.capabilities.isManager),
    });
  }

  let text = `👥 <b>العملاء النشطون — ${scopeLabel} (${customers.length}):</b>\n\n`;
  for (const [i, c] of customers.entries()) {
    text += `${i + 1}. <b>${escapeHtml(c.full_name)}</b>\n`;
    text += `   📱 ${c.phone}\n`;
    text += `   📌 ${escapeHtml(c.status)}\n`;
    if (c.requested_car) text += `   🚗 ${escapeHtml(c.requested_car)}\n`;
    if (user.capabilities.isGeneralManager && c.branch_name) {
      text += `   🏢 ${escapeHtml(c.branch_name)}\n`;
    }
    text += "\n";
  }

  return sendMessage(chatId, text.trimEnd(), {
    replyMarkup: mainMenuKeyboard(user.capabilities.isManager),
  });
}

// ─── Search ─────────────────────────────────────────────────────────────────

async function handleSearchPrompt(chatId: number, user: BotUser) {
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
      replyMarkup: mainMenuKeyboard(user.capabilities.isManager),
    });
  }

  let text = `🔍 <b>نتائج "${escapeHtml(query)}" (${results.length}):</b>\n\n`;
  for (const [i, c] of results.entries()) {
    text += `${i + 1}. <b>${escapeHtml(c.full_name)}</b>\n`;
    text += `   📱 ${c.phone}\n`;
    text += `   📌 ${escapeHtml(c.status)}\n`;
    if (c.requested_car) text += `   🚗 ${escapeHtml(c.requested_car)}\n`;
    if (user.capabilities.isGeneralManager && c.branch_name) {
      text += `   🏢 ${escapeHtml(c.branch_name)}\n`;
    }
    text += "\n";
  }

  return sendMessage(chatId, text.trimEnd(), {
    replyMarkup: mainMenuKeyboard(user.capabilities.isManager),
  });
}

// ─── Report ─────────────────────────────────────────────────────────────────

async function handleReport(chatId: number, user: BotUser) {
  if (!user.capabilities.isManager) {
    return sendMessage(chatId, "⛔ هذا الأمر متاح للمديرين فقط.", {
      replyMarkup: mainMenuKeyboard(false),
    });
  }

  await sendChatAction(chatId);
  const date = arabicDate();

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

    return sendMessage(chatId, text, {
      replyMarkup: mainMenuKeyboard(true),
    });
  }

  const report = await getBranchReport(user);
  return sendMessage(
    chatId,
    `📊 <b>تقرير الفرع — ${date}</b>\n\n` +
      `👥 العملاء النشطون: <b>${report.activeCustomers}</b>\n` +
      `🚗 السيارات المتوفرة: <b>${report.availableInventory}</b>\n` +
      `⏰ متابعات اليوم: <b>${report.todayFollowups}</b>\n` +
      `⚠️ متابعات متأخرة: <b>${report.overdueFollowups}</b>`,
    { replyMarkup: mainMenuKeyboard(true) },
  );
}

// ─── Main dispatcher ────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();

  // ── /start (works even without linking) ──
  if (text === "/start") {
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

  // ── Handle search reply (ForceReply response) ──
  if (message.reply_to_message?.text?.includes("اكتب الاسم أو رقم الهاتف")) {
    return handleSearchQuery(chatId, user, text);
  }

  // ── Button presses (Reply Keyboard) ──
  switch (text) {
    case BTN.TODAY:
      return handleToday(chatId, user);
    case BTN.MY:
      return handleMy(chatId, user);
    case BTN.SEARCH:
      return handleSearchPrompt(chatId, user);
    case BTN.REPORT:
      return handleReport(chatId, user);
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
    default:
      return sendMessage(
        chatId,
        `اختر من القائمة أدناه 👇`,
        { replyMarkup: mainMenuKeyboard(user.capabilities.isManager) },
      );
  }
}
