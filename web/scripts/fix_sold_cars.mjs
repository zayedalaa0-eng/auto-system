import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSoldCars() {
  console.log("Fetching customers with status 'تمت عملية البيع'...");
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, full_name, status, metadata')
    .eq('status', 'تمت عملية البيع');

  if (error) {
    console.error("Error fetching customers:", error);
    return;
  }

  console.log(`Found ${customers.length} sold customers.`);
  let count = 0;

  for (const customer of customers) {
    let meta = customer.metadata;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch (e) {
        continue;
      }
    }

    const inventoryId = meta?.selected_inventory_id;
    if (inventoryId) {
      // التحقق من حالة السيارة في المخزون
      const { data: car, error: carError } = await supabase
        .from('inventory')
        .select('id, model, availability_status, chassis_no')
        .eq('id', inventoryId)
        .single();

      if (carError) {
        // قد لا تكون السيارة موجودة
        continue;
      }

      if (car && car.availability_status === 'متوفرة') {
        console.log(`[FIX] Customer: ${customer.full_name} -> Car: ${car.model} (Chassis: ${car.chassis_no ?? 'N/A'}) - Changing from 'متوفرة' to 'مباعة'`);
        
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ availability_status: 'مباعة' })
          .eq('id', car.id);
          
        if (updateError) {
          console.error(`Failed to update car ${car.id}:`, updateError);
        } else {
          count++;
        }
      }
    }
  }

  console.log(`\n✅ Finished! Successfully updated ${count} cars to 'مباعة'.`);
}

fixSoldCars();
