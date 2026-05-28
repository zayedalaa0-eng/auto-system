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
  totalCount: number;
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
  totalCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentBranch = searchParams.get("branch") ?? (isGeneralManager ? "all" : "self");
  const currentOwner = searchParams.get("owner") ?? "all";
  const currentDeal = searchParams.get("deal") ?? "all";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentGearbox = searchParams.get("gearbox") ?? "all";
  const currentFuel = searchParams.get("fuel") ?? "all";

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
    if (!value || value === "all") {
      params.delete(key);
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
    currentBranch !== "all" && currentBranch !== "self" ? currentBranch : "",
    currentOwner !== "all" ? currentOwner : "",
    currentDeal !== "all" ? currentDeal : "",
    currentStatus !== "all" ? currentStatus : "",
    currentGearbox !== "all" ? currentGearbox : "",
    currentFuel !== "all" ? currentFuel : "",
  ].filter(Boolean).length;

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

        {/* عداد النتائج + مسح */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-slate-500 whitespace-nowrap">
            {totalCount} سيارة
          </span>
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

      {/* ── شبكة الفلاتر المنسدلة (3 × 2) ── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {/* المعرض */}
        <select
          className="legacy-select text-blue-700"
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
              <option value="self">معرض المعلم فقط</option>
              {branches
                .filter((b) => b !== (branchName ?? ""))
                .map((b) => (
                  <option key={b} value={`cross:${b}`}>
                    {b}
                  </option>
                ))}
            </>
          ) : (
            <option value="self">{branchName ?? "معرضي فقط"}</option>
          )}
        </select>

        {/* أصحاب السيارات برسم البيع — عملاء فقط */}
        <select
          className="legacy-select text-violet-700"
          value={currentOwner}
          onChange={(e) => navigate("owner", e.target.value)}
        >
          <option value="all">
            {consignmentOwners.length > 0
              ? `أصحاب برسم البيع (${consignmentOwners.length})`
              : "أصحاب برسم البيع"}
          </option>
          {consignmentOwners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        {/* نوع الصفقة */}
        <select
          className="legacy-select text-emerald-700"
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
          className="legacy-select text-sky-700"
          value={currentStatus}
          onChange={(e) => navigate("status", e.target.value)}
        >
          <option value="all">كل الحالات</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* ناقل الحركة (القير) */}
        <select
          className="legacy-select text-slate-700"
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
          className="legacy-select text-slate-700"
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
