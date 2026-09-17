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

test("admin Color Mark Schedule reuses class-report data for colored PDF and Excel", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@app-emulator.test");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/class-marks-reports");
  await expect(page.getByRole("heading", { name: "Class Marks Reports" })).toBeVisible();
  await page.getByRole("button", { name: "Color Mark Schedule", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Color Mark Schedule/i })
  ).toBeVisible();

  const colorPdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Color PDF", exact: true }).click();
  const colorPdfDownload = await colorPdfDownloadPromise;
  expect(colorPdfDownload.suggestedFilename()).toMatch(/Color_Marks_Report\.pdf$/);

  const colorExcelDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Color Excel", exact: true }).click();
  const colorExcelDownload = await colorExcelDownloadPromise;
  expect(colorExcelDownload.suggestedFilename()).toMatch(/Color_Marks_Report\.xlsx$/);
  const colorWorkbook = XLSX.readFile(await colorExcelDownload.path(), { cellStyles: true });
  expect(colorWorkbook.SheetNames).toEqual(
    expect.arrayContaining(["Color Mark Schedule", "Mark Analysis"])
  );
  const colorScheduleSheet = colorWorkbook.Sheets["Color Mark Schedule"];
  const serializedFillColors = Object.values(colorScheduleSheet)
    .filter((cell) => cell && typeof cell === "object" && cell.s?.fgColor?.rgb)
    .map((cell) => cell.s.fgColor.rgb);
  expect(serializedFillColors.length).toBeGreaterThan(0);

  expect(browserErrors).toEqual([]);
});

test("admin Text Book Request exports cached enrollment counts to PDF and Excel", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@app-emulator.test");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/text-book-request");
  await expect(page.getByRole("heading", { name: "Text Book Request", exact: true })).toBeVisible();
  await expect(page.getByText("Total Students").first()).toBeVisible();

  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const pdfPath = await (await pdfPromise).path();
  expect(fs.readFileSync(pdfPath).subarray(0, 4).toString("ascii")).toBe("%PDF");

  const excelPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  const excelPath = await (await excelPromise).path();
  const workbook = XLSX.readFile(excelPath);
  expect(workbook.SheetNames).toEqual([
    "Summary",
    "Subject Requirements",
    "Division Breakdown",
  ]);
  expect(browserErrors).toEqual([]);
});
