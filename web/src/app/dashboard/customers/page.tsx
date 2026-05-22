import Link from "next/link";
import { List, RefreshCcw } from "lucide-react";

import { CustomerForm } from "@/components/customer-form";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { CustomerProfileContent } from "@/components/customer-profile-content";
import { CustomersReportTable } from "@/components/customers-report-table";
import { filterCustomersForReport } from "@/lib/customer-report";
import { getCustomerById, getCustomerFormOptions, getCustomersDirectory } from "@/lib/data";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; mode?: string; scope?: string; q?: string; focus?: string }>;
}) {
  const { customer: customerId, mode, scope, q, focus } = await searchParams;
  const [customers, selectedCustomer, options] = await Promise.all([
    getCustomersDirectory(),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
  ]);

  const isFollowupScope = scope === "followups";
  const query = (q ?? "").trim();
  const filteredCustomers = isFollowupScope
    ? filterCustomersForReport(
        customers.filter((customer) => Boolean(customer.next_follow_up_at)),
        query,
      )
    : filterCustomersForReport(customers, query);

  const scopedQuery = isFollowupScope ? "&scope=followups" : "";

  return (
    <div className="legacy-grid gap-6">
      <div className="legacy-card">
        <div className="grid gap-3 md:grid-cols-[1fr_1.1fr_0.8fr_0.5fr] md:items-center">
          <div className="flex items-center justify-end gap-2 text-2xl font-bold text-sky-700">
            <List className="h-5 w-5" />
            {isFollowupScope ? `عملاء بحاجة لتواصل (${filteredCustomers.length})` : "تقرير عملائي"}
          </div>
          <form method="get">
            {isFollowupScope ? <input type="hidden" name="scope" value="followups" /> : null}
            <input
              name="q"
              defaultValue={q ?? ""}
              className="legacy-input"
              placeholder={isFollowupScope ? "بحث في العملاء بانتظار التواصل..." : "بحث في عملائي..."}
            />
          </form>
          <select className="legacy-select" defaultValue={isFollowupScope ? "followups" : "all"}>
            <option value="all">{isFollowupScope ? "بانتظار التواصل" : "كل الأوقات"}</option>
            <option value="today">تواصل اليوم</option>
            <option value="2days">آخر يومين</option>
            <option value="week">آخر أسبوع</option>
            <option value="month">آخر شهر</option>
            <option value="agenda">مهام اليوم (الأجندة)</option>
          </select>
          {isFollowupScope ? (
            <Link href="/dashboard/customers" className="legacy-btn legacy-btn-dark">
              <RefreshCcw className="h-4 w-4" />
              التقرير الكامل
            </Link>
          ) : (
            <button className="legacy-btn legacy-btn-dark">
              <RefreshCcw className="h-4 w-4" />
              تحديث
            </button>
          )}
        </div>
      </div>

      <CustomersReportTable
        customers={filteredCustomers}
        basePath="/dashboard/customers"
        query={q ?? ""}
        emptyMessage={isFollowupScope ? "لا يوجد عملاء بانتظار التواصل ضمن هذا التقرير." : "لا توجد بيانات عملاء بعد."}
      />

      {selectedCustomer && options ? (
        <CustomerModalShell closeHref={isFollowupScope ? "/dashboard/customers?scope=followups" : "/dashboard/customers"} title="">
          {mode === "edit" ? (
            <CustomerForm
              customer={selectedCustomer}
              options={options}
              returnPath={`/dashboard/customers?customer=${selectedCustomer.id}&mode=view${scopedQuery}`}
            />
          ) : (
            <CustomerProfileContent
              customer={selectedCustomer}
              options={options}
              initialOpenTradeEditor={focus === "trade"}
              compactTradeOnly={focus === "trade"}
              returnPath={`/dashboard/customers?customer=${selectedCustomer.id}&mode=view${scopedQuery}`}
            />
          )}
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
