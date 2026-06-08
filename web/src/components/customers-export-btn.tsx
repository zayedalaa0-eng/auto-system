"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ExportFilter = { status?: string; q?: string };

function fmtD(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
}

async function downloadXlsx(data: Record<string, unknown>[], stats: Record<string, unknown>, label: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:4},{wch:22},{wch:14},{wch:14},{wch:18},{wch:18},{wch:22},{wch:24},{wch:14},{wch:14},{wch:14},{wch:14},{wch:8},{wch:14},{wch:10},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws, `العملاء — ${label}`);

  const statsRows = [
    ["📊 إحصاءات العملاء",""],
    ["إجمالي العملاء", stats.total],
    ["نشطون", stats.active],
    ["مغلقون", stats.closed],
    ["لديهم موعد متابعة", stats.withFU],
    ["",""],
    ["إجمالي قيمة الصفقات (₪)", Number(stats.totalDV).toLocaleString("en-US")],
    ["",""],
    ["تاريخ التصدير", fmtD(new Date().toISOString())],
  ];
  const wsS = XLSX.utils.aoa_to_sheet(statsRows);
  wsS["!cols"] = [{wch:28},{wch:18}];
  XLSX.utils.book_append_sheet(wb, wsS, "إحصاءات");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
  a.download = `customers-${label}-${Date.now()}.xlsx`; a.click(); URL.revokeObjectURL(url);
}

function downloadHtml(data: Record<string, unknown>[], stats: Record<string, unknown>, label: string) {
  const rows = data.map(r => `<tr>
    <td>${r["#"]}</td><td><b>${r["الاسم الكامل"]}</b>${r["الكنية"]?` (${r["الكنية"]})`:""}
    </td><td>${r["الهاتف"]}</td><td>${r["نوع العملية"]}</td>
    <td style="color:${r["الحالة العامة"]==="نشط"?"#16a34a":"#dc2626"}">${r["الحالة"]}</td>
    <td>${r["السيارة المطلوبة"]}</td><td>${r["موعد المتابعة"]}</td>
    <td>${r["المعرض"]}</td><td>${r["الموظف المسؤول"]}</td>
  </tr>`).join("");
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
<style>body{font-family:Arial;font-size:11px;direction:rtl;margin:20px}h1{font-size:16px;text-align:center}
.meta{text-align:center;color:#666;font-size:10px;margin-bottom:12px}
table{width:100%;border-collapse:collapse}th{background:#1e40af;color:white;padding:6px 4px;font-size:10px}
td{padding:5px 4px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafc}
.stats{display:flex;gap:16px;margin-bottom:12px;justify-content:center}
.stat{background:#eff6ff;border-radius:8px;padding:6px 14px;text-align:center}
.stat-n{font-size:18px;font-weight:bold;color:#1e40af}.stat-l{font-size:10px;color:#64748b}</style></head>
<body><h1>👥 تقرير العملاء — ${label}</h1>
<div class="meta">${fmtD(new Date().toISOString())} | ${data.length} عميل</div>
<div class="stats">
<div class="stat"><div class="stat-n">${stats.active}</div><div class="stat-l">نشطون</div></div>
<div class="stat"><div class="stat-n">${stats.closed}</div><div class="stat-l">مغلقون</div></div>
<div class="stat"><div class="stat-n">${stats.withFU}</div><div class="stat-l">لديهم متابعة</div></div>
</div>
<table><thead><tr><th>#</th><th>الاسم</th><th>الهاتف</th><th>نوع العملية</th><th>الحالة</th><th>السيارة المطلوبة</th><th>موعد المتابعة</th><th>المعرض</th><th>الموظف</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
  a.download = `customers-${label}-${Date.now()}.html`; a.click(); URL.revokeObjectURL(url);
}

export function CustomersExportBtn({ filters }: { filters: ExportFilter }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function doExport(format: "xlsx" | "pdf", lifecycle: string) {
    setLoading(true); setOpen(false);
    try {
      const p = new URLSearchParams({ lifecycle });
      if (filters.status) p.set("status", filters.status);
      if (filters.q)      p.set("q",      filters.q);
      const res = await fetch(`/api/customers/export?${p}`);
      if (!res.ok) { alert("فشل التصدير: " + (await res.text())); return; }
      const { data, stats, label } = await res.json();
      if (format === "xlsx") await downloadXlsx(data, stats, label);
      else downloadHtml(data, stats, label);
    } catch(e) {
      alert("خطأ: " + e);
    } finally { setLoading(false); }
  }

  const OPTIONS = [
    { label: "👥 كل العملاء",     lifecycle: "all"    },
    { label: "✅ النشطون فقط",     lifecycle: "active" },
    { label: "🔒 المغلقون فقط",    lifecycle: "closed" },
  ];

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
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
                  className="rounded-lg border border-emerald-200 bg-white px-2 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50">XLS</button>
                <button onClick={() => doExport("pdf", opt.lifecycle)}
                  className="rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">PDF</button>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400 text-center">يأخذ الفلاتر الحالية بالحسبان</div>
          </div>
        </>
      )}
    </div>
  );
}
