"use client";

import { useState, useRef, useEffect } from "react";

// ── ألوان ─────────────────────────────────────────────────────────────────────
const COLOR_MAP: Array<[string[], string]> = [
  [["ابيض","بيضاء","white"],                  "#e8e8e8"],
  [["اسود","سوداء","black"],                  "#1c1917"],
  [["رمادي","رصاصي","grey","gray"],            "#9ca3af"],
  [["فضي","سيلفر","silver"],                  "#c0c8d0"],
  [["احمر","حمراء","red"],                    "#ef4444"],
  [["فيراني"],                                "#7a8a7a"], // لون الفأر — رمادي مخضر
  [["كحلي","نيلي","navy"],                    "#1e3a8a"],
  [["ازرق","زرقاء","blue"],                   "#3b82f6"],
  [["سماوي","تركواز","تيفاني","turquoise"],    "#2dd4bf"],
  [["اخضر","خضراء","green"],                  "#22c55e"],
  [["زيتي","olive"],                          "#6b7c3e"],
  [["اصفر","صفراء","yellow"],                 "#eab308"],
  [["ذهبي","ذهبيه","gold"],                   "#d4a017"],
  [["شمبانيا","شامبين","شمباني","champagne"], "#c8a96e"],
  [["بيج","كريمي","beige","cream"],           "#c9b99a"],
  [["نهدي","لبني","عاجي","ivory"],            "#d4c9b0"],
  [["باطوني","اسمنتي","سيمنتي","concrete"],   "#8a9099"],
  [["تيتانيوم","titanium"],                   "#6b7280"],
  [["برتقالي","برتقاليه","orange"],           "#f97316"],
  [["بني","بنيه","كافيه","brown"],            "#7c4d2a"],
  [["خمري","بورجندي","burgundy","wine"],       "#7f1d3a"],
  [["بنفسجي","بنفسجيه","purple"],             "#a855f7"],
  [["وردي","ورديه","pink"],                   "#ec4899"],
  [["عسلي","قهوائي","mocha","hazel"],         "#a07040"],
  [["رصاصي غامق","انثراسيت","anthracite"],    "#374151"],
];
function normalizeAr(t: string) {
  return t.replace(/[ً-ٟؐ-ؚۖ-ۭ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").toLowerCase().trim();
}
function getColorBg(v: string | null | undefined): string | null {
  if (!v) return null;
  const n = normalizeAr(v);
  for (const [kws,bg] of COLOR_MAP) if (kws.some(k=>n.includes(normalizeAr(k)))) return bg;
  return null;
}
/** يُحدد لون النص (أبيض أو أسود) بناءً على سطوع الخلفية */
function textColor(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114) / 1000 > 128 ? "#1c1917" : "#ffffff";
}
/** Label كامل يغطي نص اللون بخلفية ملونة */
function ColorLabel({ color }: { color: string }) {
  const bg = getColorBg(color);
  if (!bg) return <span className="text-sm font-semibold text-slate-700">{color}</span>;
  const tc = textColor(bg);
  return (
    <span style={{
      display:"inline-block", background:bg, color:tc,
      borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:600,
      border:"1px solid rgba(0,0,0,0.12)", letterSpacing:"0.2px",
    }}>{color}</span>
  );
}

// ── حفظ حقل واحد ─────────────────────────────────────────────────────────────
async function save(id: string, payload: Record<string,unknown>) {
  await fetch("/api/inventory/update", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id, ...payload }),
  });
}

// ── زر القلم ─────────────────────────────────────────────────────────────────
const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ── مكوّن الخلية الواحدة ──────────────────────────────────────────────────────
type CellProps = {
  itemId: string;
  field: string;
  value: string | number | null;
  type?: "text" | "number" | "select";
  options?: string[];
  dir?: "ltr" | "rtl";
  placeholder?: string;
  emptyLabel?: string;
  displayClass?: string;
  suffix?: string;
};

