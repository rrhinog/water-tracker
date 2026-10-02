import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appDir = path.resolve(__dirname, "..");
const srcDir = path.resolve(appDir, "..");
const layout = readFileSync(path.join(appDir, "layout.tsx"), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx|css|mjs|js)$/.test(e.name) ? [p] : [];
  });
}

describe("self-hosted fonts", () => {
  it("never imports next/font/google or points at a Google font host", () => {
    const self = path.join(__dirname, "fonts.test.ts");
    const offenders = sourceFiles(srcDir)
      .filter((f) => f !== self)
      .filter((f) => /next\/font\/google|fonts\.googleapis|fonts\.gstatic/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("layout loads the faces with next/font/local and keeps the CSS variable names", () => {
    expect(layout).toContain('from "next/font/local"');
    expect(layout).toContain('"--font-inter-tight"');
    expect(layout).toContain('"--font-plex-mono"');
  });

  it("every font file referenced by layout exists, is non-empty WOFF2, and has a license beside it", () => {
    const refs = [...layout.matchAll(/["'`](\.\/fonts\/[^"'`]+)["'`]/g)].map((m) => m[1]);
    expect(refs.length).toBe(4);
    for (const ref of refs) {
      const file = path.join(appDir, ref);
      expect(existsSync(file), ref).toBe(true);
      expect(statSync(file).size, ref).toBeGreaterThan(1000);
      expect(readFileSync(file).subarray(0, 4).toString("latin1"), ref).toBe("wOF2");
    }
    for (const lic of ["OFL-Inter-Tight.txt", "OFL-IBM-Plex-Mono.txt"]) {
      const file = path.join(appDir, "fonts", lic);
      expect(existsSync(file), lic).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
    expect(existsSync(path.join(appDir, "fonts", "README.md"))).toBe(true);
  });
});
