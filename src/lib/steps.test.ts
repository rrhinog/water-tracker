import { describe, expect, it } from "vitest";
import { stepsUrl, toStepsDays } from "./steps";

describe("steps source", () => {
  it("is off unless STEPS_DATABASE_URL is set to something", () => {
    expect(stepsUrl({})).toBeNull();
    expect(stepsUrl({ STEPS_DATABASE_URL: "  " })).toBeNull();
    expect(stepsUrl({ STEPS_DATABASE_URL: " postgresql://reader:x@db:5432/stats " })).toBe("postgresql://reader:x@db:5432/stats");
  });

  it("maps the view's rows, oldest first, and skips anything that is not a real day and count", () => {
    const rows = [
      { day: "2026-03-02", steps: "8412", synced_at: new Date("2026-03-02T17:00:00Z") },
      { day: "2026-03-01", steps: 12000.4, synced_at: "2026-03-02T05:00:00Z" },
      { day: "2026-02-30", steps: 10, synced_at: "2026-03-02T05:00:00Z" },
      { day: "2026-03-03", steps: -1, synced_at: "2026-03-03T05:00:00Z" },
      { day: "2026-03-04", steps: 10, synced_at: "never" },
    ];
    expect(toStepsDays(rows)).toEqual([
      { day: "2026-03-01", steps: 12000, syncedAt: "2026-03-02T05:00:00.000Z" },
      { day: "2026-03-02", steps: 8412, syncedAt: "2026-03-02T17:00:00.000Z" },
    ]);
  });
});
