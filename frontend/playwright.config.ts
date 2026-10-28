import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5178", trace: "retain-on-failure" },
  webServer: {
    command: "corepack pnpm dev --host 127.0.0.1 --port 5178 --strictPort",
    url: "http://127.0.0.1:5178", reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"],
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } }],
});
