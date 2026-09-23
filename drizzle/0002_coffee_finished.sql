-- 0002: a coffee runs from brew (at) to finished_at; NULL = still open.
ALTER TABLE coffee_entries ADD COLUMN IF NOT EXISTS finished_at timestamptz;
