const fs = require("node:fs");
const { test, expect } = require("@playwright/test");

const PASSWORD = process.env.STAGING_TEST_PASSWORD || "EmulatorOnly!123";
const EXPECTED_PROJECT_ID = process.env.EXPECTED_FIREBASE_PROJECT_ID || "demo-kilinochchi-rules";
const ACCOUNTS = {
  admin: { email: "admin@app-emulator.test", login: "/login", landing: "/" },
  teacher: { email: "teacher@app-emulator.test", login: "/login", landing: "/teacher" },
  it: { email: "it@app-emulator.test", login: "/login", landing: "/teacher" },
  sectional: { email: "sectional@app-emulator.test", login: "/login", landing: "/sectional-head" },
  account: { email: "account@app-emulator.test", login: "/accounts-login", landing: "/accounts" },
  prefect: { email: "prefect@app-emulator.test", login: "/prefect-login", landing: "/prefect" },
  unknown: { email: "unknown@app-emulator.test", login: "/login", landing: "/login" },
  missingProfile: { email: "missing-profile@app-emulator.test", login: "/login", landing: "/login" },
};

test.beforeEach(async ({ context }) => {
  // Playwright creates a fresh context per test; explicitly clear cookies as a
  // second guard so no authenticated role can cross a suite boundary.
  await context.clearCookies();
});

function monitorSecurityFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/permission-denied|missing or insufficient permissions|failed to load|could not load|firebaseerror/i.test(text)) {
      failures.push(`console: ${text}`);
    }
  });
  return {
    clear() { failures.length = 0; },
    assertClean(context) {
      expect(failures, `${context}: unexpected browser/security errors`).toEqual([]);
    },
  };
}

