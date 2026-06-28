import Link from "next/link";
import { Building2, Calendar, Car, Fuel, GaugeCircle, Palette, Send, Settings2, Store, Tag, User, Warehouse } from "lucide-react";
import { BranchLogo } from "@/components/branch-logo";

import { CarGalleryViewer } from "@/components/car-gallery-viewer";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { Pagination } from "@/components/pagination";
import { InventoryExportBtn } from "@/components/inventory-export-btn";
import { InventoryFilterBar } from "@/components/inventory-filter-bar";
import { InventoryImportBtn } from "@/components/inventory-import-btn";
import { EditableCell, InventoryPriceCellNew, GEARBOX_OPTIONS, FUEL_OPTIONS } from "@/components/inventory-inline-edit";
import { sendQuickReminderAction } from "@/app/dashboard/actions";
import { getInventoryCarAttachments, getInventoryDirectory, getInventoryFilterContext } from "@/lib/data";
import { formatCurrency } from "@/lib/format";
import { getColorSwatch } from "@/lib/colors";

type InventoryFilters = {
  q?: string;
  branch?: string;
  owner?: string;
  deal?: string;
  status?: string;
  gearbox?: string;
  fuel?: string;
  car?: string;
  cross?: string;
  tab?: string;
  minPrice?: string;
  maxPrice?: string;
  show_used?: string;
  page?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseBranchFilter(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return { mode: "default" as const, branchName: null as string | null };
  if (raw === "all") return { mode: "all" as const, branchName: null as string | null };
  if (raw === "self") return { mode: "self" as const, branchName: null as string | null };
  if (raw.startsWith("cross:")) return { mode: "cross" as const, branchName: raw.slice(6) || null };
  if (raw.startsWith("branch:")) return { mode: "branch" as const, branchName: raw.slice(7) || null };
  return { mode: "legacy-branch" as const, branchName: raw };
}

/**
 * تطبيع النص العربي — يُزيل التشكيل وينوّع الهمزات والحروف
 */
function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٟؐ-ؚۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();
}



function getDealBadgeClass(value: string | null | undefined) {
  const label = normalize(value);
  if (label.includes("استبدال")) return "inv-deal-badge inv-deal-badge--trade";
  if (label.includes("برسم البيع")) return "inv-deal-badge inv-deal-badge--consign";
  if (label.includes("شراء")) return "inv-deal-badge inv-deal-badge--purchase";
  if (label.includes("حيازة")) return "inv-deal-badge inv-deal-badge--owned";
  return "inv-deal-badge inv-deal-badge--default";
}

// ── كشف البيانات الناقصة ──────────────────────────────────────────────────────
type InventoryItem = Awaited<ReturnType<typeof getInventoryDirectory>>[number];

