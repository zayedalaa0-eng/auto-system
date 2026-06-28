const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

const oldStart = `async function handleStart(chatId: number, user: BotUser | null) {
  if (!user) {
    return sendMessage(
      chatId,
      \`مرحباً 👋\\n\\nلاستخدام البوت يجب ربط حسابك أولاً.\\n\\n🔑 <b>معرّفك على Telegram:</b>\\n<code>\${chatId}</code>\\n\\nأرسل هذا الرقم لمدير النظام ليربطه بحسابك.\`,
    );
  }

  await clearSession(String(chatId));
  const isMaalam = await checkIsMaalamMgr(user.id);

  const role = user.capabilities.isGeneralManager
    ? "مدير عام 👑"
    : user.capabilities.isManager
      ? "مدير معرض 🏢"
      : "موظف مبيعات 👤";

  let welcome = \`أهلاً وسهلاً، <b>\${escapeHtml(user.full_name)}</b> 👋\\n\\n\`;
  welcome += \`<blockquote>🪪 <b>الصلاحية:</b> \${role}\\n\`;
  if (user.branch_name) {
    welcome += \`🏢 <b>المعرض:</b> \${escapeHtml(user.branch_name)}\\n\`;
  }
  welcome += \`</blockquote>\\nاختر من القائمة أدناه:\`;

  return sendMessage(chatId, welcome, { replyMarkup: menuKeyboard(user, isMaalam) });
}`;

const newStart = `export async function sendMainMenu(chatId: number | string, user: BotUser) {
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

  let welcome = \`\${greeting}، <b>\${escapeHtml(user.full_name)}</b> 👋\\n\\n\`;
  welcome += \`<blockquote>🪪 <b>الصلاحية:</b> \${role}\\n\`;
  if (user.branch_name) {
    welcome += \`🏢 <b>المعرض:</b> \${escapeHtml(user.branch_name)}\\n\`;
  }
  welcome += \`</blockquote>\\nاختر الإجراء المطلوب من القائمة أدناه:\`;

  // Placeholder banner URL
  const bannerUrl = "https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&w=1200&q=80";

  try {
    const { sendPhoto } = require('./api');
    return await sendPhoto(chatId, bannerUrl, welcome, menuKeyboard(user, isMaalam));
  } catch (e) {
    return sendMessage(chatId, welcome, { replyMarkup: menuKeyboard(user, isMaalam) });
  }
}

async function handleStart(chatId: number, user: BotUser | null) {
  if (!user) {
    return sendMessage(
      chatId,
      \`مرحباً 👋\\n\\nلاستخدام البوت يجب ربط حسابك أولاً.\\n\\n🔑 <b>معرّفك على Telegram:</b>\\n<code>\${chatId}</code>\\n\\nأرسل هذا الرقم لمدير النظام ليربطه بحسابك.\`,
    );
  }

  await clearSession(String(chatId));
  return sendMainMenu(chatId, user);
}`;

content = content.replace(oldStart, newStart);

// Update main_menu callback
content = content.replace(
  `    if (cq.data === "main_menu") {
      await clearSession(String(chatId));
      const isMaalam = await checkIsMaalamMgr(user.id);
      return sendMessage(chatId, "🏠 القائمة الرئيسية:", { replyMarkup: menuKeyboard(user, isMaalam) });
    }`,
  `    if (cq.data === "main_menu") {
      await clearSession(String(chatId));
      return sendMainMenu(chatId, user);
    }`
);

fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
console.log("Success Start");
