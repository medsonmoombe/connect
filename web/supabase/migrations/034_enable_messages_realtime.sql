-- Migration 034: Enable Realtime on messages table
-- Without this, the Supabase Realtime subscription on the messages table
-- silently fails and live messaging in the engagement detail page doesn't work.

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
