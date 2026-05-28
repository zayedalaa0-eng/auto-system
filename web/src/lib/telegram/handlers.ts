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
  checkPhoneExists,
  createCustomer,
  getBotUser,
  getBranches,
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

// ─── حالات العميل حسب نوع العملية ──────────────────────────────────────────

const STATUS_LISTS: Record<string, string[]> = {
  buyer: [
    "جديد", "قيد المتابعة", "حجز",
    "تمت عملية البيع", "رفض من قبل العميل",
    "رفض من قبل المعرض", "إغلاق الملف",
  ],
  buyer_tradein_pending: [
    "قيد المتابعة — بانتظار التقييم",
    "قيد المتابعة — تمت عملية التقييم",
    "حجز (استبدال)", "تمت عملية البيع + استبدال",
    "تراجع العميل عن الاستبدال",
    "رفض من قبل العميل", "رفض من قبل المعرض", "إغلاق الملف",
  ],
  sell_on_behalf: [
    "عرض سيارة للبيع", "حجز (سيارة العميل)",
    "تمت عملية البيع (للعميل)", "شراء من قبل المعرض",
    "رفض من قبل العميل", "رفض من قبل المعرض",
    "سحب السيارة من البيع",
  ],
};

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
  if (appUrl) {
    await sendMessageWithWebApp(
      chatId,
      "➕ <b>إضافة عميل جديد</b>\n\nاضغط لفتح الفورم الكامل، أو تابع هنا خطوة بخطوة:",
      [{ text: "📋 فتح الفورم الكامل", url: `${appUrl}/bot-app/add-customer` }],
    );
  }
  await setSession(String(chatId), "add_cust_phone", {});
  return sendMessage(
    chatId,
    "➕ <b>إضافة عميل — الخطوة 1</b>\n\nأدخل <b>رقم الهاتف</b> (10 أرقام بالضبط):",
    { replyMarkup: cancelKeyboard() },
  );
}

// الخطوة 1 — رقم الهاتف مع فحص 10 أرقام والتحقق من الوجود
async function handleAddCustPhone(chatId: number, user: BotUser, phone: string) {
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length !== 10) {
    return sendMessage(
      chatId,
      "⚠️ رقم الهاتف يجب أن يكون <b>10 أرقام</b> بالضبط.\n\nأعد إدخال الرقم:",
      { replyMarkup: cancelKeyboard() },
    );
  }

  await sendChatAction(chatId);
  const existing = await checkPhoneExists(normalized);

  if (existing) {
    await setSession(String(chatId), "add_cust_phone_exists", { checked_phone: normalized });
    const carInfo = existing.requested_car ? `\n🚗 ${escapeHtml(existing.requested_car)}` : "";
    return sendMessage(
      chatId,
      `⚠️ <b>هذا الرقم مسجل مسبقاً في النظام</b>\n\n` +
      `👤 <b>${escapeHtml(existing.full_name)}</b>\n` +
      `📌 ${escapeHtml(existing.status)}${carInfo}\n\n` +
      `هل تريد إدخال رقم آخر أم إلغاء؟`,
      { replyMarkup: selectionKeyboard(["📱 رقم آخر", "❌ إلغاء"], false) },
    );
  }

  await setSession(String(chatId), "add_cust_name", { cust_phone: normalized });
  return sendMessage(
    chatId,
    `✅ الرقم: <b>${escapeHtml(normalized)}</b>\n\n<b>الخطوة 2</b> — أدخل <b>اسم العميل</b> (3 أحرف على الأقل):`,
    { replyMarkup: cancelKeyboard() },
  );
}

// معالجة حالة الرقم الموجود مسبقاً
async function handleAddCustPhoneExists(chatId: number, user: BotUser, answer: string) {
  if (answer === "📱 رقم آخر") {
    await setSession(String(chatId), "add_cust_phone", {});
    return sendMessage(chatId, "أدخل <b>رقم الهاتف</b> الجديد (10 أرقام):", { replyMarkup: cancelKeyboard() });
  }
  await clearSession(String(chatId));
  return sendMessage(chatId, "✅ تم الإلغاء.", { replyMarkup: menuKeyboard(user) });
}

