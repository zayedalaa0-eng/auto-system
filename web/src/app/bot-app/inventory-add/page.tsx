"use client";

import React, { useEffect, useRef, useState } from "react";
import { CAR_MAKES } from "@/lib/suggestions";

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

type Branch = { id: string; name: string };

const DEAL_TYPES    = ["شراء", "استبدال", "برسم البيع"];
const CONDITIONS    = ["مستعملة", "جديدة", "شبه جديدة"];
const GEARBOX_OPTS  = ["اتوماتيك", "يدوي"];
const FUEL_OPTS     = ["بنزين", "ديزل", "هايبرد", "كهربائية بالكامل", "بلك أن"];
const STATUS_OPTS   = ["متوفرة", "محجوزة", "مباعة"];

export default function InventoryAddPage() {
  const twaRef = useRef<TelegramWebApp | null>(null);
  const [chatId, setChatId]       = useState<string | null>(null);
  const [isDark,  setIsDark]      = useState(false);
  const [isGM,    setIsGM]        = useState(false);
  const [branches, setBranches]   = useState<Branch[]>([]);

  // حقول الفورم
  const [model,      setModel]      = useState("");
  const [year,       setYear]       = useState("");
  const [color,      setColor]      = useState("");
  const [price,      setPrice]      = useState("");
  const [chassis,    setChassis]    = useState("");
  const [mileage,    setMileage]    = useState("");
  const [gearbox,    setGearbox]    = useState("اتوماتيك");
  const [fuel,       setFuel]       = useState("بنزين");
  const [condition,  setCondition]  = useState("مستعملة");
  const [dealType,   setDealType]   = useState("شراء");
  const [status,     setStatus]     = useState("متوفرة");
  const [ownerName,  setOwnerName]  = useState("");
  const [specs,      setSpecs]      = useState("");
  const [inspection, setInspection] = useState("");
  const [notes,      setNotes]      = useState("");
  const [branchId,   setBranchId]   = useState("");

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  /* ── Init ── */
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).Telegram?.WebApp as TelegramWebApp | undefined;
    if (app) { app.ready(); app.expand(); twaRef.current = app; setIsDark(app.colorScheme === "dark"); }
    const p = new URLSearchParams(window.location.search);
    const chat = p.get("chat_id") ?? String(app?.initDataUnsafe?.user?.id ?? "");
    setChatId(chat);

    if (chat) {
      fetch(`/api/bot-app/form-data?chat_id=${chat}`)
        .then(r => r.json())
        .then(d => {
          if (d.isGeneralManager) { setIsGM(true); setBranches(d.branches ?? []); }
        });
    }
  }, []);

  /* ── Theme ── */
  const tp      = twaRef.current?.themeParams ?? {};
  const bg      = tp.bg_color           ?? (isDark ? "#1c1c1e" : "#f2f2f7");
  const cardBg  = tp.secondary_bg_color ?? (isDark ? "#2c2c2e" : "#ffffff");
  const text    = tp.text_color         ?? (isDark ? "#ffffff" : "#000000");
  const hint    = tp.hint_color         ?? (isDark ? "#8e8e93" : "#6b7280");
  const btnBg   = tp.button_color       ?? "#2563eb";
  const btnTxt  = tp.button_text_color  ?? "#ffffff";
  const border  = isDark ? "#3a3a3c" : "#e5e7eb";
  const inputBg = isDark ? "#3a3a3c" : "#f9f9f9";

  const inp: React.CSSProperties = {
    background: inputBg, color: text, border: `1.5px solid ${border}`,
    borderRadius: 10, padding: "11px 13px", fontSize: 15,
    fontFamily: "inherit", outline: "none", width: "100%",
    boxSizing: "border-box", direction: "rtl",
  };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: hint, marginBottom: 4 };
  const fld: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
  const sec: React.CSSProperties = {
    background: cardBg, borderRadius: 16, padding: 16,
    display: "flex", flexDirection: "column", gap: 14,
    boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
  };

  const consign = dealType === "برسم البيع";

  async function handleSubmit() {
    if (!model.trim()) { setError("نوع السيارة مطلوب"); return; }
    if (!chassis.trim()) { setError("رقم الشاصي مطلوب"); return; }
    if (consign && !ownerName.trim()) { setError("اسم المالك مطلوب عند اختيار برسم البيع"); return; }
    setSaving(true); setError(null);

    const res = await fetch("/api/bot-app/inventory-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId, model: model.trim(),
        production_year: year || null, color: color || null,
        price: price || null, chassis_no: chassis || null,
        mileage: mileage || null, gearbox, fuel_type: fuel,
        condition_label: condition, deal_type: dealType,
        availability_status: status, owner_name: ownerName || null,
        specs: specs || null, inspection: inspection || null,
        notes: notes || null,
        branch_id: isGM ? (branchId || null) : null,
      }),
    });

    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "حدث خطأ"); return; }

    setSavedId(json.id);
    setSuccess(true);
  }

  function handleAddAnother() {
    setSuccess(false); setSavedId(null);
    setModel(""); setYear(""); setColor(""); setPrice("");
    setChassis(""); setMileage(""); setOwnerName("");
    setSpecs(""); setInspection(""); setNotes("");
    setGearbox("اتوماتيك"); setFuel("بنزين");
    setCondition("مستعملة"); setDealType("شراء"); setStatus("متوفرة");
  }

  /* ── Success Screen ── */
  if (success) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", direction: "rtl", padding: "24px 20px" }}>
      <div style={{ background: cardBg, borderRadius: 20, padding: "28px 24px", textAlign: "center", width: "100%", maxWidth: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 56, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 6 }}>تمت إضافة السيارة!</div>
        <div style={{ fontSize: 13, color: hint, marginBottom: 24 }}>تم حفظ السيارة في المخزون بنجاح</div>
        <button onClick={handleAddAnother}
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: btnBg, color: btnTxt, fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
          ➕ إضافة سيارة أخرى
        </button>
        <button onClick={() => { try { (twaRef.current as any).close(); } catch { window.close(); } }}
          style={{ width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: hint, fontSize: 13, cursor: "pointer" }}>
          ✕ إغلاق
        </button>
      </div>
    </div>
  );

  /* ── Main Form ── */
  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "system-ui,sans-serif", direction: "rtl", padding: "12px 12px 100px" }}>

      {/* هيدر */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 24 }}>🚗</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: text }}>إضافة سيارة للمخزون</div>
            <div style={{ fontSize: 12, color: hint }}>أدخل بيانات السيارة</div>
          </div>
        </div>
        <button type="button"
          onClick={() => { try { (twaRef.current as any).close(); } catch { window.close(); } }}
          style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: hint, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          🏠
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* نوع الصفقة */}
        <div style={sec}>
          <div style={{ fontSize: 13, fontWeight: 700, color: hint }}>نوع الصفقة</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DEAL_TYPES.map(d => (
              <button key={d} type="button" onClick={() => setDealType(d)}
                style={{
                  padding: "7px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${dealType === d ? btnBg : border}`,
                  background: dealType === d ? (isDark ? "rgba(37,99,235,0.2)" : "#eff6ff") : "transparent",
                  color: dealType === d ? btnBg : hint, cursor: "pointer",
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* البيانات الأساسية */}
        <div style={sec}>
          <div style={{ fontSize: 13, fontWeight: 700, color: hint }}>البيانات الأساسية</div>

          <div style={fld}>
            <span style={lbl}>نوع السيارة *</span>
            <input value={model} onChange={e => setModel(e.target.value)}
              style={inp} placeholder="مثال: تويوتا كامري"
              list="inv-cars-list" autoComplete="off" />
            <datalist id="inv-cars-list">
              {CAR_MAKES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={fld}>
              <span style={lbl}>سنة الصنع</span>
              <input type="number" value={year} onChange={e => setYear(e.target.value)}
                style={{ ...inp, direction: "ltr" }} placeholder="2022" />
            </div>
            <div style={fld}>
              <span style={lbl}>السعر (₪)</span>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                style={{ ...inp, direction: "ltr" }} placeholder="0" />
            </div>
            <div style={fld}>
              <span style={lbl}>رقم الشاصي *</span>
              <input value={chassis} onChange={e => setChassis(e.target.value)}
                style={{ ...inp, direction: "ltr", borderColor: !chassis.trim() ? "#f87171" : undefined }}
                placeholder="مطلوب" />
            </div>
            <div style={fld}>
              <span style={lbl}>اللون</span>
              <input value={color} onChange={e => setColor(e.target.value)}
                style={inp} placeholder="أبيض، أسود..." />
            </div>
            <div style={fld}>
              <span style={lbl}>العداد (كم)</span>
              <input type="number" value={mileage} onChange={e => setMileage(e.target.value)}
                style={{ ...inp, direction: "ltr" }} placeholder="0" />
            </div>
            <div style={fld}>
              <span style={lbl}>المالك {consign ? <span style={{ color: "#ef4444" }}>*</span> : "(اختياري)"}</span>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)}
                style={{ ...inp, borderColor: consign && !ownerName.trim() ? "#f87171" : undefined }}
                placeholder={consign ? "مطلوب عند برسم البيع" : "اختياري"} />
            </div>
          </div>
        </div>

        {/* التفاصيل التقنية */}
        <div style={sec}>
          <div style={{ fontSize: 13, fontWeight: 700, color: hint }}>التفاصيل التقنية</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={fld}>
              <span style={lbl}>الحالة</span>
              <select value={condition} onChange={e => setCondition(e.target.value)} style={inp}>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={fld}>
              <span style={lbl}>التوفر</span>
              <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={fld}>
              <span style={lbl}>ناقل الحركة</span>
              <select value={gearbox} onChange={e => setGearbox(e.target.value)} style={inp}>
                {GEARBOX_OPTS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={fld}>
              <span style={lbl}>نوع الوقود</span>
              <select value={fuel} onChange={e => setFuel(e.target.value)} style={inp}>
                {FUEL_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div style={fld}>
            <span style={lbl}>المواصفات</span>
            <input value={specs} onChange={e => setSpecs(e.target.value)} style={inp} placeholder="اختياري" />
          </div>
          <div style={fld}>
            <span style={lbl}>الفحص</span>
            <input value={inspection} onChange={e => setInspection(e.target.value)} style={inp} placeholder="اختياري" />
          </div>
          <div style={fld}>
            <span style={lbl}>ملاحظات</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              style={{ ...inp, resize: "none" }} rows={2} placeholder="اختياري" />
          </div>
        </div>

        {/* المعرض — للمدير العام */}
        {isGM && branches.length > 0 && (
          <div style={{ ...sec, border: `1.5px solid #f59e0b`, background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>🏢 اختيار المعرض</div>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} style={inp}>
              <option value="">— اختر المعرض —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* زر الحفظ */}
      <div style={{ position: "fixed", bottom: 0, right: 0, left: 0, padding: "10px 12px", background: bg, borderTop: `1px solid ${border}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" }}>
        <button onClick={handleSubmit} disabled={saving || !model.trim() || !chassis.trim() || (consign && !ownerName.trim()) || !chatId}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: (saving || !model.trim()) ? (isDark ? "#3a3a3c" : "#c7c7cc") : btnBg,
            color: (saving || !model.trim()) ? hint : btnTxt,
            fontSize: 16, fontWeight: 700, cursor: (saving || !model.trim()) ? "not-allowed" : "pointer",
          }}>
          {saving ? "⏳ جاري الحفظ..." : "✅ إضافة السيارة"}
        </button>
      </div>
    </div>
  );
}
