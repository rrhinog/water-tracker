import { describe, expect, it } from "vitest";
import { coffeeStatus, makeCoffee } from "./coffee";

const seed = ["2026-09-15", "2026-09-16", "2026-09-17"].map((d) => ({ id: `seed-coffee-${d}`, at: `${d}T12:00:00`, fromNotes: true }));
const at = (d: number, h = 9) => new Date(2026, 8, d, h);

describe("coffeeStatus", () => {
  it("counts consecutive coffee-free days ending yesterday, from the seed", () => {
    const s = coffeeStatus(seed, at(22));
    expect(s.streak).toBe(4); // 18, 19, 20, 21
    expect(s.todayCount).toBe(0);
    expect(s.lastCoffeeDay).toBe("2026-09-17");
  });

  it("a coffee today resets nothing until tomorrow, but shows today's count", () => {
    const s = coffeeStatus([...seed, makeCoffee(at(22, 7))], at(22, 12));
    expect(s.streak).toBe(4);
    expect(s.todayCount).toBe(1);
    expect(s.lastCoffeeDay).toBe("2026-09-22");
  });

  it("tomorrow, that coffee makes the streak zero", () => {
    const s = coffeeStatus([...seed, makeCoffee(at(22, 7))], at(23));
    expect(s.streak).toBe(0);
  });

});
