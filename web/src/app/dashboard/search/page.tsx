import Link from "next/link";
import { RefreshCcw, Search } from "lucide-react";

import { CustomerForm } from "@/components/customer-form";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { CustomerProfileContent } from "@/components/customer-profile-content";
import { CustomersReportTable } from "@/components/customers-report-table";
import { filterCustomersForReport } from "@/lib/customer-report";
import { getCustomerById, getCustomerFormOptions, getCustomersDirectory } from "@/lib/data";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; mode?: string; q?: string; focus?: string }>;
}) {
  const { customer: customerId, mode, q, focus } = await searchParams;
  const query = (q ?? "").trim();

  const [customersRaw, selectedCustomer, options] = await Promise.all([
    query ? getCustomersDirectory(260) : Promise.resolve([]),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
  ]);

  const customers = filterCustomersForReport(customersRaw, query);

  return (
    <div className="legacy-grid gap-6">
      <div className="legacy-card">
        <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_0.6fr] md:items-center">
          <div className="flex items-center justify-end gap-2 text-2xl font-bold text-sky-700">
            <Search className="h-5 w-5" />
            بحث المعرض
          </div>
          <form method="get" className="contents">
            <input
              name="q"
              defaultValue={q ?? ""}
              className="legacy-input"
              placeholder="ابحث باسم العميل، الهاتف، السيارة، الحالة..."
              autoFocus
            />
            <div className="flex gap-2">
              <button className="legacy-btn legacy-btn-dark w-full" type="submit">
                <RefreshCcw className="h-4 w-4" />
                بحث
              </button>
              <Link href="/dashboard/search" className="legacy-btn legacy-btn-secondary">
                مسح
              </Link>
            </div>
          </form>
          <div />
        </div>
      </div>

      {!query ? (
        <div className="empty-state">اكتب عبارة البحث أولًا، وستظهر النتائج هنا مباشرة بدون تحميل تقرير كامل.</div>
      ) : (
        <CustomersReportTable
          customers={customers}
          basePath="/dashboard/search"
          query={query}
          emptyMessage="لا توجد نتائج مطابقة لعبارة البحث."
        />
      )}

      {selectedCustomer && options ? (
        <CustomerModalShell closeHref={query ? `/dashboard/search?q=${encodeURIComponent(query)}` : "/dashboard/search"} title="">
          {mode === "edit" ? (
            <CustomerForm
              customer={selectedCustomer}
              options={options}
              returnPath={
                query
                  ? `/dashboard/search?customer=${selectedCustomer.id}&mode=view&q=${encodeURIComponent(query)}`
                  : `/dashboard/search?customer=${selectedCustomer.id}&mode=view`
              }
            />
          ) : (
            <CustomerProfileContent
              customer={selectedCustomer}
              options={options}
              initialOpenTradeEditor={focus === "trade"}
              compactTradeOnly={focus === "trade"}
              returnPath={
                query
                  ? `/dashboard/search?customer=${selectedCustomer.id}&mode=view&q=${encodeURIComponent(query)}`
                  : `/dashboard/search?customer=${selectedCustomer.id}&mode=view`
              }
            />
          )}
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
