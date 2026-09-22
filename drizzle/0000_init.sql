-- 0000_init: the two tables the app syncs. Hand-written; applied with psql (README "Database").
CREATE TABLE IF NOT EXISTS water_entries (
  id          text PRIMARY KEY,
  at          timestamptz NOT NULL,
  source      text NOT NULL CHECK (source IN ('owala', 'yeti', 'camelbak', 'other')),
  fraction    numeric(4, 2) NOT NULL DEFAULT 1,
  oz          numeric(6, 1) NOT NULL CHECK (oz > 0),
  untimed     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_entries_at_idx ON water_entries (at);

CREATE TABLE IF NOT EXISTS coffee_entries (
  id          text PRIMARY KEY,
  at          timestamptz NOT NULL,
  from_notes  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coffee_entries_at_idx ON coffee_entries (at);
