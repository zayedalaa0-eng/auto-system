"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ExportFilter = { status?: string; deal?: string; branch?: string; tab?: string; q?: string };

function fmtD(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
}

async function downloadXlsx(data: Record<string, unknown>[], stats: Record<string, unknown>, label: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:4},{wch:22},{wch:10},{wch:12},{wch:20},{wch:12},{wch:12},{wch:14},{wch:12},{wch:12},{wch:14},{wch:14},{wch:16},{wch:16},{wch:24},{wch:24},{wch:24}];
  XLSX.utils.book_append_sheet(wb, ws, `مخزون — ${label}`);

  const statsRows = [
    ["📊 إحصاءات المخزون",""],
    ["إجمالي السيارات", stats.total],
    ["متوفرة", stats.available],
    ["محجوزة", stats.reserved],
    ["مباعة",  stats.sold],
    ["بيانات ناقصة", stats.incomplete],
    ["",""],
    ["إجمالي القيمة (₪)", Number(stats.totalValue).toLocaleString("en-US")],
    ["",""],
    ["تاريخ التصدير", fmtD(new Date().toISOString())],
  ];
  const wsS = XLSX.utils.aoa_to_sheet(statsRows);
  wsS["!cols"] = [{wch:28},{wch:18}];
  XLSX.utils.book_append_sheet(wb, wsS, "إحصاءات");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `inventory-${label}-${Date.now()}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
}

function downloadHtml(data: Record<string, unknown>[], stats: Record<string, unknown>, label: string) {
  const total = Number(stats.totalValue).toLocaleString("en-US");
  const rows = data.map(r => `<tr>
    <td>${r["#"]}</td><td><b>${r["نوع السيارة"]}</b></td><td>${r["سنة الصنع"]}</td>
    <td>${r["اللون"]}</td><td style="font-family:monospace;font-size:10px">${r["رقم الشاصي"]}</td>
    <td><b style="color:#16a34a">${r["السعر (₪)"] ? Number(r["السعر (₪)"]).toLocaleString("en-US")+" ₪" : "—"}</b></td>
    <td>${r["العداد (كم)"] ? Number(r["العداد (كم)"]).toLocaleString("en-US") : "—"}</td>
    <td>${r["نوع الصفقة"]}</td><td>${r["التوفر"]}</td><td>${r["المعرض"]}</td>
  </tr>`).join("");
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
<style>body{font-family:Arial;font-size:11px;direction:rtl;margin:20px}h1{font-size:16px;text-align:center}
.meta{text-align:center;color:#666;font-size:10px;margin-bottom:12px}
table{width:100%;border-collapse:collapse}th{background:#1e40af;color:white;padding:6px 4px;font-size:10px}
td{padding:5px 4px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafc}
.stats{display:flex;gap:16px;margin-bottom:12px;justify-content:center}
.stat{background:#eff6ff;border-radius:8px;padding:6px 14px;text-align:center}
.stat-n{font-size:18px;font-weight:bold;color:#1e40af}.stat-l{font-size:10px;color:#64748b}</style></head>
<body><h1>🚗 تقرير المخزون — ${label}</h1>
<div class="meta">${fmtD(new Date().toISOString())} | ${data.length} سيارة | القيمة: ${total} ₪</div>
<div class="stats">
<div class="stat"><div class="stat-n">${stats.available}</div><div class="stat-l">متوفرة</div></div>
<div class="stat"><div class="stat-n">${stats.reserved}</div><div class="stat-l">محجوزة</div></div>
<div class="stat"><div class="stat-n">${stats.sold}</div><div class="stat-l">مباعة</div></div>
<div class="stat"><div class="stat-n">${stats.incomplete}</div><div class="stat-l">بيانات ناقصة</div></div>
</div>
<table><thead><tr><th>#</th><th>السيارة</th><th>السنة</th><th>اللون</th><th>الشاصي</th><th>السعر</th><th>العداد</th><th>الصفقة</th><th>التوفر</th><th>المعرض</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `inventory-${label}-${Date.now()}.html`;
  a.click(); URL.revokeObjectURL(url);
}

export function InventoryExportBtn({ filters }: { filters: ExportFilter }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function doExport(format: "xlsx" | "pdf", statusOverride?: string) {
    setLoading(true); setOpen(false);
    try {
      const p = new URLSearchParams();
      if (statusOverride !== undefined) p.set("status", statusOverride);
      else if (filters.status) p.set("status", filters.status);
      if (filters.deal)   p.set("deal",   filters.deal);
      if (filters.tab)    p.set("tab",    filters.tab);
      if (filters.q)      p.set("q",      filters.q);

      const res = await fetch(`/api/inventory/export?${p}`);
      if (!res.ok) { alert("فشل التصدير: " + (await res.text())); return; }
      const { data, stats, label } = await res.json();

      if (format === "xlsx") await downloadXlsx(data, stats, label);
      else downloadHtml(data, stats, label);
    } catch(e) {
      alert("خطأ: " + e);
    } finally {
      setLoading(false);
    }
  }

  const OPTIONS = [
    { label: "📦 المخزون الكامل",      status: ""                      },
    { label: "✅ المتوفرة فقط",          status: "متوفرة"                },
    { label: "🔒 المحجوزة فقط",          status: "محجوزة"                },
    { label: "💰 المباعة فقط",           status: "مباعة"                 },
    { label: "🚫 المسحوبة من المعرض",   status: "مسحوبة من المعرض"     },
    { label: "⚠️ بيانات ناقصة",         status: "incomplete"            },
  ];

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-60">
        {loading ? "⏳" : <Download className="h-4 w-4" />}
        تصدير
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-3">
            <div className="text-xs font-bold text-slate-500 mb-2 px-1">اختر ما تريد تصديره</div>
            {OPTIONS.map(opt => (
              <div key={opt.status} className="flex gap-1.5 mb-1">
                <span className="flex-1 rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{opt.label}</span>
                <button onClick={() => doExport("xlsx", opt.status || undefined)}
                  className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 px-2 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">XLS</button>
                <button onClick={() => doExport("pdf", opt.status || undefined)}
                  className="rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 px-2 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30">PDF</button>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 text-center">يأخذ الفلاتر الحالية بالحسبان</div>
          </div>
        </>
      )}
    </div>
  );
}
