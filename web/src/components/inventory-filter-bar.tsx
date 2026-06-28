"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  branches: string[];
  consignmentOwners: string[];
  deals: string[];
  statuses: string[];
  gearboxOptions: string[];
  fuelTypes: string[];
  isGeneralManager: boolean;
  isMuallimBranch: boolean;
  branchName: string | null;
  totalCount?: number;
  activeTab: "showroom" | "customers";
};

export function InventoryFilterBar({
  branches,
  consignmentOwners,
  deals,
  statuses,
  gearboxOptions,
  fuelTypes,
  isGeneralManager,
  isMuallimBranch,
  branchName,
  activeTab,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentBranch = searchParams.get("branch") ?? (isGeneralManager ? "all" : "self");
  const currentOwner = searchParams.get("owner") ?? "all";
  const currentDeal = searchParams.get("deal") ?? "all";
  const currentStatus = searchParams.get("status") ?? "active";
  const currentGearbox = searchParams.get("gearbox") ?? "all";
  const currentFuel = searchParams.get("fuel") ?? "all";
  const currentShowUsed = searchParams.get("show_used") === "1";

  const [searchValue, setSearchValue] = useState(currentQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // مزامنة قيمة البحث عند تغيير URL من خارج المكون
  useEffect(() => {
    setSearchValue(currentQ);
  }, [currentQ]);

  // بحث ذكي مع تأخير 350ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchValue === currentQ) return;
    debounceRef.current = setTimeout(() => {
      navigate("q", searchValue || null);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function navigate(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all" || value === "active") {
      if (key === "status" && value === "all") {
        params.set(key, "all");
      } else {
        params.delete(key);
      }
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    setSearchValue("");
    router.push(pathname);
  }

  const activeFilterCount = [
    currentQ,
    currentBranch !== (isGeneralManager ? "all" : "self") ? currentBranch : "",
    currentOwner !== "all" && activeTab === "customers" ? currentOwner : "",
    currentDeal !== "all" ? currentDeal : "",
    currentStatus !== "active" ? currentStatus : "",
    currentGearbox !== "all" ? currentGearbox : "",
    currentFuel !== "all" ? currentFuel : "",
    currentShowUsed ? "1" : "",
  ].filter(Boolean).length;

  // دالة مساعدة لتوليد تنسيقات حقول التصفية بشكل احترافي وراقي
  function getSelectClasses(isActive: boolean, activeThemeClasses: string) {
    const baseClasses = "legacy-select flex-1 w-full text-sm font-semibold transition-all duration-200 outline-none border focus:ring-2 focus:ring-offset-0 cursor-pointer rounded-xl";
    if (isActive) {
      return `${baseClasses} ${activeThemeClasses} shadow-sm`;
    }
    return `${baseClasses} !border-slate-200 dark:!border-slate-700 !bg-white dark:!bg-slate-800 !text-slate-600 dark:!text-slate-300 hover:!border-slate-300 dark:hover:!border-slate-600 focus:!ring-slate-100 dark:focus:!ring-slate-800 focus:!border-slate-400 dark:focus:!border-slate-500`;
  }

  // عدد أصحاب برسم البيع لعرضه في optgroup
  const ownersCount = consignmentOwners.length;

  return (
    <div className="space-y-3">
      {/* ── صف البحث + العداد ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="legacy-input py-2 pe-10 ps-10"
            placeholder="بحث ذكي: الشاصي، نوع السيارة، المالك، اللون، القير، الوقود..."
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors"
              aria-label="مسح البحث"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        {/* خيارات إضافية ومسح الفلاتر */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {!(isMuallimBranch || currentBranch.includes("لمعلم") || currentBranch.includes("المعلم")) && activeTab === "showroom" && (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={currentShowUsed}
                onChange={(e) => navigate("show_used", e.target.checked ? "1" : null)}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              إظهار المستعمل
            </label>
          )}

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="crf-clear-btn"
            >
              <X className="h-3.5 w-3.5" />
              مسح ({activeFilterCount})
            </button>
          ) : null}
        </div>
      </div>

      {/* ── شريط الفلاتر — شبكة متناسقة احترافية ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* المعرض */}
        <select
          className={getSelectClasses(
            currentBranch !== (isGeneralManager ? "all" : "self"),
            "!border-blue-300 !bg-blue-50/60 !text-blue-800 font-semibold focus:!ring-blue-100 focus:!border-blue-500"
          )}
          value={currentBranch}
          onChange={(e) => navigate("branch", e.target.value)}
        >
          {isGeneralManager ? (
            <>
              <option value="all">كل المعارض</option>
              {branches.map((b) => (
                <option key={b} value={`branch:${b}`}>
                  {b}
                </option>
              ))}
            </>
          ) : isMuallimBranch ? (
            <>
              <option value="all">كل المعارض</option>
              <option value="self">معرض لمعلم فقط</option>
              {branches
                .filter((b) => b !== (branchName ?? ""))
                .map((b) => {
                  const label = b.includes("معرض") ? b : `معرض ${b}`;
                  return (
                    <option key={b} value={`cross:${b}`}>
                      {label}
                    </option>
                  );
                })}
            </>
          ) : (
            <option value="self">{branchName ?? "معرضي فقط"}</option>
          )}
        </select>

        {/* أصحاب السيارات برسم البيع — فلتر مستقل (يظهر في مخزون العملاء فقط) */}
        {activeTab === "customers" && (
          <select
            className={getSelectClasses(
              currentOwner !== "all",
              "!border-violet-300 !bg-violet-50/60 !text-violet-800 font-semibold focus:!ring-violet-100 focus:!border-violet-500"
            )}
            value={currentOwner}
            onChange={(e) => navigate("owner", e.target.value)}
          >
            <option value="all">
              {ownersCount > 0 ? `أصحاب برسم البيع (${ownersCount})` : "أصحاب برسم البيع"}
            </option>
            {consignmentOwners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}

        {/* نوع الصفقة */}
        <select
          className={getSelectClasses(
            currentDeal !== "all",
            "!border-emerald-300 !bg-emerald-50/60 !text-emerald-800 font-semibold focus:!ring-emerald-100 focus:!border-emerald-500"
          )}
          value={currentDeal}
          onChange={(e) => navigate("deal", e.target.value)}
        >
          <option value="all">كل الصفقات</option>
          {deals.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* حالة السيارة */}
        <select
          className={getSelectClasses(
            currentStatus !== "active",
            "!border-sky-300 !bg-sky-50/60 !text-sky-800 font-semibold focus:!ring-sky-100 focus:!border-sky-500"
          )}
          value={currentStatus}
          onChange={(e) => navigate("status", e.target.value)}
        >
          <option value="active">النشط (متوفرة + محجوزة)</option>
          <option value="all">كل الحالات (بما فيها المباعة والمسحوبة)</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* ناقل الحركة (القير) */}
        <select
          className={getSelectClasses(
            currentGearbox !== "all",
            "!border-indigo-300 !bg-indigo-50/60 !text-indigo-800 font-semibold focus:!ring-indigo-100 focus:!border-indigo-500"
          )}
          value={currentGearbox}
          onChange={(e) => navigate("gearbox", e.target.value)}
          disabled={gearboxOptions.length === 0}
        >
          <option value="all">القير (الكل)</option>
          {gearboxOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {/* نوع الوقود */}
        <select
          className={getSelectClasses(
            currentFuel !== "all",
            "!border-amber-300 !bg-amber-50/60 !text-amber-800 font-semibold focus:!ring-amber-100 focus:!border-amber-500"
          )}
          value={currentFuel}
          onChange={(e) => navigate("fuel", e.target.value)}
          disabled={fuelTypes.length === 0}
        >
          <option value="all">الوقود (الكل)</option>
          {fuelTypes.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
