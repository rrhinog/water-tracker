-- v1.4: bottle-start markers and Settings bottles.
-- A "started" row is a zero-ounce marker (src/lib/duration.ts), and bottle ids come from
-- Settings since v0.8, so the original fixed source list and the oz > 0 rule no longer fit.
BEGIN;
ALTER TABLE water_entries DROP CONSTRAINT IF EXISTS water_entries_source_check;
ALTER TABLE water_entries DROP CONSTRAINT IF EXISTS water_entries_oz_check;
ALTER TABLE water_entries ADD CONSTRAINT water_entries_oz_check
  CHECK (oz > 0 OR (source = 'started' AND oz = 0));
COMMIT;
