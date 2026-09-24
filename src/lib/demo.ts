// Demo data for staging, screenshots and fresh installs. Pure and seeded: the same `now` and seed
// always give the same rows, so a reseeded staging looks the same and tests can pin it.
// Written to a database only by scripts/seed-demo.ts, which refuses anything but a *_staging or
// *_demo database (see src/lib/dbtarget.ts).
import type { Fraction } from "./bottles";
import type { CoffeeEntry } from "./coffee";
import { STARTED } from "./duration";
import { dayKey, ouncesFor, type Entry } from "./log";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

export const DEMO_DAYS = 75;
export const DEMO_SEED = 1;

export interface DemoData {
  water: Entry[];
  coffee: CoffeeEntry[];
  settings: Settings;
}

/** mulberry32: a tiny seeded PRNG, uniform in [0, 1). Not for anything secret. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const i of items) {
    if ((r -= i.weight) < 0) return i.value;
  }
  return items[items.length - 1].value;
}

function between(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

const FRACTION_WEIGHTS: { value: Fraction; weight: number }[] = [
  { value: 1, weight: 14 },
  { value: 0.75, weight: 2 },
  { value: 0.5, weight: 3 },
  { value: 0.25, weight: 1 },
];

/**
 * `days` days of water and coffee ending today (local time), plus DEFAULT_SETTINGS.
 * Today always has a "Started bottle" marker; rows later than `now` are left out.
 * The four days before today are coffee-free, so the streak card has something to show.
 */
export function generateDemoData(now: Date, opts: { days?: number; seed?: number } = {}): DemoData {
  const days = opts.days ?? DEMO_DAYS;
  const rand = seededRandom(opts.seed ?? DEMO_SEED);
  const settings: Settings = structuredClone(DEFAULT_SETTINGS);
  const bottles = settings.bottles.map((b, i) => ({ value: b, weight: [5, 3, 2][i] ?? 1 }));
  const flavours = settings.flavours.map((f, i) => ({ value: f, weight: [4, 3, 2][i] ?? 1 }));
  const water: Entry[] = [];
  const coffee: CoffeeEntry[] = [];

  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const key = dayKey(day);
    const at = (minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
    const isToday = back === 0;
    const rows: Entry[] = [];
    let n = 0;
    const id = () => `demo-w-${key}-${n++}`;

    // Water: bottles back to back from waking, until the day's target or late evening.
    const wake = between(rand, 6 * 60 + 15, 8 * 60);
    if (isToday || rand() < 0.55) rows.push({ id: id(), at: at(wake).toISOString(), bottleId: STARTED, fraction: 1, oz: 0 });
    const target = settings.floorOz * (0.6 + rand() * 0.5);
    let t = wake, total = 0;
    while (total < target) {
      const bottle = pick(rand, bottles);
      const fraction = pick(rand, FRACTION_WEIGHTS);
      t += Math.max(15, Math.round(between(rand, 55, 150) * fraction));
      if (t > 22 * 60) break;
      const oz = ouncesFor(bottle, fraction);
      rows.push({ id: id(), at: at(t).toISOString(), bottleId: bottle.id, fraction, oz });
      total += oz;
    }
    if (rand() < 0.1) {
      rows.push({ id: id(), at: at(between(rand, 11 * 60, 20 * 60)).toISOString(), bottleId: "other", fraction: 1, oz: pick(rand, [12, 16, 20].map((v) => ({ value: v, weight: 1 }))) });
    }
    if (!isToday && rand() < 0.04) {
      rows.push({ id: id(), at: at(23 * 60 + 59).toISOString(), bottleId: "other", fraction: 1, oz: 16, untimed: true });
    }

    // Coffee: target zero, so most days have none.
    const cups = back >= 1 && back <= 4 ? 0 : rand() < 0.35 ? (rand() < 0.12 ? 2 : 1) : 0;
    let c = between(rand, 7 * 60 + 30, 10 * 60);
    for (let i = 0; i < cups; i++) {
      const finished = c + between(rand, 25, 140);
      coffee.push({ id: `demo-c-${key}-${i}`, at: at(c).toISOString(), finishedAt: at(finished).toISOString(), flavour: pick(rand, flavours) });
      c = finished + between(rand, 120, 300);
    }

    // Generate the whole day first so the random stream never depends on the time of day.
    const cutoff = now.toISOString();
    if (isToday) {
      const start = rows[0];
      if (start.at > cutoff) start.at = cutoff;
    }
    water.push(...rows.filter((r) => !isToday || r.at <= cutoff).sort((a, b) => a.at.localeCompare(b.at)));
  }

  // A coffee poured before now but "finished" after it is still open.
  const cutoff = now.toISOString();
  return {
    water,
    coffee: coffee.filter((c) => c.at <= cutoff).map((c) => (c.finishedAt && c.finishedAt > cutoff ? { id: c.id, at: c.at, flavour: c.flavour } : c)),
    settings,
  };
}
