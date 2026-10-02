// `bun run e2e`: the main-path browser test against a running staging app (e2e/main-path.e2e.ts).
// Kept apart from the unit tests (vitest.config.ts): it needs a browser and a server, and writes data.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.ts"],
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
});
