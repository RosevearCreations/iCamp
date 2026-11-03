import { expect, test } from "@playwright/test";

test("Build194 saved layouts and source drilldowns remain staff-only for anonymous users", async ({page}) => {
  await page.goto("/workspaces/management/command?view=arbitrary&campground=arbitrary");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fworkspaces%2Fmanagement%2Fcommand/);
  await expect(page.getByText("My Operations Command")).toHaveCount(0);
  await expect(page.getByText("Save or update a layout")).toHaveCount(0);
});
test("Build194 main command route remains sign-in gated even after a saved view reset", async ({page}) => {
  await page.goto("/workspaces/management/command?view=reset");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole("heading",{name:"Campground Operations Command"})).toHaveCount(0);
});
