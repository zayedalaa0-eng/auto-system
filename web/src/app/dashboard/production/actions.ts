"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addProductionItem } from "@/lib/production-data";

export async function createItemAction(formData: FormData) {
  const item_code = formData.get("item_code") as string;
  const original_name = formData.get("original_name") as string;
  const cost_price = Number(formData.get("cost_price"));
  const profit_margin = Number(formData.get("profit_margin"));
  
  // Calculate final selling price
  // final price = cost + (cost * profit_margin / 100)
  const final_selling_price_cents = Math.round(cost_price * 100 * (1 + profit_margin / 100));

  const itemData = {
    item_code,
    original_name,
    cost_price_cents: Math.round(cost_price * 100),
    profit_margin_percent: profit_margin,
    final_selling_price_cents,
    pricing_status: "مسعّر",
  };

  try {
    await addProductionItem(itemData);
  } catch (error) {
    console.error("Failed to add item:", error);
    // In a real app, return error state to show in UI
    throw new Error("فشل إضافة الصنف");
  }

  revalidatePath("/dashboard/production/items");
  redirect("/dashboard/production/items");
}
