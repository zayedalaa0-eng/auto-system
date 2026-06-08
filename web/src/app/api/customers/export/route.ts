export const runtime = "nodejs";

import * as XLSX from "xlsx";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";

function normalize(v: string | null | undefined) { return (v ?? "").trim().toLowerCase(); }
function fmtD(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
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
  const format     = sp.get("format") === "pdf" ? "pdf" : "xlsx";
  const lifecycle  = sp.get("lifecycle") ?? "all";   // active | closed | all
  const statusF    = sp.get("status")   ?? "";
  const opTypeF    = sp.get("op_type")  ?? "";
  const qF         = normalize(sp.get("q") ?? "");

  // ── جلب العملاء ──────────────────────────────────────────────────────────────
  let query = supabase
    .from("customers")
    .select("id, full_name, nickname, phone, address, status, operation_type, requested_car, next_follow_up_at, last_contact_at, visit_count, created_at, is_active, branch_id, assigned_user_id, metadata, branches(name), app_users(full_name)")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (!caps.isGeneralManager && profile.branch_id) {
    query = query.eq("branch_id", profile.branch_id) as typeof query;
  }
  if (lifecycle === "active")  query = query.eq("is_active", true)  as typeof query;
  if (lifecycle === "closed")  query = query.eq("is_active", false) as typeof query;
  if (statusF) query = query.ilike("status", `%${statusF}%`) as typeof query;
  if (opTypeF && opTypeF !== "all") query = query.ilike("operation_type", `%${opTypeF}%`) as typeof query;

  const { data: rows } = await query;
  let items = (rows ?? []) as Array<Record<string, unknown>>;

  if (qF) {
    items = items.filter(i =>
      [i.full_name, i.phone, i.nickname, i.address].some(v =>
        normalize(v as string).includes(qF)
      )
    );
  }

  // ── تحويل للجدول ─────────────────────────────────────────────────────────────
  const sheetData = items.map((i, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const branchName  = (i as any).branches?.name ?? Array.isArray((i as any).branches) ? (i as any).branches?.[0]?.name ?? "" : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffName   = (i as any).app_users?.full_name ?? Array.isArray((i as any).app_users) ? (i as any).app_users?.[0]?.full_name ?? "" : "";
    const meta        = (i.metadata ?? {}) as Record<string, unknown>;
    const dealValue   = meta.deal_value ? Number(meta.deal_value).toLocaleString("en-US") + " ₪" : "";
    const payMethod   = (meta.payment_method as string) ?? "";

    return {
      "#":                   idx + 1,
      "الاسم الكامل":        i.full_name ?? "",
      "الكنية":              i.nickname  ?? "",
      "الهاتف":              i.phone     ?? "",
      "المدينة / العنوان":   i.address   ?? "",
      "نوع العملية":         i.operation_type ?? "",
      "الحالة":              i.status    ?? "",
      "السيارة المطلوبة":   i.requested_car ?? "",
      "طريقة الدفع":         payMethod,
      "قيمة الصفقة":         dealValue,
      "موعد المتابعة":      fmtD(i.next_follow_up_at as string | null),
      "آخر تواصل":           fmtD(i.last_contact_at  as string | null),
      "عدد التفاعلات":       i.visit_count ?? 0,
      "تاريخ الإضافة":       fmtD(i.created_at as string | null),
      "الحالة العامة":       (i.is_active ? "نشط" : "مغلق"),
      "المعرض":              branchName,
      "الموظف المسؤول":      staffName,
    };
  });

  const lifecycleLabel = lifecycle === "active" ? "نشطون" : lifecycle === "closed" ? "مغلقون" : "الكل";
  const dateStr = new Date().toLocaleDateString("en-GB");

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      {wch:4},{wch:22},{wch:14},{wch:14},{wch:18},{wch:18},{wch:22},{wch:24},
      {wch:14},{wch:14},{wch:14},{wch:14},{wch:8},{wch:14},{wch:10},{wch:16},{wch:16},
    ];
    XLSX.utils.book_append_sheet(wb, ws, `العملاء — ${lifecycleLabel}`);

    // إحصاءات
    const active  = items.filter(i => i.is_active).length;
    const closed  = items.filter(i => !i.is_active).length;
    const withFU  = items.filter(i => i.next_follow_up_at).length;
    const totalDV = items.reduce((s, i) => {
      const m = (i.metadata ?? {}) as Record<string, unknown>;
      return s + (typeof m.deal_value === "number" ? m.deal_value : 0);
    }, 0);

    const stats = [
      ["📊 إحصاءات العملاء", ""],
      ["إجمالي العملاء", items.length],
      ["نشطون", active],
      ["مغلقون", closed],
      ["لديهم موعد متابعة", withFU],
      ["", ""],
      ["إجمالي قيمة الصفقات (₪)", totalDV.toLocaleString("en-US")],
      ["", ""],
      ["تاريخ التصدير", dateStr],
    ];
    const wsStats = XLSX.utils.aoa_to_sheet(stats);
    wsStats["!cols"] = [{wch:28},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsStats, "إحصاءات");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="customers-${lifecycleLabel}-${Date.now()}.xlsx"`,
      },
    });
  }

  // ── PDF (HTML) ────────────────────────────────────────────────────────────────
  const trs = sheetData.map(r => `<tr>
    <td>${r["#"]}</td>
    <td><b>${r["الاسم الكامل"]}</b>${r["الكنية"] ? ` (${r["الكنية"]})` : ""}</td>
    <td>${r["الهاتف"]}</td>
    <td>${r["نوع العملية"]}</td>
    <td style="color:${r["الحالة العامة"]==="نشط"?"#16a34a":"#dc2626"}">${r["الحالة"]}</td>
    <td>${r["السيارة المطلوبة"]}</td>
    <td>${r["موعد المتابعة"]}</td>
    <td>${r["المعرض"]}</td>
    <td>${r["الموظف المسؤول"]}</td>
  </tr>`).join("");

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;margin:20px}
  h1{font-size:16px;text-align:center;margin-bottom:4px}
  .meta{text-align:center;color:#666;font-size:10px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  th{background:#1e40af;color:white;padding:6px 4px;font-size:10px}
  td{padding:5px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .stats{display:flex;gap:16px;margin-bottom:12px;justify-content:center;flex-wrap:wrap}
  .stat{background:#eff6ff;border-radius:8px;padding:6px 14px;text-align:center}
  .stat-n{font-size:18px;font-weight:bold;color:#1e40af}
  .stat-l{font-size:10px;color:#64748b}
</style>
</head>
<body>
<h1>👥 تقرير العملاء — ${lifecycleLabel}</h1>
<div class="meta">تاريخ التصدير: ${dateStr} | إجمالي: ${items.length} عميل</div>
<div class="stats">
  <div class="stat"><div class="stat-n">${items.filter(i=>i.is_active).length}</div><div class="stat-l">نشطون</div></div>
  <div class="stat"><div class="stat-n">${items.filter(i=>!i.is_active).length}</div><div class="stat-l">مغلقون</div></div>
  <div class="stat"><div class="stat-n">${items.filter(i=>i.next_follow_up_at).length}</div><div class="stat-l">لديهم متابعة</div></div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>الاسم</th><th>الهاتف</th><th>نوع العملية</th><th>الحالة</th>
    <th>السيارة المطلوبة</th><th>موعد المتابعة</th><th>المعرض</th><th>الموظف</th>
  </tr></thead>
  <tbody>${trs}</tbody>
</table>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${lifecycleLabel}-${Date.now()}.html"`,
    },
  });
}
