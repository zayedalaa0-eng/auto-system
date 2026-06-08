import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";

function normalize(v: string | null | undefined) { return (v ?? "").trim().toLowerCase(); }

function isIncomplete(row: Record<string, unknown>) {
  return !row.price || !row.chassis_no || !row.color || !row.gearbox || !row.fuel_type;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { data: profile } = await supabase
      .from("app_users").select("id, role, branch_id").eq("auth_user_id", session.user.id).maybeSingle();
    if (!profile) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const caps = getRoleCapabilities(profile.role);
    const sp = req.nextUrl.searchParams;
    const statusFilter = sp.get("status") ?? "";
    const dealFilter   = sp.get("deal")   ?? "";
    const tabFilter    = sp.get("tab")    ?? "";
    const qFilter      = normalize(sp.get("q") ?? "");

    let query = supabase
      .from("inventory")
      .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, notes, source_customer_id, branch_id, branches(name)")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (!caps.isGeneralManager && profile.branch_id) {
      query = query.eq("branch_id", profile.branch_id) as typeof query;
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let items = (rows ?? []) as Array<Record<string, unknown>>;

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

    const data = items.map((i, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const br = (i as any).branches;
      const branchName = Array.isArray(br) ? (br[0]?.name ?? "") : (br?.name ?? "");
      return {
        "#": idx + 1,
        "نوع السيارة":   i.model ?? "",
        "سنة الصنع":    i.production_year ?? "",
        "اللون":        i.color ?? "",
        "رقم الشاصي":   i.chassis_no ?? "",
        "السعر (₪)":    i.price ?? "",
        "العداد (كم)":  i.mileage ?? "",
        "ناقل الحركة":  i.gearbox ?? "",
        "نوع الوقود":   i.fuel_type ?? "",
        "الحالة":       i.condition_label ?? "",
        "نوع الصفقة":   i.deal_type ?? "",
        "التوفر":       i.availability_status ?? "",
        "المالك":       i.owner_name ?? "",
        "المعرض":       branchName,
        "المواصفات":    i.specs ?? "",
        "الفحص":        i.inspection ?? "",
        "ملاحظات":      i.notes ?? "",
      };
    });

    const stats = {
      total:      items.length,
      available:  items.filter(i => normalize(i.availability_status as string) === "متوفرة").length,
      reserved:   items.filter(i => normalize(i.availability_status as string) === "محجوزة").length,
      sold:       items.filter(i => normalize(i.availability_status as string) === "مباعة").length,
      incomplete: items.filter(isIncomplete).length,
      totalValue: items.reduce((s, i) => s + (Number(i.price) || 0), 0),
    };

    return NextResponse.json({ data, stats, label: statusFilter || tabFilter || "الكل" });
  } catch (err) {
    console.error("[inventory/export]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
