"use client";

import { useEffect } from "react";

export default function BotAppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Attempt to read Telegram color scheme and apply it
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      
      const applyTheme = () => {
        if (tg.colorScheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      };

      applyTheme();
      tg.onEvent("themeChanged", applyTheme);
      
      return () => {
        tg.offEvent("themeChanged", applyTheme);
      };
    }
  }, []);

  return (
    <>
      <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      {children}
    </>
  );
}
