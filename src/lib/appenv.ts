// Which deployment this server is: set per container in docker-compose.yml (APP_ENV=staging on the
// staging service only) and read at request time, so one image can never show staging marks on live.

export type AppEnv = "live" | "staging";

/** Only the exact value "staging" is staging. Anything else, including unset or a typo, is live. */
export function appEnv(raw: string | undefined): AppEnv {
  return raw === "staging" ? "staging" : "live";
}

export const STAGING_BANNER = { tag: "STAGING", text: "demo data, not your log" } as const;

/** Names for the installed app and the browser tab, so a staging home-screen icon reads differently. */
export function appNames(env: AppEnv): { name: string; shortName: string; title: string } {
  return env === "staging"
    ? { name: "Water · Staging", shortName: "Staging", title: "Water · Staging" }
    : { name: "Water Tracker", shortName: "Water", title: "Water" };
}
