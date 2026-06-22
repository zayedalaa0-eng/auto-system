const fs = require('fs');
let content = fs.readFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', 'utf-8');

const oldStart = `  // Placeholder banner URL
  const bannerUrl = "https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&w=1200&q=80";

  try {
    const { sendPhoto } = require('./api');
    return await sendPhoto(chatId, bannerUrl, welcome, menuKeyboard(user, isMaalam));`;

const newStart = `  // Dynamic banner based on branch
  const appUrl = require('./api').getAppUrl();
  let bannerUrl = \`\${appUrl}/logos/lemalem.jpg\`; // Default

  const branch = user.branch_name || "";
  if (branch.includes("شيري")) {
    bannerUrl = \`\${appUrl}/logos/chery.jpg\`;
  } else if (branch.includes("فورثنج") || branch.includes("فورثينج")) {
    bannerUrl = \`\${appUrl}/logos/forthing.jpg\`;
  }

  try {
    const { sendPhoto } = require('./api');
    return await sendPhoto(chatId, bannerUrl, welcome, menuKeyboard(user, isMaalam));`;

if(content.includes('// Placeholder banner URL')) {
  content = content.replace(oldStart, newStart);
  fs.writeFileSync('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src/lib/telegram/handlers.ts', content);
  console.log("Success Banners");
} else {
  console.log("Not found");
}
