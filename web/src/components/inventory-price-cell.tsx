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
      <button
        onClick={() => { setValue(String(current)); setEditing(true); }}
        className="font-extrabold text-emerald-700 hover:text-emerald-500 hover:underline transition text-left"
        title="اضغط لتعديل السعر"
      >
        {formatCurrency(current)}
      </button>
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
