"use client";

import { useEffect, useRef, useState } from "react";

type TelegramWebApp = {
  initDataUnsafe: { user?: { id?: number } };
  ready(): void;
  close(): void;
  expand(): void;
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
};

const STATUSES = [
  "عميل جديد",
  "متابعة",
  "حجز",
  "بيع مكتمل",
  "غير مهتم",
];

export default function AddCustomerMiniApp() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    status: "عميل جديد",
    requested_car: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const twa = useRef<TelegramWebApp | null>(null);

  useEffect(() => {
    // Load Telegram SDK dynamically
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      twa.current = ((window as any).Telegram?.WebApp as TelegramWebApp | undefined) ?? null;
      if (twa.current) {
        twa.current.ready();
        twa.current.expand();
        const uid = twa.current.initDataUnsafe?.user?.id;
        if (uid) setChatId(String(uid));
      }
    };
    document.head.appendChild(script);

    // Fallback: read chat_id from URL query param (for testing)
    const params = new URLSearchParams(window.location.search);
    const qChatId = params.get("chat_id");
    if (qChatId) setChatId(qChatId);
  }, []);

  const isValid = form.full_name.trim().length > 1 && form.phone.trim().length > 5;

  async function submit() {
    if (!isValid || loading) return;
    if (!chatId) {
      setError("تعذر التعرف على المستخدم. افتح هذه الصفحة من داخل البوت.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bot-app/add-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, ...form }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "حدث خطأ، حاول مجدداً.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => twa.current?.close(), 1800);
    } catch {
      setError("تعذر الاتصال بالخادم.");
      setLoading(false);
    }
  }

  const tp = twa.current?.themeParams ?? {};
  const bg = tp.bg_color ?? "#f8fafc";
  const text = tp.text_color ?? "#1e293b";
  const hint = tp.hint_color ?? "#64748b";
  const btnBg = tp.button_color ?? "#0ea5e9";
  const btnText = tp.button_text_color ?? "#ffffff";
  const inputBg = tp.secondary_bg_color ?? "#ffffff";

  if (success) {
    return (
      <div style={{ background: bg, color: text, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "system-ui, sans-serif", direction: "rtl" }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>تم إضافة العميل بنجاح!</div>
        <div style={{ color: hint, fontSize: 14 }}>جارٍ الإغلاق...</div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, color: text, minHeight: "100dvh", fontFamily: "system-ui, sans-serif", direction: "rtl", padding: "16px 16px 100px" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
        ➕ إضافة عميل جديد
      </h1>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Full name */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: hint }}>الاسم الكامل *</span>
          <input
            type="text"
            placeholder="أدخل اسم العميل"
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            style={inputStyle(inputBg, text)}
          />
        </label>

        {/* Phone */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: hint }}>رقم الهاتف *</span>
          <input
            type="tel"
            placeholder="05xxxxxxxx"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            style={inputStyle(inputBg, text)}
          />
        </label>

        {/* Status */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: hint }}>الحالة</span>
          <select
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            style={inputStyle(inputBg, text)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Requested car */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: hint }}>السيارة المطلوبة</span>
          <input
            type="text"
            placeholder="مثال: كامري 2024"
            value={form.requested_car}
            onChange={(e) => setForm((p) => ({ ...p, requested_car: e.target.value }))}
            style={inputStyle(inputBg, text)}
          />
        </label>

        {/* Notes */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: hint }}>ملاحظات</span>
          <textarea
            rows={3}
            placeholder="أي ملاحظات إضافية..."
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            style={{ ...inputStyle(inputBg, text), resize: "vertical" }}
          />
        </label>

      </div>

      {/* Submit button */}
      <div style={{ position: "fixed", bottom: 0, right: 0, left: 0, padding: "12px 16px", background: bg, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <button
          onClick={submit}
          disabled={!isValid || loading}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: (!isValid || loading) ? "#94a3b8" : btnBg,
            color: btnText,
            fontSize: 16,
            fontWeight: 700,
            cursor: (!isValid || loading) ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            fontFamily: "inherit",
          }}
        >
          {loading ? "جارٍ الحفظ..." : "✅ حفظ العميل"}
        </button>
      </div>
    </div>
  );
}

function inputStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: "1.5px solid rgba(0,0,0,0.1)",
    borderRadius: 10,
    padding: "11px 13px",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    direction: "rtl",
  };
}
