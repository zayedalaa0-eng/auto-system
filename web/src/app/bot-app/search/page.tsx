"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

type TelegramWebApp = {
  initDataUnsafe: { user?: { id?: number } };
  ready(): void; expand(): void;
  themeParams: {
    bg_color?: string; text_color?: string; hint_color?: string;
    button_color?: string; button_text_color?: string;
    secondary_bg_color?: string;
  };
  colorScheme?: "light" | "dark";
};
// نستخدم any لتجنب تعارض declare global مع الملفات الأخرى
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTelegramApp = (): TelegramWebApp | undefined => (window as any).Telegram?.WebApp;

type Customer = {
  id: string;
  full_name: string;
  nickname: string | null;
  phone: string;
  status: string;
  is_active: boolean;
  next_follow_up_at: string | null;
  operation_type: string | null;
};

function getStatusColor(s: string): string {
  if (s.includes("تمت عملية البيع")) return "#16a34a";
  if (s.includes("حجز")) return "#2563eb";
  if (s.includes("رفض") || s.includes("تراجع") || s.includes("إغلاق")) return "#dc2626";
  if (s.includes("بانتظار") || s.includes("استبدال")) return "#d97706";
  if (s.includes("جديد")) return "#7c3aed";
  return "#6b7280";
}

function opBadge(op: string | null): string {
  if (!op) return "مشتري";
  if (op === "sell_on_behalf") return "بيع بالوكالة";
  if (op.includes("tradein")) return "استبدال";
  return "مشتري";
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

export default function SearchPage() {
  const [chatId, setChatId]     = useState<string | null>(null);
  const [tg, setTg]             = useState<TelegramWebApp | null>(null);
  const [isDark, setIsDark]     = useState(false);

  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Customer[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(false);
  const [page, setPage]         = useState(1);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Init ──────────────────────────────────────────────────── */
  useEffect(() => {
    const app = getTelegramApp();
    if (app) { app.ready(); app.expand(); setTg(app); setIsDark(app.colorScheme === "dark"); }
    const p = new URLSearchParams(window.location.search);
    const chat = p.get("chat_id") ?? String(app?.initDataUnsafe?.user?.id ?? "");
    setChatId(chat);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  /* ── Theme ─────────────────────────────────────────────────── */
  const tp     = tg?.themeParams ?? {};
  const bg     = tp.bg_color           ?? (isDark ? "#1c1c1e" : "#f2f2f7");
  const cardBg = tp.secondary_bg_color ?? (isDark ? "#2c2c2e" : "#ffffff");
  const text   = tp.text_color         ?? (isDark ? "#ffffff" : "#000000");
  const hint   = tp.hint_color         ?? (isDark ? "#8e8e93" : "#6b7280");
  const btnBg  = tp.button_color       ?? "#2563eb";
  const btnTxt = tp.button_text_color  ?? "#ffffff";
  const border = isDark ? "#3a3a3c" : "#e5e7eb";
  const inputBg = isDark ? "#3a3a3c" : "#ffffff";

  /* ── Search ────────────────────────────────────────────────── */
  const doSearch = useCallback(async (q: string, pg: number, append: boolean) => {
    if (!chatId || q.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bot-app/search?chat_id=${chatId}&q=${encodeURIComponent(q)}&page=${pg}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "حدث خطأ"); return; }
      setResults(prev => append ? [...prev, ...(json.customers ?? [])] : (json.customers ?? []));
      setHasMore(json.hasMore ?? false);
      setPage(pg);
      setSearched(true);
    } catch {
      setError("تعذر الاتصال");
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  function handleInput(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(() => doSearch(val.trim(), 1, false), 400);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query.trim(), 1, false);
  }

  function openCustomer(id: string) {
    window.location.href = `/bot-app/customer?id=${id}&chat_id=${chatId ?? ""}`;
  }

  return (
    <div style={{
      minHeight: "100vh", background: bg, color: text,
      fontFamily: "system-ui, sans-serif", direction: "rtl",
    }}>

      {/* ── هيدر البحث ── */}
      <div style={{
        background: cardBg, borderBottom: `1px solid ${border}`,
        padding: "12px 14px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: text }}>
          🔍 البحث عن عميل
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو اللقب..."
            autoComplete="off"
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 12,
              border: `1.5px solid ${border}`, background: inputBg, color: text,
              fontSize: 15, fontFamily: "inherit", outline: "none",
              direction: "rtl", boxSizing: "border-box",
            }}
          />
          <button type="submit" disabled={query.trim().length < 2 || loading} style={{
            padding: "11px 16px", borderRadius: 12, border: "none",
            background: query.trim().length < 2 ? hint : btnBg,
            color: btnTxt, fontSize: 14, fontWeight: 700, cursor: "pointer",
            flexShrink: 0,
          }}>
            {loading ? "⏳" : "بحث"}
          </button>
        </form>
      </div>

      {/* ── المحتوى ── */}
      <div style={{ padding: "10px 10px 80px" }}>

        {/* حالة فارغة */}
        {!searched && !loading && (
          <div style={{
            textAlign: "center", padding: "50px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          }}>
            <div style={{ fontSize: 52 }}>🔍</div>
            <div style={{ color: hint, fontSize: 15, fontWeight: 600 }}>ابحث عن أي عميل</div>
            <div style={{ color: hint, fontSize: 13 }}>
              بالاسم الكامل، رقم الهاتف، أو اللقب
            </div>
          </div>
        )}

        {/* خطأ */}
        {error && (
          <div style={{
            background: isDark ? "#3f1f1f" : "#fef2f2", border: "1px solid #fca5a5",
            borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "#b91c1c",
            marginBottom: 10,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* لا نتائج */}
        {searched && !loading && results.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>😶</div>
            <div style={{ color: hint, fontSize: 14 }}>لا توجد نتائج لـ «{query}»</div>
          </div>
        )}

        {/* النتائج */}
        {results.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: hint, marginBottom: 8, paddingRight: 4 }}>
              {results.length} نتيجة{hasMore ? "+" : ""}
            </div>

            {results.map(c => {
              const statusColor = getStatusColor(c.status);
              const isClosed = !c.is_active;
              return (
                <button
                  key={c.id}
                  onClick={() => openCustomer(c.id)}
                  style={{
                    width: "100%", background: cardBg, border: `1px solid ${border}`,
                    borderRadius: 14, padding: "13px 14px", marginBottom: 8,
                    textAlign: "right", cursor: "pointer", display: "block",
                    opacity: isClosed ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* أفاتار */}
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg,${btnBg}cc,${btnBg}55)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 700, color: "#fff",
                    }}>
                      {c.full_name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* الاسم + مغلق */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: text }}>
                          {c.full_name}
                        </span>
                        {c.nickname && (
                          <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>
                            {c.nickname}
                          </span>
                        )}
                        {isClosed && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "#b91c1c",
                            background: "#fef2f2", borderRadius: 99, padding: "1px 7px",
                            border: "1px solid #fca5a5",
                          }}>🔒 مغلق</span>
                        )}
                      </div>

                      {/* الهاتف */}
                      <div style={{ fontSize: 13, color: hint, fontFamily: "monospace", marginTop: 2 }}>
                        {c.phone}
                      </div>

                      {/* بادجات */}
                      <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                          background: `${statusColor}18`, color: statusColor,
                          border: `1px solid ${statusColor}33`,
                        }}>
                          {c.status}
                        </span>
                        <span style={{
                          fontSize: 11, color: hint, padding: "2px 9px", borderRadius: 99,
                          background: isDark ? "#3a3a3c" : "#f3f4f6",
                        }}>
                          {opBadge(c.operation_type)}
                        </span>
                        {c.next_follow_up_at && !isClosed && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: "#0ea5e9",
                            background: "#0ea5e911", borderRadius: 99, padding: "2px 8px",
                            border: "1px solid #0ea5e933",
                          }}>
                            📅 {fmtDate(c.next_follow_up_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* سهم */}
                    <div style={{ color: hint, fontSize: 18, alignSelf: "center", flexShrink: 0 }}>
                      ‹
                    </div>
                  </div>
                </button>
              );
            })}

            {/* تحميل المزيد */}
            {hasMore && (
              <button
                onClick={() => doSearch(query.trim(), page + 1, true)}
                disabled={loading}
                style={{
                  width: "100%", padding: "13px", borderRadius: 12,
                  border: `1.5px solid ${border}`, background: "transparent",
                  color: loading ? hint : btnBg, fontSize: 14, fontWeight: 700,
                  cursor: loading ? "default" : "pointer", marginTop: 4,
                }}
              >
                {loading ? "⏳ جاري التحميل..." : "تحميل المزيد"}
              </button>
            )}
          </>
        )}

        {/* مؤشر تحميل أولي */}
        {loading && results.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: hint }}>
            ⏳ جاري البحث...
          </div>
        )}
      </div>
    </div>
  );
}
