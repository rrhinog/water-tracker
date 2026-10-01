import { describe, expect, it } from "vitest";
import { ciVerdict, type CheckRun } from "./ci";

let id = 0;
const run = (name: string, conclusion: string | null = "success", status = "completed"): CheckRun => ({ id: ++id, name, status, conclusion });

describe("ciVerdict", () => {
  it("passes when every CI job that ran succeeded", () => {
    expect(ciVerdict([run("check"), run("secrets"), run("audit"), run("release")])).toEqual({ ok: true, message: "CI passed (check, secrets, audit)" });
  });
  it("passes an older commit that only had the check job", () => {
    expect(ciVerdict([run("check"), run("release")]).ok).toBe(true);
  });
  it("refuses a commit CI never ran on, whatever else ran", () => {
    expect(ciVerdict([])).toEqual({ ok: false, message: "CI never ran on this commit" });
    expect(ciVerdict([run("release"), run("secrets")]).ok).toBe(false);
  });
  it("refuses a failed or cancelled job and names it", () => {
    expect(ciVerdict([run("check", "failure"), run("audit")])).toEqual({ ok: false, message: "CI did not pass: check failure" });
    expect(ciVerdict([run("check"), run("secrets", "cancelled")]).message).toBe("CI did not pass: secrets cancelled");
  });
  it("waits for a job still running", () => {
    expect(ciVerdict([run("check", null, "in_progress"), run("secrets")]).message).toMatch(/still running \(check\)/);
  });
  it("judges a re-run job by its latest run", () => {
    expect(ciVerdict([run("check", "failure"), run("check")]).ok).toBe(true);
    expect(ciVerdict([run("check"), run("check", "failure")]).ok).toBe(false);
  });
  it("ignores other workflows' failures (a release that failed is not CI)", () => {
    expect(ciVerdict([run("check"), run("release", "failure")]).ok).toBe(true);
  });
});
