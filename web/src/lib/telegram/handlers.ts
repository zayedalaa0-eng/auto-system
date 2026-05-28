import {
  BTN,
  cancelKeyboard,
  escapeHtml,
  forceReplySearch,
  getAppUrl,
  mainMenuKeyboard,
  selectionKeyboard,
  sendChatAction,
  sendMessage,
  sendMessageWithWebApp,
} from "./api";
import {
  createCustomer,
  getBotUser,
  getBranchReport,
  getGeneralManagerReport,
  getInventory,
  getMyCustomers,
  getNotifications,
  getStaffList,
  getTodayTasks,
  markNotificationsRead,
  searchCustomers,
  sendMessageToStaff,
  type BotUser,
} from "./queries";
import { pushTelegramVoiceToManagers } from "./push";
import { clearSession, getSession, setSession } from "./sessions";

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { first_name?: string; username?: string };
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
    audio?: { file_id: string; duration: number; title?: string; mime_type?: string };
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

function menuKeyboard(user: BotUser) {
  return mainMenuKeyboard(user.capabilities.isManager, user.capabilities.isGeneralManager);
}

// ─── Customer statuses available in bot wizard (subset for quick entry) ─────

const CUSTOMER_STATUSES = [
  "جديد",
  "قيد المتابعة",
  "حجز",
  "تمت عملية البيع",
  "رفض من قبل العميل",
  "رفض من قبل المعرض",
  "إغلاق الملف",
];

// ─── /start & welcome ───────────────────────────────────────────────────────

async function handleStart(chatId: number, user: BotUser | null) {
  if (!user) {
    return sendMessage(
      chatId,
      `مرحباً 👋\n\nلاستخدام البوت يجب ربط حسابك أولاً.\n\n🔑 <b>معرّفك على Telegram:</b>\n<code>${chatId}</code>\n\nأرسل هذا الرقم لمدير النظام ليربطه بحسابك.`,
    );
  }

  await clearSession(String(chatId));
  return sendMessage(
    chatId,
    `أهلاً <b>${escapeHtml(user.full_name)}</b> 👋\n${roleLabel(user)}\n\nاختر من القائمة أدناه:`,
    { replyMarkup: menuKeyboard(user) },
  );
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

async function handleCancel(chatId: number, user: BotUser) {
  await clearSession(String(chatId));
  return sendMessage(chatId, "✅ تم الإلغاء.", { replyMarkup: menuKeyboard(user) });
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

  return sendMessage(chatId, text, { replyMarkup: menuKeyboard(user) });
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
      replyMarkup: menuKeyboard(user),
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

  return sendMessage(chatId, text.trimEnd(), { replyMarkup: menuKeyboard(user) });
}

// ─── Search ─────────────────────────────────────────────────────────────────

async function handleSearchPrompt(chatId: number, user: BotUser) {
  await setSession(String(chatId), "idle");
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
    text += `${i + 1}. <b>${escapeHtml(c.full_name)}</b>\n`;
    text += `   📱 ${c.phone}\n`;
    text += `   📌 ${escapeHtml(c.status)}\n`;
    if (c.requested_car) text += `   🚗 ${escapeHtml(c.requested_car)}\n`;
    if (user.capabilities.isGeneralManager && c.branch_name) {
      text += `   🏢 ${escapeHtml(c.branch_name)}\n`;
    }
    text += "\n";
  }

  return sendMessage(chatId, text.trimEnd(), { replyMarkup: menuKeyboard(user) });
}

// ─── Inventory ──────────────────────────────────────────────────────────────

