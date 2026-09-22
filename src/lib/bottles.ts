// Fractions of a container you can log in one slide. Containers themselves live in Settings.
export type { Bottle } from "./settings";
export { bottleById, sourceName } from "./settings";

export const FRACTIONS = [0.25, 0.5, 0.75, 1] as const;
export type Fraction = (typeof FRACTIONS)[number];

export function fractionLabel(f: Fraction): string {
  return { 0.25: "¼", 0.5: "½", 0.75: "¾", 1: "Full" }[f];
}
