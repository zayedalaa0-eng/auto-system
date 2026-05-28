import { Search } from "lucide-react";

import { CustomerForm } from "@/components/customer-form";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { CustomerProfileContent } from "@/components/customer-profile-content";
import { CustomersReportTable } from "@/components/customers-report-table";
import { filterCustomersForReport } from "@/lib/customer-report";
import { getCustomerById, getCustomerFormOptions, getCustomersDirectory } from "@/lib/data";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer?: string;
    mode?: string;
    q?: string;
    focus?: string;
  }>;
}) {
  const { customer: customerId, mode, q, focus } = await searchParams;
  const query = (q ?? "").trim();

  const [customersRaw, selectedCustomer, options] = await Promise.all([
    getCustomersDirectory(260),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
  ]);

  const customers = filterCustomersForReport(customersRaw, { q: query });

  return (
    <div className="legacy-grid gap-6">
      <div className="legacy-card space-y-3">
        <div className="flex items-center gap-2 text-xl font-bold text-sky-700 whitespace-nowrap">
          <Search className="h-5 w-5 flex-shrink-0" />
          بحث المعرض
          <span className="text-base font-normal text-slate-400">({customers.length})</span>
        </div>
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            className="legacy-input"
            placeholder="اكتب أي شيء: اسم، هاتف، سيارة، حالة، معرض..."
            autoFocus
          />
        </form>
      </div>

      <CustomersReportTable
        customers={customers}
        basePath="/dashboard/search"
        query={query}
        emptyMessage="لا توجد نتائج مطابقة لعبارة البحث."
      />

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
