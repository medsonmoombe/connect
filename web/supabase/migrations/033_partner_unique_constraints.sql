-- Migration 033: Deduplicate partner profiles + add UNIQUE constraint on company_id
-- 
-- Deduplication strategy per table:
--   1. For each company_id with multiple rows, keep the row with the most engagement
--      references (or the first by id if tied).
--   2. Update all FK references (engagements, match results) to point to the kept row.
--   3. Delete the duplicate rows.
--   4. Add a UNIQUE constraint on company_id so duplicates can never reoccur.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DEDUPLICATE capital_partners
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  dupe RECORD;
  keep_id UUID;
  del_ids UUID[];
BEGIN
  -- Process each company that has >1 capital_partner row
  FOR dupe IN (
    SELECT company_id
    FROM capital_partners
    GROUP BY company_id
    HAVING COUNT(*) > 1
  ) LOOP
    -- Keep the row with the most engagement refs; ties broken by earliest id
    SELECT cp.id INTO keep_id
    FROM capital_partners cp
    LEFT JOIN engagements e ON e.counterparty_id = cp.id AND e.counterparty_type = 'CAPITAL'
    WHERE cp.company_id = dupe.company_id
    GROUP BY cp.id
    ORDER BY COUNT(e.id) DESC, cp.id ASC
    LIMIT 1;

    -- Collect the duplicate ids (everything except the keeper)
    SELECT array_agg(cp.id) INTO del_ids
    FROM capital_partners cp
    WHERE cp.company_id = dupe.company_id AND cp.id != keep_id;

    -- Re-point capital_match_results: first remove any rows that would conflict
    -- with the UNIQUE(project_id, capital_partner_id) constraint on the keeper
    DELETE FROM capital_match_results cmr
    WHERE cmr.capital_partner_id = ANY(del_ids)
      AND EXISTS (
        SELECT 1 FROM capital_match_results cmr2
        WHERE cmr2.project_id = cmr.project_id
          AND cmr2.capital_partner_id = keep_id
      );
    -- Then repoint the remaining (non-conflicting) rows
    UPDATE capital_match_results cmr
    SET capital_partner_id = keep_id
    WHERE cmr.capital_partner_id = ANY(del_ids);

    -- Re-point any engagements referencing the dupes
    UPDATE engagements e
    SET counterparty_id = keep_id
    WHERE e.counterparty_id = ANY(del_ids) AND e.counterparty_type = 'CAPITAL';

    -- Delete the duplicate capital_partner rows
    DELETE FROM capital_partners WHERE id = ANY(del_ids);

    RAISE NOTICE 'Deduplicated capital_partners for company %: kept %, removed %', dupe.company_id, keep_id, del_ids;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. DEDUPLICATE technical_partners
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  dupe RECORD;
  keep_id UUID;
  del_ids UUID[];
BEGIN
  FOR dupe IN (
    SELECT company_id
    FROM technical_partners
    GROUP BY company_id
    HAVING COUNT(*) > 1
  ) LOOP
    SELECT tp.id INTO keep_id
    FROM technical_partners tp
    LEFT JOIN engagements e ON e.counterparty_id = tp.id AND e.counterparty_type = 'TECHNICAL'
    WHERE tp.company_id = dupe.company_id
    GROUP BY tp.id
    ORDER BY COUNT(e.id) DESC, tp.id ASC
    LIMIT 1;

    SELECT array_agg(tp.id) INTO del_ids
    FROM technical_partners tp
    WHERE tp.company_id = dupe.company_id AND tp.id != keep_id;

    -- Re-point technical_match_results: first remove conflicting rows
    DELETE FROM technical_match_results tmr
    WHERE tmr.technical_partner_id = ANY(del_ids)
      AND EXISTS (
        SELECT 1 FROM technical_match_results tmr2
        WHERE tmr2.project_id = tmr.project_id
          AND tmr2.technical_partner_id = keep_id
      );
    -- Then repoint the remaining (non-conflicting) rows
    UPDATE technical_match_results tmr
    SET technical_partner_id = keep_id
    WHERE tmr.technical_partner_id = ANY(del_ids);

    UPDATE engagements e
    SET counterparty_id = keep_id
    WHERE e.counterparty_id = ANY(del_ids) AND e.counterparty_type = 'TECHNICAL';

    DELETE FROM technical_partners WHERE id = ANY(del_ids);

    RAISE NOTICE 'Deduplicated technical_partners for company %: kept %, removed %', dupe.company_id, keep_id, del_ids;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. DEDUPLICATE power_traders
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  dupe RECORD;
  keep_id UUID;
  del_ids UUID[];
BEGIN
  FOR dupe IN (
    SELECT company_id
    FROM power_traders
    GROUP BY company_id
    HAVING COUNT(*) > 1
  ) LOOP
    SELECT pt.id INTO keep_id
    FROM power_traders pt
    WHERE pt.company_id = dupe.company_id
    ORDER BY pt.id ASC
    LIMIT 1;

    SELECT array_agg(pt.id) INTO del_ids
    FROM power_traders pt
    WHERE pt.company_id = dupe.company_id AND pt.id != keep_id;

    DELETE FROM power_traders WHERE id = ANY(del_ids);

    RAISE NOTICE 'Deduplicated power_traders for company %: kept %, removed %', dupe.company_id, keep_id, del_ids;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ADD UNIQUE CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE capital_partners  ADD CONSTRAINT capital_partners_company_id_unique  UNIQUE (company_id);
ALTER TABLE technical_partners ADD CONSTRAINT technical_partners_company_id_unique UNIQUE (company_id);
ALTER TABLE power_traders     ADD CONSTRAINT power_traders_company_id_unique     UNIQUE (company_id);
