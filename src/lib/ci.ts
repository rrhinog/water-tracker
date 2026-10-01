// Did CI pass on a commit? Pure: scripts/ci-status.ts fetches GitHub's check runs and hands them in.

/** The jobs in .github/workflows/ci.yml. Other workflows' runs on the same commit (Release) don't count. */
export const CI_JOBS = ["check", "secrets", "audit"];

export type CheckRun = { id: number; name: string; status: string; conclusion: string | null };

/**
 * "check" must have run; every CI job that ran must have finished with success. A job newer than the
 * commit has no run there, which is fine (v1.8 predates "secrets"). For a re-run job, the latest run counts.
 */
export function ciVerdict(runs: CheckRun[]): { ok: boolean; message: string } {
  const latest = new Map<string, CheckRun>();
  for (const r of runs) {
    if (!CI_JOBS.includes(r.name)) continue;
    const seen = latest.get(r.name);
    if (!seen || r.id > seen.id) latest.set(r.name, r);
  }
  if (!latest.has("check")) return { ok: false, message: "CI never ran on this commit" };
  const jobs = CI_JOBS.filter((j) => latest.has(j));
  const running = jobs.filter((j) => latest.get(j)!.status !== "completed");
  if (running.length) return { ok: false, message: `CI is still running (${running.join(", ")}); wait for it` };
  const failed = jobs.filter((j) => latest.get(j)!.conclusion !== "success");
  if (failed.length) return { ok: false, message: `CI did not pass: ${failed.map((j) => `${j} ${latest.get(j)!.conclusion}`).join(", ")}` };
  return { ok: true, message: `CI passed (${jobs.join(", ")})` };
}
