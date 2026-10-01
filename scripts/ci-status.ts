// Did CI pass on this commit? Asks GitHub with the GitHub CLI (gh, signed in), from this repo's folder.
//
//   bun scripts/ci-status.ts <commit>      # exit 0 if it passed, 1 otherwise (and says why)
//
// deploy.ps1 runs it before anything goes live. The rule is ciVerdict in src/lib/ci.ts.
import { ciVerdict, type CheckRun } from "../src/lib/ci";
import { run } from "./proc";

async function main() {
  const commit = process.argv[2];
  if (!commit || !/^[0-9a-f]{7,40}$/.test(commit)) throw new Error("usage: bun scripts/ci-status.ts <commit sha>");
  const r = await run(["gh", "api", `repos/{owner}/{repo}/commits/${commit}/check-runs?per_page=100`]).catch(() => null);
  if (!r) throw new Error("the GitHub CLI (gh) is needed: install it and run gh auth login");
  if (r.code !== 0) throw new Error(`couldn't read CI results from GitHub: ${r.stderr.trim().slice(0, 300)}`);
  const runs = (JSON.parse(r.stdout).check_runs as CheckRun[]).map(({ id, name, status, conclusion }) => ({ id, name, status, conclusion }));
  const { ok, message } = ciVerdict(runs);
  console.log(`ci: ${commit.slice(0, 7)}: ${message}`);
  if (!ok) process.exit(1);
}

main().catch((err: Error) => {
  console.error(`ci: FAILED: ${err.message}`);
  process.exit(1);
});
