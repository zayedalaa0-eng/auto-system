import { redirect } from "next/navigation";

import { hasSupabaseEnv } from "@/lib/env";
import { getDashboardContext } from "@/lib/data";

export default async function HomePage() {
  if (!hasSupabaseEnv()) {
    redirect("/dashboard/setup");
  }

  const { session } = await getDashboardContext();

  if (session) {
    redirect("/dashboard");
  }

  redirect("/login");
}
