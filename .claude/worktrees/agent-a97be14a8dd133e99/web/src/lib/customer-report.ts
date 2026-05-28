import type { CustomerItem } from "@/lib/data";

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

export function matchesCustomerQuery(customer: CustomerItem, query: string) {
  const needle = normalize(query);
  if (!needle) return true;

  const haystack = [
    customer.full_name,
    customer.phone,
    customer.requested_car ?? "",
    customer.requested_car_report ?? "",
    customer.sale_offer_car ?? "",
    customer.assigned_user_name ?? "",
    customer.branch_name ?? "",
    customer.status ?? "",
    customer.operation_type ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

export function filterCustomersForReport(customers: CustomerItem[], query: string) {
  return customers.filter((customer) => matchesCustomerQuery(customer, query));
}
