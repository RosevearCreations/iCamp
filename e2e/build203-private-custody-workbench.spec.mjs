import { expect, test } from "@playwright/test";

test("Build 203 displays owner TEST desk with a hold and does not permit unsigned decisions", async ({
  page,
}) => {
  await page.goto("/pilot/acceptance");
  await expect(
    page.getByRole("heading", {
      name: /Independent custody review & owner TEST authorization desk/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record unverified custody comparison" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Record owner TEST intent (still HOLD)" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: /Nonproduction handshake runbook/ }),
  ).toBeVisible();
});

test("Build 203 private review cannot be read or mutated by unauthenticated guests", async ({
  request,
}) => {
  const responses = [
    await request.get("/api/it/pilot-custody", { maxRedirects: 0 }),
    await request.post("/api/it/pilot-custody", {
      headers: {
        Origin: "https://untrusted.invalid",
        "Content-Type": "application/json",
      },
      data: { action: "OWNER_TEST_INTENT" },
      maxRedirects: 0,
    }),
  ];
  for (const response of responses) {
    expect([302, 303, 307, 308, 401, 403]).toContain(response.status());
    expect(response.headers()["cache-control"] ?? "").not.toContain("public");
  }
});
