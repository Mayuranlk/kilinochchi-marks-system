const { test, expect } = require("@playwright/test");

const PASSWORD = "EmulatorOnly!123";

async function timed(label, action, metrics) {
  const startedAt = Date.now();
  await action();
  metrics[label] = Date.now() - startedAt;
}

test("measure scaled startup, navigation, filtering, and report rendering", async ({ page }) => {
  await page.addInitScript(() => {
    window.__KCC_LONG_TASKS__ = [];
    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            window.__KCC_LONG_TASKS__.push({ startTime: entry.startTime, duration: entry.duration });
          });
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // Long Task API availability varies by browser build.
      }
    }
  });

  const metrics = {};
  await timed("authenticatedShellMs", async () => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@app-emulator.test");
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    await expect(page.getByText("Preparing your workspace", { exact: false })).toHaveCount(0);
  }, metrics);

  await timed("studentsNavigationMs", async () => {
    await page.getByRole("button", { name: "Students", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
    await expect(page.getByLabel("Loading content")).toHaveCount(0);
    await expect(page.locator("tbody tr").first()).toBeVisible();
  }, metrics);

  metrics.studentsTableRows = await page.locator("tbody tr").count();
  metrics.studentsDomNodes = await page.evaluate(() => document.getElementsByTagName("*").length);
  await page.locator("tbody tr").first().getByRole("button").first().click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible();
  await timed("studentDialogInputMs", async () => {
    const nameInput = editDialog.getByRole("textbox").first();
    const currentName = await nameInput.inputValue();
    await nameInput.fill(`${currentName} Test`);
    await expect(nameInput).toHaveValue(`${currentName} Test`);
  }, metrics);
  await page.keyboard.press("Escape");
  await expect(editDialog).toHaveCount(0);
  await timed("studentSearchMs", async () => {
    await page.getByPlaceholder("Search name, adm no, EMIS ID, religion, stream").fill("Performance Student 0500");
    await expect(page.locator("tbody tr")).toHaveCount(1);
  }, metrics);
  console.log(`KCC_REACT_PERFORMANCE_INTERMEDIATE ${JSON.stringify(metrics)}`);

  await timed("subjectAnalysisNavigationMs", async () => {
    await page.getByRole("button", { name: /Subject Analysis/ }).first().click();
    await expect(page.getByRole("heading", { name: "Subject Analysis", exact: true })).toBeVisible();
    await expect(page.getByLabel("Loading content")).toHaveCount(0);
    await expect(page.getByText("Preparing your workspace", { exact: false })).toHaveCount(0);
  }, metrics);

  Object.assign(metrics, await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const scriptResources = resources.filter((entry) => entry.initiatorType === "script");
    const longTasks = window.__KCC_LONG_TASKS__ || [];
    return {
      domNodes: document.getElementsByTagName("*").length,
      loadedScriptCount: scriptResources.length,
      loadedScriptTransferBytes: scriptResources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      longTaskCount: longTasks.length,
      longTaskTotalMs: Math.round(longTasks.reduce((sum, entry) => sum + entry.duration, 0)),
      jsHeapBytes: performance.memory?.usedJSHeapSize || null,
    };
  }));

  console.log(`KCC_REACT_PERFORMANCE ${JSON.stringify(metrics)}`);
  expect(metrics.studentsTableRows).toBe(50);
});
