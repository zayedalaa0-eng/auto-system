-- Telegram bot conversation state
CREATE TABLE IF NOT EXISTS bot_sessions (
  telegram_chat_id TEXT PRIMARY KEY,
  state            TEXT    NOT NULL DEFAULT 'idle',
  data             JSONB   NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
