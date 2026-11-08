import { expect, test } from "@playwright/test";

test("Build 201 pilot finding survives refresh and navigation without becoming approval", async ({
  page,
}) => {
  await page.goto("/pilot/acceptance");
  await expect(
    page.getByRole("heading", {
      name: /Finding remediation & real-device retest/i,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Issue or retest ticket reference")
    .fill("issue-playwright-2026-0001");
  await page
    .getByLabel("Observed outcome")
    .selectOption("RETEST_REPORTED_PASS");
  await page.getByRole("button", { name: "Record local finding" }).click();
  await expect(page.getByText("issue-playwright-2026-0001")).toBeVisible();
  await page.reload();
  await expect(page.getByText("issue-playwright-2026-0001")).toBeVisible();
  await page.goto("/integration/comms-hub");
  await expect(
    page.getByRole("heading", {
      name: /Comms Hub connection and legacy diagnostics/i,
    }),
  ).toBeVisible();
  await page.goto("/pilot/acceptance");
  await expect(page.getByText("issue-playwright-2026-0001")).toBeVisible();
  await page
    .getByRole("button", { name: "Copy retest packet for handoff" })
    .click();
  await page.getByText("Inspect exported, unsigned packet").click();
  await expect(
    page.getByText(/"go_live_decision": "NO_GO_PENDING_EVIDENCE"/),
  ).toBeVisible();
  await expect(
    page.getByText(/"independent_signoff": "MISSING"/),
  ).toBeVisible();
});

test("Build 201 I.T. preflight does not disclose a private connection to anonymous requests", async ({
  request,
}) => {
  const response = await request.get("/api/it/comms-hub/handshake-preflight", {
    maxRedirects: 0,
  });
  expect([302, 303, 307, 308, 401, 403]).toContain(response.status());
  expect(response.headers()["cache-control"] || "").not.toContain("public");
});
