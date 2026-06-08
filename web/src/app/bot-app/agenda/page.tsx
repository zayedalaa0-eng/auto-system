"use client";

import React, { useEffect, useState } from "react";

/* ── Telegram WebApp type ─────────────────────────────────────────────────── */
type TelegramWebApp = {
  initDataUnsafe: { user?: { id?: number } };
  ready(): void;
  expand(): void;
  close(): void;
  colorScheme?: "light" | "dark";
  themeParams: {
    bg_color?: string; text_color?: string; hint_color?: string;
    button_color?: string; button_text_color?: string;
    secondary_bg_color?: string;
  };
};
declare global { interface Window { Telegram?: { WebApp: TelegramWebApp } } }

/* ── Types ────────────────────────────────────────────────────────────────── */
type FollowupItem = {
  id: string; full_name: string; phone: string | null;
  status: string; requested_car: string | null; next_follow_up_at: string | null;
};

type ReminderItem = {
  id: string; title: string | null; message: string | null;
  due_at: string | null; customer_name: string | null;
};

type EvaluationItem = {
  id: string; customer_name: string; trade_in_model: string;
  trade_in_status: string | null;
};

type TradeItem = {
  id: string; customer_name: string; trade_in_model: string; missing_count: number;
};

type LicenseItem = {
  id: string; customer_name: string; trade_in_model: string; days: number;
};

type AgendaData = {
  followupsToday: FollowupItem[];
  followupsOverdue: FollowupItem[];
  reminders: ReminderItem[];
  pendingEvaluations: EvaluationItem[];
  incompleteTrades: TradeItem[];
  licenseDue: LicenseItem[];
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  } catch { return ""; }
}

function arabicDate(): string {
  const now = new Date(Date.now() + 3*60*60*1000);
  return `${String(now.getUTCDate()).padStart(2,"0")}/${String(now.getUTCMonth()+1).padStart(2,"0")}/${now.getUTCFullYear()}`;
}

