import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronRight } from "lucide-react";

import { CustomerForm } from "@/components/customer-form";
import { getCustomerById, getCustomerFormOptions } from "@/lib/data";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, options] = await Promise.all([getCustomerById(id), getCustomerFormOptions()]);

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/customers" className="transition hover:text-slate-900">
          العملاء
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/dashboard/customers/${customer.id}`} className="transition hover:text-slate-900">
          {customer.full_name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900">تعديل</span>
      </div>

      <CustomerForm customer={customer} options={options} />
    </div>
  );
}
