const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

const oldLine = `    await answerCallbackQuery(cq.id);`;
const newLine = `    let toastText = undefined;
    if (cq.data?.startsWith("inv_")) toastText = "⏳ جاري جلب السيارات...";
    else if (cq.data?.startsWith("invcar:")) toastText = "⏳ جاري إعداد البطاقة...";
    else if (cq.data?.startsWith("my_")) toastText = "⏳ جاري جلب العملاء...";
    else if (cq.data?.startsWith("history:")) toastText = "⏳ جاري جلب السجل...";
    else if (cq.data === "inventory_menu") toastText = "🏠 العودة للمخزون";
    else if (cq.data === "main_menu") toastText = "🏠 القائمة الرئيسية";
    await answerCallbackQuery(cq.id, toastText);`;

if(content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
  console.log("Success Toast");
} else {
  console.log("Not found");
}