export function EditableCell({
  itemId, field, value, type = "text",
  options, dir, placeholder, emptyLabel, displayClass, suffix,
}: CellProps) {
  const raw     = value != null ? String(value) : "";
  const [cur,   setCur]   = useState(raw);
  const [edit,  setEdit]  = useState(false);
  const [val,   setVal]   = useState(raw);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  useEffect(() => { if (edit) setTimeout(() => ref.current?.focus(), 50); }, [edit]);

  async function commit(v: string) {
    if (v === cur) { setEdit(false); return; }
    const payload: Record<string,unknown> = {};
    payload[field] = type === "number" ? (v ? Number(v) : null) : (v || null);
    setCur(v);
    setEdit(false);
    await save(itemId, payload);
  }

  const isColor = field === "color";

  if (!edit) {
    if (!cur) return (
      <button onClick={() => { setVal(""); setEdit(true); }}
        className="text-[10px] font-medium text-orange-400 hover:text-orange-600 transition leading-tight"
        title={`اضغط لإضافة ${placeholder ?? field}`}>
        + {emptyLabel ?? `أضف ${placeholder ?? field}`}
      </button>
    );
    const display = suffix ? `${Number(cur).toLocaleString("en-US")} ${suffix}` : cur;
    return (
      <div className="group flex items-center gap-1">
        {isColor
          ? <ColorLabel color={cur} />
          : <span className={displayClass ?? "text-sm font-semibold text-slate-700"}>{display}</span>
        }
        <button onClick={() => { setVal(cur); setEdit(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 rounded p-0.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
          title="اضغط هنا للتعديل">
          <PencilIcon />
        </button>
      </div>
    );
  }

  const inputBase = "rounded border border-blue-400 bg-blue-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-300 w-full";

  return (
    <div className="flex items-center gap-1" style={{ minWidth: 90 }}>
      {type === "select" ? (
        <select ref={ref as React.RefObject<HTMLSelectElement>}
          value={val} onChange={e=>setVal(e.target.value)}
          onBlur={() => commit(val)}
          className={inputBase} style={{ direction: "rtl" }}>
          <option value="">— اختر —</option>
          {(options??[]).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input ref={ref as React.RefObject<HTMLInputElement>}
          type={type === "number" ? "number" : "text"}
          value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") commit(val); if(e.key==="Escape"){setVal(cur);setEdit(false);} }}
          onBlur={() => commit(val)}
          className={inputBase}
          style={{ direction: dir ?? "rtl" }}
          placeholder={placeholder}
        />
      )}
      <button onClick={() => { setVal(cur); setEdit(false); }}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 text-xs">✕</button>
    </div>
  );
}

// ── خلية السعر ───────────────────────────────────────────────────────────────
export function InventoryPriceCellNew({ itemId, price }: { itemId: string; price: number | null }) {
  const [cur, setCur] = useState(price);
  const [edit, setEdit] = useState(false);
  const [val,  setVal]  = useState(price ? String(price) : "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (edit) setTimeout(() => ref.current?.focus(), 50); }, [edit]);

  async function commit() {
    const n = Number(val); if (!val || isNaN(n) || n <= 0) { setEdit(false); return; }
    setCur(n); setEdit(false);
    await save(itemId, { price: n });
  }

  if (edit) return (
    <div className="flex items-center gap-1" style={{ minWidth: 110 }}>
      <input ref={ref} type="number" value={val} onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter") commit(); if(e.key==="Escape") setEdit(false); }}
        onBlur={commit}
        className="w-20 rounded border border-blue-400 bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-300"
        style={{ direction:"ltr" }} placeholder="₪" />
      <button onClick={() => setEdit(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
    </div>
  );

  if (!cur) return (
    <button onClick={() => { setVal(""); setEdit(true); }}
      className="text-[10px] font-medium text-amber-500 hover:text-amber-700 transition">
      + أضف السعر
    </button>
  );

  return (
    <div className="group flex items-center gap-1">
      <span className="font-extrabold text-emerald-700">
        {cur.toLocaleString("en-US")} ₪
      </span>
      <button onClick={() => { setVal(String(cur)); setEdit(true); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
        title="تعديل السعر">
        <PencilIcon />
      </button>
    </div>
  );
}

// ── الثوابت ──────────────────────────────────────────────────────────────────
export const GEARBOX_OPTIONS  = ["اتوماتيك","يدوي"];
export const FUEL_OPTIONS     = ["بنزين","سولار","هايبرد","كهربائية بالكامل","بلك أن"];
export const STATUS_OPTIONS   = ["متوفرة","محجوزة","مباعة","مسحوبة من المعرض"];
export const DEAL_OPTIONS     = ["شراء","استبدال","برسم البيع"];
export const CONDITION_OPTIONS = ["مستعملة","جديدة","شبه جديدة"];
