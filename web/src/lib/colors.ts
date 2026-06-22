export const COLOR_MAP: [string[], string, string][] = [
  [["اسود", "سوداء", "black"],              "#1c1917", "#1c1917"],
  [["رمادي", "رصاصي", "grey", "gray"],      "#9ca3af", "#9ca3af"],
  [["فضي", "سيلفر", "silver"],              "#cbd5e1", "#94a3b8"],
  [["احمر", "حمراء", "red"],                "#ef4444", "#ef4444"],
  [["فيراني"],                               "#7a8a7a", "#6b7a6b"],
  [["كحلي", "نيلي", "navy"],               "#1e3a8a", "#1e3a8a"],
  [["ازرق", "زرقاء", "blue"],              "#3b82f6", "#3b82f6"],
  [["سماوي", "تركواز", "تيفاني", "tiffany", "turquoise"], "#2dd4bf", "#2dd4bf"],
  [["اخضر", "خضراء", "green"],             "#22c55e", "#22c55e"],
  [["زيتي", "olive"],                       "#84cc16", "#84cc16"],
  [["اصفر", "صفراء", "yellow"],            "#eab308", "#eab308"],
  [["ذهبي", "ذهبيه", "gold"],              "#f59e0b", "#d97706"],
  [["شمبانيا", "شامبين", "شمباني", "champagne"], "#f3e0b5", "#d4b896"],
  [["بيج", "كريمي", "beige", "cream"],     "#e8dcc8", "#c9b99a"],
  [["نهدي", "لبني", "عاجي", "ivory"],      "#f5f0e8", "#d6c9b0"],
  [["باطوني", "اسمنتي", "سيمنتي", "concrete", "cement"], "#b0b8c1", "#8a9099"],
  [["تيتانيوم", "titanium"],               "#8d9299", "#6b7280"],
  [["برتقالي", "برتقاليه", "orange"],      "#f97316", "#f97316"],
  [["بني", "بنيه", "كافيه", "brown"],      "#92400e", "#92400e"],
  [["خمري", "بورجندي", "burgundy", "wine"],"#881337", "#881337"],
  [["بنفسجي", "بنفسجيه", "purple"],        "#a855f7", "#a855f7"],
  [["وردي", "ورديه", "pink"],              "#ec4899", "#ec4899"],
  [["عسلي", "قهوائي", "mocha", "hazel"],   "#c8956c", "#a07040"],
  [["رصاصي غامق", "انثراسيت", "anthracite"], "#4b5563", "#374151"],
];

export function normalizeArabicColor(text: string): string {
  return text
    .replace(/[أإآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[ؤئ]/g, "و")
    .toLowerCase();
}

export function getColorSwatch(value: string | null | undefined): { bg: string; border: string } | null {
  if (!value) return null;
  const norm = normalizeArabicColor(value);
  for (const [keywords, bg, border] of COLOR_MAP) {
    if (keywords.some((kw) => norm.includes(kw))) return { bg, border };
  }
  return null;
}

export function getColorEmoji(value: string | null | undefined): string {
  if (!value) return "⚪";
  const norm = normalizeArabicColor(value);
  if (norm.includes("اسود") || norm.includes("سوداء") || norm.includes("black")) return "⚫";
  if (norm.includes("ابيض") || norm.includes("بيضاء") || norm.includes("white")) return "⚪";
  if (norm.includes("احمر") || norm.includes("حمراء") || norm.includes("red")) return "🔴";
  if (norm.includes("ازرق") || norm.includes("زرقاء") || norm.includes("blue") || norm.includes("كحلي")) return "🔵";
  if (norm.includes("اخضر") || norm.includes("خضراء") || norm.includes("green") || norm.includes("زيتي")) return "🟢";
  if (norm.includes("اصفر") || norm.includes("صفراء") || norm.includes("yellow") || norm.includes("ذهبي")) return "🟡";
  if (norm.includes("برتقالي") || norm.includes("orange")) return "🟠";
  if (norm.includes("بنفسجي") || norm.includes("purple") || norm.includes("وردي") || norm.includes("pink")) return "🟣";
  if (norm.includes("بني") || norm.includes("كافيه") || norm.includes("brown") || norm.includes("عسلي")) return "🟤";
  return "🔘";
}
