const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

// Update handleInventoryCategory signature
content = content.replace(
  'async function handleInventoryCategory(chatId: number, user: BotUser, category: string) {',
  'async function handleInventoryCategory(chatId: number, user: BotUser, category: string, messageId?: number, page: number = 0) {'
);

// Update caller in handleTelegramUpdate
content = content.replace(
  'const category = cq.data.slice(4); // "new", "used", "avail", "cust", "all"\n      return handleInventoryCategory(chatId, user, category);',
  `const parts = cq.data.split("_");
      // Format: inv_{category}_{page} or just inv_{category}
      const category = parts[1] + (parts[2] && !parseInt(parts[2]) ? "_" + parts[2] : ""); // handle "new_avail" etc
      const pageStr = parts[parts.length - 1];
      const page = !isNaN(parseInt(pageStr)) ? parseInt(pageStr) : 0;
      let actualCat = cq.data.slice(4);
      if(!isNaN(parseInt(pageStr))) actualCat = cq.data.slice(4, cq.data.lastIndexOf("_"));
      return handleInventoryCategory(chatId, user, actualCat, cq.message?.message_id, page);`
);

fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
