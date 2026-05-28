import { notFound } from "next/navigation";

import { CustomerProfileContent } from "@/components/customer-profile-content";
import { getCustomerById, getCustomerFormOptions } from "@/lib/data";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: roleRow } = session
    ? await supabase.from("app_users").select("role").eq("auth_user_id", session.user.id).maybeSingle()
    : { data: null };
  const isManager = getRoleCapabilities(roleRow?.role).isManager;

  const [customer, options] = await Promise.all([getCustomerById(id), getCustomerFormOptions()]);

  if (!customer) {
    notFound();
  }

  return <CustomerProfileContent customer={customer} options={options} isManager={isManager} returnPath={`/dashboard/customers/${customer.id}`} />;
}
