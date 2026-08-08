const fs = require("node:fs");
const { test, expect } = require("@playwright/test");
const XLSX = require("xlsx");

const PASSWORD = "EmulatorOnly!123";

test("teacher class-marks PDF and Excel exports produce valid downloads", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("teacher@app-emulator.test");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole("heading", { name: "Teacher Dashboard" })).toBeVisible();

  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const pdfPath = await (await pdfDownloadPromise).path();
  expect(pdfPath).toBeTruthy();
  expect(fs.readFileSync(pdfPath).subarray(0, 4).toString("ascii")).toBe("%PDF");

  const excelDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  const excelPath = await (await excelDownloadPromise).path();
  expect(excelPath).toBeTruthy();
  const workbook = XLSX.readFile(excelPath);
  expect(workbook.SheetNames).toEqual(expect.arrayContaining(["Mark Schedule", "Mark Analysis"]));

  expect(browserErrors).toEqual([]);
});
