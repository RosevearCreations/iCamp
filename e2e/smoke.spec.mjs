import { expect, test } from "@playwright/test";

test.describe("Build 016 browser end-to-end harness", () => {
  test("public shell renders and exposes the non-production demo entry point", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "More fresh air. Less admin.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open demo campground" }),
    ).toBeVisible();
  });

  test("Standard meadow theme and the HELD subscription dashboard render", async ({
    page,
  }) => {
    const response = await page.goto("/launch/subscriptions");
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", {
        name: "Subscription & connection readiness",
      }),
    ).toBeVisible();
    await expect(page.getByText("DISCONNECTED / HOLD")).toBeVisible();
    await expect(
      page.getByRole("progressbar", {
        name: "Owner-reported reviewed checkpoints",
      }),
    ).toHaveAttribute("aria-valuenow", "0");
    await expect(
      page.getByText("Tenant subscription lifecycle replay"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Start local review preview" })
      .click();
    await page.getByRole("button", { name: "Preview submit" }).click();
    await page.getByRole("button", { name: "Preview review" }).click();
    await page.getByRole("button", { name: "Preview approve" }).click();
    await expect(page.getByText(/Real approval remains HELD/)).toBeVisible();
    await expect(page.getByText("HELD · No binding decisions")).toBeVisible();
  });

  test("synthetic demo campground renders the fixture catalogue", async ({
    page,
  }) => {
    const response = await page.goto("/demo");

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Pine Shore Demo Campground" }),
    ).toBeVisible();
    await expect(page.getByText("6 demo sites")).toBeVisible();
    await expect(page.getByText("3 demo cottages")).toBeVisible();
    await expect(page.getByText("6 demo assets")).toBeVisible();
  });

  test("public system status remains healthy and client-safe", async ({
    page,
  }) => {
    const response = await page.goto("/status");

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "iCamp system status" }),
    ).toBeVisible();
    await expect(page.getByText("Internal diagnostics")).toBeVisible();
  });

  test("authentication and public workspace routes remain reachable", async ({
    page,
  }) => {
    let response = await page.goto("/auth/login");
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading").first()).toBeVisible();

    response = await page.goto("/workspaces/public");
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
