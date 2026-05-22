import { escapeHtml, sendChatAction, sendMessage } from "./api";
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

function commandsMenu(user: BotUser): string {
  const lines = [
    "/today — مهامك اليوم والمتابعات",
    "/my — العملاء النشطون",
    "/search [نص] — بحث باسم العميل أو هاتفه",
  ];
  if (user.capabilities.isManager) {
    lines.push("/report — ملخص وإحصائيات");
  }
  return lines.join("\n");
}

// ─── /start ────────────────────────────────────────────────────────────────

async function handleStart(chatId: number, user: BotUser | null) {
  if (!user) {
    return sendMessage(
      chatId,
      `مرحباً 👋\n\nلاستخدام البوت يجب ربط حسابك أولاً.\n\n🔑 <b>معرّفك على Telegram:</b>\n<code>${chatId}</code>\n\nأرسل هذا الرقم لمدير النظام ليربطه بحسابك.`,
    );
  }
  return sendMessage(
    chatId,
    `أهلاً <b>${escapeHtml(user.full_name)}</b> 👋\n` +
      `${roleLabel(user)}\n\n` +
      `<b>الأوامر المتاحة:</b>\n${commandsMenu(user)}`,
  );
}

// ─── /today ────────────────────────────────────────────────────────────────

async function handleToday(chatId: number, user: BotUser) {
  await sendChatAction(chatId);
  const { reminders, followups } = await getTodayTasks(user);
  const date = arabicDate();

  let text = `📋 <b>مهام اليوم — ${date}</b>\n`;

  if (user.capabilities.isGeneralManager) {
    text += "<i>النطاق: جميع الفروع</i>\n";
  } else if (user.capabilities.isManager) {
    text += "<i>النطاق: فرعك</i>\n";
  } else {
    text += "<i>النطاق: ملفاتك فقط</i>\n";
  }

  text += "\n";

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

  return sendMessage(chatId, text);
}

// ─── /my ───────────────────────────────────────────────────────────────────

async function handleMy(chatId: number, user: BotUser) {
  await sendChatAction(chatId);
  const customers = await getMyCustomers(user);

  if (customers.length === 0) {
    const scope = user.capabilities.isManager ? "الفرع" : "ملفاتك";
    return sendMessage(chatId, `لا يوجد عملاء نشطون في ${scope} حالياً.`);
  }

  const scopeLabel = user.capabilities.isGeneralManager
    ? "جميع الفروع"
    : user.capabilities.isManager
      ? "فرعك"
      : "ملفاتك";

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

  return sendMessage(chatId, text.trimEnd());
}

// ─── /search ───────────────────────────────────────────────────────────────

async function handleSearch(chatId: number, user: BotUser, query: string) {
  if (!query.trim()) {
    return sendMessage(chatId, "الاستخدام:\n/search [اسم العميل أو رقم الهاتف]");
  }

  await sendChatAction(chatId);
  const results = await searchCustomers(user, query.trim());

  if (results.length === 0) {
    return sendMessage(chatId, `🔍 لا توجد نتائج لـ "<b>${escapeHtml(query)}</b>"`);
  }

  let text = `🔍 <b>نتائج البحث عن "${escapeHtml(query)}" (${results.length}):</b>\n\n`;
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

  return sendMessage(chatId, text.trimEnd());
}

// ─── /report ───────────────────────────────────────────────────────────────

async function handleReport(chatId: number, user: BotUser) {
  if (!user.capabilities.isManager) {
    return sendMessage(chatId, "⛔ هذا الأمر متاح للمديرين فقط.");
  }

  await sendChatAction(chatId);
  const date = arabicDate();

  // مدير عام — تقرير شامل بكل الفروع
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

    return sendMessage(chatId, text);
  }

  // مدير معرض — تقرير الفرع
  const report = await getBranchReport(user);
  const text =
    `📊 <b>تقرير الفرع — ${date}</b>\n\n` +
    `👥 العملاء النشطون: <b>${report.activeCustomers}</b>\n` +
    `🚗 السيارات المتوفرة: <b>${report.availableInventory}</b>\n` +
    `⏰ متابعات اليوم: <b>${report.todayFollowups}</b>\n` +
    `⚠️ متابعات متأخرة: <b>${report.overdueFollowups}</b>`;

  return sendMessage(chatId, text);
}

// ─── Main dispatcher ────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const [rawCommand, ...args] = text.split(" ");
  const command = rawCommand.split("@")[0].toLowerCase();

  if (command === "/start") {
    const user = await getBotUser(String(chatId)).catch(() => null);
    return handleStart(chatId, user);
  }

  let user: BotUser | null = null;
  try {
    user = await getBotUser(String(chatId));
  } catch {
    return sendMessage(chatId, "⚠️ تعذر الاتصال بالنظام. حاول لاحقاً.");
  }

  if (!user) {
    return sendMessage(
      chatId,
      `⚠️ حسابك غير مرتبط بالنظام.\n\n🔑 <b>معرّفك:</b> <code>${chatId}</code>\n\nأرسله لمدير النظام لربطه بحسابك.`,
    );
  }

  switch (command) {
    case "/today":
      return handleToday(chatId, user);
    case "/my":
      return handleMy(chatId, user);
    case "/search":
      return handleSearch(chatId, user, args.join(" "));
    case "/report":
      return handleReport(chatId, user);
    default:
      return sendMessage(
        chatId,
        `<b>الأوامر المتاحة:</b>\n\n${commandsMenu(user)}`,
      );
  }
}
