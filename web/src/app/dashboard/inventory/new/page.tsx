export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { AddInventoryForm } from "@/components/add-inventory-form";
import { createClient } from "@/lib/supabase/server";
import { getRoleCapabilities } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/env";

export default async function NewInventoryPage() {
  if (!hasSupabaseEnv()) redirect("/dashboard/inventory");

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, full_name, role, branch_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  const caps = getRoleCapabilities(profile?.role, profile?.full_name);

  // جلب المعارض للمدير العام
  const { data: branches } = caps.isGeneralManager
    ? await supabase.from("branches").select("id, name").eq("is_active", true).order("name")
    : { data: [] };

  return (
    <div className="legacy-grid gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inventory" className="legacy-btn border text-sm">
          ← رجوع
        </Link>
        <h1 className="text-xl font-bold text-slate-800">إضافة سيارة للمخزون</h1>
      </div>

      <AddInventoryForm
        isGeneralManager={caps.isGeneralManager}
        branches={branches ?? []}
        branchId={profile?.branch_id ?? null}
      />
    </div>
  );
}
