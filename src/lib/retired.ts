// What 1.x tracked beside water and 2.0 no longer shows (docs/specs/split.md). Kept until 2.1 so that
// nothing in flight is lost and a rollback to 1.9.1 still works:
//
// - The row shapes below, so the offline queue can still send a change a phone queued under 1.x
//   (src/lib/sync.ts). Their tables and API routes stay as they were.
// - The names of the settings fields 1.x stored, so a Settings save in 2.0 carries them through
//   untouched (settingsForSave in src/lib/settings.ts).
//
// Nothing here is read for display. Remove it in 2.1, a release after nothing reads it.

/** A row of the coffee_entries table, as 1.x sent it to POST /api/coffee. */
export interface RetiredCoffee {
  id: string;
  at: string;
  fromNotes?: boolean;
  finishedAt?: string;
  flavour?: string;
}

/** A row of the slips table, as 1.x sent it to POST /api/slips. */
export interface RetiredSlip {
  id: string;
  vice: string;
  at: string;
  kind?: string;
  fromNotes?: boolean;
}

/** Settings fields 1.x stored in the one settings row. 2.0 never reads or writes them; it keeps them. */
export const RETIRED_SETTINGS_KEYS = ["flavours", "vices", "pact"] as const;
