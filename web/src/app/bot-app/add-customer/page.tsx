"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

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
    section_bg_color?: string;
  };
  colorScheme?: "light" | "dark";
};

type InventoryOption = { id: string; label: string; model: string };
type StaffOption = { id: string; full_name: string };

type FormData = {
  statuses: string[];
  sources: string[];
  inventoryOptions: InventoryOption[];
  staff: StaffOption[];
  currentUserId: string;
  isManager: boolean;
};

const CLOSED_STATUSES = ["تم البيع", "تمت صفقة استبدال", "رفض من قبل العميل", "رفض من قبل المعرض", "العميل غير فعال"];

// ─── Inline Voice Recorder ────────────────────────────────────────────────────
type VoiceState = "idle" | "requesting" | "recording" | "done" | "error";

function formatDur(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function InlineVoiceRecorder({
  onFileReady,
  colors,
}: {
  onFileReady: (file: File | null) => void;
  colors: { btn: string; btnText: string; hint: string; border: string; card: string; text: string };
}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setErrMsg("");
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mrRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const dur = durRef.current;
        setDuration(dur);
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes("webm") ? "webm" : "mp4";
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: mime });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("done");
        onFileReady(file);
      };

      mr.start(250);
      setState("recording");
      setDuration(0);
      durRef.current = 0;
      timerRef.current = setInterval(() => {
        durRef.current += 1;
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setState("error");
      setErrMsg((err as { name?: string }).name === "NotAllowedError" ? "لم يُمنح إذن المايكروفون" : "تعذر بدء التسجيل");
    }
  }

  function stop() {
    if (mrRef.current?.state !== "inactive") mrRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function del() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    durRef.current = 0;
    setState("idle");
    onFileReady(null);
  }

  const base: React.CSSProperties = { fontFamily: "system-ui,sans-serif", direction: "rtl", fontSize: 13 };

  if (state === "idle") return (
    <button type="button" onClick={start} style={{ ...base, display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${colors.border}`, background: colors.card, color: colors.hint, cursor: "pointer" }}>
      🎤 تسجيل ملاحظة صوتية
    </button>
  );

  if (state === "requesting") return (
    <span style={{ ...base, color: colors.hint }}>جاري الوصول للمايكروفون…</span>
  );

  if (state === "recording") return (
    <div style={{ ...base, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1.5px solid #f87171", background: "#fef2f2" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1s infinite" }} />
      <span style={{ fontWeight: 700, color: "#dc2626", fontVariantNumeric: "tabular-nums" }}>{formatDur(duration)}</span>
      <button type="button" onClick={stop} style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
        ⏹ إيقاف
      </button>
    </div>
  );

  if (state === "done" && audioUrl) return (
    <div style={{ ...base, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1.5px solid #6ee7b7", background: "#f0fdf4" }}>
      <span style={{ fontWeight: 700, color: "#065f46" }}>🎤 {formatDur(duration)}</span>
      <audio controls src={audioUrl} style={{ height: 30, maxWidth: 180 }} />
      <button type="button" onClick={del} style={{ padding: "4px 8px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}>
        🗑 حذف
      </button>
    </div>
  );

  if (state === "error") return (
    <div style={{ ...base, display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "#dc2626" }}>⚠️ {errMsg}</span>
      <button type="button" onClick={() => setState("idle")} style={{ color: colors.hint, textDecoration: "underline", border: "none", background: "none", cursor: "pointer", fontSize: 12 }}>إعادة المحاولة</button>
    </div>
  );

  return null;
}

export default function AddCustomerMiniApp() {
  const twa = useRef<TelegramWebApp | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("جديد");
  const [requestedCar, setRequestedCar] = useState("");
  const [carSearch, setCarSearch] = useState("");
  const [showCarDropdown, setShowCarDropdown] = useState(false);
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [paymentPlan, setPaymentPlan] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const voiceFileRef = useRef<File | null>(null);

  // Theme colors
  const tp = twa.current?.themeParams ?? {};
  const isDark = twa.current?.colorScheme === "dark";
  const bg = tp.bg_color ?? (isDark ? "#1c1c1e" : "#f2f2f7");
  const cardBg = tp.section_bg_color ?? tp.secondary_bg_color ?? (isDark ? "#2c2c2e" : "#ffffff");
  const textColor = tp.text_color ?? (isDark ? "#ffffff" : "#000000");
  const hintColor = tp.hint_color ?? (isDark ? "#8e8e93" : "#6d6d72");
  const btnBg = tp.button_color ?? "#007aff";
  const btnText = tp.button_text_color ?? "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const inputBg = tp.secondary_bg_color ?? (isDark ? "#3a3a3c" : "#f9f9f9");

  // Load Telegram SDK and init
  useEffect(() => {
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

    const params = new URLSearchParams(window.location.search);
    const qId = params.get("chat_id");
    if (qId) setChatId(qId);
  }, []);

  // Load form options
  useEffect(() => {
    if (!chatId) return;
    fetch(`/api/bot-app/form-data?chat_id=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setLoadError(data.error); return; }
        setFormData(data);
        setAssignedUserId(data.currentUserId);
      })
      .catch(() => setLoadError("تعذر تحميل بيانات الفورم"));
  }, [chatId]);

  const filteredInventory = formData?.inventoryOptions.filter((item) =>
    !carSearch || item.label.toLowerCase().includes(carSearch.toLowerCase()),
  ) ?? [];

  const selectCar = useCallback((item: InventoryOption) => {
    setRequestedCar(item.model);
    setCarSearch(item.label);
    setShowCarDropdown(false);
  }, []);

  const isClosed = CLOSED_STATUSES.includes(status);
  const isValid = fullName.trim().length > 1 && phone.trim().length > 5;

  async function handleSubmit() {
    if (!isValid || loading || !chatId) return;
    setLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/bot-app/add-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          full_name: fullName,
          phone,
          status,
          requested_car: requestedCar || null,
          source: source || null,
          notes: notes || null,
          next_follow_up_at: nextFollowUp || null,
          payment_plan: paymentPlan || null,
          assigned_user_id: assignedUserId || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) { setSubmitError(json.error ?? "حدث خطأ"); setLoading(false); return; }

      // ── رفع الملف الصوتي إن وُجد ──────────────────────────────
      const voiceFile = voiceFileRef.current;
      if (voiceFile && json.id) {
        try {
          const fd = new FormData();
          fd.append("customer_id", String(json.id));
          fd.append("file", voiceFile);
          fd.append("label", "ملاحظات عامة");
          await fetch("/api/voice-upload", { method: "POST", body: fd });
        } catch {
          // best-effort — لا نوقف العملية
        }
      }

      setSuccess(true);
      setTimeout(() => twa.current?.close(), 2000);
    } catch {
      setSubmitError("تعذر الاتصال بالخادم");
      setLoading(false);
    }
  }

  // ─── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ background: bg, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "system-ui,sans-serif", direction: "rtl" }}>
        <div style={{ background: cardBg, borderRadius: 20, padding: "32px 40px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: textColor }}>تم إضافة العميل!</div>
          <div style={{ fontSize: 14, color: hintColor, marginTop: 6 }}>جارٍ الإغلاق...</div>
        </div>
      </div>
    );
  }

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (chatId && !formData && !loadError) {
    return (
      <div style={{ background: bg, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", direction: "rtl" }}>
        <div style={{ color: hintColor, fontSize: 15 }}>جارٍ التحميل...</div>
      </div>
    );
  }

  // ─── Styles helpers ────────────────────────────────────────────────────────
  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: hintColor, textTransform: "uppercase", letterSpacing: "0.5px" };
  const input: React.CSSProperties = {
    background: inputBg, color: textColor, border: `1.5px solid ${borderColor}`,
    borderRadius: 10, padding: "11px 13px", fontSize: 15, fontFamily: "inherit",
    outline: "none", width: "100%", boxSizing: "border-box", direction: "rtl",
    WebkitAppearance: "none",
  };
  const section: React.CSSProperties = {
    background: cardBg, borderRadius: 16, padding: "16px",
    boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
    display: "flex", flexDirection: "column", gap: 14,
  };
  const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: hintColor, marginBottom: 2 };

  return (
    <div style={{ background: bg, minHeight: "100dvh", fontFamily: "system-ui,sans-serif", direction: "rtl", padding: "12px 12px 100px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 24 }}>➕</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: textColor }}>إضافة عميل جديد</div>
          <div style={{ fontSize: 12, color: hintColor }}>أدخل بيانات العميل</div>
        </div>
      </div>

      {/* Error */}
      {(loadError || submitError) && (
        <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14, direction: "rtl" }}>
          ⚠️ {loadError ?? submitError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ─── البيانات الأساسية ─── */}
        <div style={section}>
          <div style={sectionTitle}>البيانات الأساسية</div>

          <div style={field}>
            <span style={label}>الاسم الكامل *</span>
            <input type="text" placeholder="أدخل اسم العميل" value={fullName}
              onChange={(e) => setFullName(e.target.value)} style={input} />
          </div>

          <div style={field}>
            <span style={label}>رقم الهاتف *</span>
            <input type="tel" placeholder="05xxxxxxxx" value={phone}
              onChange={(e) => setPhone(e.target.value)} style={input} />
          </div>

          <div style={field}>
            <span style={label}>الحالة</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
              {(formData?.statuses ?? ["جديد", "قيد المتابعة", "حجز"]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={field}>
            <span style={label}>مصدر العميل</span>
            <select value={source} onChange={(e) => setSource(e.target.value)} style={input}>
              <option value="">— اختر —</option>
              {(formData?.sources ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ─── السيارة المطلوبة ─── */}
        <div style={section}>
          <div style={sectionTitle}>السيارة المطلوبة</div>
          <div style={{ ...field, position: "relative" }}>
            <span style={label}>ابحث في المخزون أو اكتب يدوياً</span>
            <input
              type="text"
              placeholder="ابحث عن سيارة..."
              value={carSearch}
              onChange={(e) => {
                setCarSearch(e.target.value);
                setRequestedCar(e.target.value);
                setShowCarDropdown(true);
              }}
              onFocus={() => setShowCarDropdown(true)}
              style={input}
            />
            {showCarDropdown && filteredInventory.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 50,
                background: cardBg, border: `1.5px solid ${borderColor}`,
                borderRadius: 10, maxHeight: 200, overflowY: "auto",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)", marginTop: 4,
              }}>
                {filteredInventory.slice(0, 12).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectCar(item)}
                    style={{
                      display: "block", width: "100%", textAlign: "right",
                      padding: "10px 13px", background: "transparent", border: "none",
                      borderBottom: `1px solid ${borderColor}`, color: textColor,
                      fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    🚗 {item.label}
                  </button>
                ))}
              </div>
            )}
            {requestedCar && (
              <div style={{ fontSize: 12, color: btnBg, marginTop: 2 }}>
                ✓ {requestedCar}
              </div>
            )}
          </div>
          {showCarDropdown && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 40 }}
              onClick={() => setShowCarDropdown(false)}
            />
          )}
        </div>

        {/* ─── تفاصيل إضافية ─── */}
        <div style={section}>
          <div style={sectionTitle}>تفاصيل إضافية</div>

          <div style={field}>
            <span style={label}>طريقة الدفع</span>
            <select value={paymentPlan} onChange={(e) => setPaymentPlan(e.target.value)} style={input}>
              <option value="">— اختر —</option>
              <option value="كاش">كاش</option>
              <option value="تمويل بنكي">تمويل بنكي</option>
              <option value="تقسيط">تقسيط</option>
            </select>
          </div>

          {!isClosed && (
            <div style={field}>
              <span style={label}>موعد المتابعة</span>
              <input
                type="datetime-local"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                style={{ ...input, colorScheme: isDark ? "dark" : "light" }}
              />
            </div>
          )}

          <div style={field}>
            <span style={label}>ملاحظات</span>
            <textarea
              rows={3}
              placeholder="أي ملاحظات..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...input, resize: "vertical" }}
            />
          </div>

          <div style={field}>
            <span style={label}>ملاحظة صوتية</span>
            <InlineVoiceRecorder
              onFileReady={(file) => { voiceFileRef.current = file; }}
              colors={{ btn: btnBg, btnText: btnText, hint: hintColor, border: borderColor, card: cardBg, text: textColor }}
            />
          </div>
        </div>

        {/* ─── تعيين لموظف (للمديرين) ─── */}
        {formData?.isManager && (formData?.staff?.length ?? 0) > 0 && (
          <div style={section}>
            <div style={sectionTitle}>تعيين الملف</div>
            <div style={field}>
              <span style={label}>الموظف المسؤول</span>
              <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} style={input}>
                {formData.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

      </div>

      {/* ─── زر الحفظ ─── */}
      <div style={{
        position: "fixed", bottom: 0, right: 0, left: 0,
        padding: "10px 12px", background: bg,
        borderTop: `1px solid ${borderColor}`,
        boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
      }}>
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading || !chatId}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: (!isValid || loading || !chatId) ? (isDark ? "#3a3a3c" : "#c7c7cc") : btnBg,
            color: (!isValid || loading || !chatId) ? hintColor : btnText,
            fontSize: 16, fontWeight: 700, cursor: (!isValid || loading) ? "not-allowed" : "pointer",
            fontFamily: "inherit", transition: "all 0.2s",
            letterSpacing: "0.3px",
          }}
        >
          {loading ? "⏳ جارٍ الحفظ..." : "✅ حفظ العميل"}
        </button>
      </div>

    </div>
  );
}
