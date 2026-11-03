import { expect, test } from "@playwright/test";

test("Build197 guest privacy page requires sign-in", async ({ page }) => {
  await page.goto("/guest/privacy");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("Build197 staff privacy review requires authentication", async ({
  page,
}) => {
  await page.goto("/workspaces/management/campgrounds/privacy");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("Build197 private guest export denies anonymous and never caches data", async ({
  request,
}) => {
  const response = await request.get(
    "/api/guest/privacy/export?campground=11111111-1111-4111-8111-111111111111",
  );
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-disposition"]).toBeUndefined();
});
