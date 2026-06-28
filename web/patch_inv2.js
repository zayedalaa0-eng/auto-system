const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

const oldBlock = `  const maxList = 95;
  const listToRender = filtered.slice(0, maxList);

  for (const car of listToRender) {
    const year = car.production_year ? \` \${car.production_year}\` : "";
    const name = \`\${escapeHtml(car.model)}\${year}\`;
    const price = car.price ? \` | \${Number(car.price).toLocaleString("en-US")} ₪\` : "";
    const colorEmoji = getColorEmoji(car.color);
    
    let prefix = "✅";
    if (car.availability_status !== "متوفرة") prefix = "❌";

    buttons.push([
      {
        text: \`\${prefix} \${colorEmoji} \${name}\${price}\`,
        callback_data: \`invcar:\${car.id}\`
      }
    ]);
  }

  const appUrl = getAppUrl();
  if (filtered.length > maxList && appUrl) {
    buttons.push([
      {
        text: \`عرض باقي السيارات (\${filtered.length - maxList}+) 🔗\`,
        web_app: { url: \`\${appUrl}/dashboard/inventory\` }
      }
    ]);
  }

  buttons.push([{ text: "⬅️ رجوع", callback_data: "inventory_menu" }]);

  return sendMessageWithInlineKeyboard(
    chatId,
    \`<b>\${title} (\${filtered.length}):</b>\\n<i>اضغط على أي سيارة لعرض بطاقتها الكاملة 👇</i>\`,
    buttons
  );`;

const newBlock = `  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const listToRender = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  for (const car of listToRender) {
    const year = car.production_year ? \` \${car.production_year}\` : "";
    const name = \`\${escapeHtml(car.model)}\${year}\`;
    const price = car.price ? \` | \${Number(car.price).toLocaleString("en-US")} ₪\` : "";
    const colorEmoji = getColorEmoji(car.color);
    
    let prefix = "✅";
    if (car.availability_status !== "متوفرة") prefix = "❌";

    buttons.push([
      {
        text: \`\${prefix} \${colorEmoji} \${name}\${price}\`,
        callback_data: \`invcar:\${car.id}\`
      }
    ]);
  }

  // Pagination row
  const paginationRow = [];
  if (safePage > 0) {
    paginationRow.push({ text: "⬅️ السابق", callback_data: \`inv_\${category}_\${safePage - 1}\` });
  }
  paginationRow.push({ text: \`\${safePage + 1} / \${totalPages}\`, callback_data: "ignore" });
  if (safePage < totalPages - 1) {
    paginationRow.push({ text: "التالي ➡️", callback_data: \`inv_\${category}_\${safePage + 1}\` });
  }
  if(paginationRow.length > 1) buttons.push(paginationRow);

  buttons.push([{ text: "⬅️ رجوع", callback_data: "inventory_menu" }]);

  const text = \`<b>\${title} (\${filtered.length}):</b>\\n<i>اضغط على أي سيارة لعرض بطاقتها الكاملة 👇</i>\`;

  if (messageId) {
    try {
      const { editMessageText } = require('./api');
      return await editMessageText(chatId, messageId, text, { replyMarkup: { inline_keyboard: buttons } });
    } catch (e) {
      return await sendMessageWithInlineKeyboard(chatId, text, buttons);
    }
  }

  return sendMessageWithInlineKeyboard(chatId, text, buttons);`;

if(content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
  console.log("Success");
} else {
  console.log("Block not found");
}