function isIncomplete(item: InventoryItem): boolean {
  return !item.price || !item.chassis_no || !item.color || !item.gearbox || !item.fuel_type;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventoryFilters>;
}) {
  const params = await searchParams;
  const { q, branch, owner, deal, status, gearbox, fuel, minPrice, maxPrice, car, cross, tab, show_used, page } = params;

  // التبويب: showroom = مخزون المعرض، customers = مخزون العملاء
  const activeTab = tab === "customers" ? "customers" : "showroom";
  const ctx = await getInventoryFilterContext();
  const branchFilter = parseBranchFilter(branch);
  
  const isAlMuallimView = ctx.isMuallimBranch || (branchFilter.branchName && (branchFilter.branchName.includes("المعلم") || branchFilter.branchName.includes("معلم")));
  const isShowUsed = show_used === "1" || isAlMuallimView;
  // معرض لمعلم: يجلب دائماً سيارات المعارض الأخرى (برسم البيع) — الفلتر يتحكم بما يُعرض
  const includeCross =
    ctx.isMuallimBranch && !ctx.isGeneralManager
      ? true
      : normalize(cross) === "1";
  const inventory = await getInventoryDirectory(120, { includeCrossBranchForMuallim: includeCross });

  // أسماء المعارض لاستبعادها من قائمة الملاك
  const branchNamesSet = new Set(ctx.branches.map((b) => normalize(b)));

  // أصحاب السيارات برسم البيع — عملاء فقط (بدون المعارض)
  const consignmentOwners = [
    ...new Set(
      inventory
        .filter((i) => normalize(i.deal_type).includes("برسم البيع"))
        .map((i) => normalize(i.owner_name))
        .filter((name) => Boolean(name) && !branchNamesSet.has(name)),
    ),
  ].sort((a, b) => a.localeCompare(b, "ar"));

  const branches = [
    ...new Set(
      (ctx.branches.length > 0
        ? ctx.branches
        : inventory.map((i) => normalize(i.branch_name))
      ).filter(Boolean),
    ),
  ];
  const deals = [...new Set(inventory.map((i) => normalize(i.deal_type)).filter(Boolean))];
  const statuses = [...new Set(inventory.map((i) => normalize(i.availability_status)).filter(Boolean))];

  const gearboxOptions = [...new Set(inventory.map((i) => normalize(i.gearbox)).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ar"),
  );
  const fuelTypes = [...new Set(inventory.map((i) => normalize(i.fuel_type)).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ar"),
  );

  const query = normalize(q);
  const selectedCarId = normalize(car);

  // ── الفلترة الأساسية (بدون status/incomplete) ────────────────────────────────
  const baseFiltered = inventory.filter((item) => {
    const itemBranch = normalize(item.branch_name);
    const itemOwner = normalize(item.owner_name);
    const itemDeal = normalize(item.deal_type);
    const itemGearbox = normalize(item.gearbox);
    const itemFuel = normalize(item.fuel_type);

    // فلتر المعرض
    if (ctx.isGeneralManager) {
      if (branchFilter.mode === "branch" && branchFilter.branchName && itemBranch !== branchFilter.branchName)
        return false;
      if (branchFilter.mode === "legacy-branch" && branchFilter.branchName && itemBranch !== branchFilter.branchName)
        return false;
    } else if (ctx.isMuallimBranch) {
      if (branchFilter.mode === "all" || branchFilter.mode === "default") {
        // كل المعارض أو الافتراضي: سيارات لمعلم كلها + سيارات المعارض الأخرى المستعملة/برسم البيع
        const isOtherBranch = itemBranch !== normalize(ctx.branchName);
        if (isOtherBranch) {
          const isCust = Boolean(itemOwner) && !branchNamesSet.has(itemOwner);
          const cond = normalize(item.condition_label);
          if (!(itemDeal.includes("برسم البيع") || itemDeal.includes("استبدال") || itemDeal.includes("بيع بالوكالة") || cond === "مستعمل" || isCust)) return false;
        }
      } else if (branchFilter.mode === "self") {
        if (itemBranch !== normalize(ctx.branchName)) return false;
      } else if (branchFilter.mode === "cross") {
        if (!branchFilter.branchName || itemBranch !== branchFilter.branchName) return false;
        const isCust = Boolean(itemOwner) && !branchNamesSet.has(itemOwner);
        const cond = normalize(item.condition_label);
        if (!(itemDeal.includes("برسم البيع") || itemDeal.includes("استبدال") || itemDeal.includes("بيع بالوكالة") || cond === "مستعمل" || isCust)) return false;
      } else if (branchFilter.mode === "legacy-branch") {
        if (branchFilter.branchName && itemBranch !== branchFilter.branchName) return false;
      }
    } else {
      if (itemBranch !== normalize(ctx.branchName)) return false;
    }

    if (owner && owner !== "all" && itemOwner !== owner) return false;
    if (deal && deal !== "all" && itemDeal !== deal) return false;
    if (gearbox && gearbox !== "all" && itemGearbox !== gearbox) return false;
    if (fuel && fuel !== "all" && itemFuel !== fuel) return false;

    if (minPrice) {
      const min = Number(minPrice);
      if (!isNaN(min) && min > 0 && (!item.price || item.price < min)) return false;
    }
    if (maxPrice) {
      const max = Number(maxPrice);
      if (!isNaN(max) && max > 0 && (!item.price || item.price > max)) return false;
    }

    if (!query) return true;
    return [
      item.model,
      item.chassis_no ?? "",
      item.owner_name ?? "",
      item.color ?? "",
      item.branch_name ?? "",
      item.gearbox ?? "",
      item.fuel_type ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  // ── تقسيم المخزون: معرض vs عملاء ───────────────────────────────────────────
  const isCustomerCar = (item: InventoryItem) => {
    const ownerNorm = normalize(item.owner_name);
    // إذا تحولت السيارة باسم المعرض، تظهر في مخزون المعرض وليس مخزون العملاء
    if (branchNamesSet.has(ownerNorm)) {
      return false;
    }

    const deal = normalize(item.deal_type);
    // سيارة برسم البيع: المالك شخص وليس معرضاً (ينطبق على كل المعارض)
    if (deal.includes("برسم البيع")) {
      return true;
    }
    // استبدال: فقط إذا جاءت من عميل (source_customer_id)
    if (deal.includes("استبدال")) {
      return Boolean(item.source_customer_id);
    }
    return false;
  };

  // أعداد التبويبين (من baseFiltered كاملاً)
  const showroomCount  = baseFiltered.filter((i) => !isCustomerCar(i)).length;
  const customersCount = baseFiltered.filter((i) => isCustomerCar(i)).length;

  // سيارات التبويب النشط (قبل فلتر الحالة) — أساس الإحصاءات والعدد
  const baseTabFiltered = baseFiltered.filter((item) => {
    if (activeTab === "customers") return isCustomerCar(item);
    
    // مخزون المعرض
    if (isCustomerCar(item)) return false;
    // معرض لمعلم يعرض كل شيء
    if (ctx.isMuallimBranch && !ctx.isGeneralManager) return true;
    
    // المعارض الأخرى (أو المدير العام لكل المعارض):
    // إظهار المستعمل إذا كان الفلتر مفعلاً، وإلا فقط السيارات الجديدة
    if (isShowUsed) return true;
    if (normalize(item.branch_name).includes("لمعلم") || normalize(item.owner_name).includes("لمعلم")) return true;
    return normalize(item.condition_label).includes("جديد");
  });

  // ── إحصاءات الحبوب — تعكس التبويب النشط فقط ─────────────────────────────────
  const statsAll = baseTabFiltered.length;
  const statsAvailable = baseTabFiltered.filter((i) => normalize(i.availability_status) === "متوفرة").length;
  const statsReserved  = baseTabFiltered.filter((i) => normalize(i.availability_status) === "محجوزة").length;
  const statsSold      = baseTabFiltered.filter((i) => normalize(i.availability_status) === "مباعة").length;
  const statsIncomplete = baseTabFiltered.filter(isIncomplete).length;

  // ── الفلترة النهائية (التبويب + فلتر الحالة) ─────────────────────────────────
  const tabInventory = baseTabFiltered.filter((item) => {
    const activeStatus = status ?? "active";
    if (activeStatus === "active") {
      const itemStatus = normalize(item.availability_status);
      return itemStatus !== "مباعة" && itemStatus !== "مسحوبة من المعرض";
    }
    if (activeStatus === "all") return true;
    if (activeStatus === "incomplete") return isIncomplete(item);
    return normalize(item.availability_status) === activeStatus;
  }).sort((a, b) => {
    const aIsNew = normalize(a.condition_label).includes("جديد");
    const bIsNew = normalize(b.condition_label).includes("جديد");
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    return 0;
  });

  const currentPage = parseInt(page ?? "1", 10) || 1;
  const pageSize = 15;
  const totalPages = Math.ceil(tabInventory.length / pageSize);
  const paginatedInventory = tabInventory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selectedCar = selectedCarId
    ? (baseFiltered.find((item) => item.id === selectedCarId) ?? null)
    : null;

  const selectedCarAttachments = selectedCar
    ? await getInventoryCarAttachments(
        selectedCar.id,
        selectedCar.source_customer_id,
        selectedCar.photo_urls ?? [],
      )
    : [];
  const selectedCarPhotos = selectedCarAttachments.filter((item) => item.isImage).map((item) => item.url);

  // ── بناء روابط الـ URL ────────────────────────────────────────────────────────
  const currentParams = new URLSearchParams();
  if (q) currentParams.set("q", q);
  if (branch) currentParams.set("branch", branch);
  if (owner) currentParams.set("owner", owner);
  if (deal) currentParams.set("deal", deal);
  if (gearbox) currentParams.set("gearbox", gearbox);
  if (fuel) currentParams.set("fuel", fuel);
  if (status) currentParams.set("status", status);
  if (activeTab === "customers") currentParams.set("tab", "customers");
  if (includeCross && !(ctx.isMuallimBranch && !ctx.isGeneralManager))
    currentParams.set("cross", "1");
  const baseQuery = currentParams.toString();

  // روابط التبويبين
  function tabHref(t: "showroom" | "customers") {
    const p = new URLSearchParams(currentParams);
    p.delete("status"); p.delete("car"); p.delete("tab");
    if (t === "customers") p.set("tab", "customers");
    const qs = p.toString();
    return qs ? `/dashboard/inventory?${qs}` : "/dashboard/inventory";
  }
  const closeHref = baseQuery ? `/dashboard/inventory?${baseQuery}` : "/dashboard/inventory";

  // مساعد لبناء رابط حبة الإحصاء
  function statsHref(s: string | null) {
    const p = new URLSearchParams(currentParams);
    p.delete("status");
    if (s) {
      p.set("status", s);
    } else {
      p.set("status", "all");
    }
    const qs = p.toString();
    return qs ? `/dashboard/inventory?${qs}` : "/dashboard/inventory";
  }

  const activeStatus = status ?? "active";

  return (
    <div className="legacy-grid gap-6">
      {/* ── شريط الفلاتر الذكي ── */}
      <div className="legacy-card">
        <div className="flex items-center justify-end gap-2 mb-3">
          <Link
            href="/dashboard/inventory/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 px-4 py-2 text-sm font-bold text-white transition-all transform"
          >
            + إضافة سيارة
          </Link>
          <InventoryExportBtn filters={{ status: status ?? "", deal: deal ?? "", branch: branch ?? "", tab: activeTab, q: q ?? "" }} />
          <InventoryImportBtn
            isGeneralManager={ctx.isGeneralManager}
            branchId={ctx.branchId}
            branchName={ctx.branchName}
            branchObjects={ctx.branchObjects}
          />
        </div>
        <InventoryFilterBar
          activeTab={activeTab}
          branches={branches}
          consignmentOwners={consignmentOwners}
          deals={deals}
          statuses={statuses}
          gearboxOptions={gearboxOptions}
          fuelTypes={fuelTypes}
          isMuallimBranch={ctx.isMuallimBranch}
          isGeneralManager={ctx.isGeneralManager}
          branchName={ctx.branchName}
          totalCount={baseFiltered.length}
        />
      </div>

      {/* ── شريط الإحصاءات ── */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        {/* حبوب الحالة */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {/* النشط */}
          <Link
            href={statsHref("active")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeStatus === "active"
                ? "bg-blue-700 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
            النشط <span className="opacity-70">{statsAvailable + statsReserved}</span>
          </Link>

          {/* الكل */}
          <Link
            href={statsHref("all")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeStatus === "all"
                ? "bg-slate-800 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            الكل <span className="opacity-70">{statsAll}</span>
          </Link>

          {/* متوفرة */}
          <Link
            href={statsHref("متوفرة")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeStatus === "متوفرة"
                ? "bg-emerald-700 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
            متوفرة <span className="opacity-70">{statsAvailable}</span>
          </Link>

          {/* محجوزة */}
          <Link
            href={statsHref("محجوزة")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeStatus === "محجوزة"
                ? "bg-amber-600 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
            محجوزة <span className="opacity-70">{statsReserved}</span>
          </Link>

          {/* مباعة */}
          <Link
            href={statsHref("مباعة")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeStatus === "مباعة"
                ? "bg-slate-700 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-slate-400 flex-shrink-0" />
            مباعة <span className="opacity-70">{statsSold}</span>
          </Link>

          {/* بيانات ناقصة */}
          <Link
            href={statsHref("incomplete")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeStatus === "incomplete"
                ? "bg-orange-600 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" />
            بيانات ناقصة <span className="opacity-70">{statsIncomplete}</span>
          </Link>
        </div>

      </div>

      {/* ── تبويبات المخزون ── */}
      <div className="flex gap-2.5">
        <Link
          href={tabHref("showroom")}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border transition-all ${
            activeTab === "showroom"
              ? "bg-blue-600 border-blue-600 text-white shadow-sm"
              : "bg-blue-50 dark:bg-slate-800 border-blue-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700"
          }`}
        >
          🏢 مخزون المعرض
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            activeTab === "showroom" ? "bg-white/25 text-white" : "bg-blue-100 text-blue-600"
          }`}>{showroomCount}</span>
        </Link>
        <Link
          href={tabHref("customers")}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border transition-all ${
            activeTab === "customers"
              ? "bg-amber-500 border-amber-500 text-white shadow-sm"
              : "bg-blue-50 dark:bg-slate-800 border-blue-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700"
          }`}
        >
          👤 مخزون العملاء
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            activeTab === "customers" ? "bg-white/25 text-white" : "bg-blue-100 text-blue-600"
          }`}>{customersCount}</span>
        </Link>
      </div>

      {/* ── جدول المخزون ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className={`mobile-card-table premium-table ${activeTab === "customers" ? "premium-table--amber" : "premium-table--blue"}`}>
          <thead className="legacy-standard-head">
            <tr>
              <th style={{ width: "180px" }}>المالك / الشاصي</th>
              <th style={{ width: "150px" }}>السيارة</th>
              <th style={{ width: "150px" }}>السعر والصفقة</th>
              <th style={{ width: "120px" }}>اللون والعداد</th>
              <th style={{ width: "120px" }}>القير / الوقود</th>
              <th style={{ width: "120px" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInventory.length > 0 ? (
              paginatedInventory.map((item) => {
                // المالك شخص (وليس معرضاً) → نُظهر اسم المعرض الذي أُدخل العميل من خلاله
                const ownerIsPerson =
                  Boolean(item.owner_name) && !branchNamesSet.has(normalize(item.owner_name));

                return (
                  <tr key={item.id}>
                    {/* المالك / الشاصي */}
                    <td data-label="المالك / الشاصي">
                      <div className="flex flex-col gap-1.5">
                        {/* اسم المالك — معرض أو شخص */}
                        <div className="flex items-center gap-1.5">
                          {ownerIsPerson ? (
                            <User className="h-4 w-4 flex-shrink-0 text-slate-400" />
                          ) : (
                            <div className="flex-shrink-0">
                              <BranchLogo branchName={item.owner_name} className="w-5 h-5 rounded-sm" />
                              {!item.owner_name?.includes("لمعلم") && !item.owner_name?.includes("المعلم") && !item.owner_name?.includes("شيري") && !item.owner_name?.includes("الشيري") && !item.owner_name?.includes("فورثنج") && !item.owner_name?.includes("فورثينج") && !item.owner_name?.includes("الفورثنك") && (
                                <Store className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                          )}
                          <span className="font-bold text-slate-900 text-sm leading-tight truncate">{item.owner_name ?? "—"}</span>
                        </div>
                        {/* اسم المعرض (للأشخاص فقط) */}
                        {ownerIsPerson && item.branch_name ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                            <span className="text-xs text-slate-400 truncate">{item.branch_name}</span>
                          </div>
                        ) : null}
                        {/* رقم الشاصي */}
                        <div className="flex items-center gap-1">
                          <EditableCell itemId={item.id} field="chassis_no"
                            value={item.chassis_no ?? null} dir="ltr"
                            placeholder="رقم الشاصي" emptyLabel="أضف رقم الشاصي"
                            displayClass="font-mono text-xs text-slate-400 tracking-wide"
                            icon={<span className="text-[10px] font-bold text-slate-300">#</span>} />
                        </div>
                      </div>
                    </td>

                    {/* السيارة */}
                    <td data-label="السيارة">
                      <div className="flex flex-col gap-1.5">
                        {/* اسم السيارة */}
                        <div className="flex items-center gap-1.5">
                          <Car className="h-4 w-4 flex-shrink-0 text-blue-400" />
                          <span className="font-bold text-blue-700 text-sm leading-tight truncate">{item.model || "—"}</span>
                        </div>
                        {/* سنة الصنع */}
                        {item.production_year ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="text-xs text-slate-800 font-bold">{item.production_year}</span>
                          </div>
                        ) : null}
                        {/* الحالة */}
                        {item.condition_label ? (
                          <div className="flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                              item.condition_label.includes("جديد")
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}>{item.condition_label}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* السعر والصفقة والحالة — مدمجة */}
                    <td>
                      <div className="flex flex-col gap-1.5">
                        {/* السعر */}
                        <div className="flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          <InventoryPriceCellNew itemId={item.id} price={item.price ?? null} />
                        </div>
                        {/* الصفقة */}
                        <div className="flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                          {item.deal_type ? (
                            <span className={getDealBadgeClass(item.deal_type)}>{item.deal_type}</span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </div>
                        {/* الحالة */}
                        {item.availability_status ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                              normalize(item.availability_status) === "متوفرة" ? "bg-emerald-500" :
                              normalize(item.availability_status) === "محجوزة" ? "bg-amber-400" :
                              normalize(item.availability_status) === "مباعة"  ? "bg-slate-400" : "bg-rose-400"
                            }`} />
                            <span className="text-xs font-bold text-slate-800">{item.availability_status}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* اللون والعداد */}
                    <td data-label="اللون والعداد">
                      <div className="flex flex-col gap-1.5">
                        <EditableCell itemId={item.id} field="color"
                          value={item.color ?? null} placeholder="اللون"
                          emptyLabel="أضف اللون"
                          icon={<Palette className="h-3.5 w-3.5" />} />
                        <EditableCell itemId={item.id} field="mileage"
                          value={typeof item.mileage === "number" ? item.mileage : null}
                          type="number" dir="ltr" placeholder="العداد (كم)"
                          emptyLabel="أضف العداد" suffix="كم"
                          displayClass="text-sm font-semibold text-slate-600"
                          icon={<GaugeCircle className="h-3.5 w-3.5" />} />
                      </div>
                    </td>

                    {/* القير والوقود */}
                    <td data-label="القير والوقود">
                      <div className="flex flex-col gap-1.5">
                        <EditableCell itemId={item.id} field="gearbox"
                          value={item.gearbox ?? null} type="select" options={GEARBOX_OPTIONS}
                          placeholder="ناقل الحركة" emptyLabel="أضف القير"
                          icon={<Settings2 className="h-3.5 w-3.5" />} />
                        <EditableCell itemId={item.id} field="fuel_type"
                          value={item.fuel_type ?? null} type="select" options={FUEL_OPTIONS}
                          placeholder="نوع الوقود" emptyLabel="أضف الوقود"
                          displayClass="text-sm font-semibold text-slate-600"
                          icon={<Fuel className="h-3.5 w-3.5" />} />
                      </div>
                    </td>

                    {/* الإجراءات */}
                    <td data-label="الإجراءات">
                      <div className="flex items-center gap-1.5">
                        {/* زر تذكير تيليجرام */}
                        <form action={sendQuickReminderAction} className="flex-shrink-0">
                          {item.assigned_user_id ? (
                            <>
                              <input type="hidden" name="recipient_user_id" value={item.assigned_user_id} />
                              <input type="hidden" name="recipient_label" value={item.assigned_user_name ?? ""} />
                            </>
                          ) : (
                            <>
                              <input type="hidden" name="recipient_branch_id" value={item.branch_id ?? ""} />
                              <input type="hidden" name="recipient_label" value={item.branch_name ?? ""} />
                            </>
                          )}
                          <input type="hidden" name="title" value={`تذكير — سيارة ${item.model ?? ""}`} />
                          <input
                            type="hidden"
                            name="message"
                            value={`يرجى متابعة ملف سيارة ${item.model ?? ""}${item.owner_name ? ` — المالك: ${item.owner_name}` : ""}${item.chassis_no ? ` — شاصي: ${item.chassis_no}` : ""}. الحالة: ${item.availability_status ?? "غير محددة"}`}
                          />
                          <input type="hidden" name="redirect_to" value="/dashboard/inventory" />
                          <button
                            type="submit"
                            className="inline-flex h-[32px] w-[32px] flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                            title={item.assigned_user_name ? `تذكير إلى ${item.assigned_user_name}` : "إرسال تذكير"}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </form>

                        {/* بطاقة + تعديل — مجمّعَان */}
                        <div className="flex rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                          <Link
                            href={baseQuery ? `/dashboard/inventory?${baseQuery}&car=${item.id}` : `/dashboard/inventory?car=${item.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-blue-50 hover:text-blue-700 transition border-l border-slate-200"
                            title="عرض البطاقة"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                            بطاقة
                          </Link>
                          <Link
                            href={`/dashboard/inventory/${item.id}/edit`}
                            className="inline-flex items-center justify-center min-w-[32px] px-2 py-1.5 text-xs text-slate-500 bg-white hover:bg-amber-50 hover:text-amber-600 transition"
                            title="تعديل بيانات السيارة"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    {activeTab === "customers"
                      ? "لا توجد سيارات عملاء (برسم البيع أو استبدال) مطابقة للفلاتر."
                      : "لا توجد سيارات معرض مطابقة للفلاتر الحالية."}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination totalPages={totalPages} currentPage={currentPage} />
      )}

      {/* ── درج تفاصيل السيارة ── */}
      {selectedCar ? (
        <CustomerModalShell closeHref={closeHref} title="بطاقة السيارة الكاملة">
          <div className="car-card">

            {/* ══ هيدر السيارة ══ */}
            <div className="car-card__header">
              <div className="car-card__header-top">
                <div className="car-card__model">{selectedCar.model}</div>
                <div className="car-card__price">{formatCurrency(selectedCar.price)}</div>
              </div>
              <div className="car-card__badges">
                {selectedCar.production_year ? (
                  <span className="car-card__badge car-card__badge--year">
                    📅 {selectedCar.production_year}
                  </span>
                ) : null}
                {selectedCar.condition_label ? (
                  <span className="car-card__badge car-card__badge--condition">
                    {selectedCar.condition_label}
                  </span>
                ) : null}
                {selectedCar.deal_type ? (
                  <span className={getDealBadgeClass(selectedCar.deal_type)}>
                    {selectedCar.deal_type}
                  </span>
                ) : null}
                {selectedCar.availability_status ? (
                  <span className="car-card__badge car-card__badge--status">
                    {selectedCar.availability_status}
                  </span>
                ) : null}
              </div>
            </div>

            {/* ══ شبكة البيانات الأساسية ══ */}
            <div className="car-card__section">
              <div className="car-card__section-title">
                <span>📋</span> البيانات الأساسية
              </div>
              <div className="car-card__grid">

                <div className="car-card__field">
                  <div className="car-card__field-label">👤 المالك</div>
                  <div className="car-card__field-value">{selectedCar.owner_name ?? "—"}</div>
                </div>

                <div className="car-card__field">
                  <div className="car-card__field-label">🏢 المالك / المعرض</div>
                  <div className="car-card__field-value">{selectedCar.owner_name ?? "—"}</div>
                </div>

                <div className="car-card__field car-card__field--full">
                  <div className="car-card__field-label">🔢 رقم الشاصي</div>
                  <div className="car-card__field-value car-card__field-value--mono">
                    {selectedCar.chassis_no ?? "—"}
                  </div>
                </div>

                <div className="car-card__field">
                  <div className="car-card__field-label">🎨 اللون</div>
                  <div className="car-card__field-value">
                    {selectedCar.color ? (() => {
                      const swatch = getColorSwatch(selectedCar.color);
                      return (
                        <span className="flex items-center gap-2">
                          {swatch ? (
                            <span
                              className="inv-color-dot inv-color-dot--lg"
                              style={{ background: swatch.bg, borderColor: swatch.border }}
                            />
                          ) : null}
                          {selectedCar.color}
                        </span>
                      );
                    })() : "—"}
                  </div>
                </div>

                <div className="car-card__field">
                  <div className="car-card__field-label">⚙️ ناقل الحركة</div>
                  <div className="car-card__field-value">{selectedCar.gearbox ?? "—"}</div>
                </div>

                <div className="car-card__field">
                  <div className="car-card__field-label">⛽ نوع الوقود</div>
                  <div className="car-card__field-value">{selectedCar.fuel_type ?? "—"}</div>
                </div>

                <div className="car-card__field">
                  <div className="car-card__field-label">🛣 العداد</div>
                  <div className="car-card__field-value">
                    {typeof selectedCar.mileage === "number"
                      ? `${selectedCar.mileage.toLocaleString("en-US")} كم`
                      : "—"}
                  </div>
                </div>

              </div>
            </div>

            {/* ══ المواصفات ══ */}
            <div className="car-card__section">
              <div className="car-card__section-title car-card__section-title--amber">
                <span>📝</span> المواصفات
              </div>
              {selectedCar.specs ? (
                <p className="car-card__text-body">{selectedCar.specs}</p>
              ) : (
                <p className="car-card__text-empty">لا توجد مواصفات مسجّلة لهذه السيارة.</p>
              )}
            </div>

            {/* ══ تقرير الفحص ══ */}
            <div className="car-card__section car-card__section--inspect">
              <div className="car-card__section-title car-card__section-title--teal">
                <span>🔍</span> تقرير الفحص
              </div>
              {selectedCar.inspection ? (
                <p className="car-card__text-body">{selectedCar.inspection}</p>
              ) : (
                <p className="car-card__text-empty">لا يوجد تقرير فحص مسجّل.</p>
              )}
            </div>

            {/* ══ مجلد الصور — يظهر دائماً ══ */}
            <div className="car-card__section car-card__section--gallery">
              <CarGalleryViewer
                photos={selectedCarPhotos}
                files={selectedCarAttachments
                  .filter((item) => !item.isImage)
                  .map((item) => ({ url: item.url, fileName: item.fileName }))}
                carLabel={selectedCar.model}
              />
            </div>

            {/* ══ أزرار التعديل والحذف ══ */}
            <div className="flex gap-3 px-4 pb-4 pt-2">
              <Link
                href={`/dashboard/inventory/${selectedCar.id}/edit`}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                تعديل بيانات السيارة
              </Link>
              <Link
                href={`/dashboard/inventory/${selectedCar.id}/edit?delete=1`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                حذف
              </Link>
            </div>

          </div>
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
