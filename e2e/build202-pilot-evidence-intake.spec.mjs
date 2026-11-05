import { expect, test } from "@playwright/test";

test("Build 202 displays unverified source intake alongside prior pilot retest", async ({
  page,
}) => {
  await page.goto("/pilot/acceptance");
  await expect(
    page.getByRole("heading", {
      name: /Independent pilot evidence intake & peer enrollment review/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("DISCONNECTED / HOLD")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit unverified evidence claim" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", {
      name: /Finding remediation & real-device retest/i,
    }),
  ).toBeVisible();
});

test("Build 202 private GET/POST evidence API denies anonymous review and state mutations", async ({
  request,
}) => {
  for (const response of [
    await request.get("/api/it/pilot-evidence", { maxRedirects: 0 }),
    await request.post("/api/it/pilot-evidence", {
      headers: {
        Origin: "https://unauthorized.example",
        "Content-Type": "application/json",
      },
      data: { campgroundId: "12345678-1234-4234-8234-123456789abc" },
      maxRedirects: 0,
    }),
  ]) {
    expect([302, 303, 307, 308, 401, 403]).toContain(response.status());
    expect(response.headers()["cache-control"] || "").not.toContain("public");
  }
});
