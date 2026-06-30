import { getScopedProfile } from "@/lib/data";
import { getSoldInventory, filterSoldInventory } from "@/lib/inventory-sold";
import { SoldInventoryFilterBar } from "@/components/sold-inventory-filter-bar";
import { SoldInventoryList } from "@/components/sold-inventory-list";
import { CarFront } from "lucide-react";
import { redirect } from "next/navigation";


export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function InventorySoldPage({ searchParams }: Props) {
  const { profile, capabilities, isMuallim } = await getScopedProfile();
  if (!profile) {
    redirect("/");
  }

  const { isGeneralManager, isManager } = capabilities;

  const rawParams = await searchParams;
  const q = typeof rawParams.q === "string" ? rawParams.q : undefined;
  const branch = typeof rawParams.branch === "string" ? rawParams.branch : undefined;
  const deal = typeof rawParams.deal === "string" ? rawParams.deal : undefined;

  const items = await getSoldInventory(300); // fetch recent 300 sold cars
  const filteredItems = filterSoldInventory(items, { q, branch, deal });

  // Filter by branch scope — isMuallim already available from getScopedProfile

  // Filter by branch scope
  const finalItems = isGeneralManager
    ? filteredItems
    : filteredItems.filter(item => {
        // Car's own branch matches employee's branch
        if (item.branch_id === profile.branch_id) return true;
        // Buyer was handled by this branch
        if (item.buyer_branch_name === profile.branch_name) return true;
        // Al-Muallim employees also see consignment/trade-in cars (برسم البيع / استبدال)
        // that they sold — same logic as applyBranchScope for inventory
        if (isMuallim) {
          const dealType = (item.deal_type ?? "").trim();
          if (dealType === "استبدال" || dealType === "برسم البيع") return true;
        }
        return false;
      });

  const branchNames = Array.from(new Set(filteredItems.map(item => item.branch_name).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CarFront className="h-6 w-6 text-emerald-600" />
            السيارات المباعة
          </h1>
          <p className="mt-1 text-sm text-slate-500">سجل متكامل لعمليات البيع، مسارات النقل بين المعارض، وتفاصيل المشترين.</p>
        </div>
      </div>

      <div className="legacy-card space-y-4">
        <SoldInventoryFilterBar branches={branchNames} />
        
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
            <span>النتائج: <strong className="text-slate-700">{finalItems.length}</strong> سيارة</span>
          </div>
          <SoldInventoryList items={finalItems} />
        </div>
      </div>
    </div>
  );
}
