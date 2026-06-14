"use client";

import { useTransition, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { markNotificationReadAction, sendEvaluationReplyAction } from "@/app/dashboard/actions";
import type { NotificationsCenterItem } from "@/lib/data";
import { formatRelativeDate } from "@/lib/format";

type KindFilter = "all" | "new_customer" | "customer_update" | "sales_opportunity" | "followup" | "other";

function getNotificationKind(item: NotificationsCenterItem): KindFilter {
  const payload = item.payload ?? {};
  const source = typeof payload.source === "string" ? payload.source : "";
  const title = (item.title ?? "").trim();
  if (source === "customer_create" || title.includes("إضافة عميل")) return "new_customer";
  if (source === "customer_update" || title.includes("تحديث ملف")) return "customer_update";
  if (source === "inventory_opportunity" || title.includes("فرصة")) return "sales_opportunity";
  if (source === "manual_reminder" || item.notification_type === "manual_reminder") return "followup";
  return "other";
}

const KIND_COLORS: Record<KindFilter, { bg: string; text: string; dot: string }> = {
  all:               { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  new_customer:      { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  customer_update:   { bg: "#fefce8", text: "#854d0e", dot: "#eab308" },
  sales_opportunity: { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" },
  followup:          { bg: "#fdf4ff", text: "#7e22ce", dot: "#a855f7" },
  other:             { bg: "#f8fafc", text: "#475569", dot: "#94a3b8" },
};

const KIND_LABELS: Record<KindFilter, string> = {
  all:               "الكل",
  new_customer:      "عميل جديد",
  customer_update:   "تعديل بيانات",
  sales_opportunity: "فرص بيع",
  followup:          "متابعة",
  other:             "أخرى",
};

const KIND_ICONS: Record<KindFilter, string> = {
  all:               "🔔",
  new_customer:      "➕",
  customer_update:   "📝",
  sales_opportunity: "🏷️",
  followup:          "📅",
  other:             "📢",
};

function EvaluationReplyForm({ item }: { item: NotificationsCenterItem }) {
  const [open, setOpen]       = useState(false);
  const [price, setPrice]     = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const payload = item.payload ?? {};

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setErr(null);
    const fd = new FormData();
    fd.set("notification_id",  item.id);
    fd.set("customer_id",      String(payload.customer_id ?? ""));
    fd.set("actor_user_id",    String(payload.actor_user_id ?? ""));
    fd.set("price",            price);
    const res = await sendEvaluationReplyAction(fd);
    setSending(false);
    if (res.error) { setErr(res.error); return; }
    setDone(true); setOpen(false);
  }

  if (done) {
    return (
      <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8,
        background: "#f0fdf4", color: "#166534", fontSize: 13, fontWeight: 600 }}>
        ✅ تم إرسال قيمة التقييم بنجاح
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 16px", borderRadius: 8, border: "1.5px solid #0ea5e9",
            background: "#f0f9ff", color: "#0369a1", fontSize: 13, fontWeight: 700,
            cursor: "pointer",
          }}
        >
          💰 إرسال قيمة التقييم
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            min="1"
            placeholder="قيمة التقييم (₪)"
            value={price}
            onChange={e => setPrice(e.target.value)}
            required
            style={{
              height: 36, borderRadius: 8, border: "1.5px solid #bae6fd",
              padding: "0 12px", fontSize: 14, outline: "none",
              background: "#f8fafc", color: "#0f172a", direction: "rtl", width: 180,
            }}
          />
          <button
            type="submit"
            disabled={sending || !price}
            style={{
              height: 36, padding: "0 16px", borderRadius: 8, border: "none",
              background: sending ? "#94a3b8" : "#0ea5e9", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "جارٍ الإرسال..." : "إرسال"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              height: 36, padding: "0 12px", borderRadius: 8,
              border: "1px solid #e2e8f0", background: "#fff",
              color: "#64748b", fontSize: 13, cursor: "pointer",
            }}
          >
            إلغاء
          </button>
          {err && <span style={{ color: "#dc2626", fontSize: 12 }}>{err}</span>}
        </form>
      )}
    </div>
  );
}

function NotificationCard({ item }: { item: NotificationsCenterItem }) {
  const [expanded, setExpanded] = useState(false);
  const [read, setRead] = useState(item.status !== "unread");
  const [, startTransition] = useTransition();
  const isUnread = !read;
  const kind = getNotificationKind(item);
  const colors = KIND_COLORS[kind];

  function handleToggle() {
    if (!expanded && isUnread) {
      // mark as read automatically when opening
      setRead(true);
      const fd = new FormData();
      fd.set("notification_id", item.id);
      startTransition(() => { void markNotificationReadAction(fd); });
    }
    setExpanded((v) => !v);
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: isUnread ? "1.5px solid #bae6fd" : "1px solid #e2e8f0",
        background: isUnread ? "#f0f9ff" : "#fff",
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
    >
      {/* ── Collapsed row (always visible) ── */}
      <button
        type="button"
        onClick={handleToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "right",
        }}
      >
        {/* unread dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isUnread ? "#0ea5e9" : "transparent",
            border: isUnread ? "none" : "1.5px solid #cbd5e1",
            flexShrink: 0,
          }}
        />

        {/* kind badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            borderRadius: 20,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
            background: colors.bg,
            color: colors.text,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {KIND_ICONS[kind]} {KIND_LABELS[kind]}
        </span>

        {/* title */}
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: isUnread ? 700 : 600,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "right",
          }}
        >
          {item.title ?? "تنبيه"}
          {item.recipient_label && (
            <span style={{ color: "#3b82f6", fontWeight: 600, marginRight: 6 }}>
              · {item.recipient_label}
            </span>
          )}
        </span>

        {/* relative time */}
        <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, whiteSpace: "nowrap" }}>
          {formatRelativeDate(item.created_at)}
        </span>

        {/* chevron */}
        <span style={{ color: "#94a3b8", flexShrink: 0 }}>
          {expanded
            ? <ChevronUp style={{ width: 15, height: 15 }} />
            : <ChevronDown style={{ width: 15, height: 15 }} />}
        </span>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* message rendered as HTML */}
          <div
            style={{ fontSize: 13, color: "#334155", lineHeight: 1.75 }}
            dangerouslySetInnerHTML={{
              __html: item.message
                // Convert newlines to <br>
                .replace(/\n/g, "<br>")
                // Remove raw dashes used as separators and replace with styled divider
                .replace(/\s*-{3,}\s*/g, " · "),
            }}
          />

          {/* زر رد التقييم لمدير معرض المعلم */}
          {item.notification_type === "trade_in_evaluation" &&
            Boolean((item.payload as Record<string,unknown>)?.customer_id) && (
            <EvaluationReplyForm item={item} />
          )}

          {/* footer: relative time */}
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {formatRelativeDate(item.created_at)}
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationsList({ items }: { items: NotificationsCenterItem[] }) {
  if (items.length === 0) {
    return <div className="empty-state">لا توجد تنبيهات مطابقة للفلاتر الحالية.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item) => (
        <NotificationCard key={item.id} item={item} />
      ))}
    </div>
  );
}
