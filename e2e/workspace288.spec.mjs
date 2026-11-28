import { expect, test } from "@playwright/test";

test("Build 288 administrator, campground and guest entry are distinct", async ({ page }) => {
  await page.goto("/auth/login?next=%2Fsysop");
  await expect(page.getByRole("heading", { name: "Platform administrator sign-in" })).toBeVisible();
  await expect(page.locator('[data-shell="platform-access"]')).toHaveAttribute("data-visual", "orbit");
  await page.goto("/auth/login?next=%2Fcampground");
  await expect(page.getByRole("heading", { name: "Campground owner or staff sign-in" })).toBeVisible();
  await expect(page.getByPlaceholder("CampRosevear")).toBeVisible();
  await page.goto("/auth/login?next=%2Fguest%2Fhub");
  await expect(page.getByRole("heading", { name: "Camper / guest sign-in" })).toBeVisible();
  await expect(page.getByPlaceholder("SampleCamper")).toBeVisible();
});

test("Build 288 protected workspace URLs require login", async ({ page }) => {
  await page.goto("/sysop");
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.goto("/campground");
  await expect(page).toHaveURL(/\/auth\/login/);
});
