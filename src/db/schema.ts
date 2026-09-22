// Database schema (Drizzle). The SQL that creates these lives in drizzle/*.sql and is
// applied by hand (see README "Database"); this file is the typed mirror the app reads.
import { boolean, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const waterEntries = pgTable("water_entries", {
  /** Client-generated id; POST is an upsert on it, so retries never duplicate. */
  id: text("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  /** owala | yeti | camelbak | other */
  source: text("source").notNull(),
  fraction: numeric("fraction", { precision: 4, scale: 2 }).notNull().default("1"),
  oz: numeric("oz", { precision: 6, scale: 1 }).notNull(),
  /** Backfilled amount with no known time (placed at 23:59 of its day). */
  untimed: boolean("untimed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coffeeEntries = pgTable("coffee_entries", {
  id: text("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  /** True for a day-level row imported from the daily notes (time unknown, set to noon). */
  fromNotes: boolean("from_notes").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
