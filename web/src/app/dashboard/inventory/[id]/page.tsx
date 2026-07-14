import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/env";
import { getInterestedCustomers } from "@/lib/data";
import { InterestedCustomers } from "./components/InterestedCustomers";
import { formatCurrency } from "@/lib/format";

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const interests = await getInterestedCustomers(id);

  // Fetch all active customers for the dropdown
  // We can limit this or add search later, but for now we fetch active ones.
  // In a real large app we'd use an async select, but this is a good start.
  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .eq("is_active", true)
    .order("full_name");

  // Fetch all inventory for the quick switcher
  const { data: allInventory } = await supabase
    .from("inventory")
    .select("id, model, availability_status")
    .order("model");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory" className="legacy-btn border text-sm">← رجوع</Link>
          <h1 className="text-xl font-bold text-slate-800">تفاصيل السيارة: {car.model}</h1>
        </div>
        <Link href={`/dashboard/inventory/${id}/edit`} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
          تعديل بيانات السيارة
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">الموديل</div>
            <div className="font-semibold text-slate-800">{car.model}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">السنة</div>
            <div className="font-semibold text-slate-800">{car.production_year || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">السعر</div>
            <div className="font-semibold text-emerald-600">{formatCurrency(car.price)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">الحالة</div>
            <div className="font-semibold text-slate-800">{car.availability_status}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">اللون</div>
            <div className="font-semibold text-slate-800">{car.color || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">رقم الشاصي</div>
            <div className="font-semibold text-slate-800">{car.chassis_no || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">نوع الصفقة</div>
            <div className="font-semibold text-slate-800">{car.deal_type || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">المالك</div>
            <div className="font-semibold text-slate-800">{car.owner_name || "الشركة"}</div>
          </div>
        </div>
        {car.notes && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="text-xs text-slate-500 mb-1">ملاحظات</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{car.notes}</p>
          </div>
        )}
      </div>

      <InterestedCustomers 
        inventoryId={id} 
        interests={interests} 
        allCustomers={customers ?? []} 
        allInventory={allInventory ?? []}
      />
    </div>
  );
}
