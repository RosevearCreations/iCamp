(() => {
  "use strict";

  const root = document.getElementById("offline-maintenance-root");
  if (!root || root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  const DB_NAME = "icamp-offline-maintenance-v1";
  const DB_VERSION = 1;
  const META = "meta";
  const SNAPSHOTS = "snapshots";
  const QUEUE = "queue";
  let activeCampgroundId = root.dataset.campgroundId || "";
  let snapshot = null;
  let queue = [];
  let busy = false;
  let message = "";

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
        if (!db.objectStoreNames.contains(SNAPSHOTS)) {
          db.createObjectStore(SNAPSHOTS, { keyPath: "campgroundId" });
        }
        if (!db.objectStoreNames.contains(QUEUE)) {
          db.createObjectStore(QUEUE, { keyPath: "clientOperationId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(name, mode, run) {
    const db = await openDb();
    try {
      const tx = db.transaction(name, mode);
      const result = run(tx.objectStore(name));
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return result;
    } finally {
      db.close();
    }
  }

  async function getMeta(key) {
    const db = await openDb();
    try {
      const tx = db.transaction(META, "readonly");
      return await requestValue(tx.objectStore(META).get(key));
    } finally {
      db.close();
    }
  }

  async function putMeta(key, value) {
    await withStore(META, "readwrite", (store) => store.put(value, key));
  }

  async function getSnapshot(campgroundId) {
    const db = await openDb();
    try {
      const tx = db.transaction(SNAPSHOTS, "readonly");
      return await requestValue(tx.objectStore(SNAPSHOTS).get(campgroundId));
    } finally {
      db.close();
    }
  }

  async function putSnapshot(value) {
    await withStore(SNAPSHOTS, "readwrite", (store) => store.put(value));
  }

  async function allQueue() {
    const db = await openDb();
    try {
      const tx = db.transaction(QUEUE, "readonly");
      return (await requestValue(tx.objectStore(QUEUE).getAll())) || [];
    } finally {
      db.close();
    }
  }

  async function putQueue(value) {
    await withStore(QUEUE, "readwrite", (store) => store.put(value));
  }

  async function deleteQueue(id) {
    await withStore(QUEUE, "readwrite", (store) => store.delete(id));
  }

  async function clearDeviceCache() {
    const db = await openDb();
    try {
      const tx = db.transaction([META, SNAPSHOTS, QUEUE], "readwrite");
      tx.objectStore(META).clear();
      tx.objectStore(SNAPSHOTS).clear();
      tx.objectStore(QUEUE).clear();
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    return String(value == null ? "" : value)
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function formatDate(value) {
    if (!value) return "Not recorded";
    try {
      return new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function queueForCampground() {
    return queue
      .filter((entry) => entry.campgroundId === activeCampgroundId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  function queueLabel(entry) {
    if (entry.operationKind === "work_order_note") return "Work-order note";
    if (entry.operationKind === "inspection_result") return "Checklist answer";
    return "Field media";
  }

  function workOrderCard(order, capabilities) {
    let html =
      '<article class="offline-card">' +
      '<p class="offline-kicker">' +
      escapeHtml(titleCase(order.priorityKey)) +
      " · " +
      escapeHtml(order.categoryName) +
      "</p>" +
      "<h3>" +
      escapeHtml(order.title) +
      "</h3>" +
      '<div class="offline-details">' +
      "<span>Status: <strong>" +
      escapeHtml(titleCase(order.status)) +
      "</strong></span>" +
      "<span>Location: " +
      escapeHtml(order.locationLabel || "Not specified") +
      "</span>" +
      "<span>Completion target: " +
      escapeHtml(formatDate(order.completionDueAt)) +
      "</span>" +
      "<span>Cached row version: " +
      escapeHtml(order.rowVersion) +
      "</span>" +
      "</div>";

    if (order.description) {
      html += "<p>" + escapeHtml(order.description) + "</p>";
    }

    if (capabilities.notes) {
      html +=
        '<form class="offline-form" data-note-form data-work-order-id="' +
        escapeHtml(order.id) +
        '" data-row-version="' +
        escapeHtml(order.rowVersion) +
        '">' +
        "<label>Offline note" +
        '<textarea name="note" maxlength="4000" required placeholder="Record field observations while disconnected"></textarea>' +
        "</label>" +
        '<button class="offline-button" type="submit">Queue note</button>' +
        "</form>";
    } else {
      html +=
        '<p class="offline-muted">Your current role can view this work but cannot add note evidence.</p>';
    }

    if (capabilities.media) {
      html +=
        '<form class="offline-form" data-media-form data-work-order-id="' +
        escapeHtml(order.id) +
        '" data-row-version="' +
        escapeHtml(order.rowVersion) +
        '">' +
        "<label>Field media" +
        '<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" required />' +
        "</label>" +
        "<label>Caption" +
        '<input name="caption" maxlength="500" />' +
        "</label>" +
        '<button class="offline-button" type="submit">Queue media</button>' +
        "</form>";
    } else {
      html +=
        '<p class="offline-muted">Offline media upload is not granted to this role.</p>';
    }

    return html + "</article>";
  }

  function inspectionCard(inspection, capabilities) {
    let items = "";
    for (const item of inspection.items) {
      const current = item.result ? item.result.resultValue : "";
      items +=
        '<form data-inspection-form data-occurrence-id="' +
        escapeHtml(inspection.id) +
        '" data-occurrence-row-version="' +
        escapeHtml(inspection.rowVersion) +
        '" data-item-id="' +
        escapeHtml(item.id) +
        '" data-result-row-version="' +
        escapeHtml(item.result ? item.result.rowVersion : "") +
        '">' +
        "<label>" +
        escapeHtml(item.position) +
        ". " +
        escapeHtml(item.label) +
        '<select name="resultValue" required>' +
        '<option value="" ' +
        (current ? "" : "selected") +
        " disabled>Choose result</option>" +
        '<option value="pass" ' +
        (current === "pass" ? "selected" : "") +
        ">Pass</option>" +
        '<option value="fail" ' +
        (current === "fail" ? "selected" : "") +
        ">Fail</option>" +
        '<option value="not_applicable" ' +
        (current === "not_applicable" ? "selected" : "") +
        ">Not applicable</option>" +
        "</select>" +
        "</label>" +
        "<label>Note" +
        '<textarea name="note" maxlength="2000">' +
        escapeHtml(item.result && item.result.note ? item.result.note : "") +
        "</textarea>" +
        "</label>" +
        '<button class="offline-button" type="submit" ' +
        (capabilities.inspections ? "" : "disabled") +
        ">Queue checklist answer</button>" +
        "</form>";
    }

    return (
      '<article class="offline-card">' +
      '<p class="offline-kicker">Inspection v' +
      escapeHtml(inspection.versionNumber) +
      "</p>" +
      "<h3>" +
      escapeHtml(inspection.templateName) +
      "</h3>" +
      '<p class="offline-muted">' +
      escapeHtml(inspection.targetLabel) +
      " · started " +
      escapeHtml(formatDate(inspection.startedAt)) +
      "</p>" +
      '<div class="offline-checklist">' +
      items +
      "</div>" +
      "</article>"
    );
  }

  function queueItem(entry) {
    return (
      '<article class="offline-queue-item" data-state="' +
      escapeHtml(entry.state) +
      '">' +
      '<span class="offline-state">' +
      escapeHtml(entry.state) +
      "</span>" +
      "<strong>" +
      escapeHtml(queueLabel(entry)) +
      "</strong>" +
      '<span class="offline-muted">' +
      escapeHtml(entry.summary || "") +
      "</span>" +
      (entry.lastError
        ? '<span class="offline-muted">' +
          escapeHtml(entry.lastError) +
          "</span>"
        : "") +
      '<button class="offline-button offline-button--secondary" type="button" data-remove-operation="' +
      escapeHtml(entry.clientOperationId) +
      '">Remove from device queue</button>' +
      "</article>"
    );
  }

  function render() {
    const localQueue = queueForCampground();
    const connection = navigator.onLine ? "Online" : "Offline";
    const campgroundName =
      (snapshot && snapshot.campground && snapshot.campground.name) ||
      root.dataset.campgroundName ||
      "Cached campground";
    const generated =
      snapshot && snapshot.generatedAt
        ? formatDate(snapshot.generatedAt)
        : "No cached snapshot";
    const pending = localQueue.filter((entry) => entry.state === "pending").length;
    const conflicts = localQueue.filter(
      (entry) => entry.state === "conflict" || entry.state === "blocked",
    ).length;
    const workOrders = snapshot ? snapshot.workOrders || [] : [];
    const inspections = snapshot ? snapshot.inspections || [] : [];
    const capabilities =
      snapshot && snapshot.capabilities
        ? snapshot.capabilities
        : { notes: false, inspections: false, media: false };

    const workOrderHtml =
      workOrders.length === 0
        ? '<p class="offline-empty">No assigned work orders are cached for this campground.</p>'
        : '<div class="offline-grid">' +
          workOrders.map((order) => workOrderCard(order, capabilities)).join("") +
          "</div>";
    const inspectionHtml =
      inspections.length === 0
        ? '<p class="offline-empty">No in-progress inspection checklists are cached for you.</p>'
        : inspections
            .map((inspection) => inspectionCard(inspection, capabilities))
            .join("");
    const queueHtml =
      localQueue.length === 0
        ? '<p class="offline-empty">Nothing is waiting to synchronize.</p>'
        : '<div class="offline-queue">' +
          localQueue.map(queueItem).join("") +
          "</div>";

    root.innerHTML =
      '<div class="offline-shell">' +
      '<div class="offline-toolbar">' +
      '<div class="offline-status">' +
      "<strong>" +
      escapeHtml(campgroundName) +
      " · " +
      connection +
      "</strong>" +
      '<span class="offline-muted">Cached snapshot: ' +
      escapeHtml(generated) +
      "</span>" +
      "</div>" +
      '<div class="offline-actions">' +
      '<button class="offline-button" type="button" data-sync ' +
      (busy || !navigator.onLine ? "disabled" : "") +
      ">Sync queued evidence</button>" +
      '<button class="offline-button offline-button--secondary" type="button" data-refresh ' +
      (busy || !navigator.onLine ? "disabled" : "") +
      ">Refresh assigned work</button>" +
      '<button class="offline-button offline-button--secondary" type="button" data-clear ' +
      (busy ? "disabled" : "") +
      ">Clear device cache</button>" +
      "</div>" +
      "</div>" +
      (message
        ? '<p class="offline-message' +
          (message.startsWith("Error:")
            ? " offline-message--error"
            : "") +
          '" role="status">' +
          escapeHtml(message) +
          "</p>"
        : "") +
      '<div class="offline-summary">' +
      "<div><strong>" +
      workOrders.length +
      "</strong><span>Assigned work orders</span></div>" +
      "<div><strong>" +
      inspections.length +
      "</strong><span>In-progress inspections</span></div>" +
      "<div><strong>" +
      pending +
      "</strong><span>Pending sync</span></div>" +
      "<div><strong>" +
      conflicts +
      "</strong><span>Conflicts / blocked</span></div>" +
      "</div>" +
      "<section><h3>Assigned maintenance work</h3>" +
      workOrderHtml +
      "</section>" +
      "<section><h3>Offline checklists</h3>" +
      inspectionHtml +
      "</section>" +
      "<section><h3>Device sync queue</h3>" +
      queueHtml +
      "</section>" +
      "</div>";
  }

  async function loadLocal() {
    if (!activeCampgroundId) {
      activeCampgroundId = (await getMeta("lastCampgroundId")) || "";
    }
    if (activeCampgroundId) {
      snapshot = await getSnapshot(activeCampgroundId);
    }
    queue = await allQueue();
    render();
  }

  async function refreshSnapshot() {
    if (!navigator.onLine || !activeCampgroundId || busy) return;
    busy = true;
    message = "Refreshing assigned work from the server…";
    render();
    try {
      const response = await fetch(
        "/api/maintenance/offline/snapshot?campground=" +
          encodeURIComponent(activeCampgroundId),
        { cache: "no-store", credentials: "same-origin" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Snapshot refresh failed.");
      }
      snapshot = Object.assign({}, payload.snapshot, {
        campgroundId: activeCampgroundId,
      });
      await putSnapshot(snapshot);
      await putMeta("lastCampgroundId", activeCampgroundId);
      message = "Assigned work cache refreshed.";
    } catch (error) {
      message =
        "Error: " +
        (error instanceof Error ? error.message : "Snapshot refresh failed.");
    } finally {
      busy = false;
      queue = await allQueue();
      render();
    }
  }

  async function queueNote(form) {
    const data = new FormData(form);
    const note = String(data.get("note") || "").trim();
    if (!note) return;
    const entry = {
      clientOperationId: crypto.randomUUID(),
      campgroundId: activeCampgroundId,
      operationKind: "work_order_note",
      targetId: form.dataset.workOrderId,
      expectedWorkOrderRowVersion: Number(form.dataset.rowVersion),
      note,
      state: "pending",
      summary: note.slice(0, 120),
      createdAt: new Date().toISOString(),
    };
    await putQueue(entry);
    queue = await allQueue();
    message = navigator.onLine
      ? "Note queued. Use Sync queued evidence to apply it."
      : "Note saved on this device for later synchronization.";
    render();
  }

  async function queueInspection(form) {
    const data = new FormData(form);
    const occurrenceId = form.dataset.occurrenceId;
    const templateItemId = form.dataset.itemId;
    const existingQueue = await allQueue();
    for (const entry of existingQueue) {
      if (
        entry.campgroundId === activeCampgroundId &&
        entry.operationKind === "inspection_result" &&
        entry.targetId === occurrenceId &&
        entry.templateItemId === templateItemId
      ) {
        await deleteQueue(entry.clientOperationId);
      }
    }

    const resultRowVersion = form.dataset.resultRowVersion;
    const entry = {
      clientOperationId: crypto.randomUUID(),
      campgroundId: activeCampgroundId,
      operationKind: "inspection_result",
      targetId: occurrenceId,
      templateItemId,
      expectedOccurrenceRowVersion: Number(form.dataset.occurrenceRowVersion),
      expectedResultRowVersion: resultRowVersion
        ? Number(resultRowVersion)
        : null,
      resultValue: String(data.get("resultValue") || ""),
      note: String(data.get("note") || "").trim() || null,
      state: "pending",
      summary: "Checklist: " + String(data.get("resultValue") || ""),
      createdAt: new Date().toISOString(),
    };
    await putQueue(entry);
    queue = await allQueue();
    message = navigator.onLine
      ? "Checklist answer queued. Sync when ready."
      : "Checklist answer saved on this device.";
    render();
  }

  async function queueMedia(form) {
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size < 1) return;
    const entry = {
      clientOperationId: crypto.randomUUID(),
      campgroundId: activeCampgroundId,
      operationKind: "work_order_media",
      targetId: form.dataset.workOrderId,
      expectedWorkOrderRowVersion: Number(form.dataset.rowVersion),
      caption: String(data.get("caption") || "").trim() || null,
      file,
      fileName: file.name,
      fileType: file.type,
      state: "pending",
      summary: file.name + " · " + Math.ceil(file.size / 1024) + " KiB",
      createdAt: new Date().toISOString(),
    };
    await putQueue(entry);
    queue = await allQueue();
    message = navigator.onLine
      ? "Media queued. Sync sends it through secure internal-media validation."
      : "Media stored on this device until connectivity returns.";
    render();
  }

  async function syncEntry(entry) {
    let response;
    if (entry.operationKind === "work_order_media") {
      const formData = new FormData();
      formData.set("campgroundId", entry.campgroundId);
      formData.set("clientOperationId", entry.clientOperationId);
      formData.set("workOrderId", entry.targetId);
      formData.set(
        "expectedWorkOrderRowVersion",
        String(entry.expectedWorkOrderRowVersion),
      );
      if (entry.caption) formData.set("caption", entry.caption);
      const file =
        entry.file instanceof File
          ? entry.file
          : new File([entry.file], entry.fileName || "offline-evidence.bin", {
              type: entry.fileType || "application/octet-stream",
            });
      formData.set("file", file);
      response = await fetch("/api/maintenance/offline/media", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
    } else {
      const payload = Object.assign({}, entry);
      delete payload.state;
      delete payload.summary;
      delete payload.createdAt;
      delete payload.lastError;
      response = await fetch("/api/maintenance/offline/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
    }

    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      await deleteQueue(entry.clientOperationId);
      return;
    }

    entry.state =
      response.status === 409
        ? "conflict"
        : response.status === 401 || response.status === 403
          ? "blocked"
          : "pending";
    entry.lastError =
      body.error ||
      (response.status === 409
        ? "Server data changed after this evidence was cached."
        : "Synchronization failed.");
    await putQueue(entry);
  }

  async function syncQueue() {
    if (!navigator.onLine || busy) return;
    busy = true;
    message = "Synchronizing queued evidence…";
    render();
    try {
      const entries = queueForCampground().filter(
        (entry) => entry.state === "pending",
      );
      for (const entry of entries) {
        await syncEntry(entry);
      }
      queue = await allQueue();
      const unresolved = queueForCampground().filter(
        (entry) => entry.state !== "pending",
      ).length;
      message =
        unresolved > 0
          ? "Synchronization finished with conflicts or blocked evidence that requires review."
          : "Queued evidence synchronized.";
    } catch (error) {
      message =
        "Error: " +
        (error instanceof Error ? error.message : "Synchronization failed.");
    } finally {
      busy = false;
      queue = await allQueue();
      render();
    }

    if (navigator.onLine) {
      await refreshSnapshot();
    }
  }

  root.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.matches("[data-note-form]")) {
      event.preventDefault();
      void queueNote(form);
    } else if (form.matches("[data-inspection-form]")) {
      event.preventDefault();
      void queueInspection(form);
    } else if (form.matches("[data-media-form]")) {
      event.preventDefault();
      void queueMedia(form);
    }
  });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest("[data-sync]")) {
      void syncQueue();
      return;
    }
    if (target.closest("[data-refresh]")) {
      void refreshSnapshot();
      return;
    }
    if (target.closest("[data-clear]")) {
      void (async () => {
        await clearDeviceCache();
        snapshot = null;
        queue = [];
        activeCampgroundId = root.dataset.campgroundId || "";
        message = "Device-local maintenance cache cleared.";
        render();
        if (navigator.onLine && activeCampgroundId) {
          await refreshSnapshot();
        }
      })();
      return;
    }

    const remove = target.closest("[data-remove-operation]");
    if (remove) {
      const id = remove.getAttribute("data-remove-operation");
      if (id) {
        void (async () => {
          await deleteQueue(id);
          queue = await allQueue();
          message = "Queued device evidence removed.";
          render();
        })();
      }
    }
  });

  window.addEventListener("online", () => {
    message = "Connection restored. Synchronizing pending evidence…";
    render();
    void syncQueue();
  });

  window.addEventListener("offline", () => {
    message = "Connection lost. New evidence will stay on this device.";
    render();
  });

  void (async () => {
    await loadLocal();
    if (navigator.onLine && activeCampgroundId) {
      await refreshSnapshot();
    }
  })();
})();
