-- 0005: slips, one row per slip of a vice (docs/specs/vices.md). Additive only: a new table.
-- vice is a Settings id ("alcohol"); kind is the chip, copied at log time like coffee's flavour.
CREATE TABLE IF NOT EXISTS slips (
  id          text PRIMARY KEY,
  vice        text NOT NULL,
  at          timestamptz NOT NULL,
  kind        text,
  from_notes  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS slips_at_idx ON slips (at);
