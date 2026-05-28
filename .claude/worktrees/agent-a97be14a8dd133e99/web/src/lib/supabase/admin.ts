import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";

export function hasSupabaseServiceRoleEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
