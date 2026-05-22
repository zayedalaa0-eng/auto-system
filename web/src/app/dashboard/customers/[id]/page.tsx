import { notFound } from "next/navigation";

import { CustomerProfileContent } from "@/components/customer-profile-content";
import { getCustomerById, getCustomerFormOptions } from "@/lib/data";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, options] = await Promise.all([getCustomerById(id), getCustomerFormOptions()]);

  if (!customer) {
    notFound();
  }

  return <CustomerProfileContent customer={customer} options={options} returnPath={`/dashboard/customers/${customer.id}`} />;
}
