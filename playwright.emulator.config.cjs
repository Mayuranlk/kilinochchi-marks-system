const { defineConfig } = require("@playwright/test");

const baseURL = "http://127.0.0.1:3100";

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: process.env.PLAYWRIGHT_TEST_MATCH || "application-emulator.spec.cjs",
  grep: process.env.PLAYWRIGHT_GREP ? new RegExp(process.env.PLAYWRIGHT_GREP, "i") : undefined,
  fullyParallel: false,
  workers: 1,
  timeout: Number(process.env.PLAYWRIGHT_TEST_TIMEOUT || 240_000),
  globalTimeout: process.env.PLAYWRIGHT_GLOBAL_TIMEOUT
    ? Number(process.env.PLAYWRIGHT_GLOBAL_TIMEOUT)
    : undefined,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 15_000,
    baseURL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [["line"], ["json", { outputFile: "test-results/application-emulator-results.json" }]],
  outputDir: "test-results/application-emulator-artifacts",
  webServer: {
    command: "node scripts/serveApplicationBuild.cjs",
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_APP_SERVER === "true",
    stdout: "pipe",
    stderr: "pipe",
  },
});
