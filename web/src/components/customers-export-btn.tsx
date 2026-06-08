"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ExportFilter = { status?: string; op_type?: string; q?: string };

export function CustomersExportBtn({ filters }: { filters: ExportFilter }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function doExport(format: "xlsx" | "pdf", lifecycle: string) {
    setLoading(true); setOpen(false);
    try {
      const p = new URLSearchParams({ format, lifecycle });
      if (filters.status)  p.set("status",  filters.status);
      if (filters.op_type) p.set("op_type", filters.op_type);
      if (filters.q)       p.set("q",       filters.q);
      const res  = await fetch(`/api/customers/export?${p}`);
      if (!res.ok) { alert("فشل التصدير"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `customers-${lifecycle}-${Date.now()}.${format === "pdf" ? "html" : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  }

  const OPTIONS = [
    { label: "👥 كل العملاء",      lifecycle: "all"    },
    { label: "✅ النشطون فقط",      lifecycle: "active" },
    { label: "🔒 المغلقون فقط",     lifecycle: "closed" },
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
          <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-3">
            <div className="text-xs font-bold text-slate-500 mb-2 px-1">اختر ما تريد تصديره</div>
            {OPTIONS.map(opt => (
              <div key={opt.lifecycle} className="flex gap-1.5 mb-1">
                <span className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{opt.label}</span>
                <button onClick={() => doExport("xlsx", opt.lifecycle)}
                  className="rounded-lg border border-emerald-200 bg-white px-2 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50">
                  XLS
                </button>
                <button onClick={() => doExport("pdf", opt.lifecycle)}
                  className="rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
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
