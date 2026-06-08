"use client";

import { useState, useRef, useEffect } from "react";

type FieldDef =
  | { type: "text";   field: string; placeholder?: string; dir?: "ltr" | "rtl" }
  | { type: "select"; field: string; options: string[] }
  | { type: "number"; field: string; placeholder?: string };

async function saveFields(itemId: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/inventory/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: itemId, ...payload }),
  });
  return res.ok;
}

/* ── خلية واحدة قابلة للتعديل ──────────────────────────────────────── */
function InlineField({
  value, field, type, options, placeholder, dir, onSaved,
  inputStyle,
}: {
  value: string; field: string; type: string; options?: string[];
  placeholder?: string; dir?: "ltr" | "rtl"; onSaved: (v: string) => void;
  inputStyle?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(value);
  const [saving,  setSaving]  = useState(false);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  useEffect(() => { if (editing) setTimeout(() => ref.current?.focus(), 50); }, [editing]);

  async function save(v: string) {
    if (!v.trim()) { setEditing(false); return; }
    setSaving(true);
    onSaved(v); // optimistic
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return val ? (
      <div className="group flex items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-700 select-none">{val}</span>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 rounded p-0.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
          title="اضغط هنا للتعديل"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
    ) : (
      <button
        onClick={() => setEditing(true)}
        className="text-xs font-semibold text-orange-500 hover:text-orange-700 transition whitespace-nowrap flex items-center gap-1"
        title="اضغط لإضافة القيمة"
      >
        ⚠️ {placeholder ?? "أضف"}
      </button>
    );
  }

  const base: React.CSSProperties = {
    background: "#f0f9ff", color: "#0f172a", border: "1.5px solid #3b82f6",
    borderRadius: 6, padding: "3px 6px", fontSize: 12, fontFamily: "inherit",
    outline: "none", width: "100%", ...inputStyle,
  };

  return (
    <div className="flex items-center gap-1" style={{ minWidth: 100 }}>
      {type === "select" ? (
        <select ref={ref as React.RefObject<HTMLSelectElement>} value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => save(val)}
          style={base}>
          <option value="">— اختر —</option>
          {(options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input ref={ref as React.RefObject<HTMLInputElement>}
          type={type === "number" ? "number" : "text"}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(val); if (e.key === "Escape") setEditing(false); }}
          onBlur={() => save(val)}
          style={{ ...base, direction: dir ?? "rtl" }}
        />
      )}
      {saving && <span className="text-xs text-slate-400">⏳</span>}
    </div>
  );
}

/* ── خلية رقم الشاصي ────────────────────────────────────────────────── */
export function InventoryChassisCell({ itemId, chassis }: { itemId: string; chassis: string | null }) {
  const [current, setCurrent] = useState(chassis ?? "");

  async function handleSaved(v: string) {
    await saveFields(itemId, { chassis_no: v });
    setCurrent(v);
  }

  return (
    <InlineField
      value={current} field="chassis_no" type="text"
      placeholder="أضف رقم الشاصي" dir="ltr"
      inputStyle={{ fontFamily: "monospace" }}
      onSaved={handleSaved}
    />
  );
}

/* ── خلية اللون والعداد ─────────────────────────────────────────────── */
export function InventoryColorMileageCell({
  itemId, color, mileage,
}: { itemId: string; color: string | null; mileage: number | null }) {
  const [curColor,   setCurColor]   = useState(color ?? "");
  const [curMileage, setCurMileage] = useState(mileage != null ? String(mileage) : "");
  const [saving, setSaving] = useState(false);

  async function handleColorSaved(v: string) {
    setSaving(true);
    await saveFields(itemId, { color: v });
    setCurColor(v); setSaving(false);
  }
  async function handleMileageSaved(v: string) {
    setSaving(true);
    await saveFields(itemId, { mileage: Number(v) });
    setCurMileage(v); setSaving(false);
  }

  const missing = !curColor && !curMileage;

  if (missing) return (
    <div className="flex flex-col gap-1">
      <InlineField value="" field="color" type="text" placeholder="أضف اللون" onSaved={handleColorSaved} />
      <InlineField value="" field="mileage" type="number" placeholder="أضف العداد" dir="ltr" onSaved={handleMileageSaved} />
      {saving && <span className="text-xs text-slate-400">⏳</span>}
    </div>
  );

  return (
    <div className="flex flex-col gap-1">
      <InlineField value={curColor} field="color" type="text" placeholder="أضف اللون" onSaved={handleColorSaved} />
      {curMileage ? (
        <InlineField value={curMileage} field="mileage" type="number" placeholder="أضف العداد" dir="ltr"
          onSaved={v => handleMileageSaved(v)} />
      ) : (
        <InlineField value="" field="mileage" type="number" placeholder="أضف العداد" dir="ltr" onSaved={handleMileageSaved} />
      )}
      {saving && <span className="text-xs text-slate-400">⏳</span>}
    </div>
  );
}

/* ── خلية القير والوقود ─────────────────────────────────────────────── */
export function InventoryGearFuelCell({
  itemId, gearbox, fuelType,
}: { itemId: string; gearbox: string | null; fuelType: string | null }) {
  const [curGear, setCurGear] = useState(gearbox ?? "");
  const [curFuel, setCurFuel] = useState(fuelType ?? "");
  const [saving,  setSaving]  = useState(false);

  async function handleGearSaved(v: string) {
    setSaving(true);
    await saveFields(itemId, { gearbox: v });
    setCurGear(v); setSaving(false);
  }
  async function handleFuelSaved(v: string) {
    setSaving(true);
    await saveFields(itemId, { fuel_type: v });
    setCurFuel(v); setSaving(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <InlineField value={curGear} field="gearbox" type="select"
        options={["اتوماتيك", "يدوي"]}
        placeholder="أضف ناقل الحركة" onSaved={handleGearSaved} />
      <InlineField value={curFuel} field="fuel_type" type="select"
        options={["بنزين", "سولار", "هايبرد", "كهربائية بالكامل", "بلك أن"]}
        placeholder="أضف نوع الوقود" onSaved={handleFuelSaved} />
      {saving && <span className="text-xs text-slate-400">⏳</span>}
    </div>
  );
}
