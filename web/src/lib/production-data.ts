import { createClient } from "./supabase/server";

export async function getProductionItems() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("erp_items")
    .select("*, erp_categories(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching items:", error);
    return [];
  }
  return data;
}

export async function getProductionOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("erp_production_orders")
    .select("*, erp_items(original_name, approved_name), erp_sales_orders(customer_id)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching production orders:", error);
    return [];
  }
  return data;
}

export async function addProductionItem(itemData: any) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("erp_items")
    .insert([itemData])
    .select()
    .single();

  if (error) {
    console.error("Error adding item:", error);
    throw error;
  }
  return data;
}

export async function addProductionOrder(orderData: any) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("erp_production_orders")
    .insert([orderData])
    .select()
    .single();

  if (error) {
    console.error("Error adding production order:", error);
    throw error;
  }
  return data;
}

export async function updateProductionOrderStatus(orderId: string, status: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("erp_production_orders")
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error("Error updating order:", error);
    throw error;
  }
  return data;
}
