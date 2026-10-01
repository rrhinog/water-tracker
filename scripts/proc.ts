// Run a command for the backup scripts: stdin from a file, stdout to a file or captured, stderr
// captured. Node APIs only, like the other scripts, so `tsc` checks them without Bun's types.
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

export type Result = { code: number; stdout: string; stderr: string };

export function run(cmd: string[], opts: { env?: NodeJS.ProcessEnv; stdinFile?: string; stdoutFile?: string } = {}): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), { env: opts.env ?? process.env, stdio: "pipe", windowsHide: true });
    let stdout = "";
    let stderr = "";
    const written = opts.stdoutFile ? pipeline(child.stdout, createWriteStream(opts.stdoutFile)) : Promise.resolve();
    if (!opts.stdoutFile) child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.stdin.on("error", () => {}); // the command may exit before reading all of stdin; its exit code says why
    if (opts.stdinFile) createReadStream(opts.stdinFile).pipe(child.stdin);
    else child.stdin.end();
    child.on("error", reject);
    child.on("close", (code) => written.then(() => resolve({ code: code ?? 1, stdout, stderr }), reject));
  });
}
