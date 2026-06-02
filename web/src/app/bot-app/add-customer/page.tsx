"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { PALESTINE_CITIES, CAR_MAKES } from "@/lib/suggestions";

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

type InventoryOption = { id: string; label: string; model: string; chassis_no?: string | null };
type StaffOption = { id: string; full_name: string };
type OperationType = "buyer" | "buyer_tradein_pending" | "sell_on_behalf";

type BranchOption = { id: string; name: string };
type FormData = {
  statusesByType: Record<OperationType, string[]>;
  inventoryOptions: InventoryOption[];
  staff: StaffOption[];
  branches: BranchOption[];
  currentUserId: string;
  isManager: boolean;
  isGeneralManager: boolean;
};

// حالات تُغلق الملف وتُخفي موعد المتابعة
const CLOSED_STATUSES = [
  "تمت عملية البيع",
  "تمت عملية البيع + استبدال",
  "تمت عملية البيع (للعميل)",
  "شراء من قبل المعرض",
  "رفض من قبل العميل",
  "رفض من قبل المعرض",
  "إغلاق الملف",
  "تراجع العميل عن الاستبدال",
  "سحب السيارة من البيع",
];

const OP_TYPES: { value: OperationType; label: string }[] = [
  { value: "buyer", label: "🛒 مشتري" },
  { value: "buyer_tradein_pending", label: "🔄 مشتري + استبدال" },
  { value: "sell_on_behalf", label: "🚗 بيع بالوكالة" },
];

