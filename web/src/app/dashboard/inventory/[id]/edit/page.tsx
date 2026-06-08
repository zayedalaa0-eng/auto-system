export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { EditInventoryForm } from "@/components/edit-inventory-form";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/env";

export default async function EditInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) redirect("/dashboard/inventory");
  const { id } = await params;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: car } = await admin
    .from("inventory")
    .select("id, model, production_year, color, price, chassis_no, mileage, gearbox, fuel_type, condition_label, deal_type, availability_status, specs, inspection, notes, owner_name, branch_id")
    .eq("id", id)
    .maybeSingle();

  if (!car) notFound();

  const { data: branches } = await supabase
    .from("branches").select("id, name").eq("is_active", true).order("name");

  return (
    <div className="legacy-grid gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inventory" className="legacy-btn border text-sm">← رجوع</Link>
        <h1 className="text-xl font-bold text-slate-800">تعديل سيارة: {car.model}</h1>
      </div>
      <Suspense fallback={<div className="legacy-card text-center text-slate-400 py-8">جارٍ التحميل...</div>}>
        <EditInventoryForm car={car} branches={branches ?? []} />
      </Suspense>
    </div>
  );
}
