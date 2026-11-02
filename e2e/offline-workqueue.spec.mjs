import { expect, test } from "@playwright/test";

test("Build189 device-local filters, draft recovery and safe queued notes", async ({
  page,
}) => {
  await page.goto("/offline-maintenance.html");
  await page.evaluate(async () => {
    const campgroundId = "a0000000-0000-4000-8000-000000000189";
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("icamp-offline-maintenance-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction(["meta", "snapshots"], "readwrite");
    tx.objectStore("meta").put(campgroundId, "lastCampgroundId");
    tx.objectStore("snapshots").put({
      campgroundId,
      campground: { id: campgroundId, name: "Offline test property" },
      generatedAt: new Date().toISOString(),
      capabilities: { notes: true, inspections: false, media: false },
      workOrders: [
        {
          id: "b0000000-0000-4000-8000-000000000189",
          title: "Repair washout",
          priorityKey: "urgent",
          categoryName: "Grounds",
          status: "assigned",
          rowVersion: 4,
          locationLabel: "North lane",
          notes: [],
        },
        {
          id: "c0000000-0000-4000-8000-000000000189",
          title: "Paint utility marker",
          priorityKey: "normal",
          categoryName: "Grounds",
          status: "assigned",
          rowVersion: 2,
          locationLabel: "South lane",
          notes: [],
        },
      ],
      inspections: [],
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    database.close();
  });
  await page.reload();
  await expect(page.getByText("Offline test property")).toBeVisible();
  await page.locator("[data-filter-priority]").selectOption("urgent");
  await expect(page.locator(".offline-card")).toHaveCount(1);
  const note = page.locator("[data-note-form] textarea");
  await note.fill("The north lane washout needs gravel and a drainage review.");
  await page.reload();
  await expect(page.locator("[data-note-form] textarea").first()).toHaveValue(
    "The north lane washout needs gravel and a drainage review.",
  );
  await page.locator("[data-note-form] button[type=submit]").first().click();
  await expect(page.locator(".offline-queue-item")).toHaveCount(1);
  await expect(page.getByText("Pending sync")).toBeVisible();
  await expect(page.locator("[data-note-form] textarea").first()).toHaveValue(
    "",
  );
  await expect(page.locator("[data-complete-work-order]")).toHaveCount(0);
});
