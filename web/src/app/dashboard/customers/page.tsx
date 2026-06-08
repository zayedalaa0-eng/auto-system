import { List } from "lucide-react";
import { CustomersExportBtn } from "@/components/customers-export-btn";

import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
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
import { getCustomerById, getCustomerFormOptions, getCustomersDirectory } from "@/lib/data";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer?: string;
    mode?: string;
    scope?: string;
    q?: string;
    customer_name?: string;
    focus?: string;
    lifecycle?: string;
    status?: string;
    period?: string;
    overdue?: string;
  }>;
}) {
  const { customer: customerId, mode, scope, q, customer_name, focus, lifecycle, status, period, overdue } = await searchParams;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: roleRow } = session
    ? await supabase.from("app_users").select("role").eq("auth_user_id", session.user.id).maybeSingle()
    : { data: null };
  const capabilities = getRoleCapabilities(roleRow?.role);
  const isManager = capabilities.isManager;

  const [customers, selectedCustomer, options] = await Promise.all([
    getCustomersDirectory(120, { onlyAssignedToCurrentUser: true }),
    customerId ? getCustomerById(customerId) : Promise.resolve(null),
    customerId ? getCustomerFormOptions() : Promise.resolve(null),
  ]);

  const isFollowupScope = scope === "followups";
  const query = (q ?? "").trim();
  const isOverdue = overdue === "1";

  const baseList = filterCustomersForReport(customers, {
    q: query,
    customer_name,
    lifecycle: (lifecycle as "all" | "active" | "closed" | undefined),
    period,
    overdue: isOverdue,
    scope: isFollowupScope ? "followups" : undefined,
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
    scope: isFollowupScope ? "followups" : undefined,
  });

  const scopedQuery = isFollowupScope ? "&scope=followups" : "";

  return (
    <div className="legacy-grid gap-6">
      <div className="legacy-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xl font-bold text-sky-700 whitespace-nowrap">
            <List className="h-5 w-5 flex-shrink-0" />
            {isFollowupScope
              ? `عملاء بحاجة لتواصل (${filteredCustomers.length})`
              : `تقرير عملائي (${filteredCustomers.length})`}
          </div>
          <CustomersExportBtn filters={{ q: (params.q as string) ?? "", status: (params.status as string) ?? "", op_type: (params.op_type as string) ?? "" }} />
        </div>

        <ReportSmartFilters
          statuses={statusOptions}
          users={userOptions}
          customerNames={customerNameOptions}
          queryPlaceholder={isFollowupScope ? "ابحث في العملاء بحاجة لتواصل..." : "ابحث في تقرير عملائي..."}
        />
      </div>

      <CustomersReportTable
        customers={filteredCustomers}
        basePath="/dashboard/customers"
        query={q ?? ""}
        emptyMessage={isFollowupScope ? "لا يوجد عملاء بحاجة لتواصل ضمن هذا التقرير." : "لا توجد نتائج مطابقة للفلاتر الحالية."}
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
              isManager={isManager}
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
