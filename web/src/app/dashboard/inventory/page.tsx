import Link from "next/link";
import { Bell, Eye, Fuel, GaugeCircle, Search } from "lucide-react";

import { CustomerModalShell } from "@/components/customer-modal-shell";
import { getInventoryDirectory } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

type InventoryFilters = {
  q?: string;
  branch?: string;
  owner?: string;
  deal?: string;
  status?: string;
  car?: string;
  cross?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isSoldOrWithdrawnStatus(value: string | null | undefined) {
  const label = normalize(value);
  return label.includes("مباع") || label.includes("مباعة") || label.includes("مسحوب");
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventoryFilters>;
}) {
  const params = await searchParams;
  const { q, branch, owner, deal, status, car, cross } = params;
  const includeCross = normalize(cross) === "1";
  const inventory = await getInventoryDirectory(120, { includeCrossBranchForMuallim: includeCross });

  const owners = [...new Set(inventory.map((i) => normalize(i.owner_name)).filter(Boolean))];
  const branches = [...new Set(inventory.map((i) => normalize(i.branch_name)).filter(Boolean))];
  const deals = [...new Set(inventory.map((i) => normalize(i.deal_type)).filter(Boolean))];
  const statuses = [...new Set(inventory.map((i) => normalize(i.availability_status)).filter(Boolean))];
  const query = normalize(q).toLowerCase();
  const selectedCarId = normalize(car);

  const filteredInventory = inventory.filter((item) => {
    const itemBranch = normalize(item.branch_name);
    const itemOwner = normalize(item.owner_name);
    const itemDeal = normalize(item.deal_type);
    const itemStatus = normalize(item.availability_status);

    if (branch && branch !== "all" && itemBranch !== branch) return false;
    if (owner && owner !== "all" && itemOwner !== owner) return false;
    if (deal && deal !== "all" && itemDeal !== deal) return false;
    if (status && status !== "all") {
      if (itemStatus !== status) return false;
    } else if (isSoldOrWithdrawnStatus(itemStatus)) {
      return false;
    }

    if (!query) return true;
    return [item.model, item.chassis_no ?? "", item.owner_name ?? "", item.color ?? "", item.branch_name ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const selectedCar = selectedCarId ? filteredInventory.find((item) => item.id === selectedCarId) ?? null : null;

  const currentParams = new URLSearchParams();
  if (q) currentParams.set("q", q);
  if (branch) currentParams.set("branch", branch);
  if (owner) currentParams.set("owner", owner);
  if (deal) currentParams.set("deal", deal);
  if (status) currentParams.set("status", status);
  if (includeCross) currentParams.set("cross", "1");
  const baseQuery = currentParams.toString();
  const closeHref = baseQuery ? `/dashboard/inventory?${baseQuery}` : "/dashboard/inventory";

  const getDealClassName = (value: string | null | undefined) => {
    const label = normalize(value);
    if (label.includes("استبدال")) return "bg-cyan-500 text-white";
    if (label.includes("برسم البيع")) return "bg-amber-400 text-slate-900";
    if (label.includes("شراء")) return "bg-emerald-500 text-white";
    return "bg-slate-700 text-white";
  };

  return (
    <div className="legacy-grid gap-6">
      <form className="legacy-card space-y-3" method="get">
        <div className="relative">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q ?? ""}
            className="legacy-input pe-12"
            placeholder="بحث سريع: ابحث برقم الشاصي، الموديل، المالك أو المواصفات..."
          />
        </div>

        <div className="grid gap-2 rounded-[14px] border border-slate-200 bg-slate-50 p-2 md:grid-cols-4">
          <select className="legacy-select text-blue-700" name="branch" defaultValue={branch ?? "all"}>
            <option value="all">كل المعارض</option>
            {branches.map((branchName) => (
              <option key={branchName} value={branchName}>
                {branchName}
              </option>
            ))}
          </select>

          <select className="legacy-select text-slate-700" name="owner" defaultValue={owner ?? "all"}>
            <option value="all">كل الملاك (خارجي)</option>
            {owners.map((ownerName) => (
              <option key={ownerName} value={ownerName}>
                {ownerName}
              </option>
            ))}
          </select>

          <select className="legacy-select text-emerald-700" name="deal" defaultValue={deal ?? "all"}>
            <option value="all">الصفقات</option>
            {deals.map((dealType) => (
              <option key={dealType} value={dealType}>
                {dealType}
              </option>
            ))}
          </select>

          <select className="legacy-select text-sky-700" name="status" defaultValue={status ?? "all"}>
            <option value="all">حالة السيارة</option>
            {statuses.map((statusValue) => (
              <option key={statusValue} value={statusValue}>
                {statusValue}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800">
            <input type="checkbox" name="cross" value="1" defaultChecked={includeCross} />
            خيار معرض المعلم: عرض سيارات المعارض الأخرى (مستعملة) كبند برسم البيع
          </label>
          <button className="legacy-btn legacy-btn-dark px-8" type="submit">
            تحديث
          </button>
          <a className="legacy-btn legacy-btn-light" href="/dashboard/inventory">
            مسح
          </a>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="premium-table">
          <thead className="legacy-standard-head">
            <tr>
              <th>المعرض / المالك</th>
              <th>النوع والموديل</th>
              <th>سعر البيع</th>
              <th>الحالة / الصفقة</th>
              <th>اللون والقير</th>
              <th>العداد والوقود</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="font-bold text-slate-900">{item.owner_name ?? "بدون مالك"}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.branch_name ?? "بدون معرض"}</div>
                    <div className="mt-2 inline-flex rounded-lg bg-slate-500 px-3 py-1 text-xs font-bold text-white">
                      {item.chassis_no ? `شاصي: ${item.chassis_no}` : "شاصي: بدون شاصي"}
                    </div>
                  </td>

                  <td>
                    <div className="font-extrabold text-blue-700">{item.model || "—"}</div>
                    <div className="mt-2 inline-flex items-center rounded-lg bg-cyan-500 px-3 py-1 text-base font-bold text-slate-900">
                      موديل:{item.production_year ?? "-"}
                    </div>
                  </td>

                  <td className="font-extrabold text-emerald-700">{formatCurrency(item.price)}</td>

                  <td>
                    <div className="mb-2 inline-flex min-w-[120px] items-center justify-center rounded-lg bg-slate-100 px-3 py-1 font-bold text-slate-900">
                      {item.condition_label ?? "مستعملة"}
                    </div>
                    <div className={`inline-flex min-w-[120px] items-center justify-center rounded-lg px-3 py-1 font-bold ${getDealClassName(item.deal_type)}`}>
                      {item.deal_type ?? "—"}
                    </div>
                  </td>

                  <td>
                    <div className="mb-2 inline-flex rounded-lg bg-slate-500 px-3 py-1 text-sm font-bold text-white">{item.color ?? "غير محدد"}</div>
                    <div className="inline-flex rounded-lg bg-slate-900 px-3 py-1 text-sm font-bold text-white">أوتوماتيك</div>
                  </td>

                  <td>
                    <div className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-slate-700">
                      <GaugeCircle className="h-4 w-4" />
                      {item.condition_label ?? "-"}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1 text-sm font-extrabold text-slate-900">
                      <Fuel className="h-4 w-4" />
                      بنزين
                    </div>
                  </td>

                  <td>
                    <div className="legacy-table-actions">
                      <button type="button" className="legacy-table-icon-btn">
                        <Bell className="h-4 w-4" />
                      </button>
                      <Link
                        href={baseQuery ? `/dashboard/inventory?${baseQuery}&car=${item.id}` : `/dashboard/inventory?car=${item.id}`}
                        className="legacy-table-icon-btn"
                        title="عرض بطاقة السيارة"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
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

      {selectedCar ? (
        <CustomerModalShell closeHref={closeHref} title="بطاقة السيارة">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="legacy-input bg-slate-50">{selectedCar.model || "—"}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.production_year ?? "—"}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.chassis_no ?? "—"}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.owner_name ?? "—"}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.branch_name ?? "—"}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.deal_type ?? "—"}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.condition_label ?? "—"}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.availability_status ?? "—"}</div>
            <div className="legacy-input bg-slate-50">{formatCurrency(selectedCar.price)}</div>
            <div className="legacy-input bg-slate-50">{selectedCar.color ?? "—"}</div>
            <div className="legacy-input bg-slate-50 md:col-span-2">
              العداد: {typeof selectedCar.mileage === "number" ? selectedCar.mileage.toLocaleString("en-US") : "—"}
            </div>
            <div className="legacy-subpanel md:col-span-2">
              <div className="legacy-label mb-2">المواصفات</div>
              <div className="legacy-input min-h-14 bg-white">{selectedCar.specs ?? "لا توجد مواصفات"}</div>
            </div>
            <div className="legacy-subpanel md:col-span-2">
              <div className="legacy-label mb-2">الفحص</div>
              <div className="legacy-input min-h-14 bg-white">{selectedCar.inspection ?? "لا توجد بيانات فحص"}</div>
            </div>
          </div>
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
