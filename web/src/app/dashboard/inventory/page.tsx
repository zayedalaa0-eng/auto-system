import Link from "next/link";
import { Building2, Car, Fuel, GaugeCircle, Send, Settings2 } from "lucide-react";

import { CarGalleryViewer } from "@/components/car-gallery-viewer";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { InventoryFilterBar } from "@/components/inventory-filter-bar";
import { InventoryImportBtn } from "@/components/inventory-import-btn";
import { InventorySaveViewBtn } from "@/components/inventory-save-view-btn";
import { sendQuickReminderAction } from "@/app/dashboard/actions";
import { getInventoryCarAttachments, getInventoryDirectory, getInventoryFilterContext } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

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

/** خريطة الألوان */
const COLOR_MAP: Array<[string[], string, string]> = [
  [["ابيض", "بيضاء", "white"],              "#ffffff", "#d1d5db"],
  [["اسود", "سوداء", "black"],              "#1c1917", "#1c1917"],
  [["رمادي", "رصاصي", "grey", "gray"],      "#9ca3af", "#9ca3af"],
  [["فضي", "سيلفر", "silver"],              "#cbd5e1", "#94a3b8"],
  [["احمر", "حمراء", "red"],               "#ef4444", "#ef4444"],
  [["كحلي", "نيلي", "navy"],               "#1e3a8a", "#1e3a8a"],
  [["ازرق", "زرقاء", "blue"],              "#3b82f6", "#3b82f6"],
  [["سماوي", "تركواز", "تيفاني", "tiffany", "turquoise"], "#2dd4bf", "#2dd4bf"],
  [["اخضر", "خضراء", "green"],             "#22c55e", "#22c55e"],
  [["زيتي", "olive"],                       "#84cc16", "#84cc16"],
  [["اصفر", "صفراء", "yellow"],            "#eab308", "#eab308"],
  [["ذهبي", "ذهبيه", "gold"],              "#f59e0b", "#d97706"],
  [["شمبانيا", "شامبين", "شمباني", "champagne"], "#f3e0b5", "#d4b896"],
  [["بيج", "كريمي", "beige", "cream"],     "#e8dcc8", "#c9b99a"],
  [["برتقالي", "برتقاليه", "orange"],      "#f97316", "#f97316"],
  [["بني", "بنيه", "كافيه", "brown"],      "#92400e", "#92400e"],
  [["خمري", "بورجندي", "burgundy", "wine"],"#881337", "#881337"],
  [["بنفسجي", "بنفسجيه", "purple"],        "#a855f7", "#a855f7"],
  [["وردي", "ورديه", "pink"],              "#ec4899", "#ec4899"],
];

function getColorSwatch(value: string | null | undefined): { bg: string; border: string } | null {
  if (!value) return null;
  const norm = normalizeArabic(value);
  for (const [keywords, bg, border] of COLOR_MAP) {
    if (keywords.some((kw) => norm.includes(kw))) return { bg, border };
  }
  return null;
}

function getDealBadgeClass(value: string | null | undefined) {
  const label = normalize(value);
  if (label.includes("استبدال")) return "inv-deal-badge inv-deal-badge--trade";
  if (label.includes("برسم البيع")) return "inv-deal-badge inv-deal-badge--consign";
  if (label.includes("شراء")) return "inv-deal-badge inv-deal-badge--purchase";
  if (label.includes("حيازة")) return "inv-deal-badge inv-deal-badge--owned";
  return "inv-deal-badge inv-deal-badge--default";
}

// ── مساعدات الأفاتار ──────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];

