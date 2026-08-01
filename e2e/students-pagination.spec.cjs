const { test, expect } = require("@playwright/test");
const XLSX = require("xlsx");

const PASSWORD = "EmulatorOnly!123";

async function signInAsAdmin(page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@app-emulator.test");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function openStudents(page) {
  await page.goto("/students");
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
  await expect(page.getByLabel("Loading content")).toHaveCount(0);
}

test("desktop pagination preserves full-data export, global numbering, search, keyboard use, and dialog focus", async ({ page }) => {
  await signInAsAdmin(page);
  await openStudents(page);

  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.getByText("1–50 of 500 students", { exact: true })).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator("tbody tr")).toHaveCount(500);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("tbody tr")).toHaveCount(50);

  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Identity Fix Export", { exact: true }).click();
  const download = await downloadPromise;
  const workbook = XLSX.readFile(await download.path());
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const exportedRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  expect(exportedRows).toHaveLength(501);

  const nextPage = page.getByRole("button", { name: "Go to next students page" });
  await nextPage.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("51–100 of 500 students", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr").first().locator("td").first()).toHaveText("51");
  await expect(nextPage).toBeFocused();

  const editButton = page.locator("tbody tr").first().getByRole("button").first();
  await editButton.focus();
  await editButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(editButton).toBeFocused();

  await page.getByPlaceholder("Search name, adm no, EMIS ID, religion, stream").fill("Performance Student 0500");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("Performance Student 0500", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Showing students 1 to 1 of 1 filtered results");
});

test("mobile cards use the same complete client-side pagination and restore edit focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsAdmin(page);
  await openStudents(page);

  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(50);
  await expect(page.getByText("1–50 of 500 students", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Go to next students page" }).click();
  await expect(page.getByText("51–100 of 500 students", { exact: true })).toBeVisible();

  const editButton = page.getByRole("button", { name: "Edit" }).first();
  await editButton.focus();
  await editButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(editButton).toBeFocused();
});
