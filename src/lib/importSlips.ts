// Parse a markdown file of slips kept by hand into slip rows, for scripts/import-slips.ts. Pure.
//
// One slip per line, as a bullet or a table row; the time and the chip are optional:
//
//   - 2026-03-01 21:30 Alcohol Beer
//   - 2026-03-02 9:15 pm Alcohol: Wine
//   - 2026-03-04 Sweets                      (no time: noon that day, marked "from notes")
//   | 2026-03-05 | 22:00 | Alcohol | Cocktail |
//
// The vice is matched to Settings by id or name, ignoring case; a chip is matched to that vice's
// chips the same way and otherwise kept as written. Lines with no date (headings, prose) are ignored.
// A dated line that says coffee, or "clean"/"none", is skipped and counted: coffee has its own table.
// A dated line naming no known vice is an error, and the script refuses to write until it is fixed.
// Ids come from the date, vice and order in the file, so running the import twice adds nothing.
import { dayKey } from "./log";
import { isIsoDay } from "./settings";
import { COFFEE_QUIT, type Slip } from "./vices";

export interface ImportVice {
  id: string;
  name: string;
  chips: readonly string[];
}

export interface ImportResult {
  slips: Slip[];
  skipped: { line: number; reason: "coffee" | "clean" }[];
  errors: { line: number; reason: string }[];
}

const DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const TIME = /^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?\b/i;

function at(day: string, h: number, m: number): Date {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m);
}

/** Words after the date and time: "21:30 | Alcohol | Beer" -> { time, rest: "Alcohol Beer" }. */
function splitTime(rest: string): { h: number; m: number; rest: string } | { h: null; rest: string } {
  const t = TIME.exec(rest);
  if (!t) return { h: null, rest };
  let h = Number(t[1]);
  const m = Number(t[2]);
  const ampm = t[3]?.toLowerCase();
  if (ampm === "p" && h < 12) h += 12;
  if (ampm === "a" && h === 12) h = 0;
  if (h > 23 || m > 59) return { h: null, rest };
  return { h, m, rest: rest.slice(t[0].length) };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function parseSlipFile(text: string, vices: readonly ImportVice[]): ImportResult {
  const out: ImportResult = { slips: [], skipped: [], errors: [] };
  const seen = new Map<string, number>();
  // Longest names first, so "Late snacks" wins over "Late".
  const names = vices.flatMap((v) => [{ key: norm(v.id), v }, { key: norm(v.name), v }]).sort((a, b) => b.key.length - a.key.length);
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const d = DATE.exec(raw);
    if (!d) return;
    const day = d[1];
    if (!isIsoDay(day)) return void out.errors.push({ line, reason: `${day} is not a real date` });
    // Table pipes, commas and a colon after the vice ("Alcohol: Wine") are separators; "21:30" is a time.
    const after = raw.slice(d.index + day.length).replace(/[|,]|(?<!\d):|:(?!\d)/g, " ");
    const time = splitTime(after.trim());
    const cleaned = time.rest.replace(/[-–—*_]+/g, " ").trim().replace(/\s+/g, " ");
    const words = cleaned.toLowerCase();
    if (!words) return void out.errors.push({ line, reason: "no vice named" });
    if (/^(clean|none)\b/.test(words)) return void out.skipped.push({ line, reason: "clean" });
    if (words === COFFEE_QUIT || words.startsWith(`${COFFEE_QUIT} `)) return void out.skipped.push({ line, reason: "coffee" });
    const hit = names.find(({ key }) => words === key || words.startsWith(`${key} `));
    if (!hit) return void out.errors.push({ line, reason: `no vice in Settings matches "${words.split(" ")[0]}"` });
    const kindText = cleaned.slice(hit.key.length).trim();
    const kind = kindText ? (hit.v.chips.find((c) => norm(c) === norm(kindText)) ?? kindText) : undefined;
    const n = (seen.get(`${day} ${hit.v.id}`) ?? 0) + 1;
    seen.set(`${day} ${hit.v.id}`, n);
    const when = time.h === null ? at(day, 12, 0) : at(day, time.h, time.m);
    const slip: Slip = { id: `import-${day}-${hit.v.id}-${n}`, vice: hit.v.id, at: when.toISOString() };
    if (kind) slip.kind = kind;
    if (time.h === null) slip.fromNotes = true;
    out.slips.push(slip);
  });
  return out;
}

/** "alcohol 12, sweets 3 · 2026-03-01 to 2026-03-20": what an import would add, without any slip's details. */
export function importSummary(r: ImportResult): string {
  if (r.slips.length === 0) return "nothing to import";
  const per = new Map<string, number>();
  for (const s of r.slips) per.set(s.vice, (per.get(s.vice) ?? 0) + 1);
  const days = r.slips.map((s) => dayKey(new Date(s.at))).sort();
  return `${[...per].map(([v, n]) => `${v} ${n}`).join(", ")} · ${days[0]} to ${days[days.length - 1]}`;
}
