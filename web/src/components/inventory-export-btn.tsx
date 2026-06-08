"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ExportFilter = {
  status?: string;
  deal?: string;
  branch?: string;
  tab?: string;
  q?: string;
};

export function InventoryExportBtn({ filters }: { filters: ExportFilter }) {
  const [open,      setOpen]     = useState(false);
  const [loading,   setLoading]  = useState(false);

  async function doExport(format: "xlsx" | "pdf", statusOverride?: string) {
    setLoading(true); setOpen(false);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (statusOverride) params.set("status", statusOverride);
      else if (filters.status) params.set("status", filters.status);
      if (filters.deal)   params.set("deal",   filters.deal);
      if (filters.branch) params.set("branch", filters.branch);
      if (filters.tab)    params.set("tab",    filters.tab);
      if (filters.q)      params.set("q",      filters.q);

      const res = await fetch(`/api/inventory/export?${params}`);
      if (!res.ok) { alert("فشل التصدير"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `inventory-${statusOverride ?? filters.status ?? "all"}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  const OPTIONS = [
    { label: "📦 المخزون الكامل",       status: "",            emoji: "📦" },
    { label: "✅ المتوفرة فقط",          status: "متوفرة",      emoji: "✅" },
    { label: "🔒 المحجوزة فقط",          status: "محجوزة",      emoji: "🔒" },
    { label: "💰 المباعة فقط",           status: "مباعة",       emoji: "💰" },
    { label: "🚫 المسحوبة من المعرض",   status: "مسحوبة من المعرض", emoji: "🚫" },
    { label: "⚠️ بيانات ناقصة",         status: "incomplete",  emoji: "⚠️" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? "⏳" : <Download className="h-4 w-4" />}
        تصدير
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-3">
            <div className="text-xs font-bold text-slate-500 mb-2 px-1">اختر ما تريد تصديره</div>

            {OPTIONS.map(opt => (
              <div key={opt.status} className="flex gap-1.5 mb-1">
                <button
                  onClick={() => doExport("xlsx", opt.status || undefined)}
                  className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition text-right"
                >
                  {opt.label}
                </button>
                <button
                  onClick={() => doExport("xlsx", opt.status || undefined)}
                  className="rounded-lg border border-emerald-200 bg-white px-2 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition"
                  title="Excel"
                >
                  XLS
                </button>
                <button
                  onClick={() => doExport("pdf", opt.status || undefined)}
                  className="rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                  title="PDF"
                >
                  PDF
                </button>
              </div>
            ))}

            <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400 text-center">
              يأخذ الفلاتر الحالية بالحسبان
            </div>
          </div>
        </>
      )}
    </div>
  );
}
