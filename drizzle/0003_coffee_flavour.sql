-- 0003: which pod (or "Bought out") a coffee was. Free text, copied from Settings at log time.
ALTER TABLE coffee_entries ADD COLUMN IF NOT EXISTS flavour text;
