import { describe, expect, it } from "vitest";
import { dayKey, makeEntry, type Entry } from "./log";
import { DEFAULT_SETTINGS } from "./settings";
import { atOnDay, parseTime, retime, timeValue, YESTERDAY_DEFAULT_TIME, yesterdayAt } from "./when";

const yeti = DEFAULT_SETTINGS.bottles[1];

describe("parseTime / timeValue", () => {
  it("reads what <input type=time> gives and rejects anything else", () => {
    expect(parseTime("14:05")).toEqual({ h: 14, m: 5 });
    expect(parseTime("9:00")).toEqual({ h: 9, m: 0 });
    expect(parseTime("")).toBeNull();
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("2pm")).toBeNull();
  });

  it("writes a local time back in the same format", () => {
    expect(timeValue(new Date(2026, 8, 24, 9, 5))).toBe("09:05");
    expect(timeValue(new Date(2026, 8, 24, 21, 0))).toBe("21:00");
  });
});

describe("yesterdayAt", () => {
  it("defaults to a forgotten evening bottle, 9:00 PM", () => {
    expect(YESTERDAY_DEFAULT_TIME).toBe("21:00");
    const at = yesterdayAt(YESTERDAY_DEFAULT_TIME, new Date(2026, 8, 24, 8, 0))!;
    expect(dayKey(at)).toBe("2026-09-23");
    expect([at.getHours(), at.getMinutes()]).toEqual([21, 0]);
  });

  it("just after midnight, yesterday is the day that just ended", () => {
    const at = yesterdayAt("23:30", new Date(2026, 8, 24, 0, 5))!;
    expect(dayKey(at)).toBe("2026-09-23");
    expect(at.getTime()).toBeLessThan(new Date(2026, 8, 24, 0, 5).getTime());
  });

  it("crosses month and year ends", () => {
    expect(dayKey(yesterdayAt("21:00", new Date(2026, 9, 1, 7, 0))!)).toBe("2026-09-30");
    expect(dayKey(yesterdayAt("21:00", new Date(2027, 0, 1, 7, 0))!)).toBe("2026-12-31");
    expect(dayKey(yesterdayAt("21:00", new Date(2028, 2, 1, 7, 0))!)).toBe("2028-02-29");
  });

  // US clocks: 2026-03-08 has 23 hours, 2026-11-01 has 25. "Now minus 24 hours" lands on the wrong
  // date around each (CI runs in America/New_York); building from calendar fields does not. The
  // assertions hold in any time zone.
  it("the day after spring forward: yesterday is the 23-hour day, not two days back", () => {
    const now = new Date(2026, 2, 9, 0, 30); // minus 24 h = Mar 7, 23:30
    expect(dayKey(yesterdayAt("21:00", now)!)).toBe("2026-03-08");
    expect(dayKey(yesterdayAt("00:15", now)!)).toBe("2026-03-08");
  });

  it("late on the fall-back day: yesterday is the day before, not today", () => {
    const now = new Date(2026, 10, 1, 23, 30); // minus 24 h = Nov 1, 00:30
    expect(dayKey(yesterdayAt("21:00", now)!)).toBe("2026-10-31");
    expect(dayKey(yesterdayAt("23:45", new Date(2026, 10, 2, 0, 10))!)).toBe("2026-11-01");
  });

  it("a time inside the spring-forward gap stays on that day", () => {
    const at = atOnDay(new Date(2026, 2, 9, 12, 0), -1, "02:30")!;
    expect(dayKey(at)).toBe("2026-03-08");
  });

  it("an empty picker gives no time", () => {
    expect(yesterdayAt("", new Date(2026, 8, 24, 8, 0))).toBeNull();
  });
});

describe("retime", () => {
  const now = new Date(2026, 8, 24, 15, 0);
  const logged = makeEntry(yeti, 1, now);

  it("keeps the id, bottle and amount; only the time moves", () => {
    const r = retime(logged, "14:00", now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry).toEqual({ ...logged, at: new Date(2026, 8, 24, 14, 0).toISOString() });
  });

  it("refuses a time that hasn't happened yet", () => {
    expect(retime(logged, "15:01", now)).toEqual({ ok: false, error: "That time hasn't happened yet" });
    expect(retime(logged, "15:00", now).ok).toBe(true); // right now is fine
  });

  it("stays on the entry's own day: yesterday's drink edited today is still yesterday", () => {
    const old = makeEntry(yeti, 1, new Date(2026, 8, 23, 21, 0));
    const r = retime(old, "23:30", now); // later than now's clock time, but on yesterday: allowed
    expect(r.ok && dayKey(new Date(r.entry.at))).toBe("2026-09-23");
  });

  it("refuses an empty or broken value", () => {
    expect(retime(logged, "", now)).toEqual({ ok: false, error: "Pick a time" });
  });

  it("a backfilled row given a real time is no longer untimed", () => {
    const untimed: Entry = { ...makeEntry(yeti, 1, new Date(2026, 8, 23, 23, 59)), untimed: true };
    const r = retime(untimed, "20:00", now);
    expect(r.ok && r.entry.untimed).toBeUndefined();
  });

  it("a gap time on spring-forward day resolves to the same day", () => {
    const e = makeEntry(yeti, 1, new Date(2026, 2, 8, 10, 0));
    const r = retime(e, "02:30", new Date(2026, 2, 8, 12, 0));
    expect(r.ok && dayKey(new Date(r.entry.at))).toBe("2026-03-08");
  });
});
