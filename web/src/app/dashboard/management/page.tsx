import { redirect } from "next/navigation";
import { List } from "lucide-react";

import { CustomerForm } from "@/components/customer-form";
import { CustomerModalShell } from "@/components/customer-modal-shell";
import { CustomerProfileContent } from "@/components/customer-profile-content";
import { ReportSmartFilters } from "@/components/report-smart-filters";
import { CustomersReportTable } from "@/components/customers-report-table";
import {
  buildCustomerNameOptions,
  buildStatusOptions,
  buildUserOptions,
  filterCustomersForReport,
} from "@/lib/customer-report";
import { getCustomerById, getCustomerFormOptions, getCustomersDirectory, getCustomersSearchResults } from "@/lib/data";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer?: string;
    mode?: string;
    q?: string;
    customer_name?: string;
    focus?: string;
    lifecycle?: string;
    status?: string;
    period?: string;
    overdue?: string;
    user?: string;
  }>;
}) {
  // ── حماية الصفحة: المديرون فقط ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const { data: profile } = await supabase
    .from("app_users")
    .select("role")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();
  const caps = getRoleCapabilities(profile?.role);
  if (!caps.isManager) redirect("/dashboard/unauthorized");

  const { customer: customerId, mode, q, customer_name, focus, lifecycle, status, period, overdue, user } = await searchParams;

  const query = (q ?? "").trim();
  const isOverdue = overdue === "1";

  // عند وجود بحث نصي: نستخدم البحث في قاعدة البيانات مباشرةً (أسرع وأشمل)
  // بدون بحث: نجلب آخر 220 سجلاً للتصفية المتقدمة من الواجهة
  const [customers, selectedCustomer, options] = await Promise.all([
    query ? getCustomersSearchResults(query, 300) : getCustomersDirectory(220),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
  ]);

  const baseList = filterCustomersForReport(customers, {
    q: query,
    customer_name,
    lifecycle: (lifecycle as "all" | "active" | "closed" | undefined),
    period,
    overdue: isOverdue,
    user,
  });
  const statusOptions = buildStatusOptions(baseList);
  const userOptions = buildUserOptions(customers);
  const customerNameOptions = buildCustomerNameOptions(customers);

  const filteredCustomers = filterCustomersForReport(customers, {
    q: query,
    customer_name,
    lifecycle: (lifecycle as "all" | "active" | "closed" | undefined),
    status,
    period,
    overdue: isOverdue,
    user,
  });

  return (
    <div className="legacy-grid gap-6">
      <div className="legacy-card space-y-3">
        <div className="flex items-center gap-2 text-xl font-bold text-sky-700 whitespace-nowrap">
          <List className="h-5 w-5 flex-shrink-0" />
          تقرير الإدارة الشامل ({filteredCustomers.length})
        </div>

        <ReportSmartFilters
          statuses={statusOptions}
          users={userOptions}
          customerNames={customerNameOptions}
          queryPlaceholder="بحث ذكي: الاسم، الهاتف، السيارة، المعرض، الموظف..."
        />
      </div>

      <CustomersReportTable
        customers={filteredCustomers}
        basePath="/dashboard/management"
        query={q ?? ""}
        emptyMessage="لا توجد نتائج مطابقة للفلاتر الحالية."
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
              isManager={caps.isManager}
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
