import { List, RefreshCcw } from "lucide-react";

import { CustomerForm } from "@/components/customer-form";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { CustomerProfileContent } from "@/components/customer-profile-content";
import { CustomersReportTable } from "@/components/customers-report-table";
import { filterCustomersForReport } from "@/lib/customer-report";
import { getCustomerById, getCustomerFormOptions, getCustomersDirectory } from "@/lib/data";

export default async function ManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; mode?: string; q?: string; focus?: string }>;
}) {
  const { customer: customerId, mode, q, focus } = await searchParams;
  const [customers, selectedCustomer, options] = await Promise.all([
    getCustomersDirectory(220),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
  ]);

  const query = (q ?? "").trim();
  const filteredCustomers = filterCustomersForReport(customers, query);

  return (
    <div className="legacy-grid gap-6">
      <div className="legacy-card">
        <div className="grid gap-3 md:grid-cols-[1fr_1.1fr_0.8fr_0.5fr] md:items-center">
          <div className="flex items-center justify-end gap-2 text-2xl font-bold text-sky-700">
            <List className="h-5 w-5" />
            تقرير الإدارة الشامل
          </div>
          <form method="get">
            <input name="q" defaultValue={q ?? ""} className="legacy-input" placeholder="بحث شامل..." />
          </form>
          <select className="legacy-select" defaultValue="all">
            <option value="all">كل الأوقات</option>
            <option value="today">تواصل اليوم</option>
            <option value="2days">آخر يومين</option>
            <option value="week">آخر أسبوع</option>
            <option value="month">آخر شهر</option>
            <option value="agenda">مهام اليوم (الأجندة)</option>
          </select>
          <button className="legacy-btn legacy-btn-dark">
            <RefreshCcw className="h-4 w-4" />
            تحديث
          </button>
        </div>
      </div>

      <CustomersReportTable
        customers={filteredCustomers}
        basePath="/dashboard/management"
        query={q ?? ""}
        emptyMessage="لا توجد بيانات ضمن الفلاتر الحالية."
      />

      {selectedCustomer && options ? (
        <CustomerModalShell closeHref="/dashboard/management" title="">
          {mode === "edit" ? (
            <CustomerForm
              customer={selectedCustomer}
              options={options}
              returnPath={`/dashboard/management?customer=${selectedCustomer.id}&mode=view`}
            />
          ) : (
            <CustomerProfileContent
              customer={selectedCustomer}
              options={options}
              initialOpenTradeEditor={focus === "trade"}
              compactTradeOnly={focus === "trade"}
              returnPath={`/dashboard/management?customer=${selectedCustomer.id}&mode=view`}
            />
          )}
        </CustomerModalShell>
      ) : null}
    </div>
  );
}
