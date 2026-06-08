"use client";

import React, { useEffect, useRef, useState } from "react";

type TelegramWebApp = {
  initDataUnsafe: { user?: { id?: number } };
  ready(): void; expand(): void; close(): void;
  themeParams: {
    bg_color?: string; text_color?: string; hint_color?: string;
    button_color?: string; button_text_color?: string;
    secondary_bg_color?: string;
  };
  colorScheme?: "light" | "dark";
};

export default function SendMessagePage() {
  const twaRef = useRef<TelegramWebApp | null>(null);
  const [chatId,    setChatId]    = useState<string | null>(null);
  const [toChatId,  setToChatId]  = useState<string | null>(null);
  const [custId,    setCustId]    = useState<string | null>(null);
  const [isDark,    setIsDark]    = useState(false);
  const [msg,       setMsg]       = useState("");
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).Telegram?.WebApp as TelegramWebApp | undefined;
    if (app) { app.ready(); app.expand(); twaRef.current = app; setIsDark(app.colorScheme === "dark"); }
    const p = new URLSearchParams(window.location.search);
    const chat = p.get("chat_id") ?? String(app?.initDataUnsafe?.user?.id ?? "");
    setChatId(chat);
    setToChatId(p.get("to_chat_id"));
    setCustId(p.get("customer_id") || null);

    // جلب اسم الموظف المستقبِل
    const toChat = p.get("to_chat_id");
    if (toChat && chat) {
      fetch(`/api/bot-app/staff-name?chat_id=${toChat}`)
        .then(r => r.json())
        .then(d => { if (d.name) setStaffName(d.name); })
        .catch(() => {});
    }
    setTimeout(() => textRef.current?.focus(), 300);
  }, []);

  const tp     = twaRef.current?.themeParams ?? {};
  const bg     = tp.bg_color           ?? (isDark ? "#1c1c1e" : "#f2f2f7");
  const cardBg = tp.secondary_bg_color ?? (isDark ? "#2c2c2e" : "#ffffff");
  const text   = tp.text_color         ?? (isDark ? "#ffffff" : "#000000");
  const hint   = tp.hint_color         ?? (isDark ? "#8e8e93" : "#6b7280");
  const btnBg  = tp.button_color       ?? "#2563eb";
  const btnTxt = tp.button_text_color  ?? "#ffffff";
  const border = isDark ? "#3a3a3c" : "#e5e7eb";

  async function handleSend() {
    if (!msg.trim() || !toChatId || !chatId) return;
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/bot-app/send-direct-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_chat_id: chatId,
          to_chat_id: toChatId,
          message: msg.trim(),
          customer_id: custId,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "تعذر الإرسال"); return; }
      setSent(true);
    } catch {
      setError("تعذر الاتصال");
    } finally {
      setSending(false);
    }
  }

  if (sent) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", direction: "rtl", padding: "24px 20px" }}>
      <div style={{ background: cardBg, borderRadius: 20, padding: "28px 24px", textAlign: "center", width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 6 }}>تم الإرسال بنجاح!</div>
        <div style={{ fontSize: 13, color: hint, marginBottom: 24 }}>وصلت رسالتك إلى {staffName ?? "الموظف"}</div>
        <button onClick={() => { try { (twaRef.current as any).close(); } catch { window.close(); } }}
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: btnBg, color: btnTxt, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          إغلاق
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "system-ui,sans-serif", direction: "rtl", padding: "16px 14px 100px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>💬 رسالة للموظف</div>
        <div style={{ fontSize: 13, color: hint, marginTop: 4 }}>
          إلى: <strong>{staffName ?? "الموظف"}</strong>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <textarea
        ref={textRef}
        value={msg}
        onChange={e => setMsg(e.target.value)}
        rows={6}
        placeholder="اكتب رسالتك هنا..."
        style={{
          width: "100%", boxSizing: "border-box",
          background: cardBg, color: text,
          border: `1.5px solid ${border}`, borderRadius: 14,
          padding: "13px", fontSize: 15, fontFamily: "inherit",
          direction: "rtl", outline: "none", resize: "none",
        }}
      />
      <div style={{ fontSize: 12, color: hint, marginTop: 4 }}>{msg.length} حرف</div>

      <div style={{ position: "fixed", bottom: 0, right: 0, left: 0, padding: "10px 14px", background: bg, borderTop: `1px solid ${border}` }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { try { (twaRef.current as any).close(); } catch { window.close(); } }}
            style={{ flex: 1, padding: "13px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            إلغاء
          </button>
          <button onClick={handleSend} disabled={!msg.trim() || sending}
            style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: !msg.trim() ? hint : btnBg, color: btnTxt, fontSize: 15, fontWeight: 700, cursor: !msg.trim() ? "default" : "pointer" }}>
            {sending ? "⏳ جاري الإرسال..." : "✉️ إرسال"}
          </button>
        </div>
      </div>
    </div>
  );
}
