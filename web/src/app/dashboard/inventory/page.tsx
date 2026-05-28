import Link from "next/link";
import { Fuel, GaugeCircle, MessageCircle, Settings2 } from "lucide-react";

import { CarGalleryViewer } from "@/components/car-gallery-viewer";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { InventoryFilterBar } from "@/components/inventory-filter-bar";
import { InventoryImportBtn } from "@/components/inventory-import-btn";
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
 * حتى تعمل مطابقة "احمر" مع "أحمر"، و"اسود" مع "أسود" ... إلخ
 */
function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٟؐ-ؚۖ-ۭ]/g, "") // إزالة التشكيل
    .replace(/[أإآٱ]/g, "ا")   // توحيد الألف بكل أشكالها
    .replace(/ة/g, "ه")         // تاء مربوطة → هاء
    .replace(/ى/g, "ي")         // ألف مقصورة → ياء
    .toLowerCase()
    .trim();
}

/** خريطة الألوان — المفاتيح بعد تطبيع النص العربي */
const COLOR_MAP: Array<[string[], string, string]> = [
  // [keywords_normalized, background, border]
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

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventoryFilters>;
}) {
  const params = await searchParams;
  const { q, branch, owner, deal, status, gearbox, fuel, car, cross } = params;
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

  // خيارات القير والوقود من البيانات الحية
  const gearboxOptions = [...new Set(inventory.map((i) => normalize(i.gearbox)).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ar"),
  );
  const fuelTypes = [...new Set(inventory.map((i) => normalize(i.fuel_type)).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ar"),
  );

  const query = normalize(q);
  const selectedCarId = normalize(car);

  const filteredInventory = inventory.filter((item) => {
    const itemBranch = normalize(item.branch_name);
    const itemOwner = normalize(item.owner_name);
    const itemDeal = normalize(item.deal_type);
    const itemStatus = normalize(item.availability_status);
    const itemGearbox = normalize(item.gearbox);
    const itemFuel = normalize(item.fuel_type);

    // ── فلتر المعرض ──────────────────────────────────────────────────────────
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

    // ── الفلاتر المنسدلة ──────────────────────────────────────────────────────
    if (owner && owner !== "all" && itemOwner !== owner) return false;
    if (deal && deal !== "all" && itemDeal !== deal) return false;
    if (gearbox && gearbox !== "all" && itemGearbox !== gearbox) return false;
    if (fuel && fuel !== "all" && itemFuel !== fuel) return false;
    if (status && status !== "all") {
      if (itemStatus !== status) return false;
    }

    // ── البحث النصي ──────────────────────────────────────────────────────────
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

  const selectedCar = selectedCarId
    ? (filteredInventory.find((item) => item.id === selectedCarId) ?? null)
    : null;

  // جلب صور السيارة المختارة (من inventory.photo_urls + customer_attachments)
  const selectedCarAttachments = selectedCar
    ? await getInventoryCarAttachments(
        selectedCar.id,
        selectedCar.source_customer_id,
        selectedCar.photo_urls ?? [],
      )
    : [];
  const selectedCarPhotos = selectedCarAttachments.filter((item) => item.isImage).map((item) => item.url);

  const currentParams = new URLSearchParams();
  if (q) currentParams.set("q", q);
  if (branch) currentParams.set("branch", branch);
  if (owner) currentParams.set("owner", owner);
  if (deal) currentParams.set("deal", deal);
  if (gearbox) currentParams.set("gearbox", gearbox);
  if (fuel) currentParams.set("fuel", fuel);
  if (status) currentParams.set("status", status);
  if (includeCross && !(ctx.isMuallimBranch && !ctx.isGeneralManager))
    currentParams.set("cross", "1");
  const baseQuery = currentParams.toString();
  const closeHref = baseQuery ? `/dashboard/inventory?${baseQuery}` : "/dashboard/inventory";

  return (
    <div className="legacy-grid gap-6">
      {/* ── شريط الفلاتر الذكي ── */}
      <div className="legacy-card">
        <div className="flex items-center justify-end mb-3">
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
          totalCount={filteredInventory.length}
        />
      </div>

      {/* ── جدول المخزون ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="premium-table">
          <thead className="legacy-standard-head">
            <tr>
              <th style={{ width: "175px" }}>المالك / المعرض</th>
              <th style={{ width: "165px" }}>نوع السيارة</th>
              <th style={{ width: "115px" }}>سعر البيع</th>
              <th style={{ width: "145px" }}>الصفقة والحالة</th>
              <th style={{ width: "105px" }}>اللون والعداد</th>
              <th style={{ width: "120px" }}>القير والوقود</th>
              <th style={{ width: "85px" }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <tr key={item.id}>
                  {/* المالك / المعرض */}
                  <td>
                    <div className="font-bold text-slate-900 leading-tight">
                      {item.owner_name ?? "—"}
                    </div>
                    {item.chassis_no ? (
                      <div className="mt-1.5 font-mono text-xs text-slate-400 tracking-wide">
                        {item.chassis_no}
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-slate-300">بدون شاصي</div>
                    )}
                  </td>

                  {/* نوع السيارة */}
                  <td>
                    <div className="font-bold text-blue-700 leading-tight">
                      {item.model || "—"}
                    </div>
                    {item.production_year ? (
                      <div className="mt-1 text-xs text-slate-500">{item.production_year}</div>
                    ) : null}
                    {item.condition_label ? (
                      <div className="mt-1.5 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {item.condition_label}
                      </div>
                    ) : null}
                  </td>

                  {/* سعر البيع */}
                  <td>
                    <span className="font-extrabold text-emerald-700">
                      {formatCurrency(item.price)}
                    </span>
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
                  </td>

                  {/* القير والوقود */}
                  <td>
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
                  </td>

                  {/* الإجراءات */}
                  <td>
                    <div className="flex flex-col gap-1.5 items-stretch">
                      {/* زر بطاقة السيارة */}
                      <Link
                        href={
                          baseQuery
                            ? `/dashboard/inventory?${baseQuery}&car=${item.id}`
                            : `/dashboard/inventory?car=${item.id}`
                        }
                        className="legacy-table-btn legacy-table-btn--view text-center"
                        title="عرض بطاقة السيارة"
                      >
                        بطاقة
                      </Link>
                      {/* زر تذكير تيليجرام */}
                      <form action={sendQuickReminderAction}>
                        <input type="hidden" name="recipient_branch_id" value={item.branch_id ?? ""} />
                        <input type="hidden" name="recipient_label" value={item.branch_name ?? ""} />
                        <input type="hidden" name="title" value={`تذكير — سيارة ${item.model ?? ""}`} />
                        <input
                          type="hidden"
                          name="message"
                          value={`يرجى متابعة ملف سيارة ${item.model ?? ""}${item.owner_name ? ` — المالك: ${item.owner_name}` : ""}${item.chassis_no ? ` — شاصي: ${item.chassis_no}` : ""}. الحالة: ${item.availability_status ?? "غير محددة"}`}
                        />
                        <input type="hidden" name="redirect_to" value="/dashboard/inventory" />
                        <button
                          type="submit"
                          className="legacy-table-btn legacy-table-btn--edit w-full justify-center gap-1"
                          title="إرسال تذكير عبر تيليجرام"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          تذكير
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">لا توجد نتائج مطابقة للفلاتر الحالية.</div>
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
