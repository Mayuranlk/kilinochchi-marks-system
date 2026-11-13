const fs = require("node:fs");
const { test, expect } = require("@playwright/test");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

test("measure complete teacher SBA read path with unrelated legacy enrollments", async ({ page }) => {
  test.setTimeout(240000);
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8085" || process.env.GCLOUD_PROJECT !== "demo-kilinochchi-rules") throw new Error("Local demo emulator required");
  const db = getFirestore(initializeApp({ projectId: "demo-kilinochchi-rules" }, "read-audit"));
  for (const student of ["student-001", "student-002"]) {
    await db.collection("sbaMarks").doc(`term-2026-1~${student}~subject-mathematics`).delete();
  }
  // These synthetic rows intentionally share a subject, not the selected class/year.
  for (let offset = 0; offset < 2000; offset += 400) {
    const batch = db.batch();
    for (let i = offset; i < offset + 400; i++) batch.set(db.collection("studentSubjectEnrollments").doc(`read-audit-${i}`), {
      studentId: `unrelated-${i}`, subjectId: "subject-mathematics", academicYear: i < 1000 ? "2026" : "2025",
      grade: 11, section: "Z", fullClassName: "11Z", status: "active",
    });
    await batch.commit();
  }
  const results = [];
  let batchGetDocuments = 0;
  page.on("request", (request) => {
    if (request.url().includes("127.0.0.1:8085") && request.url().includes(":batchGet")) {
      try { batchGetDocuments += request.postDataJSON().documents.length; } catch {}
    }
  });
  const sample = async (step) => {
    const events = await page.evaluate(() => window.getFirestoreReadDiagnostics?.() || []);
    results.push({ step, events, returnedDocuments: events.reduce((sum, event) => sum + event.documents, 0), batchGetDocuments });
    fs.mkdirSync("audit-output/sba-deep-scan", { recursive: true });
    fs.writeFileSync("audit-output/sba-deep-scan/read-path.json", JSON.stringify(results, null, 2));
  };
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("teacher@app-emulator.test");
  await page.locator('input[type="password"]').fill("EmulatorOnly!123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("button", { name: "Load term statistics" })).toBeVisible();
  await sample("teacher-dashboard");
  expect(results.at(-1).events.some((e) => /^(marks|studentSubjectEnrollments):/.test(e.query))).toBe(false);
  // SPA route changes preserve the same session cache, just like navigation links.
  async function navigate(path) { await page.evaluate((path) => { window.history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }, path); }
  await navigate("/teacher/sba-marks");
  const first = page.getByRole("textbox", { name: "SBA mark for Synthetic Student One", exact: true });
  await expect(first).toBeEnabled();
  await sample("sba-open");
  const openReads = results.at(-1).returnedDocuments;
  expect(openReads).toBeLessThan(200);
  await expect(page.getByRole("button", { name: "A3 class register" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Blank assessment sheet" })).toHaveCount(0);
  await first.fill("18");
  await page.getByRole("textbox", { name: "SBA mark for Synthetic Student Two", exact: true }).fill("15");
  await sample("sba-type");
  expect(results.at(-1).returnedDocuments).toBe(openReads);
  const beforeSaveBatchGet = batchGetDocuments;
  await page.getByRole("button", { name: "Save SBA marks", exact: true }).click();
  await expect(page.getByText("2 SBA record(s) saved.", { exact: true })).toBeVisible();
  await sample("sba-save-two");
  expect(results.at(-1).returnedDocuments).toBe(openReads);
  expect(batchGetDocuments - beforeSaveBatchGet).toBe(4);
  await navigate("/teacher/sba-register");
  await expect(page).toHaveURL(/\/teacher\/sba-marks$/);
  await expect(first).toHaveValue("18");
  await sample("admin-register-route-redirected");
  const beforeRefresh = results.at(-1).returnedDocuments;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(first).toBeEnabled();
  await sample("sba-refresh");
  expect(results.at(-1).returnedDocuments - beforeRefresh).toBeLessThan(200);
  await navigate("/teacher/sba");
  await expect(page).toHaveURL(/\/teacher\/sba-marks$/);
  await expect(first).toHaveValue("18");
  await sample("admin-blank-route-redirected");
  await page.reload();
  await expect(first).toHaveValue("18");
  await sample("sba-cold-reload");
  expect(results.at(-1).returnedDocuments).toBeLessThan(200);
  fs.mkdirSync("audit-output/sba-deep-scan", { recursive: true });
  fs.writeFileSync("audit-output/sba-deep-scan/read-path.json", JSON.stringify(results, null, 2));
});
