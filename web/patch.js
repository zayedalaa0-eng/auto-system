const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

content = content.replace(
  'sendMessageWithInlineKeyboard,',
  'sendMediaWithKeyboard,\n  sendMessageWithInlineKeyboard,'
);

const oldBlock = `    try {
      if (e.photo_urls.length > 0) {
        const photoRes = await fetch(\`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: e.photo_urls[0],
            caption: finalCaption,
            parse_mode: "HTML",
            reply_markup: replyMarkupInline,
          }),
        });
        const json = await photoRes.json();
        if (!json.ok) {
          console.error("Telegram error sending photo:", json);
          await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
        }
      } else {
        await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
      }
    } catch (err) {
      console.error("Failed to send eval card", err);
      await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
    }`;

const newBlock = `    try {
      await sendMediaWithKeyboard(chatId, e.photo_urls, finalCaption, inlineButtons);
    } catch (err) {
      console.error("Failed to send eval card", err);
      await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
    }`;

content = content.replace(oldBlock, newBlock);

fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
