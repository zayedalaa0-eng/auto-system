"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type Props = {
  /** هل المودال مفتوح */
  open: boolean;
  /** عنوان الإجراء */
  title: string;
  /** وصف تحذيري */
  description: string;
  /** نص الزر بعد التأكيد */
  confirmLabel?: string;
  /** لون الزر: danger | warning | info */
  variant?: "danger" | "warning" | "info";
  /** عند الإغلاق */
  onClose: () => void;
  /** عند التأكيد الناجح */
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تنفيذ",
  variant = "danger",
  onClose,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // إعادة تهيئة الحقل عند كل فتح
  useEffect(() => {
    if (open) {
      setTyped("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  if (!open) return null;

  const isReady = typed.trim() === "تأكيد";

  const btnColor =
    variant === "danger"  ? "bg-rose-600 hover:bg-rose-700 text-white" :
    variant === "warning" ? "bg-amber-500 hover:bg-amber-600 text-white" :
                            "bg-sky-600 hover:bg-sky-700 text-white";

  const iconColor =
    variant === "danger"  ? "text-rose-500" :
    variant === "warning" ? "text-amber-500" :
                            "text-sky-500";

  return (
    <div
      className="legacy-album-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="legacy-album-card"
        style={{ maxWidth: 440, width: "95%", padding: 0, overflow: "hidden" }}
      >
        {/* Header */}
        <div className="legacy-album-head">
          <span style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle className={`h-5 w-5 ${iconColor}`} />
            {title}
          </span>
          <button
            type="button"
            className="legacy-album-close"
            onClick={onClose}
            aria-label="إغلاق"
            style={{ position: "static", width: 34, height: 34 }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }} dir="rtl">
          <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.7 }}>
            {description}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              اكتب كلمة <span style={{ color: "#dc2626", fontWeight: 700 }}>تأكيد</span> للمتابعة:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && isReady) onConfirm(); }}
              className="legacy-input"
              placeholder="تأكيد"
              autoComplete="off"
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              className="legacy-btn border"
              onClick={onClose}
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={!isReady}
              onClick={onConfirm}
              className={`legacy-btn transition-colors ${isReady ? btnColor : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
