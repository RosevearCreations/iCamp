import { expect, test } from "@playwright/test";

test("Build 196 financial close requires staff authentication", async ({
  page,
}) => {
  await page.goto("/workspaces/management/command/finance-close");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(
    page.getByText("Financial exception review & daily close"),
  ).toHaveCount(0);
});

test("Build 196 financial export cannot be requested anonymously", async ({
  request,
}) => {
  const response = await request.get(
    "/api/management/finance-close/export?campground=11111111-1111-4111-8111-111111111111&day=2026-11-03",
  );
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-type"]).not.toContain("text/csv");
});
