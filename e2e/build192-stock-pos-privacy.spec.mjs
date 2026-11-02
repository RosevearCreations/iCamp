import { expect, test } from "@playwright/test";

test("Build192 stock and POS register evidence is staff-only and not public checkout", async ({
  page,
}) => {
  await page.goto("/workspaces/management/campgrounds/store/operations");
  await expect(page).toHaveURL(
    /\/auth\/login\?next=%2Fworkspaces%2Fmanagement%2Fcampgrounds%2Fstore%2Foperations/,
  );
  await expect(
    page.getByText("Current stock positions & reorder attention"),
  ).toHaveCount(0);
  await expect(page.getByText("Close and freeze reconciliation")).toHaveCount(
    0,
  );
});
