const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

// 1. Update signature
content = content.replace(
  'async function handleMyCategory(chatId: number, user: BotUser, category: string) {',
  'async function handleMyCategory(chatId: number, user: BotUser, category: string, messageId?: number, page: number = 0) {'
);

// 2. Update caller in handleTelegramUpdate
content = content.replace(
  'const category = cq.data.slice(3); // "new", "followup", "noanswer", "all"\n      return handleMyCategory(chatId, user, category);',
  `const parts = cq.data.split("_");
      const pageStr = parts[parts.length - 1];
      const page = !isNaN(parseInt(pageStr)) ? parseInt(pageStr) : 0;
      let actualCat = cq.data.slice(3);
      if(!isNaN(parseInt(pageStr))) actualCat = cq.data.slice(3, cq.data.lastIndexOf("_"));
      return handleMyCategory(chatId, user, actualCat, cq.message?.message_id, page);`
);

// 3. Update handleMyCategory body
const oldBody = `  let text = \`<b>\${title} (\${filtered.length}):</b>\\n\\n\`;
  for (const [i, c] of filtered.entries()) {
    text += \`<blockquote><b>\${i + 1}. \${escapeHtml(c.full_name)}</b>\\n\`;
    text += \`<b>📱 الهاتف:</b> <code>\${c.phone}</code>\\n\`;
    text += \`<b>📌 الحالة:</b> \${escapeHtml(c.status)}\\n\`;
    if (c.requested_car) text += \`<b>🚗 السيارة:</b> \${escapeHtml(c.requested_car)}\\n\`;
    if (user.capabilities.isGeneralManager && c.branch_name) {
      text += \`<b>🏢 الفرع:</b> \${escapeHtml(c.branch_name)}\\n\`;
    }
    text += \`</blockquote>\\n\`;
  }

  return sendMessage(chatId, text.trimEnd());`;

const newBody = `  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const listToRender = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  let text = \`<b>\${title} (\${filtered.length}):</b>\\n\\n\`;
  for (let idx = 0; idx < listToRender.length; idx++) {
    const c = listToRender[idx];
    const displayNum = startIndex + idx + 1;
    text += \`<blockquote><b>\${displayNum}. \${escapeHtml(c.full_name)}</b>\\n\`;
    text += \`<b>📱 الهاتف:</b> <code>\${c.phone}</code>\\n\`;
    text += \`<b>📌 الحالة:</b> \${escapeHtml(c.status)}\\n\`;
    if (c.requested_car) text += \`<b>🚗 السيارة:</b> \${escapeHtml(c.requested_car)}\\n\`;
    if (user.capabilities.isGeneralManager && c.branch_name) {
      text += \`<b>🏢 الفرع:</b> \${escapeHtml(c.branch_name)}\\n\`;
    }
    text += \`</blockquote>\\n\`;
  }

  const buttons = [];
  const paginationRow = [];
  if (safePage > 0) paginationRow.push({ text: "⬅️ السابق", callback_data: \`my_\${category}_\${safePage - 1}\` });
  paginationRow.push({ text: \`\${safePage + 1} / \${totalPages}\`, callback_data: "ignore" });
  if (safePage < totalPages - 1) paginationRow.push({ text: "التالي ➡️", callback_data: \`my_\${category}_\${safePage + 1}\` });
  
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

  return sendMessageWithInlineKeyboard(chatId, text.trimEnd(), buttons);`;

if(content.includes(oldBody)) {
  content = content.replace(oldBody, newBody);

  // We need to add handleMyCustomers callback handling
  const myCustomersHandler = `    if (cq.data === "my_customers") {
      return handleMyCustomers(chatId, user);
    }`;
  content = content.replace('if (cq.data === "inventory_menu") {', myCustomersHandler + '\n\n    if (cq.data === "inventory_menu") {');

  // We also need to update handleMyCustomers to use editMessageText if messageId exists
  content = content.replace(
    'async function handleMyCustomers(chatId: number, user: BotUser) {',
    'async function handleMyCustomers(chatId: number, user: BotUser, messageId?: number) {'
  );
  
  // update handleMyCustomers return
  content = content.replace(
    'return sendMessageWithInlineKeyboard(chatId, text, inlineRows);',
    `if (messageId) {
    try {
      const { editMessageText } = require('./api');
      return await editMessageText(chatId, messageId, text, { replyMarkup: { inline_keyboard: inlineRows } });
    } catch (e) {
      return await sendMessageWithInlineKeyboard(chatId, text, inlineRows);
    }
  }
  return sendMessageWithInlineKeyboard(chatId, text, inlineRows);`
  );

  // update the caller of handleMyCustomers in handleTelegramUpdate
  content = content.replace(
    'return handleMyCustomers(chatId, user);',
    'return handleMyCustomers(chatId, user, cq.message?.message_id);'
  );

  // update the caller of handleInventory in inventory_menu
  content = content.replace(
    'async function handleInventory(chatId: number, user: BotUser) {',
    'async function handleInventory(chatId: number, user: BotUser, messageId?: number) {'
  );

  content = content.replace(
    'return sendMessageWithInlineKeyboard(chatId, text, buttons);',
    `if (messageId) {
    try {
      const { editMessageText } = require('./api');
      return await editMessageText(chatId, messageId, text, { replyMarkup: { inline_keyboard: buttons } });
    } catch (e) {
      return await sendMessageWithInlineKeyboard(chatId, text, buttons);
    }
  }
  return sendMessageWithInlineKeyboard(chatId, text, buttons);`
  );

  content = content.replace(
    'if (cq.data === "inventory_menu") {\n      return handleInventory(chatId, user);\n    }',
    'if (cq.data === "inventory_menu") {\n      return handleInventory(chatId, user, cq.message?.message_id);\n    }'
  );

  fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
  console.log("Success MyCust");
} else {
  console.log("Not found body");
}
