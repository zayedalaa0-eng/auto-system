#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

function readArg(name) {
  const entry = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.slice(name.length + 3).trim() : "";
}

const email = readArg("email");
const newPassword = readArg("password");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!email || !newPassword) {
  console.error("Usage: node scripts/admin-reset-password.mjs --email=user@example.com --password=NewPass123");
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error("Password must be at least 6 chars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Failed to list users:", listError.message);
  process.exit(1);
}

const target = (usersData.users || []).find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
if (!target) {
  console.error(`No auth user found for email: ${email}`);
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(target.id, {
  password: newPassword,
});

if (updateError) {
  console.error("Failed to update password:", updateError.message);
  process.exit(1);
}

console.log(`Password updated successfully for ${email}`);