// خيارات الدفع — مطابقة للويب
const PAYMENT_OPTIONS = [
  { value: "كاش",               label: "💵 كاش" },
  { value: "تقسيط بنكي",        label: "🏦 تقسيط بنكي" },
  { value: "تأجير تمويلي",      label: "📋 تأجير تمويلي" },
  { value: "شيكات",             label: "📝 شيكات" },
  { value: "استبدال فقط",       label: "🔄 استبدال فقط" },
  { value: "استبدال + كاش",    label: "🔄 استبدال + كاش" },
  { value: "استبدال + تقسيط",  label: "🔄 استبدال + تقسيط" },
];
const PAYMENT_TRIGGER_STATUSES = ["تمت عملية البيع","تمت عملية البيع + استبدال","تمت عملية البيع (للعميل)","شراء من قبل المعرض","حجز"];
function needsPaymentMethod(s: string) { return PAYMENT_TRIGGER_STATUSES.some(t => s.includes(t)); }

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
  const [operationType, setOperationType] = useState<OperationType>("buyer");
  const [fullName, setFullName]       = useState("");
  const [nickname, setNickname]       = useState("");
  const [address,  setAddress]        = useState("");
  const [whatsappPrefix, setWhatsappPrefix] = useState("+970");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("جديد");
  const [paymentMethod, setPaymentMethod] = useState("");

  // ── حقول السيارة المطلوبة (مطابقة للويب — multi-select + تفاوض) ──
  const [rcUseInventory,    setRcUseInventory]    = useState(false);
  const [rcSelectedCars,    setRcSelectedCars]    = useState<InventoryOption[]>([]);
  const [rcNegotiations,    setRcNegotiations]    = useState<Record<string,string>>({});
  const [rcInventoryToAdd,  setRcInventoryToAdd]  = useState("");
  const [rcUseCustom,       setRcUseCustom]       = useState(false);
  const [rcCustomType,      setRcCustomType]      = useState("");
  const [rcCustomYear,      setRcCustomYear]      = useState("");
  const [rcCustomNeg,       setRcCustomNeg]       = useState("");
  const [rcNegError,        setRcNegError]        = useState<string|null>(null);
  // للمدير العام: اختيار معرض لعرض مخزونه
  const [rcBranchId,        setRcBranchId]        = useState("");
  const [rcBranchInventory, setRcBranchInventory] = useState<InventoryOption[]>([]);
  const [rcBranchLoading,   setRcBranchLoading]   = useState(false);

  // ── trade-in fields (مطابقة للويب) ──
  const [tradeInModel, setTradeInModel] = useState("");
  const [tradeInChassis, setTradeInChassis] = useState("");
  const [tradeInPrice, setTradeInPrice] = useState("");
  const [tradeInColor, setTradeInColor] = useState("");
  const [tradeInYear, setTradeInYear] = useState("");
  const [tradeInMileage, setTradeInMileage] = useState("");
  const [tradeInLicense, setTradeInLicense] = useState("");
  const [tradeInSpecs, setTradeInSpecs] = useState("");
  const [tradeInInspection, setTradeInInspection] = useState("");
  const [tradeInGear, setTradeInGear] = useState("اتوماتيك");
  const [tradeInFuel, setTradeInFuel] = useState("بنزين");
  const [tradeInNotes, setTradeInNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [branchId, setBranchId] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedCustomerId, setSavedCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [duplicateCustomerId, setDuplicateCustomerId] = useState<string | null>(null);
  const [duplicateIsClosed, setDuplicateIsClosed] = useState(false);
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
    const qPhone = params.get("phone");
    if (qPhone) setPhone(qPhone);
  }, []);

  // عند تغيير نوع العملية → اضبط الحالة الافتراضية لأول حالة في القائمة
  useEffect(() => {
    if (!formData) return;
    const list = formData.statusesByType[operationType] ?? [];
    if (list.length > 0) setStatus(list[0]);
  }, [operationType, formData]);

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

  // المخزون النشط: للمدير العام من rcBranchInventory، للبقية من formData
  const activeInventory: InventoryOption[] = formData?.isGeneralManager ? rcBranchInventory : (formData?.inventoryOptions ?? []);

  function addRcCar() {
    if (!rcInventoryToAdd) return;
    const item = activeInventory.find(o => o.id === rcInventoryToAdd);
    if (!item) return;
    setRcSelectedCars(prev => prev.some(p => p.id === item.id) ? prev : [...prev, item]);
    setRcInventoryToAdd("");
    setRcNegError(null);
  }

  function removeRcCar(id: string) {
    setRcSelectedCars(prev => prev.filter(p => p.id !== id));
    setRcNegotiations(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  const isClosed = CLOSED_STATUSES.includes(status);
  const showRequestedCar = operationType === "buyer" || operationType === "buyer_tradein_pending";
  const showTradeInCar = operationType === "buyer_tradein_pending" || operationType === "sell_on_behalf";
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length === 10;
  const branchRequired = formData?.isGeneralManager && (formData?.branches?.length ?? 0) > 0;
  const isValid = fullName.trim().length > 1 && phoneValid && (!branchRequired || !!branchId);

  async function handleSubmit() {
    if (!isValid || loading || !chatId) return;

    // التحقق من التفاوض قبل الإرسال
    if (showRequestedCar) {
      const missingNeg = rcSelectedCars.filter(c => !(rcNegotiations[c.id] ?? "").trim());
      if (missingNeg.length) {
        setRcNegError(`يرجى إدخال تفاصيل التفاوض لـ: ${missingNeg.map(c => c.model).join(" / ")}`);
        return;
      }
      if (rcUseCustom && rcCustomType.trim() && !rcCustomNeg.trim()) {
        setRcNegError("يرجى إدخال تفاصيل التفاوض للطلب الخاص");
        return;
      }
    }
    setRcNegError(null);

    setLoading(true);
    setSubmitError(null);

    try {
      // بناء نص السيارة المطلوبة — نحفظ اسم الموديل فقط بدون شاصي/سعر
      const rcNames: string[] = [
        ...rcSelectedCars.map(c => c.model),
        ...(rcUseCustom && rcCustomType.trim()
          ? [`${rcCustomType.trim()}${rcCustomYear.trim() ? ` ${rcCustomYear.trim()}` : ""}`]
          : []),
      ];
      const finalRequestedCar = showRequestedCar ? (rcNames.join(" | ") || null) : null;

      // بناء ملاحظات التفاوض
      const noteParts: string[] = [];
      if (showRequestedCar) {
        rcSelectedCars.forEach(c => {
          const neg = (rcNegotiations[c.id] ?? "").trim();
          noteParts.push(`🚗 ${c.label}\n${neg || "(بدون تفاصيل تفاوض)"}`);
        });
        if (rcUseCustom && rcCustomType.trim()) {
          const customLabel = `${rcCustomType.trim()}${rcCustomYear.trim() ? ` - موديل ${rcCustomYear.trim()}` : ""}`;
          noteParts.push(`🚗 (طلب خاص) ${customLabel}\n${rcCustomNeg.trim() || "(بدون تفاصيل تفاوض)"}`);
        }
      }
      if (notes.trim()) noteParts.push(notes.trim());
      const combinedNotes = noteParts.join("\n\n") || null;

      const res = await fetch("/api/bot-app/add-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          full_name: fullName,
          nickname: nickname || null,
          address: address || null,
          whatsapp_prefix: whatsappPrefix || "+970",
          phone,
          operation_type: operationType,
          status,
          requested_car: finalRequestedCar,
          notes: combinedNotes,
          next_follow_up_at: nextFollowUp || null,
          assigned_user_id: assignedUserId || null,
          branch_id: branchId || null,
          payment_method: needsPaymentMethod(status) && paymentMethod ? paymentMethod : null,
          // حقول سيارة العميل الكاملة
          trade_in: showTradeInCar ? {
            model: tradeInModel || null,
            chassis_no: tradeInChassis || null,
            price: tradeInPrice ? Number(tradeInPrice) : null,
            color: tradeInColor || null,
            production_year: tradeInYear ? Number(tradeInYear) : null,
            mileage: tradeInMileage ? Number(tradeInMileage) : null,
            license_expiry: tradeInLicense || null,
            specs: tradeInSpecs || null,
            inspection: tradeInInspection || null,
            gear: tradeInGear,
            fuel: tradeInFuel,
            notes: tradeInNotes || null,
          } : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        // رقم الهاتف مكرر → عرض خيار فتح بطاقة العميل
        if (res.status === 409 && json.customer_id) {
          setDuplicateCustomerId(json.customer_id);
          setDuplicateIsClosed(json.is_closed === true);
        } else {
          setSubmitError(json.error ?? "حدث خطأ");
        }
        setLoading(false);
        return;
      }

      // ── رفع الملفات (صوتي + صور) ──────────────────────────────
      const customerId = json.id;
      if (customerId) {
        const uploads: Promise<void>[] = [];
        const voiceFile = voiceFileRef.current;
        if (voiceFile) {
          uploads.push((async () => {
            const fd = new FormData();
            fd.append("chat_id", String(chatId));
            fd.append("customer_id", String(customerId));
            fd.append("category", "voice_note");
            fd.append("file", voiceFile);
            await fetch("/api/bot-app/upload-attachment", { method: "POST", body: fd });
          })());
        }
        for (const photo of photoFiles) {
          uploads.push((async (f) => {
            const fd = new FormData();
            fd.append("chat_id", String(chatId));
            fd.append("customer_id", String(customerId));
            fd.append("category", "trade_photo");
            fd.append("file", f);
            await fetch("/api/bot-app/upload-attachment", { method: "POST", body: fd });
          })(photo));
        }
        await Promise.allSettled(uploads);
      }

      setSavedCustomerId(customerId ?? null);
      setSuccess(true);
    } catch {
      setSubmitError("تعذر الاتصال بالخادم");
      setLoading(false);
    }
  }

  // ─── Duplicate phone screen ────────────────────────────────────────────────
  if (duplicateCustomerId) {
    const customerUrl = `${window.location.origin}/bot-app/customer?id=${duplicateCustomerId}&chat_id=${chatId}`;
    return (
      <div style={{ background: bg, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "system-ui,sans-serif", direction: "rtl", padding: "24px 20px" }}>
        <div style={{ background: cardBg, borderRadius: 20, padding: "28px 24px", textAlign: "center", width: "100%", maxWidth: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>{duplicateIsClosed ? "⚫" : "⚠️"}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: textColor, marginBottom: 8 }}>
            {duplicateIsClosed ? "ملف مغلق بنفس الرقم" : "رقم الهاتف مسجل مسبقاً"}
          </div>
          <div style={{ fontSize: 14, color: hintColor, marginBottom: 20, lineHeight: 1.6 }}>
            {duplicateIsClosed
              ? "يوجد ملف مغلق بهذا الرقم. يمكنك فتحه للاطلاع عليه."
              : "يوجد عميل نشط في النظام بنفس رقم الهاتف."}
          </div>
          <button
            onClick={() => { window.location.href = customerUrl; }}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: btnBg, color: btnText, fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}
          >
            👤 فتح بطاقة العميل
          </button>
          <button
            onClick={() => { setDuplicateCustomerId(null); setLoading(false); }}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${borderColor}`, background: "transparent", color: textColor, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}
          >
            📱 إدخال رقم آخر
          </button>
          <button
            onClick={() => { try{ (twa.current as any).sendData(JSON.stringify({action:"close"})); }catch{ twa.current?.close(); } }}
            style={{ width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: hintColor, fontSize: 13, cursor: "pointer" }}
          >
            🏠 القائمة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  // ─── Success screen ────────────────────────────────────────────────────────
  if (success) {
    const cardUrl = savedCustomerId ? `${window.location.origin}/bot-app/customer?id=${savedCustomerId}&chat_id=${chatId}` : null;
    return (
      <div style={{ background: bg, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "system-ui,sans-serif", direction: "rtl", padding: "24px 20px" }}>
        <div style={{ background: cardBg, borderRadius: 20, padding: "28px 24px", textAlign: "center", width: "100%", maxWidth: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: textColor, marginBottom: 6 }}>تم إضافة العميل!</div>
          <div style={{ fontSize: 14, color: hintColor, marginBottom: 24, lineHeight: 1.6 }}>تم حفظ بيانات العميل بنجاح</div>

          {cardUrl && (
            <button
              onClick={() => { window.location.href = cardUrl; }}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: btnBg, color: btnText, fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}
            >
              👤 فتح بطاقة العميل
            </button>
          )}
          <button
            onClick={() => {
              // إضافة عميل جديد — مسح كل الحقول
              setSuccess(false);
              setSavedCustomerId(null);
              setFullName(""); setNickname(""); setAddress(""); setWhatsappPrefix("+970"); setPhone("");
              setRcUseInventory(false); setRcSelectedCars([]); setRcNegotiations({});
              setRcInventoryToAdd(""); setRcUseCustom(false);
              setRcCustomType(""); setRcCustomYear(""); setRcCustomNeg("");
              setRcNegError(null); setRcBranchId(""); setRcBranchInventory([]);
              setTradeInModel(""); setTradeInChassis(""); setTradeInPrice("");
              setNotes(""); setNextFollowUp("");
              setOperationType("buyer");
            }}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${borderColor}`, background: "transparent", color: textColor, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}
          >
            ➕ إضافة عميل آخر
          </button>
          <button
            onClick={() => {
              // إرسال بيانات للبوت ثم إغلاق
              if (twa.current) {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (twa.current as any).sendData(JSON.stringify({ action: "customer_saved", id: savedCustomerId, name: fullName }));
                } catch {
                  try{ (twa.current as any).sendData(JSON.stringify({action:"close"})); }catch{ twa.current.close(); }
                }
              }
            }}
            style={{ width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: hintColor, fontSize: 13, cursor: "pointer" }}
          >
            ✕ إنهاء وإغلاق
          </button>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 24 }}>➕</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: textColor }}>إضافة عميل جديد</div>
            <div style={{ fontSize: 12, color: hintColor }}>أدخل بيانات العميل</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { try{ (twa.current as any).sendData(JSON.stringify({action:"close"})); }catch{ twa.current?.close(); } }}
          style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: "transparent", color: hintColor, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
          title="القائمة الرئيسية"
        >🏠</button>
      </div>

      {/* Error */}
      {(loadError || submitError) && (
        <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14, direction: "rtl" }}>
          ⚠️ {loadError ?? submitError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ─── نوع العملية ─── */}
        <div style={section}>
          <div style={sectionTitle}>نوع العملية *</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {OP_TYPES.map((op) => {
              const active = operationType === op.value;
              return (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setOperationType(op.value)}
                  style={{
                    ...input,
                    textAlign: "right",
                    cursor: "pointer",
                    fontWeight: active ? 700 : 500,
                    border: `1.5px solid ${active ? btnBg : borderColor}`,
                    background: active ? (isDark ? "rgba(0,122,255,0.15)" : "#eff6ff") : inputBg,
                    color: active ? btnBg : textColor,
                  }}
                >
                  {active ? "● " : "○ "}{op.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── البيانات الأساسية ─── */}
        <div style={section}>
          <div style={sectionTitle}>البيانات الأساسية</div>

          <div style={field}>
            <span style={label}>الاسم الكامل *</span>
            <input type="text" placeholder="أدخل اسم العميل" value={fullName}
              onChange={(e) => setFullName(e.target.value)} style={input} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={field}>
              <span style={label}>الكنية</span>
              <input type="text" placeholder="اختياري" value={nickname}
                onChange={(e) => setNickname(e.target.value)} style={input} />
            </div>
            <div style={field}>
              <span style={label}>المدينة / العنوان</span>
              <input type="text" placeholder="ابحث..." value={address}
                onChange={(e) => setAddress(e.target.value)}
                list="cities-list" autoComplete="off"
                style={input} />
              <datalist id="cities-list">
                {PALESTINE_CITIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div style={field}>
            <span style={label}>رقم الهاتف * (10 أرقام)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={whatsappPrefix}
                onChange={(e) => setWhatsappPrefix(e.target.value)}
                style={{ ...input, width: "auto", flexShrink: 0, direction: "ltr", paddingLeft: 8, paddingRight: 8 }}
              >
                <option value="+970">🇵🇸 +970</option>
                <option value="+972">🇮🇱 +972</option>
                <option value="+962">🇯🇴 +962</option>
                <option value="+966">🇸🇦 +966</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+20">🇪🇬 +20</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
              </select>
              <input type="tel" inputMode="numeric" maxLength={14} placeholder="05xxxxxxxx" value={phone}
                onChange={(e) => setPhone(e.target.value)} style={{ ...input, flex: 1 }} />
            </div>
            {phone.trim().length > 0 && !phoneValid && (
              <span style={{ fontSize: 12, color: "#dc2626" }}>الرقم يجب أن يكون 10 أرقام بالضبط</span>
            )}
          </div>

          <div style={field}>
            <span style={label}>الحالة</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
              {(formData?.statusesByType[operationType] ?? ["جديد"]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {needsPaymentMethod(status) && (
            <div style={field}>
              <span style={label}>💳 طريقة الدفع</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={input}>
                <option value="">— اختر طريقة الدفع —</option>
                {PAYMENT_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ─── السيارة المطلوبة للعميل ─── */}
        {showRequestedCar && (
        <div style={section}>
          <div style={sectionTitle}>🚗 السيارة المطلوبة للعميل</div>

          {/* ملخص السيارات المختارة */}
          {(rcSelectedCars.length > 0 || (rcUseCustom && rcCustomType.trim())) && (
            <div style={{ padding: "8px 12px", borderRadius: 10, background: isDark ? "rgba(0,122,255,0.12)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(0,122,255,0.3)" : "#bfdbfe"}`, fontSize: 13, color: btnBg, fontWeight: 600 }}>
              {[
                ...rcSelectedCars.map(c => c.label),
                ...(rcUseCustom && rcCustomType.trim() ? [`(طلب خاص) ${rcCustomType.trim()}${rcCustomYear.trim() ? ` - ${rcCustomYear.trim()}` : ""}`] : []),
              ].join(" | ") || "بدون سيارات محددة"}
            </div>
          )}

          {/* للمدير العام: اختيار المعرض */}
          {formData?.isGeneralManager && (
            <div style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px solid rgba(245,158,11,0.4)`, background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb" }}>
              <div style={{ fontSize: 12, color: "#b45309", fontWeight: 700, marginBottom: 6 }}>🏢 اختر المعرض لعرض سياراته</div>
              <select
                value={rcBranchId}
                onChange={async (e) => {
                  const bid = e.target.value;
                  setRcBranchId(bid);
                  setRcBranchInventory([]);
                  setRcInventoryToAdd("");
                  if (!bid) return;
                  setRcBranchLoading(true);
                  try {
                    const r = await fetch(`/api/bot-app/inventory-by-branch?chat_id=${chatId}&branch_id=${bid}`);
                    const j = await r.json();
                    if (j.ok) setRcBranchInventory(j.inventory ?? []);
                  } finally { setRcBranchLoading(false); }
                }}
                style={input}
              >
                <option value="">— اختر المعرض —</option>
                {(formData?.branches ?? []).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {rcBranchLoading && <div style={{ fontSize: 12, color: hintColor, marginTop: 6 }}>⏳ جاري تحميل المخزون...</div>}
            </div>
          )}

          {/* ── خيار 1: من المخزون ── */}
          <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", borderRadius: 10, padding: "10px 12px", border: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={rcUseInventory}
                onChange={e => { setRcUseInventory(e.target.checked); setRcInventoryToAdd(""); }}
                style={{ width: 16, height: 16, accentColor: btnBg }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>اختيار سيارة مطلوبة من المخزون المتوفر</span>
            </label>

            {rcUseInventory && (
              <>
                {/* إذا GM ولم يختر معرض */}
                {formData?.isGeneralManager && !rcBranchId ? (
                  <div style={{ fontSize: 13, color: "#b45309", fontStyle: "italic" }}>اختر المعرض أولاً لعرض السيارات المتاحة</div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={rcInventoryToAdd} onChange={e => setRcInventoryToAdd(e.target.value)} style={{ ...input, flex: 1 }}>
                        <option value="">اختر من المخزون</option>
                        {activeInventory.map(o => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addRcCar}
                        disabled={!rcInventoryToAdd}
                        style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: rcInventoryToAdd ? btnBg : (isDark ? "#3a3a3c" : "#c7c7cc"), color: rcInventoryToAdd ? btnText : hintColor, fontSize: 13, fontWeight: 700, cursor: rcInventoryToAdd ? "pointer" : "default", whiteSpace: "nowrap" }}
                      >إضافة</button>
                    </div>
                    {activeInventory.length === 0 && !rcBranchLoading && (
                      <div style={{ fontSize: 12, color: hintColor, fontStyle: "italic" }}>لا توجد سيارات متوفرة حالياً</div>
                    )}
                  </>
                )}

                {/* السيارات المضافة */}
                {rcSelectedCars.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {rcSelectedCars.map(car => (
                      <div key={car.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 8, border: `1px solid ${borderColor}`, padding: "7px 10px", background: isDark ? "rgba(255,255,255,0.06)" : "#f9fafb", fontSize: 13, color: btnBg }}>
                        <span>✔ {car.label}</span>
                        <button type="button" onClick={() => removeRcCar(car.id)}
                          style={{ border: "none", background: "transparent", color: "#ef4444", fontSize: 16, cursor: "pointer", fontWeight: 700, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── خيار 2: طلب خاص ── */}
          <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", borderRadius: 10, padding: "10px 12px", border: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={rcUseCustom}
                onChange={e => { setRcUseCustom(e.target.checked); if (!e.target.checked) { setRcCustomType(""); setRcCustomYear(""); setRcCustomNeg(""); } }}
                style={{ width: 16, height: 16, accentColor: "#f59e0b" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>إدخال سيارة غير متوفرة حالياً (طلب خاص)</span>
            </label>

            {rcUseCustom && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                <div>
                  <input type="text" placeholder="نوع السيارة..." value={rcCustomType}
                    onChange={e => setRcCustomType(e.target.value)}
                    list="cars-list" autoComplete="off"
                    style={input} />
                  <datalist id="cars-list">
                    {CAR_MAKES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <input type="number" placeholder="الموديل (سنة)" value={rcCustomYear}
                  onChange={e => setRcCustomYear(e.target.value)} style={{ ...input, direction: "ltr" }} />
              </div>
            )}
          </div>

          {/* ── تفاصيل التفاوض ── */}
          {(rcSelectedCars.length > 0 || (rcUseCustom && rcCustomType.trim())) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: hintColor, letterSpacing: "0.5px" }}>
                تفاصيل التفاوض لكل سيارة
                <span style={{ color: "#ef4444", marginRight: 4, fontWeight: 400, fontSize: 11 }}>(إجباري)</span>
              </div>

              {rcSelectedCars.map(car => (
                <div key={car.id} style={{ borderRadius: 10, border: `1.5px solid ${borderColor}`, overflow: "hidden" }}>
                  <div style={{ padding: "6px 12px", background: isDark ? "rgba(0,122,255,0.12)" : "#eff6ff", fontSize: 12, fontWeight: 700, color: btnBg }}>
                    التفاوض على: {car.label}
                  </div>
                  <textarea
                    rows={2}
                    placeholder="السعر المقترح، الملاحظات..."
                    value={rcNegotiations[car.id] ?? ""}
                    onChange={e => { setRcNegotiations(prev => ({ ...prev, [car.id]: e.target.value })); setRcNegError(null); }}
                    style={{ ...input, borderRadius: 0, border: "none", borderTop: `1px solid ${borderColor}`, resize: "none" }}
                  />
                </div>
              ))}

              {rcUseCustom && rcCustomType.trim() && (
                <div style={{ borderRadius: 10, border: `1.5px solid rgba(245,158,11,0.5)`, overflow: "hidden" }}>
                  <div style={{ padding: "6px 12px", background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb", fontSize: 12, fontWeight: 700, color: "#b45309" }}>
                    التفاوض على: (طلب خاص) {rcCustomType}{rcCustomYear.trim() ? ` - موديل ${rcCustomYear}` : ""}
                  </div>
                  <textarea
                    rows={2}
                    placeholder="تفاصيل التفاوض للطلب الخاص..."
                    value={rcCustomNeg}
                    onChange={e => { setRcCustomNeg(e.target.value); setRcNegError(null); }}
                    style={{ ...input, borderRadius: 0, border: "none", borderTop: `1px solid ${borderColor}`, resize: "none" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* خطأ التفاوض */}
          {rcNegError && (
            <div style={{ borderRadius: 8, border: "1px solid #fca5a5", background: isDark ? "#3b0a0a" : "#fff1f2", padding: "8px 12px", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
              ⚠️ {rcNegError}
            </div>
          )}

          {/* ملاحظة صوتية */}
          <div style={field}>
            <span style={label}>ملاحظة صوتية</span>
            <InlineVoiceRecorder
              onFileReady={(file) => { voiceFileRef.current = file; }}
              colors={{ btn: btnBg, btnText, hint: hintColor, border: borderColor, card: cardBg, text: textColor }}
            />
          </div>
        </div>
        )}

        {/* ─── سيارة العميل (استبدال / بيع بالوكالة) — حقول كاملة ─── */}
        {showTradeInCar && (
        <div style={section}>
          <div style={sectionTitle}>
            {operationType === "sell_on_behalf" ? "🚗 سيارة العميل (المراد بيعها)" : "🔄 سيارة الاستبدال"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ ...field, gridColumn: "1 / -1" }}>
              <span style={label}>النوع والموديل *</span>
              <input type="text" placeholder="مثال: تويوتا كامري 2020" value={tradeInModel}
                onChange={(e) => setTradeInModel(e.target.value)} style={input} />
            </div>

            <div style={field}>
              <span style={label}>رقم الشاصي</span>
              <input type="text" placeholder="اختياري" value={tradeInChassis}
                onChange={(e) => setTradeInChassis(e.target.value)} style={{ ...input, direction: "ltr" }} />
            </div>

            <div style={field}>
              <span style={label}>سعر التقييم</span>
              <input type="number" placeholder="0" value={tradeInPrice}
                onChange={(e) => setTradeInPrice(e.target.value)} style={{ ...input, direction: "ltr" }} />
            </div>

            <div style={field}>
              <span style={label}>اللون</span>
              <input type="text" placeholder="أبيض، أسود..." value={tradeInColor}
                onChange={(e) => setTradeInColor(e.target.value)} style={input} />
            </div>

            <div style={field}>
              <span style={label}>سنة الصنع</span>
              <input type="number" placeholder="2020" value={tradeInYear}
                onChange={(e) => setTradeInYear(e.target.value)} style={{ ...input, direction: "ltr" }} />
            </div>

            <div style={field}>
              <span style={label}>العداد (كم)</span>
              <input type="number" placeholder="0" value={tradeInMileage}
                onChange={(e) => setTradeInMileage(e.target.value)} style={{ ...input, direction: "ltr" }} />
            </div>

            <div style={field}>
              <span style={label}>انتهاء الرخصة</span>
              <input type="date" value={tradeInLicense}
                onChange={(e) => setTradeInLicense(e.target.value)}
                style={{ ...input, direction: "ltr", colorScheme: isDark ? "dark" : "light" }} />
            </div>

            <div style={field}>
              <span style={label}>ناقل الحركة</span>
              <select value={tradeInGear} onChange={(e) => setTradeInGear(e.target.value)} style={input}>
                <option value="اتوماتيك">اتوماتيك</option>
                <option value="يدوي">يدوي</option>
              </select>
            </div>

            <div style={field}>
              <span style={label}>نوع الوقود</span>
              <select value={tradeInFuel} onChange={(e) => setTradeInFuel(e.target.value)} style={input}>
                <option value="بنزين">بنزين</option>
                <option value="سولار">سولار</option>
                <option value="هايبرد">هايبرد</option>
                <option value="كهربائية بالكامل">كهربائية بالكامل</option>
                <option value="بلك أن">بلك أن</option>
              </select>
            </div>

            <div style={{ ...field, gridColumn: "1 / -1" }}>
              <span style={label}>المواصفات</span>
              <input type="text" placeholder="اختياري" value={tradeInSpecs}
                onChange={(e) => setTradeInSpecs(e.target.value)} style={input} />
            </div>

            <div style={{ ...field, gridColumn: "1 / -1" }}>
              <span style={label}>الفحص</span>
              <input type="text" placeholder="اختياري" value={tradeInInspection}
                onChange={(e) => setTradeInInspection(e.target.value)} style={input} />
            </div>

            <div style={{ ...field, gridColumn: "1 / -1" }}>
              <span style={label}>ملاحظات السيارة</span>
              <textarea rows={2} placeholder="اختياري" value={tradeInNotes}
                onChange={(e) => setTradeInNotes(e.target.value)}
                style={{ ...input, resize: "vertical" }} />
            </div>

            {/* ── مجلد المرفقات ── */}
            <div style={{ gridColumn: "1 / -1", borderRadius: 12, border: `1px solid ${borderColor}`, overflow: "hidden" }}>
              {/* رأس المجلد */}
              <div style={{ padding: "10px 14px", background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${borderColor}` }}>
                <span style={{ fontSize: 16 }}>📁</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: hintColor }}>مجلد المرفقات</span>
                {photoFiles.length > 0 && (
                  <span style={{ marginRight: "auto", fontSize: 12, fontWeight: 600, color: btnBg, background: isDark ? "rgba(0,122,255,0.15)" : "#dbeafe", borderRadius: 99, padding: "2px 8px" }}>
                    {photoFiles.length} صورة
                  </span>
                )}
              </div>

              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setPhotoFiles((prev) => [...prev, ...files]);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                  }}
                />

                {/* شبكة المعاينة */}
                {photoFiles.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {photoFiles.map((f, i) => (
                      <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: `1px solid ${borderColor}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={() => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: 10, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                        >✕</button>
                      </div>
                    ))}
                    {/* زر إضافة المزيد */}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      style={{ aspectRatio: "1", borderRadius: 8, border: `1.5px dashed ${borderColor}`, background: "transparent", color: hintColor, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >+</button>
                  </div>
                )}

                {/* زر الإضافة الأولي */}
                {photoFiles.length === 0 && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1.5px dashed ${borderColor}`, background: "transparent", color: btnBg, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    📷 إضافة صور للسيارة
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ─── تفاصيل إضافية ─── */}
        <div style={section}>
          <div style={sectionTitle}>تفاصيل إضافية</div>

          {!isClosed && (
            <div style={field}>
              <span style={label}>موعد المتابعة</span>
              <input
                type="date"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                style={{ ...input, colorScheme: "light" }}
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

          {/* ملاحظة صوتية — تظهر فقط عند نوع العملية بيع بالوكالة (لأن السيارة المطلوبة لها مسجلها الخاص) */}
          {!showRequestedCar && (
            <div style={field}>
              <span style={label}>ملاحظة صوتية</span>
              <InlineVoiceRecorder
                onFileReady={(file) => { voiceFileRef.current = file; }}
                colors={{ btn: btnBg, btnText: btnText, hint: hintColor, border: borderColor, card: cardBg, text: textColor }}
              />
            </div>
          )}
        </div>

        {/* ─── اختيار المعرض (للمدير العام فقط) ─── */}
        {formData?.isGeneralManager && (formData?.branches?.length ?? 0) > 0 && (
          <div style={{ ...section, border: `1.5px solid #f59e0b`, background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb" }}>
            <div style={{ ...sectionTitle, color: "#b45309" }}>🏢 اختيار المعرض *</div>
            <div style={field}>
              <span style={label}>المعرض</span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                style={{ ...input, border: branchId ? `1.5px solid ${btnBg}` : "1.5px solid #f59e0b" }}
              >
                <option value="">— اختر المعرض —</option>
                {formData.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {!branchId && (
                <span style={{ fontSize: 12, color: "#b45309" }}>⚠️ يجب اختيار المعرض كمدير عام</span>
              )}
            </div>
          </div>
        )}

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
