export const runtime = "nodejs";

import * as XLSX from "xlsx";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";

function normalize(v: string | null | undefined) { return (v ?? "").trim().toLowerCase(); }

function isIncomplete(row: Record<string, unknown>) {
  return !row.price || !row.chassis_no || !row.color || !row.gearbox || !row.fuel_type;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { data: profile } = await supabase
    .from("app_users").select("id, role, branch_id").eq("auth_user_id", session.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const caps = getRoleCapabilities(profile.role);
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "pdf" ? "pdf" : "xlsx";
  const statusFilter = sp.get("status") ?? "";
  const dealFilter   = sp.get("deal")   ?? "";
  const tabFilter    = sp.get("tab")    ?? "";
  const qFilter      = normalize(sp.get("q") ?? "");

  // ── جلب المخزون ──────────────────────────────────────────────────────────────
  let query = supabase
    .from("inventory")
    .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, notes, branch_id, branches(name)")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (!caps.isGeneralManager && profile.branch_id) {
    query = query.eq("branch_id", profile.branch_id) as typeof query;
  }

  const { data: rows } = await query;
  let items = (rows ?? []) as Array<Record<string, unknown>>;

  // ── فلترة ─────────────────────────────────────────────────────────────────────
  const CUSTOMER_DEALS = ["برسم البيع", "استبدال"];

  if (tabFilter === "customers") {
    items = items.filter(i => CUSTOMER_DEALS.some(d => normalize(i.deal_type as string).includes(normalize(d))));
  } else if (tabFilter === "showroom") {
    items = items.filter(i => !CUSTOMER_DEALS.some(d => normalize(i.deal_type as string).includes(normalize(d))));
  }

  if (statusFilter === "incomplete") {
    items = items.filter(isIncomplete);
  } else if (statusFilter) {
    items = items.filter(i => normalize(i.availability_status as string) === normalize(statusFilter));
  }

  if (dealFilter && dealFilter !== "all") {
    items = items.filter(i => normalize(i.deal_type as string).includes(normalize(dealFilter)));
  }

  if (qFilter) {
    items = items.filter(i =>
      [i.model, i.chassis_no, i.owner_name, i.color].some(v =>
        normalize(v as string).includes(qFilter)
      )
    );
  }

  // ── بناء بيانات الجدول ────────────────────────────────────────────────────────
  const statusLabel = statusFilter === "incomplete" ? "بيانات ناقصة"
    : statusFilter || "الكل";

  const sheetData = items.map((i, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const branchName = Array.isArray((i as any).branches) ? (i as any).branches[0]?.name : (i as any).branches?.name ?? "";
    return {
      "#":                   idx + 1,
      "نوع السيارة":         i.model ?? "",
      "سنة الصنع":          i.production_year ?? "",
      "اللون":              i.color ?? "",
      "رقم الشاصي":         i.chassis_no ?? "",
      "السعر (₪)":          i.price ?? "",
      "العداد (كم)":        i.mileage ?? "",
      "ناقل الحركة":        i.gearbox ?? "",
      "نوع الوقود":         i.fuel_type ?? "",
      "الحالة":             i.condition_label ?? "",
      "نوع الصفقة":         i.deal_type ?? "",
      "التوفر":             i.availability_status ?? "",
      "المالك":             i.owner_name ?? "",
      "المعرض":             branchName,
      "المواصفات":          i.specs ?? "",
      "الفحص":              i.inspection ?? "",
      "ملاحظات":            i.notes ?? "",
    };
  });

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);

    // عرض الأعمدة
    ws["!cols"] = [
      { wch: 4 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 },
      { wch: 24 }, { wch: 24 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, `مخزون — ${statusLabel}`);

    // ورقة إحصاءات
    const available  = items.filter(i => normalize(i.availability_status as string) === "متوفرة").length;
    const reserved   = items.filter(i => normalize(i.availability_status as string) === "محجوزة").length;
    const sold       = items.filter(i => normalize(i.availability_status as string) === "مباعة").length;
    const incomplete = items.filter(isIncomplete).length;
    const totalValue = items.reduce((s, i) => s + (Number(i.price) || 0), 0);

    const stats = [
      ["📊 إحصاءات المخزون", ""],
      ["إجمالي السيارات", items.length],
      ["متوفرة", available],
      ["محجوزة", reserved],
      ["مباعة", sold],
      ["بيانات ناقصة", incomplete],
      ["", ""],
      ["إجمالي قيمة المخزون (₪)", totalValue.toLocaleString("en-US")],
      ["", ""],
      ["تاريخ التصدير", new Date().toLocaleDateString("en-GB")],
    ];
    const wsStats = XLSX.utils.aoa_to_sheet(stats);
    wsStats["!cols"] = [{ wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsStats, "إحصاءات");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inventory-${statusLabel}-${Date.now()}.xlsx"`,
      },
    });
  }

  // ── PDF (HTML → print) ────────────────────────────────────────────────────────
  const rows2 = sheetData.map(r => `
    <tr>
      <td>${r["#"]}</td>
      <td><b>${r["نوع السيارة"]}</b></td>
      <td>${r["سنة الصنع"]}</td>
      <td>${r["اللون"]}</td>
      <td style="font-family:monospace;font-size:10px">${r["رقم الشاصي"]}</td>
      <td><b style="color:#16a34a">${r["السعر (₪)"] ? Number(r["السعر (₪)"]).toLocaleString("en-US") + " ₪" : "—"}</b></td>
      <td>${r["العداد (كم)"] ? Number(r["العداد (كم)"]).toLocaleString("en-US") : "—"}</td>
      <td>${r["نوع الصفقة"]}</td>
      <td>${r["التوفر"]}</td>
      <td>${r["المعرض"]}</td>
    </tr>`).join("");

  const totalVal = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const dateStr  = new Date().toLocaleDateString("en-GB");

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; direction: rtl; margin: 20px; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  .meta { text-align: center; color: #666; font-size: 10px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e40af; color: white; padding: 6px 4px; font-size: 10px; }
  td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .stats { display: flex; gap: 20px; margin-bottom: 12px; justify-content: center; }
  .stat { background: #eff6ff; border-radius: 8px; padding: 6px 14px; text-align: center; }
  .stat-n { font-size: 18px; font-weight: bold; color: #1e40af; }
  .stat-l { font-size: 10px; color: #64748b; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>🚗 تقرير المخزون — ${statusLabel}</h1>
<div class="meta">تاريخ التصدير: ${dateStr} | إجمالي: ${items.length} سيارة | القيمة الإجمالية: ${totalVal.toLocaleString("en-US")} ₪</div>
<div class="stats">
  <div class="stat"><div class="stat-n">${items.filter(i => normalize(i.availability_status as string) === "متوفرة").length}</div><div class="stat-l">متوفرة</div></div>
  <div class="stat"><div class="stat-n">${items.filter(i => normalize(i.availability_status as string) === "محجوزة").length}</div><div class="stat-l">محجوزة</div></div>
  <div class="stat"><div class="stat-n">${items.filter(i => normalize(i.availability_status as string) === "مباعة").length}</div><div class="stat-l">مباعة</div></div>
  <div class="stat"><div class="stat-n">${items.filter(isIncomplete).length}</div><div class="stat-l">بيانات ناقصة</div></div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>السيارة</th><th>السنة</th><th>اللون</th><th>الشاصي</th>
    <th>السعر</th><th>العداد</th><th>الصفقة</th><th>التوفر</th><th>المعرض</th>
  </tr></thead>
  <tbody>${rows2}</tbody>
</table>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${statusLabel}-${Date.now()}.html"`,
    },
  });
}