function getAvatarColor(name: string | null): string {
  if (!name) return "#94a3b8";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getInitials(name: string | null): string {
  if (!name) return "—";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0][0] ?? "—").toUpperCase();
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
  const { q, branch, owner, deal, status, gearbox, fuel, car, cross, tab } = params;

  // التبويب: showroom = مخزون المعرض، customers = مخزون العملاء
  const activeTab = tab === "customers" ? "customers" : "showroom";
  const ctx = await getInventoryFilterContext();
  const branchFilter = parseBranchFilter(branch);
  const includeCross =
    ctx.isMuallimBranch && !ctx.isGeneralManager
      ? branchFilter.mode === "all" || branchFilter.mode === "cross" || normalize(cross) === "1"
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
      if (branchFilter.mode === "self") {
        if (itemBranch !== normalize(ctx.branchName)) return false;
      } else if (branchFilter.mode === "cross") {
        if (!branchFilter.branchName || itemBranch !== branchFilter.branchName) return false;
        if (normalize(item.deal_type) !== "برسم البيع") return false;
      } else if (branchFilter.mode === "legacy-branch") {
        if (branchFilter.branchName && itemBranch !== branchFilter.branchName) return false;
      } else if (branchFilter.mode === "default") {
        if (itemBranch !== normalize(ctx.branchName)) return false;
      }
    } else {
      if (itemBranch !== normalize(ctx.branchName)) return false;
    }

    if (owner && owner !== "all" && itemOwner !== owner) return false;
    if (deal && deal !== "all" && itemDeal !== deal) return false;
    if (gearbox && gearbox !== "all" && itemGearbox !== gearbox) return false;
    if (fuel && fuel !== "all" && itemFuel !== fuel) return false;

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

  // ── إحصاءات الحبوب ───────────────────────────────────────────────────────────
  const statsAll = baseFiltered.length;
  const statsAvailable = baseFiltered.filter((i) => normalize(i.availability_status) === "متوفرة").length;
  const statsReserved  = baseFiltered.filter((i) => normalize(i.availability_status) === "محجوزة").length;
  const statsSold      = baseFiltered.filter((i) => normalize(i.availability_status) === "مباعة").length;
  const statsIncomplete = baseFiltered.filter(isIncomplete).length;

  // ── الفلترة النهائية (مع status/incomplete) ──────────────────────────────────
  const filteredInventory = baseFiltered.filter((item) => {
    if (!status || status === "all") return true;
    if (status === "incomplete") return isIncomplete(item);
    return normalize(item.availability_status) === status;
  });

  // ── تقسيم المخزون: معرض vs عملاء ───────────────────────────────────────────
  const CUSTOMER_DEALS = ["برسم البيع", "استبدال"];
  const isCustomerCar = (item: InventoryItem) =>
    CUSTOMER_DEALS.some((d) => normalize(item.deal_type).includes(normalize(d)));

  const tabInventory = filteredInventory.filter((item) =>
    activeTab === "customers" ? isCustomerCar(item) : !isCustomerCar(item),
  );

  // إحصاءات التبويبين (من baseFiltered بدون فلتر status)
  const showroomCount  = baseFiltered.filter((i) => !isCustomerCar(i)).length;
  const customersCount = baseFiltered.filter((i) => isCustomerCar(i)).length;

  const selectedCar = selectedCarId
    ? (filteredInventory.find((item) => item.id === selectedCarId) ?? null)
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
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/dashboard/inventory?${qs}` : "/dashboard/inventory";
  }

  const activeStatus = status ?? "";

  return (
    <div className="legacy-grid gap-6">
      {/* ── شريط الفلاتر الذكي ── */}
      <div className="legacy-card">
        <div className="flex items-center justify-end gap-2 mb-3">
          <Link
            href="/dashboard/inventory/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            + إضافة سيارة
          </Link>
          <InventoryImportBtn
            isGeneralManager={ctx.isGeneralManager}
            branchId={ctx.branchId}
            branchName={ctx.branchName}
            branchObjects={ctx.branchObjects}
          />
        </div>
        <InventoryFilterBar
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
          {/* الكل */}
          <Link
            href={statsHref(null)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              !activeStatus || activeStatus === "all"
                ? "bg-slate-800 text-white shadow"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
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
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
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
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
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
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
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
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" />
            بيانات ناقصة <span className="opacity-70">{statsIncomplete}</span>
          </Link>
        </div>

        {/* زر حفظ كعرض */}
        <InventorySaveViewBtn />
      </div>

      {/* ── تبويبات المخزون ── */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        <Link
          href={tabHref("showroom")}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-xl border border-b-0 transition-colors ${
            activeTab === "showroom"
              ? "bg-white border-slate-200 text-blue-700 shadow-sm -mb-px"
              : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          🏢 مخزون المعرض
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            activeTab === "showroom" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
          }`}>{showroomCount}</span>
        </Link>
        <Link
          href={tabHref("customers")}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-xl border border-b-0 transition-colors ${
            activeTab === "customers"
              ? "bg-white border-slate-200 text-amber-700 shadow-sm -mb-px"
              : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          👤 مخزون العملاء
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            activeTab === "customers" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"
          }`}>{customersCount}</span>
        </Link>
      </div>

      {/* ── جدول المخزون ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="premium-table">
          <thead className="legacy-standard-head">
            <tr>
              <th style={{ width: "170px" }}>المالك / الشاصي</th>
              <th style={{ width: "140px" }}>السيارة</th>
              <th style={{ width: "100px" }}>السعر</th>
              <th style={{ width: "130px" }}>الصفقة والحالة</th>
              <th style={{ width: "110px" }}>اللون والعداد</th>
              <th style={{ width: "110px" }}>القير / الوقود</th>
              <th style={{ width: "86px" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tabInventory.length > 0 ? (
              tabInventory.map((item) => {
                const avatarColor = getAvatarColor(item.owner_name);
                const initials = getInitials(item.owner_name);
                const isUsed = normalize(item.condition_label).includes("مستعمل");
                const missingColorMileage = isUsed && !item.color && typeof item.mileage !== "number";
                const missingGearFuel = !item.gearbox && !item.fuel_type;
                // المالك شخص (وليس معرضاً) → نُظهر اسم المعرض الذي أُدخل العميل من خلاله
                const ownerIsPerson =
                  Boolean(item.owner_name) && !branchNamesSet.has(normalize(item.owner_name));

                return (
                  <tr key={item.id}>
                    {/* المالك / الشاصي */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white select-none"
                          style={{ backgroundColor: avatarColor }}
                          title={item.owner_name ?? undefined}
                        >
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 leading-tight truncate">
                            {item.owner_name ?? "—"}
                          </div>
                          {ownerIsPerson && item.branch_name ? (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
                              <Building2 className="h-3 w-3 flex-shrink-0 text-slate-400" />
                              {item.branch_name}
                            </div>
                          ) : null}
                          {item.chassis_no ? (
                            <div className="mt-0.5 font-mono text-xs text-slate-400 tracking-wide truncate">
                              {item.chassis_no}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-xs text-orange-500 font-medium">⚠️ أضف رقم الشاصي</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* السيارة */}
                    <td>
                      <div className="flex items-start gap-1.5">
                        <Car className="h-4 w-4 flex-shrink-0 text-slate-300 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-bold text-blue-700 leading-tight truncate">
                            {item.model || "—"}
                          </div>
                          {item.production_year ? (
                            <div className="mt-0.5 text-xs text-slate-400">{item.production_year}</div>
                          ) : null}
                          {item.condition_label ? (
                            <div className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              {item.condition_label}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* السعر */}
                    <td>
                      {item.price ? (
                        <span className="font-extrabold text-emerald-700">
                          {formatCurrency(item.price)}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-semibold">+ أضف السعر</span>
                      )}
                    </td>

                    {/* الصفقة والحالة */}
                    <td>
                      {item.deal_type ? (
                        <div className={getDealBadgeClass(item.deal_type)}>{item.deal_type}</div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      {item.availability_status ? (
                        <div className="mt-1.5 text-xs text-slate-500">{item.availability_status}</div>
                      ) : null}
                    </td>

                    {/* اللون والعداد */}
                    <td>
                      {missingColorMileage ? (
                        <div className="text-xs text-orange-500 font-medium">⚠️ أكمل اللون والعداد</div>
                      ) : (
                        <>
                          {item.color ? (() => {
                            const swatch = getColorSwatch(item.color);
                            return (
                              <div className="flex items-center gap-1.5">
                                {swatch ? (
                                  <span
                                    className="inv-color-dot"
                                    style={{ background: swatch.bg, borderColor: swatch.border }}
                                    title={item.color}
                                  />
                                ) : null}
                                <span className="text-sm font-semibold text-slate-700">{item.color}</span>
                              </div>
                            );
                          })() : (
                            <div className="text-xs text-slate-400">—</div>
                          )}
                          {typeof item.mileage === "number" ? (
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <GaugeCircle className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                              {item.mileage.toLocaleString("en-US")} كم
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>

                    {/* القير والوقود */}
                    <td>
                      {missingGearFuel ? (
                        <div className="text-xs text-orange-500 font-medium">⚠️ أكمل القير والوقود</div>
                      ) : (
                        <>
                          {item.gearbox ? (
                            <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                              <Settings2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                              {item.gearbox}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">—</div>
                          )}
                          {item.fuel_type ? (
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <Fuel className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                              {item.fuel_type}
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>

                    {/* الإجراءات */}
                    <td>
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

                        {/* بطاقة السيارة */}
                        <Link
                          href={
                            baseQuery
                              ? `/dashboard/inventory?${baseQuery}&car=${item.id}`
                              : `/dashboard/inventory?car=${item.id}`
                          }
                          className="legacy-table-btn legacy-table-btn--view legacy-table-btn--sm"
                          title="عرض بطاقة السيارة"
                        >
                          بطاقة
                        </Link>
                        {/* تعديل */}
                        <Link
                          href={`/dashboard/inventory/${item.id}/edit`}
                          className="legacy-table-btn legacy-table-btn--sm"
                          title="تعديل بيانات السيارة"
                        >
                          ✏️
                        </Link>
                        {/* حذف */}
                        <Link
                          href={`/dashboard/inventory/${item.id}/edit?delete=1`}
                          className="legacy-table-btn legacy-table-btn--sm"
                          style={{ color: "#dc2626" }}
                          title="حذف السيارة"
                        >
                          🗑
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
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

          </div>
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
