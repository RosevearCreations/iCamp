(() => {
  "use strict";

  const root = document.getElementById("offline-maintenance-root");
  if (!root || root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  if (!document.querySelector('link[href="/offline-maintenance.css"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/offline-maintenance.css";
    document.head.append(stylesheet);
  }

  const DB_NAME = "icamp-offline-maintenance-v1";
  const DB_VERSION = 2;
  const META = "meta";
  const SNAPSHOTS = "snapshots";
  const QUEUE = "queue";
  const DRAFTS = "drafts";
  let activeCampgroundId = root.dataset.campgroundId || "";
  let snapshot = null;
  let queue = [];
  let drafts = {};
  let audit = null;
  let filter = { priority: "all", status: "all", text: "" };
  let lockedForDifferentUser = false;
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
        if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS);
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

  async function loadDrafts() {
    const db = await openDb();
    try {
      const tx = db.transaction(DRAFTS, "readonly");
      const store = tx.objectStore(DRAFTS);
      const [keys, values] = await Promise.all([
        requestValue(store.getAllKeys()),
        requestValue(store.getAll()),
      ]);
      return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
    } finally {
      db.close();
    }
  }

  async function putDraft(key, value) {
    drafts[key] = value;
    await withStore(DRAFTS, "readwrite", (store) => store.put(value, key));
  }

  async function deleteDraft(key) {
    delete drafts[key];
    await withStore(DRAFTS, "readwrite", (store) => store.delete(key));
  }

  function draftKey(form) {
    if (form.matches("[data-note-form]"))
      return "note:" + activeCampgroundId + ":" + form.dataset.workOrderId;
    if (form.matches("[data-inspection-form]"))
      return (
        "inspection:" +
        activeCampgroundId +
        ":" +
        form.dataset.occurrenceId +
        ":" +
        form.dataset.itemId
      );
    return "";
  }

  async function clearDeviceCache() {
    const db = await openDb();
    try {
      const tx = db.transaction([META, SNAPSHOTS, QUEUE, DRAFTS], "readwrite");
      tx.objectStore(META).clear();
      tx.objectStore(SNAPSHOTS).clear();
      tx.objectStore(QUEUE).clear();
      tx.objectStore(DRAFTS).clear();
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

  function draftCount() {
    return Object.keys(drafts).filter((key) =>
      key.includes(":" + activeCampgroundId + ":"),
    ).length;
  }

  function currentTarget(entry) {
    if (!snapshot) return null;
    if (entry.operationKind === "inspection_result") {
      const occurrence = (snapshot.inspections || []).find(
        (item) => item.id === entry.targetId,
      );
      if (!occurrence || occurrence.status !== "in_progress") return null;
      const item = (occurrence.items || []).find(
        (candidate) => candidate.id === entry.templateItemId,
      );
      return item
        ? {
            rowVersion: occurrence.rowVersion,
            resultVersion: item.result?.rowVersion ?? null,
            value: item.result?.resultValue ?? "Unanswered",
            note: item.result?.note ?? "",
          }
        : null;
    }
    const order = (snapshot.workOrders || []).find(
      (item) => item.id === entry.targetId,
    );
    return order && !["completed", "cancelled"].includes(order.status)
      ? {
          rowVersion: order.rowVersion,
          status: order.status,
          title: order.title,
        }
      : null;
  }

  function canReview(entry) {
    return (
      navigator.onLine &&
      !busy &&
      snapshot &&
      entry.conflictedAt &&
      Date.parse(snapshot.generatedAt) > Date.parse(entry.conflictedAt) &&
      Boolean(currentTarget(entry))
    );
  }

  function queueLabel(entry) {
    if (entry.operationKind === "work_order_note") return "Work-order note";
    if (entry.operationKind === "inspection_result") return "Checklist answer";
    return "Field media";
  }

  function workOrderCard(order, capabilities) {
    const savedNote =
      drafts["note:" + activeCampgroundId + ":" + order.id]?.note || "";
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
        '<textarea name="note" maxlength="4000" required placeholder="Record field observations while disconnected">' +
        escapeHtml(savedNote) +
        "</textarea>" +
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
      const savedDraft =
        drafts[
          "inspection:" +
            activeCampgroundId +
            ":" +
            inspection.id +
            ":" +
            item.id
        ];
      const current =
        savedDraft?.resultValue ?? (item.result ? item.result.resultValue : "");
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
        escapeHtml(
          savedDraft?.note ??
            (item.result && item.result.note ? item.result.note : ""),
        ) +
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
    const current = currentTarget(entry);
    const needsReview = entry.state === "conflict";
    const detail = needsReview
      ? '<div class="offline-review"><p><strong>Manual comparison required.</strong> The original evidence remains on this device. Refresh assigned work before re-queuing.</p>' +
        "<p>Cached version: " +
        escapeHtml(
          entry.operationKind === "inspection_result"
            ? entry.expectedOccurrenceRowVersion
            : entry.expectedWorkOrderRowVersion,
        ) +
        " · Current version: " +
        escapeHtml(current?.rowVersion ?? "Not assigned or unavailable") +
        "</p>" +
        (entry.operationKind === "inspection_result"
          ? "<p>Cached answer: " +
            escapeHtml(entry.resultValue) +
            " · Server answer: " +
            escapeHtml(current?.value ?? "Unavailable") +
            "</p>"
          : "") +
        (canReview(entry)
          ? '<form class="offline-form" data-review-form data-review-id="' +
            escapeHtml(entry.clientOperationId) +
            '">' +
            "<label>Why keep this field evidence after checking the current server record?" +
            '<textarea name="resolutionReason" minlength="20" maxlength="500" required placeholder="Explain your manual comparison and decision"></textarea></label>' +
            '<button class="offline-button" type="submit">Re-queue reviewed evidence with current version</button></form>'
          : '<p class="offline-muted">Re-queue unavailable until you reconnect, refresh and verify the assignment is still active.</p>') +
        "</div>"
      : "";
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
      detail +
      '<button class="offline-button offline-button--secondary" type="button" data-remove-operation="' +
      escapeHtml(entry.clientOperationId) +
      '">Discard queued evidence from this device</button>' +
      "</article>"
    );
  }

  function render() {
    if (lockedForDifferentUser) {
      root.innerHTML =
        '<div class="offline-empty"><h3>Device cache belongs to another staff sign-in</h3><p>Cached evidence and drafts are hidden. Ask the previous user to clear this shared-device cache before continuing.</p><button class="offline-button" type="button" data-clear>Clear this device cache</button></div>';
      return;
    }
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
    const pending = localQueue.filter(
      (entry) => entry.state === "pending",
    ).length;
    const conflicts = localQueue.filter(
      (entry) => entry.state === "conflict" || entry.state === "blocked",
    ).length;
    const workOrders = snapshot ? snapshot.workOrders || [] : [];
    const filteredOrders = workOrders.filter(
      (order) =>
        (filter.priority === "all" || order.priorityKey === filter.priority) &&
        (filter.status === "all" || order.status === filter.status) &&
        (!filter.text ||
          (
            order.title +
            " " +
            (order.locationLabel || "") +
            " " +
            (order.description || "")
          )
            .toLowerCase()
            .includes(filter.text.toLowerCase())),
    );
    const inspections = snapshot ? snapshot.inspections || [] : [];
    const capabilities =
      snapshot && snapshot.capabilities
        ? snapshot.capabilities
        : { notes: false, inspections: false, media: false };

    const workOrderHtml =
      filteredOrders.length === 0
        ? '<p class="offline-empty">No assigned work orders match the current filters.</p>'
        : '<div class="offline-grid">' +
          filteredOrders
            .map((order) => workOrderCard(order, capabilities))
            .join("") +
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
          (message.startsWith("Error:") ? " offline-message--error" : "") +
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
      '<p class="offline-muted">' +
      draftCount() +
      " protected local draft(s). Device storage is not encrypted: clear this cache before sharing your device. Offline entries never complete work or sign off inspections.</p>" +
      "<section><h3>Assigned maintenance work</h3>" +
      '<div class="offline-filters" aria-label="Filter assigned work">' +
      '<label>Priority <select data-filter-priority><option value="all">All priorities</option>' +
      ["emergency", "urgent", "normal", "low"]
        .map(
          (value) =>
            '<option value="' +
            value +
            '" ' +
            (filter.priority === value ? "selected" : "") +
            ">" +
            titleCase(value) +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      '<label>Status <select data-filter-status><option value="all">All statuses</option>' +
      ["assigned", "in_progress", "blocked"]
        .map(
          (value) =>
            '<option value="' +
            value +
            '" ' +
            (filter.status === value ? "selected" : "") +
            ">" +
            titleCase(value) +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      '<label>Search assignment <input data-filter-text value="' +
      escapeHtml(filter.text) +
      '" placeholder="Title or location" /></label>' +
      '</div><p class="offline-muted">Showing ' +
      filteredOrders.length +
      " of " +
      workOrders.length +
      " assigned work orders.</p>" +
      workOrderHtml +
      "</section>" +
      "<section><h3>Offline checklists</h3>" +
      inspectionHtml +
      "</section>" +
      "<section><h3>Device sync queue</h3>" +
      queueHtml +
      "</section>" +
      '<section><h3>Server sync audit</h3><p class="offline-muted">Read-only receipts and first conflict detections, scoped to your staff identity. Retries do not create duplicate application records.</p>' +
      (audit
        ? '<div class="offline-audit">' +
          audit.receipts
            .map(
              (item) =>
                "<p><strong>" +
                escapeHtml(queueLabel(item)) +
                " · applied " +
                escapeHtml(formatDate(item.appliedAt)) +
                "</strong>" +
                (item.reviewedConflictOperationId ? " · reviewed replay" : "") +
                (item.resolutionReason
                  ? "<span>Review: " +
                    escapeHtml(item.resolutionReason) +
                    "</span>"
                  : "") +
                "</p>",
            )
            .join("") +
          audit.conflicts
            .map(
              (item) =>
                "<p><strong>" +
                escapeHtml(queueLabel(item)) +
                " · conflict " +
                escapeHtml(formatDate(item.detectedAt)) +
                "</strong><span>" +
                escapeHtml(titleCase(item.reasonCode)) +
                "</span></p>",
            )
            .join("") +
          (!audit.receipts.length && !audit.conflicts.length
            ? "<p>No server sync activity recorded.</p>"
            : "") +
          "</div>"
        : '<p class="offline-muted">Connect to load the server audit.</p>') +
      "</section>" +
      "</div>";
  }

  async function loadLocal() {
    const actorId = root.dataset.actorUserId || "";
    const previousActorId = await getMeta("actorUserId");
    if (actorId && previousActorId && previousActorId !== actorId) {
      lockedForDifferentUser = true;
      message = "Another account has a device-local offline cache.";
      render();
      return;
    }
    if (actorId && !previousActorId) {
      const existingQueue = await allQueue();
      if (existingQueue.length || (await getMeta("lastCampgroundId"))) {
        lockedForDifferentUser = true;
        render();
        return;
      }
    }
    if (actorId) await putMeta("actorUserId", actorId);
    if (!activeCampgroundId) {
      activeCampgroundId = (await getMeta("lastCampgroundId")) || "";
    }
    if (activeCampgroundId) {
      snapshot = await getSnapshot(activeCampgroundId);
    }
    queue = await allQueue();
    drafts = await loadDrafts();
    render();
  }

  async function refreshAudit() {
    if (!navigator.onLine || !activeCampgroundId || lockedForDifferentUser)
      return;
    try {
      const response = await fetch(
        "/api/maintenance/offline/audit?campground=" +
          encodeURIComponent(activeCampgroundId),
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) {
        audit = null;
        return;
      }
      audit = (await response.json()).audit;
    } catch {
      audit = null;
    }
  }

  async function refreshSnapshot() {
    if (
      !navigator.onLine ||
      !activeCampgroundId ||
      busy ||
      lockedForDifferentUser
    )
      return;
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
      await refreshAudit();
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
    await deleteDraft(draftKey(form));
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
        message =
          "An answer for this checklist item is already queued. Review or discard that operation before queuing another; your draft remains saved.";
        render();
        return;
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
    await deleteDraft(draftKey(form));
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
    const supported = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (
      !supported.includes(file.type) ||
      file.size > (file.type === "application/pdf" ? 25 : 12) * 1024 * 1024
    ) {
      message =
        "Error: Only supported images (12 MiB maximum) or PDFs (25 MiB maximum) may be queued. The server verifies file signatures at sync.";
      render();
      return;
    }
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
      if (entry.reviewedConflictOperationId) {
        formData.set(
          "reviewedConflictOperationId",
          entry.reviewedConflictOperationId,
        );
        formData.set("resolutionReason", entry.resolutionReason);
      }
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
    if (entry.state === "conflict")
      entry.conflictedAt = new Date().toISOString();
    await putQueue(entry);
  }

  async function syncQueue() {
    if (!navigator.onLine || busy || lockedForDifferentUser) return;
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
      await refreshAudit();
      queue = await allQueue();
      const unresolved = queueForCampground().length;
      message =
        unresolved > 0
          ? "Sync attempted; " +
            unresolved +
            " operation(s) remain on this device as pending, conflicted or blocked. No work was marked complete."
          : "All queued evidence synchronized. Work completion and inspection sign-off still require the online workflow.";
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
    } else if (form.matches("[data-review-form]")) {
      event.preventDefault();
      void (async () => {
        const original = queue.find(
          (entry) => entry.clientOperationId === form.dataset.reviewId,
        );
        if (!original || original.state !== "conflict" || !canReview(original))
          return;
        const current = currentTarget(original);
        if (!current) return;
        const reason = String(
          new FormData(form).get("resolutionReason") || "",
        ).trim();
        if (reason.length < 20 || reason.length > 500) return;
        const next = Object.assign({}, original, {
          clientOperationId: crypto.randomUUID(),
          reviewedConflictOperationId: original.clientOperationId,
          resolutionReason: reason,
          state: "pending",
          createdAt: new Date().toISOString(),
          lastError: null,
          conflictedAt: null,
        });
        if (next.operationKind === "inspection_result") {
          next.expectedOccurrenceRowVersion = current.rowVersion;
          next.expectedResultRowVersion = current.resultVersion;
        } else {
          next.expectedWorkOrderRowVersion = current.rowVersion;
        }
        await putQueue(next);
        await deleteQueue(original.clientOperationId);
        queue = await allQueue();
        message =
          "Reviewed evidence re-queued with a fresh operation ID and current server versions. Sync is still subject to server authorization and version checks.";
        render();
      })();
    }
  });

  root.addEventListener("input", (event) => {
    const element = event.target;
    if (!(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ))
      return;
    const form = element.closest("[data-note-form], [data-inspection-form]");
    if (!form || lockedForDifferentUser) return;
    const key = draftKey(form);
    if (!key) return;
    const data = new FormData(form);
    const value = form.matches("[data-note-form]")
      ? { note: String(data.get("note") || "") }
      : {
          resultValue: String(data.get("resultValue") || ""),
          note: String(data.get("note") || ""),
        };
    void putDraft(key, value).catch(() => {
      message =
        "Error: Device storage unavailable. Copy your evidence before navigating away.";
    });
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    ))
      return;
    if (target.matches("[data-filter-priority]"))
      filter.priority = target.value;
    else if (target.matches("[data-filter-status]"))
      filter.status = target.value;
    else if (target.matches("[data-filter-text]"))
      filter.text = target.value.trim();
    else return;
    render();
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
        if (
          !window.confirm(
            "Delete ALL cached assigned work, unsent evidence, image files and protected drafts on this device? This cannot be undone.",
          )
        )
          return;
        await clearDeviceCache();
        snapshot = null;
        queue = [];
        drafts = {};
        audit = null;
        lockedForDifferentUser = false;
        activeCampgroundId = root.dataset.campgroundId || "";
        message = "Device-local maintenance cache cleared.";
        render();
        if (root.dataset.actorUserId)
          await putMeta("actorUserId", root.dataset.actorUserId);
        if (navigator.onLine && activeCampgroundId) {
          await refreshSnapshot();
        }
      })();
      return;
    }

    const remove = target.closest("[data-remove-operation]");
    if (remove) {
      const id = remove.getAttribute("data-remove-operation");
      if (
        id &&
        window.confirm(
          "Discard this device-local operation permanently? It will not be synchronized.",
        )
      ) {
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
