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
    const branchFilter = sp.get("branch") ?? "";
    const ownerFilter  = sp.get("owner")  ?? "";
    const gearboxFilter = sp.get("gearbox") ?? "";
    const fuelFilter    = sp.get("fuel") ?? "";
    const showUsedFilter = sp.get("show_used") === "1";
    const qFilter      = normalize(sp.get("q") ?? "");

    // ── أسماء المعارض + اسم معرض المستخدم (للتصنيف حسب المالك وكشف المعلم) ──
    const { data: branchRows } = await supabase.from("branches").select("id, name").eq("is_active", true);
    const branchNameSet = new Set((branchRows ?? []).map(b => normalize(b.name as string)));
    const userBranchName = normalize(
      (branchRows ?? []).find(b => b.id === profile.branch_id)?.name as string ?? ""
    );
    const isMuallim = userBranchName.includes("المعلم");

    // ── جلب المخزون ──────────────────────────────────────────────────────────
    let query = supabase
      .from("inventory")
      .select("id, model, owner_name, deal_type, chassis_no, condition_label, availability_status, price, production_year, color, gearbox, fuel_type, mileage, specs, inspection, notes, source_customer_id, branch_id, branches(name)")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1000);

    // النطاق: المدير العام = الكل، معرض المعلم = الكل (cross-branch)، غيرهما = فرعه
    if (!caps.isGeneralManager && profile.branch_id && !isMuallim) {
      query = query.eq("branch_id", profile.branch_id) as typeof query;
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let items = (rows ?? []) as Array<Record<string, unknown>>;

    // ── تصنيف حسب المالك: شخص → عميل، معرض/فارغ → معرض ──────────────────────
    const isCustomerCar = (i: Record<string, unknown>) => {
      const owner = normalize(i.owner_name as string);
      return Boolean(owner) && !branchNameSet.has(owner);
    };

    // ── دالة تقسيم فلتر المعرض (نفس الموجودة في page.tsx) ───────────────────
    function parseBranchFilter(value: string | undefined) {
      const raw = (value ?? "").trim();
      if (!raw) return { mode: "default" as const, branchName: null as string | null };
      if (raw === "all") return { mode: "all" as const, branchName: null as string | null };
      if (raw === "self") return { mode: "self" as const, branchName: null as string | null };
      if (raw.startsWith("cross:")) return { mode: "cross" as const, branchName: raw.slice(6) || null };
      if (raw.startsWith("branch:")) return { mode: "branch" as const, branchName: raw.slice(7) || null };
      return { mode: "legacy-branch" as const, branchName: raw };
    }

    const bFilter = parseBranchFilter(branchFilter);
    const isShowUsed = showUsedFilter || isMuallim;

    items = items.filter(i => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const br = (i as any).branches;
      const itemBranch = normalize((Array.isArray(br) ? br[0]?.name : br?.name) as string ?? "");
      const itemOwner = normalize(i.owner_name as string);
      const itemDeal = normalize(i.deal_type as string);
      const itemGearbox = normalize(i.gearbox as string);
      const itemFuel = normalize(i.fuel_type as string);

      // ── فلتر المعرض ──
      if (caps.isGeneralManager) {
        if (bFilter.mode === "branch" && bFilter.branchName && itemBranch !== normalize(bFilter.branchName)) return false;
        if (bFilter.mode === "legacy-branch" && bFilter.branchName && itemBranch !== normalize(bFilter.branchName)) return false;
      } else if (isMuallim) {
        if (bFilter.mode === "all" || bFilter.mode === "default") {
          const isOtherBranch = itemBranch !== userBranchName;
          if (isOtherBranch) {
            const isCust = Boolean(itemOwner) && !branchNameSet.has(itemOwner);
            const cond = normalize(i.condition_label as string);
            if (!(itemDeal.includes("برسم البيع") || itemDeal.includes("استبدال") || itemDeal.includes("بيع بالوكالة") || cond === "مستعمل" || isCust)) return false;
          }
        } else if (bFilter.mode === "self") {
          if (itemBranch !== userBranchName) return false;
        } else if (bFilter.mode === "cross") {
          if (!bFilter.branchName || itemBranch !== normalize(bFilter.branchName)) return false;
          const isCust = Boolean(itemOwner) && !branchNameSet.has(itemOwner);
          const cond = normalize(i.condition_label as string);
          if (!(itemDeal.includes("برسم البيع") || itemDeal.includes("استبدال") || itemDeal.includes("بيع بالوكالة") || cond === "مستعمل" || isCust)) return false;
        } else if (bFilter.mode === "legacy-branch") {
          if (bFilter.branchName && itemBranch !== normalize(bFilter.branchName)) return false;
        }
      } else {
        if (itemBranch !== userBranchName) return false;
      }

      // ── الفلاتر الأخرى ──
      if (ownerFilter && ownerFilter !== "all" && itemOwner !== normalize(ownerFilter)) return false;
      if (dealFilter && dealFilter !== "all" && itemDeal !== normalize(dealFilter)) return false;
      if (gearboxFilter && gearboxFilter !== "all" && itemGearbox !== normalize(gearboxFilter)) return false;
      if (fuelFilter && fuelFilter !== "all" && itemFuel !== normalize(fuelFilter)) return false;

      // ── فلتر البحث ──
      if (qFilter) {
        const matches = [i.model, i.chassis_no, i.owner_name, i.color, itemBranch, i.gearbox, i.fuel_type].some(v =>
          normalize(v as string).includes(qFilter)
        );
        if (!matches) return false;
      }

      // ── تبويبات وفلاتر الحالة (نفس المنطق من page.tsx) ──
      if (tabFilter === "customers") {
        if (!isCustomerCar(i)) return false;
      } else if (tabFilter === "showroom") {
        if (isCustomerCar(i)) return false;
        // إظهار المستعمل
        if (!isMuallim && !isShowUsed) {
          if (!normalize(i.condition_label as string).includes("جديد")) return false;
        }
      }

      if (statusFilter === "incomplete") {
        if (!isIncomplete(i)) return false;
      } else if (statusFilter && statusFilter !== "all") {
        // "active" status means not sold and not withdrawn
        if (statusFilter === "active") {
          const s = normalize(i.availability_status as string);
          if (s === "مباعة" || s === "مسحوبة من المعرض") return false;
        } else {
          if (normalize(i.availability_status as string) !== normalize(statusFilter)) return false;
        }
      } else if (!statusFilter) {
        // default "active"
        const s = normalize(i.availability_status as string);
        if (s === "مباعة" || s === "مسحوبة من المعرض") return false;
      }

      return true;
    });

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