async function handleInventory(chatId: number, user: BotUser) {
  await sendChatAction(chatId);
  const items = await getInventory(user);

  const scopeLabel = user.capabilities.isGeneralManager ? "جميع الفروع" : "فرعك";

  if (items.length === 0) {
    return sendMessage(chatId, `📦 لا توجد سيارات في المخزون (${scopeLabel}).`, {
      replyMarkup: menuKeyboard(user),
    });
  }

  const available = items.filter((i) => i.availability_status === "متوفرة");
  const unavailable = items.filter((i) => i.availability_status !== "متوفرة");

  let text = `📦 <b>المخزون — ${scopeLabel} (${items.length}):</b>\n\n`;

  if (available.length > 0) {
    text += `✅ <b>متوفرة (${available.length}):</b>\n`;
    for (const car of available) {
      const year = car.production_year ? ` ${car.production_year}` : "";
      const name = `${escapeHtml(car.model)}${year}`;
      const price = car.price ? ` | ${Number(car.price).toLocaleString("ar-EG")} ر.س` : "";
      const color = car.color ? ` | ${escapeHtml(car.color)}` : "";
      text += `• <b>${name}</b>${color}${price}\n`;
      if (user.capabilities.isGeneralManager && car.branch_name) {
        text += `  🏢 ${escapeHtml(car.branch_name)}\n`;
      }
    }
    text += "\n";
  }

  if (unavailable.length > 0) {
    text += `❌ <b>غير متوفرة (${unavailable.length}):</b>\n`;
    for (const car of unavailable) {
      const year = car.production_year ? ` ${car.production_year}` : "";
      const name = `${escapeHtml(car.model)}${year}`;
      text += `• ${name} — ${escapeHtml(car.availability_status)}\n`;
    }
  }

  return sendMessage(chatId, text.trimEnd(), { replyMarkup: menuKeyboard(user) });
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

// ─── Add Customer Wizard ─────────────────────────────────────────────────────

async function handleAddCustomerStart(chatId: number, user: BotUser) {
  const appUrl = getAppUrl();

  // If app URL is configured, offer Mini App + wizard choice
  if (appUrl) {
    const miniAppUrl = `${appUrl}/bot-app/add-customer`;
    await sendMessageWithWebApp(
      chatId,
      "➕ <b>إضافة عميل جديد</b>\n\nاضغط الزر أدناه لفتح الفورم الكامل، أو اكتب <b>ويزارد</b> للإدخال خطوة خطوة:",
      [{ text: "📋 فتح الفورم الكامل", url: miniAppUrl }],
    );
    // Still start the wizard so the user can type "ويزارد" or just proceed
    await setSession(String(chatId), "add_cust_name", {});
    return;
  }

  // Fallback: wizard only
  await setSession(String(chatId), "add_cust_name", {});
  return sendMessage(
    chatId,
    "➕ <b>إضافة عميل جديد</b>\n\nالخطوة 1/4 — أدخل <b>اسم العميل:</b>",
    { replyMarkup: cancelKeyboard() },
  );
}

async function handleAddCustName(chatId: number, user: BotUser, name: string) {
  if (!name.trim()) {
    return sendMessage(chatId, "⚠️ الاسم لا يمكن أن يكون فارغاً. أدخل الاسم:", {
      replyMarkup: cancelKeyboard(),
    });
  }
  await setSession(String(chatId), "add_cust_phone", { cust_name: name.trim() });
  return sendMessage(
    chatId,
    `✅ الاسم: <b>${escapeHtml(name.trim())}</b>\n\nالخطوة 2/4 — أدخل <b>رقم الهاتف:</b>`,
    { replyMarkup: cancelKeyboard() },
  );
}

async function handleAddCustPhone(chatId: number, user: BotUser, phone: string, sessionData: object) {
  if (!phone.trim()) {
    return sendMessage(chatId, "⚠️ رقم الهاتف لا يمكن أن يكون فارغاً. أدخل الرقم:", {
      replyMarkup: cancelKeyboard(),
    });
  }
  await setSession(String(chatId), "add_cust_status", { ...sessionData, cust_phone: phone.trim() });
  return sendMessage(
    chatId,
    `✅ الهاتف: <b>${escapeHtml(phone.trim())}</b>\n\nالخطوة 3/4 — اختر <b>حالة العميل:</b>`,
    { replyMarkup: selectionKeyboard(CUSTOMER_STATUSES) },
  );
}

async function handleAddCustStatus(chatId: number, user: BotUser, status: string, sessionData: object) {
  if (!CUSTOMER_STATUSES.includes(status)) {
    return sendMessage(chatId, "⚠️ اختر حالة من القائمة:", {
      replyMarkup: selectionKeyboard(CUSTOMER_STATUSES),
    });
  }
  await setSession(String(chatId), "add_cust_car", { ...sessionData, cust_status: status });
  return sendMessage(
    chatId,
    `✅ الحالة: <b>${escapeHtml(status)}</b>\n\nالخطوة 4/4 — أدخل <b>السيارة المطلوبة</b> (أو أرسل "-" للتخطي):`,
    { replyMarkup: cancelKeyboard() },
  );
}

async function handleAddCustCar(chatId: number, user: BotUser, car: string, sessionData: Record<string, string>) {
  const carVal = car.trim() === "-" ? null : car.trim() || null;
  await setSession(String(chatId), "add_cust_confirm", { ...sessionData, cust_car: carVal ?? "" });

  const d = sessionData;
  let summary =
    `📋 <b>ملخص العميل الجديد:</b>\n\n` +
    `👤 الاسم: <b>${escapeHtml(d.cust_name ?? "")}</b>\n` +
    `📱 الهاتف: <b>${escapeHtml(d.cust_phone ?? "")}</b>\n` +
    `📌 الحالة: <b>${escapeHtml(d.cust_status ?? "")}</b>\n`;
  if (carVal) summary += `🚗 السيارة: <b>${escapeHtml(carVal)}</b>\n`;

  summary += "\nهل تريد حفظ العميل؟";
  return sendMessage(chatId, summary, {
    replyMarkup: selectionKeyboard(["✅ حفظ", "❌ إلغاء"], false),
  });
}

async function handleAddCustConfirm(chatId: number, user: BotUser, answer: string, sessionData: Record<string, string>) {
  if (answer !== "✅ حفظ") {
    await clearSession(String(chatId));
    return sendMessage(chatId, "❌ تم الإلغاء.", { replyMarkup: menuKeyboard(user) });
  }

  await sendChatAction(chatId);
  const { error } = await createCustomer(user, {
    full_name: sessionData.cust_name ?? "",
    phone: sessionData.cust_phone ?? "",
    status: sessionData.cust_status ?? "عميل جديد",
    requested_car: sessionData.cust_car || null,
  });

  await clearSession(String(chatId));

  if (error) {
    return sendMessage(chatId, `⚠️ خطأ في الحفظ: ${escapeHtml(String(error.message))}`, {
      replyMarkup: menuKeyboard(user),
    });
  }

  return sendMessage(
    chatId,
    `✅ <b>تم إضافة العميل بنجاح!</b>\n\n👤 ${escapeHtml(sessionData.cust_name ?? "")}`,
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

async function handleVoiceMessage(
  chatId: number,
  user: BotUser,
  voice: NonNullable<NonNullable<TelegramUpdate["message"]>["voice"]>,
) {
  const appUrl = getAppUrl();
  const durationSec = voice.duration;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  // أرسل إلى المديرين (best-effort)
  void pushTelegramVoiceToManagers({
    branchId: user.branch_id ?? null,
    caption:
      `🎤 <b>رسالة صوتية من البوت</b>\n` +
      `👤 الموظف: ${escapeHtml(user.full_name)}\n` +
      `⏱ المدة: ${durationStr}`,
    voiceUrl: voice.file_id,   // Telegram يقبل file_id مباشرةً
  });

  // رد على المستخدم
  if (appUrl) {
    return sendMessageWithWebApp(
      chatId,
      `✅ <b>تم استلام تسجيلك الصوتي (${durationStr})</b>\n\nتم إرساله للمدير. لإرفاقه بملف عميل افتح ملف العميل من الويب:`,
      [{ text: "🌐 فتح النظام", url: `${appUrl}/dashboard` }],
    );
  }

  return sendMessage(
    chatId,
    `✅ <b>تم استلام تسجيلك الصوتي (${durationStr})</b>\n\nتم إرساله للمدير.\nلإرفاقه بملف عميل — افتح النظام وارفع الملف من هناك.`,
    { replyMarkup: menuKeyboard(user) },
  );
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate) {
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

  if (!message.text) return;
  const text = message.text.trim();

  // ── Cancel always works ──
  if (text === BTN.CANCEL) {
    return handleCancel(chatId, user);
  }

  // ── Read session state ──
  const session = await getSession(String(chatId));

  // ── Wizard state machine ──
  if (session.state !== "idle") {
    switch (session.state) {
      case "add_cust_name":
        return handleAddCustName(chatId, user, text);
      case "add_cust_phone":
        return handleAddCustPhone(chatId, user, text, session.data);
      case "add_cust_status":
        return handleAddCustStatus(chatId, user, text, session.data);
      case "add_cust_car":
        return handleAddCustCar(chatId, user, text, session.data as Record<string, string>);
      case "add_cust_confirm":
        return handleAddCustConfirm(chatId, user, text, session.data as Record<string, string>);
      case "msg_pick_recipient":
        return handleMsgPickRecipient(chatId, user, text);
      case "msg_write":
        return handleMsgWrite(chatId, user, text, session.data as Record<string, string>);
    }
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
    default:
      return sendMessage(
        chatId,
        "اختر من القائمة أدناه 👇",
        { replyMarkup: menuKeyboard(user) },
      );
  }
}