// الخطوة 2 — الاسم
async function handleAddCustName(chatId: number, user: BotUser, name: string, sessionData: Record<string, string>) {
  if (name.trim().length < 3) {
    return sendMessage(chatId, "⚠️ الاسم يجب أن يكون <b>3 أحرف على الأقل</b>. أعد الإدخال:", {
      replyMarkup: cancelKeyboard(),
    });
  }
  await setSession(String(chatId), "add_cust_nickname", { ...sessionData, cust_name: name.trim() });
  return sendMessage(
    chatId,
    `✅ الاسم: <b>${escapeHtml(name.trim())}</b>\n\n<b>الخطوة 3</b> — أدخل <b>الكنية / المدينة</b>\n(أو أرسل <code>-</code> للتخطي):`,
    { replyMarkup: cancelKeyboard() },
  );
}

// الخطوة 3 — الكنية
async function handleAddCustNickname(chatId: number, user: BotUser, nickname: string, sessionData: Record<string, string>) {
  const val = nickname.trim() === "-" ? "" : nickname.trim();
  await setSession(String(chatId), "add_cust_optype", { ...sessionData, cust_nickname: val });
  return sendMessage(
    chatId,
    `<b>الخطوة 4</b> — اختر <b>نوع العملية</b>:`,
    { replyMarkup: selectionKeyboard(OP_LABELS) },
  );
}

// الخطوة 4 — نوع العملية
async function handleAddCustOpType(chatId: number, user: BotUser, answer: string, sessionData: Record<string, string>) {
  const opType = getOpTypeValue(answer);
  if (!opType) {
    return sendMessage(chatId, "⚠️ اختر نوع العملية من القائمة:", {
      replyMarkup: selectionKeyboard(OP_LABELS),
    });
  }
  const nextData = { ...sessionData, cust_optype: opType };

  // المدير العام يختار المعرض
  if (user.capabilities.isGeneralManager) {
    await sendChatAction(chatId);
    const branches = await getBranches();
    const branchNames = branches.map((b) => b.name);
    await setSession(String(chatId), "add_cust_branch", {
      ...nextData,
      _branches: JSON.stringify(branches),
    });
    return sendMessage(
      chatId,
      `<b>الخطوة 5</b> — اختر <b>المعرض</b>:`,
      { replyMarkup: selectionKeyboard(branchNames) },
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
      replyMarkup: selectionKeyboard(branches.map((b) => b.name)),
    });
  }
  return proceedToCarStep(chatId, user, { ...sessionData, cust_branch_id: branch.id, _branches: "" }, 6);
}

// الانتقال لخطوة السيارة حسب نوع العملية
async function proceedToCarStep(chatId: number, user: BotUser, sessionData: Record<string, string>, stepNum: number) {
  const opType = sessionData.cust_optype;

  if (opType === "sell_on_behalf") {
    await setSession(String(chatId), "add_cust_trade_car", sessionData);
    return sendMessage(
      chatId,
      `<b>الخطوة ${stepNum}</b> — أدخل <b>نوع سيارة العميل</b> (المراد بيعها):\n<i>مثال: تويوتا كامري 2020</i>\n\nأو أرسل <code>-</code> للتخطي:`,
      { replyMarkup: cancelKeyboard() },
    );
  }

  // مشتري / مشتري+استبدال
  await setSession(String(chatId), "add_cust_car", sessionData);
  return sendMessage(
    chatId,
    `<b>الخطوة ${stepNum}</b> — أدخل <b>السيارة المطلوبة</b>:\n<i>مثال: كيا سيراتو 2022</i>\n\nأو أرسل <code>-</code> للتخطي:`,
    { replyMarkup: cancelKeyboard() },
  );
}

// خطوة السيارة المطلوبة (مشتري/استبدال)
async function handleAddCustCar(chatId: number, user: BotUser, car: string, sessionData: Record<string, string>) {
  const carVal = car.trim() === "-" ? "" : car.trim();
  const isGM = user.capabilities.isGeneralManager;
  await setSession(String(chatId), "add_cust_status", { ...sessionData, cust_car: carVal });
  return askForStatus(chatId, sessionData.cust_optype, isGM ? 7 : 6);
}

// خطوة سيارة العميل (بيع بالوكالة)
async function handleAddCustTradeCar(chatId: number, user: BotUser, car: string, sessionData: Record<string, string>) {
  const carVal = car.trim() === "-" ? "" : car.trim();
  const isGM = user.capabilities.isGeneralManager;
  await setSession(String(chatId), "add_cust_status", { ...sessionData, cust_trade_car: carVal });
  return askForStatus(chatId, sessionData.cust_optype, isGM ? 7 : 6);
}

