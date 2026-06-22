const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

const searchPrefix = `let finalCaption = fullText;`;
const searchSuffix = `  }`;

const startIdx = content.indexOf('let finalCaption = fullText;', 930 * 20); // skip early matches
if (startIdx === -1) {
  console.log("Not found!");
  process.exit(1);
}
const endIdx = content.indexOf('  }', startIdx + 100);
if (endIdx === -1) {
  console.log("End not found");
  process.exit(1);
}

const replacement = `let finalCaption = fullText;
    if (e.photo_urls.length > 1) {
      finalCaption += \`\\n\\n📸 <i>(هذه البطاقة تحتوي على \${e.photo_urls.length} صور)</i>\`;
    }

    try {
      await sendMediaWithKeyboard(chatId, e.photo_urls, finalCaption, inlineButtons);
    } catch (err) {
      console.error("Failed to send eval card", err);
      await sendMessage(chatId, finalCaption, { replyMarkup: replyMarkupInline });
    }
  }`;

const before = content.substring(0, startIdx);
const after = content.substring(endIdx + 3);

fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', before + replacement + after);
console.log("Done");