/* ── Section Component ────────────────────────────────────────────────────── */
function Section({
  title, icon, count, color, children, defaultOpen = false,
}: {
  title: string; icon: string; count: number; color: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${color}33`,
      background: "#fff", overflow: "hidden", marginBottom: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "12px 14px",
          background: `${color}0d`, border: "none", cursor: "pointer",
          textAlign: "right",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title}</span>
          <span style={{
            background: color, color: "#fff", borderRadius: 20,
            padding: "2px 9px", fontSize: 12, fontWeight: 700,
          }}>{count}</span>
        </div>
        <span style={{ fontSize: 16, color, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </button>
      {open && <div style={{ padding: "10px 14px 14px" }}>{children}</div>}
    </div>
  );
}

/* ── Customer Card ────────────────────────────────────────────────────────── */
function CustomerCard({
  id, name, sub1, sub2, badge, badgeColor, chatId,
}: {
  id: string; name: string; sub1?: string; sub2?: string;
  badge?: string; badgeColor?: string; chatId: string | null;
}) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const cardUrl = `${appUrl}/bot-app/customer?id=${id}&chat_id=${chatId ?? ""}`;

  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0",
      background: "#f8fafc", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{name}</div>
          {sub1 && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{sub1}</div>}
          {sub2 && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>{sub2}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {badge && (
            <span style={{
              background: badgeColor ?? "#e2e8f0", color: "#fff",
              borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
              whiteSpace: "nowrap",
            }}>{badge}</span>
          )}
          <a
            href={cardUrl}
            style={{
              display: "inline-block", fontSize: 11, color: "#2563eb",
              textDecoration: "none", border: "1px solid #bfdbfe",
              borderRadius: 6, padding: "3px 8px", background: "#eff6ff",
            }}
          >
            فتح البطاقة ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function AgendaPage() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const uid = tg.initDataUnsafe?.user?.id;
      if (uid) setChatId(String(uid));
    }

    // Also try from URL params
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("chat_id");
    if (cid) setChatId(cid);
  }, []);

  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    fetch(`/api/bot-app/agenda?chat_id=${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setAgenda(d);
      })
      .catch(() => setError("تعذّر تحميل البيانات"))
      .finally(() => setLoading(false));
  }, [chatId]);

  const total = agenda
    ? agenda.followupsToday.length + agenda.followupsOverdue.length +
      agenda.reminders.length + agenda.pendingEvaluations.length +
      agenda.incompleteTrades.length + agenda.licenseDue.length
    : 0;

  return (
    <div style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      direction: "rtl",
      minHeight: "100vh",
      background: "#f1f5f9",
      paddingBottom: 30,
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
        padding: "18px 16px 16px",
        color: "#fff",
      }}>
        <div style={{ fontSize: 22, marginBottom: 2 }}>📅</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>الأجندة</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{arabicDate()}</div>
      </div>

      <div style={{ padding: "14px 12px 0" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div>جاري تحميل الأجندة...</div>
          </div>
        )}

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
            padding: 16, textAlign: "center", color: "#dc2626",
          }}>
            <div style={{ fontSize: 24 }}>⚠️</div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>{error}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#94a3b8" }}>تأكد من تسجيل الدخول ثم حاول مجدداً</div>
          </div>
        )}

        {!loading && !error && agenda && total === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b" }}>لا توجد مهام اليوم</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>كل شيء على ما يرام 🎉</div>
          </div>
        )}

        {!loading && !error && agenda && total > 0 && (
          <>
            {/* Summary Bar */}
            <div style={{
              background: "#fff", borderRadius: 12, padding: "10px 14px",
              marginBottom: 14, border: "1px solid #e2e8f0",
              display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
            }}>
              {agenda.followupsToday.length > 0 && (
                <span style={{ background: "#eff6ff", color: "#2563eb", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  ⏰ {agenda.followupsToday.length} متابعة اليوم
                </span>
              )}
              {agenda.followupsOverdue.length > 0 && (
                <span style={{ background: "#fff7ed", color: "#ea580c", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  ⚠️ {agenda.followupsOverdue.length} متأخرة
                </span>
              )}
              {agenda.reminders.length > 0 && (
                <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  🔔 {agenda.reminders.length} تذكير
                </span>
              )}
              {agenda.pendingEvaluations.length > 0 && (
                <span style={{ background: "#fefce8", color: "#ca8a04", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  🔍 {agenda.pendingEvaluations.length} تقييم
                </span>
              )}
              {agenda.incompleteTrades.length > 0 && (
                <span style={{ background: "#fdf4ff", color: "#9333ea", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  📋 {agenda.incompleteTrades.length} ناقصة
                </span>
              )}
              {agenda.licenseDue.length > 0 && (
                <span style={{ background: "#fff1f2", color: "#e11d48", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  📄 {agenda.licenseDue.length} رخصة
                </span>
              )}
            </div>

            {/* Section 1: متابعات اليوم */}
            <Section title="متابعات اليوم" icon="⏰" count={agenda.followupsToday.length} color="#2563eb" defaultOpen>
              {agenda.followupsToday.map((c) => (
                <CustomerCard
                  key={c.id} id={c.id} name={c.full_name}
                  sub1={`📌 ${c.status}${c.next_follow_up_at ? ` · 📅 ${formatDate(c.next_follow_up_at)}` : ""}`}
                  sub2={c.requested_car ? `🚗 ${c.requested_car}` : c.phone ?? undefined}
                  badge={c.phone ?? undefined} badgeColor="#2563eb" chatId={chatId}
                />
              ))}
            </Section>

            {/* Section 2: متابعات متأخرة */}
            <Section title="متابعات متأخرة" icon="⚠️" count={agenda.followupsOverdue.length} color="#ea580c" defaultOpen>
              {agenda.followupsOverdue.map((c) => {
                const overdueDays = c.next_follow_up_at
                  ? Math.floor((Date.now() - new Date(c.next_follow_up_at).getTime()) / 86400000)
                  : 0;
                return (
                  <CustomerCard
                    key={c.id} id={c.id} name={c.full_name}
                    sub1={`📌 ${c.status}`}
                    sub2={`⏰ متأخر ${overdueDays} يوم${c.requested_car ? ` · 🚗 ${c.requested_car}` : ""}`}
                    badge={`${overdueDays}d`} badgeColor="#ea580c" chatId={chatId}
                  />
                );
              })}
            </Section>

            {/* Section 3: تذكيرات معلقة */}
            <Section title="تذكيرات معلقة" icon="🔔" count={agenda.reminders.length} color="#16a34a">
              {agenda.reminders.map((r) => (
                <div key={r.id} style={{
                  padding: "10px 12px", borderRadius: 10,
                  border: "1px solid #dcfce7", background: "#f0fdf4", marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>
                    🔔 {r.title ?? r.message ?? "تذكير"}
                  </div>
                  {r.customer_name && (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                      👤 {r.customer_name}
                    </div>
                  )}
                  {r.due_at && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      📅 {formatDate(r.due_at)}
                    </div>
                  )}
                </div>
              ))}
            </Section>

            {/* Section 4: سيارات بانتظار التقييم */}
            <Section title="سيارات بانتظار التقييم" icon="🔍" count={agenda.pendingEvaluations.length} color="#ca8a04">
              {agenda.pendingEvaluations.map((e) => (
                <CustomerCard
                  key={e.id} id={e.id} name={e.customer_name}
                  sub1={`🚗 ${e.trade_in_model}`}
                  sub2={e.trade_in_status ? `📌 ${e.trade_in_status}` : undefined}
                  badge="بانتظار التقييم" badgeColor="#ca8a04" chatId={chatId}
                />
              ))}
            </Section>

            {/* Section 5: بيانات ناقصة */}
            <Section title="سيارات بيانات ناقصة" icon="📋" count={agenda.incompleteTrades.length} color="#9333ea">
              {agenda.incompleteTrades.map((t) => (
                <CustomerCard
                  key={t.id} id={t.id} name={t.customer_name}
                  sub1={`🚗 ${t.trade_in_model}`}
                  sub2={`⚠️ ${t.missing_count} حقل ناقص`}
                  badge={`${t.missing_count} ناقص`} badgeColor="#9333ea" chatId={chatId}
                />
              ))}
            </Section>

            {/* Section 6: رخص تنتهي */}
            <Section title="رخص تحتاج متابعة" icon="📄" count={agenda.licenseDue.length} color="#e11d48">
              {agenda.licenseDue.map((l) => {
                const daysLabel = l.days < 0
                  ? `منتهية منذ ${Math.abs(l.days)} يوم`
                  : l.days === 0 ? "تنتهي اليوم"
                  : `تنتهي خلال ${l.days} يوم`;
                const badgeColor = l.days < 0 ? "#dc2626" : l.days <= 7 ? "#ea580c" : "#ca8a04";
                return (
                  <CustomerCard
                    key={l.id} id={l.id} name={l.customer_name}
                    sub1={`🚗 ${l.trade_in_model}`}
                    sub2={`🗓 ${daysLabel}`}
                    badge={daysLabel} badgeColor={badgeColor} chatId={chatId}
                  />
                );
              })}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
