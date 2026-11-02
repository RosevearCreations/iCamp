import { expect, test } from "@playwright/test";

test("Build191 private vendor workboard redirects unsigned visitors and exposes no supplier contacts", async ({
  page,
}) => {
  await page.goto("/workspaces/management/campgrounds/vendors");
  await expect(page).toHaveURL(
    /\/auth\/login\?next=%2Fworkspaces%2Fmanagement%2Fcampgrounds%2Fvendors/,
  );
  await expect(
    page.getByText("Vendor service requests, contracts & SLA follow-up"),
  ).toHaveCount(0);
});
