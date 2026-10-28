import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
if (process.env.VERCEL_ENV === "production" && config.rewrites[0].destination.includes(".invalid")) {
  throw new Error("Configure the Render origin with scripts/configure-hosting.mjs before deploying production.");
}
if (process.env.VERCEL_ENV === "production" && (process.env.PROXY_SHARED_SECRET || "").length < 32) {
  throw new Error("Set the private PROXY_SHARED_SECRET in Vercel and Render before deploying production.");
}
