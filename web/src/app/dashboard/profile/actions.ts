"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  message?: string;
};

export async function updatePasswordAction(password: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "تم تحديث كلمة المرور بنجاح." };
}
