import { defineConfig } from "@playwright/test";

// Journey tests run against a RUNNING app (the real engine + DeepSeek), not a mock.
// Set JOURNEY_BASE_URL to a deployed URL to gate prod; defaults to local dev.
const baseURL = process.env.JOURNEY_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/journeys",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  // Use the full chromium build (channel: "chromium") rather than the default
  // headless_shell, so the suite runs with whichever chromium is installed.
  projects: [{ name: "chromium", use: { channel: "chromium" } }],
});
