-- 071_scale_indexes.sql
-- Composite indexes for the hot read paths at 1000+ user scale.
--
-- The four partner match-read endpoints (/api/matches/{capital,technical,
-- consultant,trader}) all filter by `partner_id + status = 'active'` and
-- sort by compatibility_score DESC. Migration 036 created (partner, score)
-- and (project, score) indexes but none include `status`, so Postgres must
-- fetch + filter every row for the partner. These partial indexes make the
-- common case (active matches only) an index-only ordering scan.
--
-- Same pattern for engagements-by-counterparty (partner dashboards) and
-- notifications-by-recipient (navbar unread polling).

-- ── Match read paths (partial: active rows only) ─────────────────────
CREATE INDEX IF NOT EXISTS idx_capital_matches_partner_active
  ON capital_match_results (capital_partner_id, compatibility_score DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_technical_matches_partner_active
  ON technical_match_results (technical_partner_id, compatibility_score DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_consultant_matches_partner_active
  ON consultant_match_results (consultant_id, compatibility_score DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_grant_matches_provider_active
  ON grant_match_results (grant_provider_id, compatibility_score DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_trader_matches_partner_active
  ON power_trader_match_results (power_trader_id, compatibility_score DESC)
  WHERE status = 'active';

-- ── Dashboard / engagement read paths ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_engagements_counterparty_status
  ON engagements (counterparty_id, status);

-- ── Notifications (navbar unread polling) ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL AND read = false;

-- ── Projects list: live marketplace scan ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_live_visible
  ON projects (status, is_visible_to_investors, created_at DESC)
  WHERE deleted_at IS NULL;

--
-- (user → org lookups are served by idx_org_members_user/org from
-- migration 003 and idx_company_members_* from 010 - no new index needed.)
