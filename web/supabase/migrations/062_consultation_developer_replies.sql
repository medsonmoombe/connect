-- Migration 062: Add developer_replies to consultation_requests
ALTER TABLE consultation_requests
  ADD COLUMN IF NOT EXISTS developer_replies JSONB DEFAULT '[]'::JSONB;
