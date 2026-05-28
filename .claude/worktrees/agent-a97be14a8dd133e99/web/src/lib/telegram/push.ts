import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleCapabilities } from "@/lib/roles";
import { sendMessage } from "./api";

export async function pushTelegramToManagers({
  branchId,
  title,
  message,
}: {
  branchId: string | null;
  title: string;
  message: string;
}) {
  try {
    const admin = createAdminClient();
    const { data: users } = await admin
      .from("app_users")
      .select("full_name, role, branch_id, telegram_chat_id, is_active")
      .not("telegram_chat_id", "is", null)
      .eq("is_active", true);

    const recipients = (users ?? []).filter((user) => {
      const caps = getRoleCapabilities(user.role, user.full_name);
      if (caps.isGeneralManager) return true;
      if (caps.isManager && !caps.isGeneralManager && branchId && user.branch_id === branchId) return true;
      return false;
    });

    await Promise.allSettled(
      recipients
        .filter((r) => r.telegram_chat_id)
        .map((r) =>
          sendMessage(
            r.telegram_chat_id as string,
            `🔔 <b>${title}</b>\n\n${message}`,
          ),
        ),
    );
  } catch {
    // Telegram push is best-effort — never block the main flow
  }
}
