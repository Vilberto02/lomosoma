import { ipAddress, next } from "@vercel/functions";

// Runs on Vercel only; never imported into the browser bundle.
export default function proxy(request) {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (!secret || secret.length < 32) {
    return new Response("API proxy is not configured", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const headers = new Headers(request.headers);
  // Always replace values supplied by the client before trusting them in FastAPI.
  headers.set("x-lomosoma-proxy", secret);
  headers.set("x-lomosoma-client-ip", ipAddress(request) || "unknown");
  return next({ request: { headers } });
}
