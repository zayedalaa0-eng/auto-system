import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, created_by, app_users(full_name)")
    .limit(1);

  if (error) {
    console.error("Error joining app_users:", error.message);
    
    // Try the other direction
    const { data: d2, error: e2 } = await supabase
      .from("customers")
      .select("id, created_by, app_users!customers_created_by_fkey(full_name)")
      .limit(1);
    
    console.log("With !customers_created_by_fkey:", e2 ? e2.message : JSON.stringify(d2));
  } else {
    console.log("Join successful:", JSON.stringify(data));
  }
}

run();