async function login(page, accountName) {
  const account = ACCOUNTS[accountName];
  await page.goto(account.login);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${account.landing.replaceAll("/", "\\/")}(?:$|\\?)`));
  await expect(page.getByText("Preparing your workspace", { exact: false })).toHaveCount(0);
}

async function visit(page, monitor, path, title) {
  console.log(`[application-emulator] visiting ${path}`);
  monitor.clear();
  await page.goto(path);
  await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Preparing your workspace", { exact: false })).toHaveCount(0);
  await page.waitForTimeout(250);
  const body = await page.locator("body").innerText();
  expect(body, `${path} rendered an application load error`).not.toMatch(
    /Failed to load dashboard data|Could not load .*Check Firestore|Missing or insufficient permissions/i
  );
  monitor.assertClean(path);
  console.log(`[application-emulator] passed ${path}`);
}

test("admin can load every protected administration route under proposed Rules", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "admin");
  const routes = [
    ["/", "Admin Dashboard"],
    ["/classrooms", "Classrooms"],
    ["/subjects", "Subject Management"],
    ["/terms", "Academic Terms"],
    ["/practice-exams", "Practice Exams"],
    ["/setup-school-defaults", "School Setup"],
    ["/students", "Students"],
    ["/students/by-subject", "Students by Subject"],
    ["/students/classwise-list", "Classwise Student List"],
    ["/class-data-management", "Class Data Management"],
    ["/class-shuffle", "Class Shuffle"],
    ["/student-subject-enrollments", "Generate Subject Enrollments"],
    ["/manual-student-subject-enrollments", "Student Subject Enrollments"],
    ["/migrate-student-subjects", "Legacy Subject Fields Cleanup"],
    ["/teachers", "Manage Teachers"],
    ["/assignments", "Teacher Assignments"],
    ["/class-teachers", "Class Teacher Assignments"],
    ["/marks", "Marks Entry"],
    ["/sba", "SBA Assessment Sheets"],
    ["/marks-upload", "Bulk Marks Upload"],
    ["/teacher-mark-sheets", "Teacher Mark Sheets"],
    ["/class-marks-reports", "Class Marks Reports"],
    ["/class-completion-report", "Class Completion Report"],
    ["/text-book-request", "Text Book Request"],
    ["/subject-analysis", "Subject Analysis"],
    ["/report/student-001", "Synthetic Student One"],
    ["/promotion", "Year End Promotion"],
    ["/backup-restore", "Backup & Restore"],
    ["/academic-data-health", "Academic Data Health"],
    ["/election-count", "Election Counting Console"],
    ["/marks-status-live", "Marks Status"],
    ["/election-live", "Students' Parliament Election"],
  ];
  for (const [path, title] of routes) await visit(page, monitor, path, title);
});

test("admin settings and secondary Auth staff creation workflows succeed locally", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "admin");
  await visit(page, monitor, "/", "Admin Dashboard");
  await page.getByRole("button", { name: "Save Access" }).click();
  await expect(page.getByText(/Teacher marks entry is available|Teacher marks entry is locked/)).toBeVisible();
  monitor.assertClean("admin marks-entry setting write");

  await visit(page, monitor, "/teachers", "Manage Teachers");
  await page.getByRole("button", { name: "Add Teacher", exact: true }).first().click();
  await page.getByLabel("Name *").fill("Synthetic Browser Teacher");
  await page.getByLabel("Email Address *").fill("browser-teacher@app-emulator.test");
  await page.getByLabel("Password (min 6 chars) *").fill(PASSWORD);
  await page.getByRole("dialog").getByRole("button", { name: "Add Teacher", exact: true }).click();
  await expect(page.getByText("Synthetic Browser Teacher", { exact: true }).first()).toBeVisible();
  monitor.assertClean("secondary Auth emulator staff creation");
});

test("teacher can load assigned routes and save a canonical mark", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "teacher");
  for (const [path, title] of [
    ["/teacher", "Teacher Dashboard"],
    ["/teacher/marks", "Marks Entry"],
    ["/teacher/sba-marks", "SBA Marks Entry"],
    ["/teacher/class-report", "Class Report"],
    ["/teacher/report/student-001", "Synthetic Student One"],
  ]) await visit(page, monitor, path, title);

  await visit(page, monitor, "/teacher/marks", "Marks Entry");
  // Desktop Marks Entry renders compact table inputs without an associated
  // label element; select the first seeded numeric mark by its current value.
  const markInput = page.locator('input[value="74"]').first();
  await expect(markInput).toBeVisible();
  await markInput.fill("82");
  await page.getByRole("button", { name: "Save Marks" }).click();
  await expect(page.getByText("0 unsaved", { exact: true }).last()).toBeVisible();
  // The table row is replaced after the write; assert against the newly
  // rendered input instead of retaining a detached pre-save locator.
  await expect(page.locator('input[value="82"]').first()).toBeVisible();
  monitor.assertClean("teacher canonical mark save");

  await page.goto("/subjects");
  await expect(page).toHaveURL(/\/teacher$/);
});

test("IT teacher can load actual report routes", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "it");
  for (const [path, title] of [
    ["/teacher", "Teacher Dashboard"],
    ["/teacher-mark-sheets", "Teacher Mark Sheets"],
    ["/class-marks-reports", "Class Marks Reports"],
    ["/class-completion-report", "Class Completion Report"],
    ["/text-book-request", "Text Book Request"],
    ["/subject-analysis", "Subject Analysis"],
  ]) await visit(page, monitor, path, title);
});

test("sectional head can load actual report routes", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "sectional");
  for (const [path, title] of [
    ["/sectional-head", "Sectional Head Dashboard"],
    ["/sectional-head/class-marks-reports", "Class Marks Reports"],
    ["/sectional-head/class-completion-report", "Class Completion Report"],
    ["/sectional-head/subject-analysis", "Subject Analysis"],
    ["/sectional-head/classwise-list", "Classwise Student List"],
  ]) await visit(page, monitor, path, title);
});

test("account user can load the finance route and record a synthetic payment", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "account");
  await visit(page, monitor, "/accounts", "Kilinochchi Accounts Portal");
  await page.getByRole("combobox", { name: "Select Class" }).click();
  await page.getByRole("option", { name: /10.*A|G10-A/i }).first().click();
  const payButton = page.getByRole("button", { name: "Pay Facilities" }).first();
  await expect(payButton).toBeVisible();
  await payButton.click();
  await page.getByLabel("Amount").fill("10");
  await page.getByRole("button", { name: "Save Payment" }).click();
  await expect(page.getByText(/Saved Facilities payment/)).toBeVisible();
  monitor.assertClean("account payment write");

  await page.goto("/marks");
  await expect(page).toHaveURL(/\/accounts$/);
});

test("prefect can record and return a synthetic late-arrival book", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "prefect");
  await visit(page, monitor, "/prefect", "Late Arrival Desk");
  await page.getByRole("tab", { name: "Find student" }).click();
  await page.getByPlaceholder(/Name, index number/).fill("Synthetic Student Two");
  await page.getByRole("button", { name: "Record late arrival" }).first().click();
  // This MUI Select has a visual InputLabel but no accessible-name linkage.
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: "Transport delay" }).click();
  await page.getByRole("button", { name: "Save late record" }).click();
  await expect(page.getByText("Late arrival recorded.")).toBeVisible();
  const newStudentPendingCard = page
    .locator("div")
    .filter({ has: page.getByText("Synthetic Student Two", { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Hand over book" }) })
    .last();
  await newStudentPendingCard.getByRole("button", { name: "Hand over book" }).click();
  await page.getByLabel("I handed this record book to the student").check();
  await page.getByRole("button", { name: "Confirm handover" }).click();
  await expect(page.getByText("Record book handover confirmed.")).toBeVisible();
  monitor.assertClean("prefect create and constrained update");

  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/prefect$/);
});

test("unknown and unauthenticated sessions are rejected by application and Rules", async ({ page }) => {
  await page.goto(ACCOUNTS.unknown.login);
  await page.locator('input[type="email"]').fill(ACCOUNTS.unknown.email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/role is not configured correctly/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  // Missing profile is a distinct fixture from an existing unsupported role.
  await page.locator('input[type="email"]').fill(ACCOUNTS.missingProfile.email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/role is not configured correctly/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto("/marks-status-live");
  await expect(page.getByText(/Could not load marks status|check Firestore read access/i)).toBeVisible();
  await page.goto("/election-live");
  await expect(page.getByText(/Could not connect to the live count/i)).toBeVisible();
});

test("admin completes backup download, validation, upload, and restore through the UI", async ({ page }) => {
  const monitor = monitorSecurityFailures(page);
  await login(page, "admin");
  await visit(page, monitor, "/backup-restore", "Backup & Restore");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create & Download Backup" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const payload = JSON.parse(fs.readFileSync(downloadPath, "utf8"));
  expect(payload.projectId).toBe(EXPECTED_PROJECT_ID);
  expect(Object.keys(payload.collections)).toContain("sbaMarks");
  expect(Object.keys(payload.collections).length).toBeGreaterThanOrEqual(18);
  expect(payload.summary.documentCount).toBeGreaterThan(0);
  await expect(page.getByText(/Backup downloaded successfully/)).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(downloadPath);
  await expect(page.getByText(/Backup checked successfully/i)).toBeVisible();
  await page.getByLabel('Type "RESTORE" to confirm').fill("RESTORE");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore This Backup" }).click();
  await expect(page.getByText(/documents were restored/)).toBeVisible();
  monitor.assertClean("admin backup and restore UI flow");
});