function askForStatus(chatId: number, opType: string, stepNum: number) {
  const statuses = STATUS_LISTS[opType] ?? STATUS_LISTS.buyer;
  return sendMessage(
    chatId,
    `<b>الخطوة ${stepNum}</b> — اختر <b>حالة العميل</b>:`,
    { replyMarkup: selectionKeyboard(statuses) },
  );
}

// خطوة الحالة
async function handleAddCustStatus(chatId: number, user: BotUser, status: string, sessionData: Record<string, string>) {
  const validStatuses = STATUS_LISTS[sessionData.cust_optype] ?? STATUS_LISTS.buyer;
  if (!validStatuses.includes(status)) {
    return sendMessage(chatId, "⚠️ اختر الحالة من القائمة:", {
      replyMarkup: selectionKeyboard(validStatuses),
    });
  }
  const isGM = user.capabilities.isGeneralManager;
  await setSession(String(chatId), "add_cust_notes", { ...sessionData, cust_status: status });
  return sendMessage(
    chatId,
    `✅ الحالة: <b>${escapeHtml(status)}</b>\n\n<b>الخطوة ${isGM ? 8 : 7}</b> — أدخل <b>الملاحظات</b>\n(أو أرسل <code>-</code> للتخطي):`,
    { replyMarkup: cancelKeyboard() },
  );
}

// خطوة الملاحظات
async function handleAddCustNotes(chatId: number, user: BotUser, notes: string, sessionData: Record<string, string>) {
  const notesVal = notes.trim() === "-" ? "" : notes.trim();
  const isGM = user.capabilities.isGeneralManager;
  const defaultDate = defaultFollowupDate();
  await setSession(String(chatId), "add_cust_followup", { ...sessionData, cust_notes: notesVal });
  return sendMessage(
    chatId,
    `<b>الخطوة ${isGM ? 9 : 8}</b> — أدخل <b>تاريخ المتابعة القادمة</b>:\n<i>الصيغة: YYYY-MM-DD (مثال: ${defaultDate})</i>\n\nأو أرسل <code>-</code> للتعيين تلقائياً (+7 أيام):`,
    { replyMarkup: cancelKeyboard() },
  );
}

// خطوة تاريخ المتابعة
async function handleAddCustFollowup(chatId: number, user: BotUser, dateStr: string, sessionData: Record<string, string>) {
  let followup = defaultFollowupDate();
  const trimmed = dateStr.trim();
  if (trimmed !== "-" && trimmed) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return sendMessage(
        chatId,
        `⚠️ صيغة التاريخ غير صحيحة. استخدم <code>YYYY-MM-DD</code> أو أرسل <code>-</code>:`,
        { replyMarkup: cancelKeyboard() },
      );
    }
    followup = trimmed;
  }
  const finalData = { ...sessionData, cust_followup: followup };
  await setSession(String(chatId), "add_cust_confirm", finalData);
  return showWizardSummary(chatId, finalData);
}

function showWizardSummary(chatId: number, d: Record<string, string>) {
  let summary = `📋 <b>ملخص العميل الجديد:</b>\n\n`;
  summary += `📱 الهاتف: <b>${escapeHtml(d.cust_phone ?? "")}</b>\n`;
  summary += `👤 الاسم: <b>${escapeHtml(d.cust_name ?? "")}</b>\n`;
  if (d.cust_nickname) summary += `🏷 الكنية: <b>${escapeHtml(d.cust_nickname)}</b>\n`;
  summary += `🔖 نوع العملية: <b>${getOpTypeLabel(d.cust_optype ?? "")}</b>\n`;
  summary += `📌 الحالة: <b>${escapeHtml(d.cust_status ?? "")}</b>\n`;
  if (d.cust_car)       summary += `🚗 السيارة المطلوبة: <b>${escapeHtml(d.cust_car)}</b>\n`;
  if (d.cust_trade_car) summary += `🚗 سيارة العميل: <b>${escapeHtml(d.cust_trade_car)}</b>\n`;
  if (d.cust_notes)     summary += `📝 الملاحظات: <b>${escapeHtml(d.cust_notes)}</b>\n`;
  summary += `📅 المتابعة: <b>${d.cust_followup ?? ""}</b>\n`;
  summary += "\nهل تريد الحفظ؟";

  return sendMessage(chatId, summary, {
    replyMarkup: selectionKeyboard(["✅ حفظ", "❌ إلغاء"], false),
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
    const d = session.data as Record<string, string>;
    switch (session.state) {
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
