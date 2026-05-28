import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

type ImportRow = {
  model: string;
  production_year: number | null;
  color: string | null;
  price: number | null;
  chassis_no: string | null;
  mileage: number | null;
  gearbox: string | null;
  fuel_type: string | null;
  condition_label: string | null;
  deal_type: string | null;
  availability_status: string;
  specs: string | null;
  inspection: string | null;
};

type ImportResult = {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
};

function parseNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseStr(value: unknown): string | null {
  const s = (value ?? "").toString().trim();
  return s || null;
}

function normalizeStatus(raw: string | null): string {
  const s = (raw ?? "").trim();
  const lower = s.toLowerCase();
  if (lower.includes("محجوز") || lower.includes("محجوزة")) return "محجوزة";
  if (lower.includes("مباع") || lower.includes("مباعة")) return "مباعة";
  if (lower.includes("مسحوب")) return "مسحوبة من المعرض";
  return "متوفرة"; // default
}

function parseRow(raw: Record<string, unknown>): ImportRow | { error: string } {
  const model = parseStr(raw["اسم السيارة / الموديل *"] ?? raw["اسم السيارة"]);
  if (!model) return { error: "اسم السيارة مطلوب" };

  const yearRaw = parseNum(raw["سنة الصنع *"] ?? raw["سنة الصنع"]);
  const color = parseStr(raw["اللون *"] ?? raw["اللون"]);
  const chassisNo = parseStr(raw["رقم الشاصي *"] ?? raw["رقم الشاصي"]);

  if (!color) return { error: `سيارة "${model}": اللون مطلوب` };
  if (!chassisNo) return { error: `سيارة "${model}": رقم الشاصي مطلوب` };
  if (yearRaw && (yearRaw < 1980 || yearRaw > 2030)) {
    return { error: `سيارة "${model}": سنة الصنع ${yearRaw} غير صحيحة` };
  }

  return {
    model,
    production_year: yearRaw,
    color,
    chassis_no: chassisNo,
    price: parseNum(raw["السعر (شيكل)"] ?? raw["السعر"]),
    mileage: parseNum(raw["العداد (كم)"] ?? raw["العداد"]),
    gearbox: parseStr(raw["ناقل الحركة"]),
    fuel_type: parseStr(raw["نوع الوقود"]),
    condition_label: parseStr(raw["حالة السيارة"]),
    deal_type: parseStr(raw["نوع الصفقة"]),
    availability_status: normalizeStatus(parseStr(raw["حالة التوفر"])),
    specs: parseStr(raw["مواصفات إضافية"] ?? raw["المواصفات"]),
    inspection: parseStr(raw["ملاحظات الفحص"] ?? raw["الفحص"]),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  // يُسمح باستيراد المخزون للمديرين فقط
  const capabilities = getRoleCapabilities(profile?.role);
  if (!capabilities.isManager) {
    return NextResponse.json({ error: "غير مصرح — هذه العملية متاحة للمديرين فقط" }, { status: 403 });
  }

  const branchId = profile?.branch_id ?? null;

  // ── قراءة الملف ─────────────────────────────────────────────
  let arrayBuffer: ArrayBuffer;
  let ownerName: string | null = null;
  let uploadedBranchId: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "لم يتم رفع أي ملف" }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      return NextResponse.json({ error: "صيغة الملف غير مدعومة. يُرجى رفع ملف .xlsx أو .xls أو .csv" }, { status: 400 });
    }
    // اسم المعرض يُرسَل من الواجهة (لا يُقرأ من الملف)
    ownerName = (formData.get("branch_name") as string | null)?.trim() || null;
    uploadedBranchId = (formData.get("branch_id") as string | null)?.trim() || null;
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "تعذر قراءة الملف" }, { status: 400 });
  }

  if (!ownerName) {
    return NextResponse.json({ error: "لم يتم تحديد المعرض. يرجى اختيار المعرض قبل الرفع." }, { status: 400 });
  }

  // ── تحليل Excel ─────────────────────────────────────────────
  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    // نقرأ الورقة الأولى فقط (Data)
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  } catch {
    return NextResponse.json({ error: "الملف تالف أو بصيغة غير مدعومة" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "الملف فارغ — لا توجد صفوف بيانات" }, { status: 400 });
  }

  if (rows.length > 500) {
    return NextResponse.json({ error: "الحد الأقصى 500 سيارة لكل ملف" }, { status: 400 });
  }

  // ── معالجة الصفوف ────────────────────────────────────────────
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // الصف الأول headers
    const parsed = parseRow(rows[i]);

    if ("error" in parsed) {
      result.errors.push(`الصف ${rowNum}: ${parsed.error}`);
      result.skipped++;
      continue;
    }

    const payload = {
      branch_id: uploadedBranchId ?? branchId,
      model: parsed.model,
      production_year: parsed.production_year,
      color: parsed.color,
      price: parsed.price,
      chassis_no: parsed.chassis_no,
      mileage: parsed.mileage,
      gearbox: parsed.gearbox,
      fuel_type: parsed.fuel_type,
      condition_label: parsed.condition_label ?? "مستعملة",
      deal_type: parsed.deal_type ?? "شراء",
      availability_status: parsed.availability_status,
      owner_name: ownerName,
      specs: parsed.specs,
      inspection: parsed.inspection,
    };

    try {
      // الشاصي إلزامي → دائماً نبحث عنه أولاً (upsert)
      const { data: existing } = await supabase
        .from("inventory")
        .select("id")
        .eq("chassis_no", parsed.chassis_no!)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("inventory").update(payload).eq("id", existing.id);
        result.updated++;
      } else {
        await supabase.from("inventory").insert(payload);
        result.added++;
      }
    } catch {
      result.errors.push(`الصف ${rowNum} (${parsed.model}): خطأ في قاعدة البيانات`);
      result.skipped++;
    }
  }

  return NextResponse.json(result);
}
