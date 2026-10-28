import { test } from "node:test";
import assert from "node:assert/strict";
import proxy from "../proxy.js";

test("unconfigured proxy refuses to forward account requests", () => {
  delete process.env.PROXY_SHARED_SECRET;
  assert.equal(proxy(new Request("https://app.example.com/api/auth/session")).status, 503);
});

test("proxy replaces client-supplied identity headers", () => {
  process.env.PROXY_SHARED_SECRET = "test-shared-secret-with-at-least-32-characters";
  const response = proxy(new Request("https://app.example.com/api/lomas", { headers: {
    "x-real-ip": "1.2.3.4", "x-lomosoma-proxy": "forged", "x-lomosoma-client-ip": "forged",
  } }));
  assert.equal(response.headers.get("x-middleware-request-x-lomosoma-proxy"), process.env.PROXY_SHARED_SECRET);
  assert.equal(response.headers.get("x-middleware-request-x-lomosoma-client-ip"), "1.2.3.4");
  delete process.env.PROXY_SHARED_SECRET;
});
