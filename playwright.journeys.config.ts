import { defineConfig } from "@playwright/test";

// Journey tests run against a RUNNING app (the real engine + DeepSeek), not a mock.
// Set JOURNEY_BASE_URL to a deployed URL to gate prod; defaults to local dev.
const baseURL = process.env.JOURNEY_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/journeys",
  // Each test does a real LLM round-trip (route → retrieve → grounded generation).
  // A cold-start / high-latency round-trip in the serial suite can exceed 90s, which
  // once timed out F-C (correct 5/5 via API, ~5.5s in isolation). Give a generous
  // per-test budget so latency alone never reds the suite.
  timeout: 180_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  // A transient LLM latency / cold-start timeout is a CI-reliability flake, not a
  // content defect — retry it a bounded number of times so the suite is reliably
  // green on the public client repo. A real content failure fails all attempts.
  retries: 2,
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
