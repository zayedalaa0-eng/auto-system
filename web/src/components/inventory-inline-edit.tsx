"use client";

import { useState, useRef, useEffect } from "react";

// ── دائرة اللون ──────────────────────────────────────────────────────────────
const COLOR_MAP: Array<[string[], string, string]> = [
  [["ابيض","بيضاء","white"],                  "#ffffff","#d1d5db"],
  [["اسود","سوداء","black"],                  "#1c1917","#1c1917"],
  [["رمادي","رصاصي","grey","gray"],            "#9ca3af","#9ca3af"],
  [["فضي","سيلفر","silver"],                  "#cbd5e1","#94a3b8"],
  [["احمر","حمراء","فيراني","red"],            "#ef4444","#ef4444"],
  [["كحلي","نيلي","navy"],                    "#1e3a8a","#1e3a8a"],
  [["ازرق","زرقاء","blue"],                   "#3b82f6","#3b82f6"],
  [["سماوي","تركواز","تيفاني","turquoise"],    "#2dd4bf","#2dd4bf"],
  [["اخضر","خضراء","green"],                  "#22c55e","#22c55e"],
  [["زيتي","olive"],                          "#84cc16","#84cc16"],
  [["اصفر","صفراء","yellow"],                 "#eab308","#eab308"],
  [["ذهبي","ذهبيه","gold"],                   "#f59e0b","#d97706"],
  [["شمبانيا","شامبين","شمباني","champagne"], "#f3e0b5","#d4b896"],
  [["بيج","كريمي","beige","cream"],           "#e8dcc8","#c9b99a"],
  [["نهدي","لبني","عاجي","ivory"],            "#f5f0e8","#d6c9b0"],
  [["باطوني","اسمنتي","سيمنتي","concrete"],   "#b0b8c1","#8a9099"],
  [["تيتانيوم","titanium"],                   "#8d9299","#6b7280"],
  [["برتقالي","برتقاليه","orange"],           "#f97316","#f97316"],
  [["بني","بنيه","كافيه","brown"],            "#92400e","#92400e"],
  [["خمري","بورجندي","burgundy","wine"],       "#881337","#881337"],
  [["بنفسجي","بنفسجيه","purple"],             "#a855f7","#a855f7"],
  [["وردي","ورديه","pink"],                   "#ec4899","#ec4899"],
  [["عسلي","قهوائي","mocha","hazel"],         "#c8956c","#a07040"],
  [["رصاصي غامق","انثراسيت","anthracite"],    "#4b5563","#374151"],
];
function normalizeAr(t: string) {
  return t.replace(/[ً-ٟؐ-ؚۖ-ۭ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").toLowerCase().trim();
}
function getColorSwatch(v: string | null | undefined) {
  if (!v) return null;
  const n = normalizeAr(v);
  for (const [kws,bg,border] of COLOR_MAP) if (kws.some(k=>n.includes(normalizeAr(k)))) return {bg,border};
  return null;
}
function ColorDot({ color }: { color: string }) {
  const s = getColorSwatch(color);
  if (!s) return null;
  return <span style={{display:"inline-block",width:11,height:11,borderRadius:"50%",border:`1.5px solid ${s.border}`,background:s.bg,flexShrink:0,verticalAlign:"middle"}} title={color}/>;
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
        {isColor && <ColorDot color={cur} />}
        <span className={displayClass ?? "text-sm font-semibold text-slate-700"}>{display}</span>
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
