import { CustomerWizard } from "@/components/customer-wizard";
import { getCustomerFormOptions } from "@/lib/data";
import { getRoleCapabilities } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    notice?: string;
    saved_id?: string;
    /** دورة جديدة لعميل عائد */
    parent_id?: string;
    name?: string;
    phone?: string;
    op_type?: string;
    branch_id?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  let isManager = false;
  if (session) {
    const { data: profile } = await supabase
      .from("app_users")
      .select("role")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    isManager = getRoleCapabilities(profile?.role).isManager;
  }

  const options = await getCustomerFormOptions();
  const { error, parent_id, name, phone, op_type, branch_id } = await searchParams;

  return (
    <CustomerWizard
      options={options}
      errorMessage={error ? decodeURIComponent(error) : null}
      initialParentId={parent_id ?? null}
      initialFullName={name ? decodeURIComponent(name) : null}
      initialPhone={phone ? decodeURIComponent(phone) : null}
      initialOpType={op_type ?? null}
      initialBranchId={branch_id ?? null}
      isManager={isManager}
    />
  );
}
