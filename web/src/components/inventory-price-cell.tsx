"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/format";

export function InventoryPriceCell({
  itemId,
  price,
}: {
  itemId: string;
  price: number | null;
}) {
  const [editing,  setEditing]  = useState(false);
  const [value,    setValue]    = useState(price ? String(price) : "");
  const [saving,   setSaving]   = useState(false);
  const [current,  setCurrent]  = useState(price);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 50);
  }, [editing]);

  async function handleSave() {
    const num = Number(value.replace(/,/g, ""));
    if (!value.trim() || isNaN(num) || num <= 0) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, price: num }),
      });
      if (res.ok) { setCurrent(num); }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" style={{ minWidth: 110 }}>
        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-20 rounded-lg border border-blue-300 px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
          placeholder="السعر ₪"
          style={{ direction: "ltr" }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {saving ? "⏳" : "✓"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-lg bg-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-300"
        >
          ✕
        </button>
      </div>
    );
  }

  if (current) {
    return (
      <div className="group flex items-center gap-1.5">
        <span className="font-extrabold text-emerald-700 select-none">{formatCurrency(current)}</span>
        <button
          onClick={() => { setValue(String(current)); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 rounded p-0.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
          title="اضغط هنا لتعديل السعر"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setValue(""); setEditing(true); }}
      className="text-xs font-semibold text-amber-600 hover:text-amber-500 hover:underline transition"
    >
      + أضف السعر
    </button>
  );
}
