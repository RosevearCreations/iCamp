import { expect, test } from "@playwright/test";

test("Build 195 seasonal outlook is sign-in gated", async ({ page }) => {
  await page.goto(
    "/workspaces/management/command/forecast?horizon=3&planning=high",
  );
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByText("Seasonal occupancy outlook")).toHaveCount(0);
});

test("Build 195 server CSV refuses anonymous export", async ({ request }) => {
  const response = await request.get(
    "/api/management/occupancy-forecast/export?campground=11111111-1111-4111-8111-111111111111&horizon=3&planning=high",
  );
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-type"]).not.toContain("text/csv");
});
