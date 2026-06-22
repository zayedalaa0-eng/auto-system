const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

if (!content.includes('sendMediaWithKeyboard')) {
  content = content.replace(
    'sendMessageWithInlineKeyboard,',
    'sendMessageWithInlineKeyboard,\n  sendMediaWithKeyboard,'
  );
}

const pattern = /let finalCaption = fullText;[\s\S]*?(?=\s*\}\s*\n\s*\/\/ ─── Notifications)/;
const replacement = `let finalCaption = fullText;
    if (e.photo_urls.length > 1) {
      finalCaption += \`\\n\\n📸 <i>(هذه البطاقة تحتوي على \${e.photo_urls.length} صور)</i>\`;
    }

    try {
      await sendMediaWithKeyboard(chatId, e.photo_urls, finalCaption, inlineButtons);
    } catch (err) {
      console.error("Failed to send eval card", err);
      await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
    }`;

content = content.replace(pattern, replacement);

fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
