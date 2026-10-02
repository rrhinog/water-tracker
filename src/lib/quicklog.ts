// Log a drink without opening the app: an iPhone Shortcut (Back Tap, "Hey Siri, log a Yeti") sends one
// request naming a bottle, and the server fills in the id, the time and the ounces from Settings.
// Pure, so it is unit-testable; the route (src/app/api/log) only reads Settings and writes the row.
import { FRACTIONS, fractionLabel, type Fraction } from "./bottles";
import { ouncesFor, type Entry } from "./log";
import { fmt, sourceName, type Bottle, type Settings } from "./settings";

/** The biggest one-off amount accepted, about 6 L: anything more is surely a typo (169 for 16.9). */
export const MAX_OZ = 200;

/** The Shortcut's own name for this drink: the same one twice logs it once. */
const REQUEST_ID = /^[A-Za-z0-9._:+-]{1,80}$/;

export type QuickLog = { ok: true; entry: Entry; message: string } | { ok: false; message: string };

const fail = (message: string): QuickLog => ({ ok: false, message });

/** A JSON number, or a number typed as text in a Shortcut ("0.5", "16,9"). NaN for anything else. */
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v.trim().replace(",", "."));
  return NaN;
}

const squash = (s: string) => s.trim().replace(/\s+/g, " ");

/** A bottle by its name or id, ignoring case and extra spaces. */
export function findBottle(bottles: readonly Bottle[], name: string): Bottle | undefined {
  const key = squash(name).toLowerCase();
  return bottles.find((b) => b.name.toLowerCase() === key) ?? bottles.find((b) => b.id.toLowerCase() === key);
}

/** "36 oz · Yeti", "18 oz · ½ Yeti", "16.9 oz" (an Other amount): what was logged, in the user's unit. */
export function describeDrink(e: Pick<Entry, "bottleId" | "fraction" | "oz">, settings: Settings): string {
  const amount = fmt(e.oz, settings.unit);
  if (e.bottleId === "other") return amount;
  const part = e.fraction === 1 ? "" : `${fractionLabel(e.fraction)} `;
  return `${amount} · ${part}${sourceName(settings.bottles, e.bottleId)}`;
}

/**
 * Turn a Shortcut's request into a drink, or a message saying what's wrong. Accepts
 * {"bottle": "Yeti"}, {"bottle": "Yeti", "fraction": 0.5}, {"bottle": "Other", "oz": 16.9} or {"oz": 16.9},
 * each with an optional "requestId".
 */
export function quickLog(body: unknown, settings: Settings, now: Date, random: () => number = Math.random): QuickLog {
  const names = settings.bottles.map((b) => b.name).join(", ");
  const example = settings.bottles[0]?.name ?? "Yeti";
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(`Send JSON like {"bottle": "${example}"}.`);
  const b = body as Record<string, unknown>;

  let id: string;
  if (b.requestId === undefined || b.requestId === null || b.requestId === "") {
    id = `log-${now.getTime()}-${random().toString(36).slice(2, 8)}`;
  } else if (typeof b.requestId === "string" && REQUEST_ID.test(b.requestId.trim())) {
    id = `log-${b.requestId.trim()}`;
  } else {
    return fail("requestId must be 1 to 80 letters, digits or . _ : + -");
  }

  if (b.bottle !== undefined && typeof b.bottle !== "string") return fail(`bottle must be a name, like "${example}".`);
  const name = typeof b.bottle === "string" ? squash(b.bottle) : "";
  const at = now.toISOString();

  // Other: a typed amount, like the app's Other chip. The amount is the request's, not a bottle's.
  if (name === "" || name.toLowerCase() === "other") {
    if (b.fraction !== undefined) return fail(`A fraction needs a bottle: ${names}.`);
    if (b.oz === undefined) return fail(name === "" ? `Name a bottle (${names}), or send Other with an amount in oz.` : `Other needs an amount, like "oz": 16.9.`);
    const oz = Math.round(num(b.oz) * 10) / 10;
    if (!(oz > 0 && oz <= MAX_OZ)) return fail(`oz must be a number above 0 and at most ${MAX_OZ}.`);
    const entry: Entry = { id, at, bottleId: "other", fraction: 1, oz };
    return { ok: true, entry, message: `Logged ${describeDrink(entry, settings)}` };
  }

  const bottle = findBottle(settings.bottles, name);
  if (!bottle) return fail(`No bottle called "${name}". Yours: ${names}. Or use Other with an amount in oz.`);
  if (b.oz !== undefined) return fail(`${bottle.name} takes a fraction (0.25, 0.5, 0.75 or 1), not oz. For an amount in oz, use Other.`);
  const fraction = b.fraction === undefined ? 1 : num(b.fraction);
  if (!FRACTIONS.includes(fraction as Fraction)) return fail("fraction must be 0.25, 0.5, 0.75 or 1.");
  const entry: Entry = { id, at, bottleId: bottle.id, fraction: fraction as Fraction, oz: ouncesFor(bottle, fraction as Fraction) };
  return { ok: true, entry, message: `Logged ${describeDrink(entry, settings)}` };
}
