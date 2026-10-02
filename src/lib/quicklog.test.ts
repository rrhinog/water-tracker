import { describe, expect, it } from "vitest";
import { describeDrink, findBottle, MAX_OZ, quickLog } from "./quicklog";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

const now = new Date("2026-10-03T14:15:00Z");
const s: Settings = { ...DEFAULT_SETTINGS }; // Owala 40, Yeti 36, CamelBak 50
const log = (body: unknown, settings: Settings = s) => quickLog(body, settings, now, () => 0.123456);

describe("quickLog: a bottle by name", () => {
  it("logs a full bottle at the server's time, with the size from Settings", () => {
    const r = log({ bottle: "Yeti" });
    expect(r).toEqual({
      ok: true,
      entry: { id: `log-${now.getTime()}-${(0.123456).toString(36).slice(2, 8)}`, at: "2026-10-03T14:15:00.000Z", bottleId: "yeti", fraction: 1, oz: 36 },
      message: "Logged 36 oz · Yeti",
    });
  });

  it("follows a changed bottle size: nothing about sizes lives in the Shortcut", () => {
    const bigger = { ...s, bottles: [{ id: "yeti", name: "Yeti", oz: 46 }] };
    expect(log({ bottle: "Yeti" }, bigger)).toMatchObject({ ok: true, entry: { oz: 46 } });
  });

  it("matches the name or the id, ignoring case and extra spaces", () => {
    expect(log({ bottle: "  yeti " })).toMatchObject({ ok: true, entry: { bottleId: "yeti" } });
    expect(log({ bottle: "CAMELBAK" })).toMatchObject({ ok: true, entry: { bottleId: "camelbak", oz: 50 } });
    const twoWords = { ...s, bottles: [{ id: "big-jug", name: "Big Jug", oz: 64 }] };
    expect(log({ bottle: "big   jug" }, twoWords)).toMatchObject({ ok: true, entry: { bottleId: "big-jug" } });
    expect(log({ bottle: "big-jug" }, twoWords)).toMatchObject({ ok: true, entry: { bottleId: "big-jug" } });
  });

  it("takes a fraction, as a number or as text from a Shortcut", () => {
    expect(log({ bottle: "Yeti", fraction: 0.5 })).toMatchObject({ ok: true, entry: { fraction: 0.5, oz: 18 }, message: "Logged 18 oz · ½ Yeti" });
    expect(log({ bottle: "Owala", fraction: "0.25" })).toMatchObject({ ok: true, entry: { fraction: 0.25, oz: 10 } });
    expect(log({ bottle: "Owala", fraction: "0,75" })).toMatchObject({ ok: true, entry: { fraction: 0.75, oz: 30 } });
  });

  it("refuses a fraction the app can't show", () => {
    for (const fraction of [0.3, 0, 2, "half", null]) {
      expect(log({ bottle: "Yeti", fraction })).toEqual({ ok: false, message: "fraction must be 0.25, 0.5, 0.75 or 1." });
    }
  });

  it("refuses an unknown bottle and names the ones it knows", () => {
    expect(log({ bottle: "Nalgene" })).toEqual({
      ok: false,
      message: 'No bottle called "Nalgene". Yours: Owala, Yeti, CamelBak. Or use Other with an amount in oz.',
    });
  });

  it("refuses oz on a bottle, which logs fractions only", () => {
    expect(log({ bottle: "Yeti", oz: 20 })).toMatchObject({ ok: false, message: expect.stringMatching(/^Yeti takes a fraction/) });
  });

  it("says the amount in the user's unit", () => {
    expect(log({ bottle: "Yeti" }, { ...s, unit: "ml" })).toMatchObject({ ok: true, entry: { oz: 36 }, message: "Logged 1065 mL · Yeti" });
  });
});

describe("quickLog: an amount (Other)", () => {
  it("logs a typed amount, like the app's Other chip", () => {
    expect(log({ bottle: "Other", oz: 16.9 })).toMatchObject({ ok: true, entry: { bottleId: "other", fraction: 1, oz: 16.9 }, message: "Logged 16.9 oz" });
    expect(log({ oz: "12" })).toMatchObject({ ok: true, entry: { bottleId: "other", oz: 12 } });
  });

  it("refuses a missing, zero, negative or huge amount", () => {
    expect(log({ bottle: "other" })).toEqual({ ok: false, message: 'Other needs an amount, like "oz": 16.9.' });
    for (const oz of [0, -5, 0.04, MAX_OZ + 1, "lots"]) {
      expect(log({ oz })).toMatchObject({ ok: false, message: expect.stringMatching(/^oz must be/) });
    }
    expect(log({ oz: MAX_OZ })).toMatchObject({ ok: true });
  });

  it("refuses a fraction without a bottle", () => {
    expect(log({ oz: 12, fraction: 0.5 })).toMatchObject({ ok: false, message: expect.stringMatching(/^A fraction needs a bottle/) });
  });
});

describe("quickLog: the request itself", () => {
  it("says how to ask when there is nothing to log", () => {
    expect(log({})).toEqual({ ok: false, message: "Name a bottle (Owala, Yeti, CamelBak), or send Other with an amount in oz." });
    for (const body of [null, "Yeti", 5, [{ bottle: "Yeti" }]]) {
      expect(log(body)).toEqual({ ok: false, message: 'Send JSON like {"bottle": "Owala"}.' });
    }
    expect(log({ bottle: 7 })).toEqual({ ok: false, message: 'bottle must be a name, like "Owala".' });
  });

  it("makes the request id the drink's id, so the same request twice is the same drink", () => {
    const a = log({ bottle: "Yeti", requestId: "yeti-2026-10-03T10:15" });
    const b = quickLog({ bottle: "Yeti", requestId: "yeti-2026-10-03T10:15" }, s, new Date(now.getTime() + 5000));
    expect(a.ok && a.entry.id).toBe("log-yeti-2026-10-03T10:15");
    expect(b.ok && b.entry.id).toBe("log-yeti-2026-10-03T10:15");
  });

  it("refuses a request id that isn't a short plain word", () => {
    for (const requestId of ["has space", "x".repeat(81), 42, "a/b"]) {
      expect(log({ bottle: "Yeti", requestId })).toMatchObject({ ok: false, message: expect.stringMatching(/^requestId must be/) });
    }
  });

  it("never collides with the app's own ids", () => {
    const r = log({ bottle: "Yeti" });
    expect(r.ok && r.entry.id.startsWith("log-")).toBe(true);
  });
});

describe("findBottle and describeDrink", () => {
  it("prefers a name over another bottle's id", () => {
    const tricky = [
      { id: "yeti", name: "Old", oz: 10 },
      { id: "new", name: "Yeti", oz: 36 },
    ];
    expect(findBottle(tricky, "yeti")?.id).toBe("new");
  });

  it("describes a drink whose bottle was removed by its stored id", () => {
    expect(describeDrink({ bottleId: "gone", fraction: 1, oz: 20 }, s)).toBe("20 oz · gone");
  });
});
