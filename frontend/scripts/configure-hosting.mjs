import { readFileSync, writeFileSync } from "node:fs";

const origin = new URL(process.env.RENDER_API_ORIGIN || "https://api.example.invalid");
if (origin.protocol !== "https:" || !origin.hostname.endsWith(".onrender.com") || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("Set RENDER_API_ORIGIN to your HTTPS Render service origin, without paths or credentials.");
}
const path = new URL("../vercel.json", import.meta.url);
const config = JSON.parse(readFileSync(path, "utf8"));
config.rewrites[0].destination = `${origin.origin}/api/:path*`;
writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
console.log("Vercel API rewrite configured.");
