const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

const oldBlock = `    let finalCaption = fullText;
    if (e.photo_urls.length > 1) {
      finalCaption += \`\\n\\n📸 <i>(مرفق \${e.photo_urls.length} صور — اضغط زر فتح البطاقة لرؤيتها جميعاً)</i>\`;
    }

    try {
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
        const photoJson = await photoRes.json() as { ok: boolean };
        if (!photoJson.ok) {
          // إذا فشل (مثلاً النص طويل جداً أو الرابط منتهي) — نرسل نص فقط
          await fetch(\`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}/sendMessage\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: "HTML", reply_markup: replyMarkupInline }),
          });
        }
      } else {
        // لا توجد صور → رسالة نصية كاملة مع الأزرار
        await fetch(\`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}/sendMessage\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: "HTML", reply_markup: replyMarkupInline }),
        });
      }
    } catch (err) {
      console.error("Failed to send eval card", err);
      await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
    }`;

const newBlock = `    let finalCaption = fullText;
    if (e.photo_urls.length > 1) {
      finalCaption += \`\\n\\n📸 <i>(هذه البطاقة تحتوي على \${e.photo_urls.length} صور)</i>\`;
    }

    try {
      await sendMediaWithKeyboard(chatId, e.photo_urls, finalCaption, inlineButtons);
    } catch (err) {
      console.error("Failed to send eval card", err);
      await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
    }`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
