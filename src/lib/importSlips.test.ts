import { describe, expect, it } from "vitest";
import { importSummary, parseSlipFile } from "./importSlips";

// A made-up notes file: invented vices, dates and chips, in each shape the parser takes.
const FIXTURE = `# Slips (fake fixture)

Some prose with no date is ignored.

- 2026-03-01 21:30 Alcohol Beer
- 2026-03-01 23:10 alcohol beer
- 2026-03-02 9:15 pm Alcohol: Wine
- 2026-03-03 Late snacks
- 2026-03-04 clean
- 2026-03-05 Coffee
* 2026-03-06 12:05 am Sweets Cupcake

| day | time | vice | kind |
| --- | --- | --- | --- |
| 2026-03-07 | 22:00 | Alcohol | Cocktail |
| 2026-03-08 |  | sweets |  |

- 2026-03-09 Tobacco
- 2026-02-30 Alcohol
`;

const VICES = [
  { id: "alcohol", name: "Alcohol", chips: ["Beer", "Wine", "Cocktail"] },
  { id: "sweets", name: "Sweets", chips: ["Candy"] },
  { id: "late-snacks", name: "Late snacks", chips: [] },
  { id: "late", name: "Late", chips: [] },
];
const local = (d: number, h: number, m = 0) => new Date(2026, 2, d, h, m).toISOString();

describe("parseSlipFile", () => {
  const r = parseSlipFile(FIXTURE, VICES);

  it("reads bullets and table rows, with or without a time or a chip", () => {
    expect(r.slips).toEqual([
      { id: "import-2026-03-01-2130-alcohol", vice: "alcohol", at: local(1, 21, 30), kind: "Beer" },
      { id: "import-2026-03-01-2310-alcohol", vice: "alcohol", at: local(1, 23, 10), kind: "Beer" },
      { id: "import-2026-03-02-2115-alcohol", vice: "alcohol", at: local(2, 21, 15), kind: "Wine" },
      { id: "import-2026-03-03-notime-late-snacks", vice: "late-snacks", at: local(3, 12), fromNotes: true },
      { id: "import-2026-03-06-0005-sweets", vice: "sweets", at: local(6, 0, 5), kind: "Cupcake" },
      { id: "import-2026-03-07-2200-alcohol", vice: "alcohol", at: local(7, 22), kind: "Cocktail" },
      { id: "import-2026-03-08-notime-sweets", vice: "sweets", at: local(8, 12), fromNotes: true },
    ]);
  });

  it("skips clean days and coffee, and reports what it cannot place", () => {
    expect(r.skipped).toEqual([{ line: 9, reason: "clean" }, { line: 10, reason: "coffee" }]);
    expect(r.errors).toEqual([
      { line: 18, reason: 'no vice in Settings matches "tobacco"' },
      { line: 19, reason: "2026-02-30 is not a real date" },
    ]);
  });

  it("ignores lines with no date, including the table's header", () => {
    expect(parseSlipFile("# Heading\n| day | vice |\n| --- | --- |\nno date here", VICES)).toEqual({ slips: [], skipped: [], errors: [] });
  });

  it("a slip near midnight keeps its own calendar day", () => {
    const [late, early] = parseSlipFile("- 2026-03-01 23:59 Alcohol\n- 2026-03-02 00:01 Alcohol", VICES).slips;
    expect(new Date(late.at).getDate()).toBe(1);
    expect(new Date(early.at).getDate()).toBe(2);
  });

  it("the same file twice gives the same ids, so a re-run adds nothing", () => {
    expect(parseSlipFile(FIXTURE, VICES).slips.map((s) => s.id)).toEqual(r.slips.map((s) => s.id));
  });

  it("a line added above others later leaves their ids alone; only identical slips get a suffix", () => {
    const before = parseSlipFile("- 2026-03-01 21:30 Alcohol Beer\n- 2026-03-01 Alcohol", VICES).slips.map((s) => s.id);
    const after = parseSlipFile("- 2026-03-01 19:00 Alcohol Wine\n- 2026-03-01 21:30 Alcohol Beer\n- 2026-03-01 Alcohol", VICES).slips.map((s) => s.id);
    expect(after).toEqual(["import-2026-03-01-1900-alcohol", ...before]);
    const twins = parseSlipFile("- 2026-03-01 21:30 Alcohol Beer\n- 2026-03-01 21:30 Alcohol Wine\n- 2026-03-01 Alcohol\n- 2026-03-01 Alcohol", VICES).slips;
    expect(twins.map((s) => s.id)).toEqual([
      "import-2026-03-01-2130-alcohol", "import-2026-03-01-2130-alcohol-2", "import-2026-03-01-notime-alcohol", "import-2026-03-01-notime-alcohol-2",
    ]);
  });

  it("keeps a hyphen inside a chip, so it matches the chip exactly; separator dashes and emphasis go", () => {
    const vices = [{ id: "smoke", name: "Smoke", chips: ["Pre-roll", "Disposable vape"] }];
    const kinds = parseSlipFile("- 2026-03-01 21:30 Smoke Pre-roll\n- 2026-03-02 Smoke — pre-roll\n- 2026-03-03 **Smoke** disposable vape\n- 2026-03-04 Smoke Half-joint", vices).slips.map((s) => s.kind);
    expect(kinds).toEqual(["Pre-roll", "Pre-roll", "Disposable vape", "Half-joint"]);
  });

  it("summarises counts and the date range, never a slip's details", () => {
    expect(importSummary(r)).toBe("alcohol 4, late-snacks 1, sweets 2 · 2026-03-01 to 2026-03-08");
    expect(importSummary({ slips: [], skipped: [], errors: [] })).toBe("nothing to import");
  });
});
