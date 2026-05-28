import { CustomerWizard } from "@/components/customer-wizard";
import { getCustomerFormOptions } from "@/lib/data";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; saved_id?: string }>;
}) {
  const options = await getCustomerFormOptions();
  const { error, success, saved_id } = await searchParams;

  return (
    <CustomerWizard
      options={options}
      errorMessage={error ? decodeURIComponent(error) : null}
      successMessage={success ? decodeURIComponent(success) : null}
      savedCustomerId={saved_id ?? null}
    />
  );
}
