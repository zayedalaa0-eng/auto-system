import { createAdminClient } from "@/lib/supabase/admin";

export type SessionState =
  | "idle"
  | "add_cust_name"
  | "add_cust_phone"
  | "add_cust_status"
  | "add_cust_car"
  | "add_cust_confirm"
  | "msg_pick_recipient"
  | "msg_write";

export type SessionData = {
  cust_name?: string;
  cust_phone?: string;
  cust_status?: string;
  cust_car?: string;
  msg_recipient_id?: string;
  msg_recipient_name?: string;
};

export type Session = {
  state: SessionState;
  data: SessionData;
};

export async function getSession(chatId: string): Promise<Session> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bot_sessions")
    .select("state, data")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  return {
    state: (data?.state as SessionState) ?? "idle",
    data: (data?.data as SessionData) ?? {},
  };
}

export async function setSession(
  chatId: string,
  state: SessionState,
  data: SessionData = {},
) {
  const admin = createAdminClient();
  await admin.from("bot_sessions").upsert({
    telegram_chat_id: chatId,
    state,
    data,
    updated_at: new Date().toISOString(),
  });
}

export async function clearSession(chatId: string) {
  await setSession(chatId, "idle", {});
}
