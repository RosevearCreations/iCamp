"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import {
  addSecurityIncidentAttachment,
  createSecurityIncidentCase,
  listSecurityIncidentCases,
  reviewSecurityIncidentClosure,
  updateSecurityIncidentCase,
  updateSecurityIncidentSensitive,
} from "@/lib/security-incidents/postgres.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";
import {
  buildMediaObjectKey,
  validateMediaUpload,
} from "@/lib/media/validation.mjs";

const PATH = "/workspaces/security/incidents";

function value(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function nextUrl(
  campgroundId: string,
  caseId: string | null,
  query: string,
  message: string,
) {
  return (
    `${PATH}?campground=${encodeURIComponent(campgroundId)}` +
    (caseId ? `&case=${encodeURIComponent(caseId)}` : "") +
    `&${query}=${encodeURIComponent(message.slice(0, 240))}`
  );
}

function safeError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The incident action could not be completed.";
}

function finish(
  campgroundId: string,
  caseId: string | null,
  message: string,
  error = false,
): never {
  revalidatePath(PATH);
  revalidatePath("/workspaces/security/dashboard");
  redirect(nextUrl(campgroundId, caseId, error ? "error" : "saved", message));
}

export async function createIncidentAction(formData: FormData) {
  const campgroundId = value(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "security.incident.manage",
    PATH,
  );
  let caseId: string | null = null;
  let error: string | null = null;
  try {
    const created = await createSecurityIncidentCase({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      input: {
        title: value(formData, "title"),
        category: value(formData, "category"),
        severity: value(formData, "severity"),
        operationalSummary: value(formData, "summary"),
        linkedSignalKind: value(formData, "signalKind"),
        linkedSignalId: value(formData, "signalId"),
      },
    });
    caseId = created.id;
  } catch (caught) {
    error = safeError(caught);
  }
  finish(
    campgroundId,
    caseId,
    error ?? "Security incident case opened.",
    Boolean(error),
  );
}

export async function updateIncidentAction(formData: FormData) {
  const campgroundId = value(formData, "campgroundId");
  const caseId = value(formData, "caseId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "security.incident.manage",
    PATH,
  );
  let error: string | null = null;
  try {
    await updateSecurityIncidentCase({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      caseId,
      rowVersion: Number(value(formData, "rowVersion")),
      action: value(formData, "action"),
      details: value(formData, "details"),
      assigneeUserId: value(formData, "assigneeUserId") || null,
    });
  } catch (caught) {
    error = safeError(caught);
  }
  finish(
    campgroundId,
    caseId,
    error ?? "Case chronology updated.",
    Boolean(error),
  );
}

export async function reviewIncidentAction(formData: FormData) {
  const campgroundId = value(formData, "campgroundId");
  const caseId = value(formData, "caseId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "security.incident.review",
    PATH,
  );
  let error: string | null = null;
  try {
    await reviewSecurityIncidentClosure({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      caseId,
      rowVersion: Number(value(formData, "rowVersion")),
      decision: value(formData, "decision"),
      rationale: value(formData, "rationale"),
    });
  } catch (caught) {
    error = safeError(caught);
  }
  finish(
    campgroundId,
    caseId,
    error ?? "Independent closure review recorded.",
    Boolean(error),
  );
}

export async function updateIncidentSensitiveAction(formData: FormData) {
  const campgroundId = value(formData, "campgroundId");
  const caseId = value(formData, "caseId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "security.incident.sensitive.read",
    PATH,
  );
  let error: string | null = null;
  try {
    await updateSecurityIncidentSensitive({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      caseId,
      rowVersion: Number(value(formData, "rowVersion")),
      witnessContext: value(formData, "witnessContext"),
      guestContext: value(formData, "guestContext"),
    });
  } catch (caught) {
    error = safeError(caught);
  }
  finish(
    campgroundId,
    caseId,
    error ?? "Restricted witness/guest context saved.",
    Boolean(error),
  );
}

export async function attachIncidentEvidenceAction(formData: FormData) {
  const campgroundId = value(formData, "campgroundId");
  const caseId = value(formData, "caseId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "security.incident.sensitive.read",
    PATH,
  );
  await requireCampgroundPermission(
    campgroundId,
    "security.incident.manage",
    PATH,
  );
  let error: string | null = null;
  let uploaded: {
    bucketKey: string;
    objectKey: string;
    adapter: ReturnType<typeof createSupabaseStorageAdapter>;
  } | null = null;
  try {
    // Authorize case scope and state before sending any bytes to private storage.
    const board = await listSecurityIncidentCases({
      actorUserId: session.user.id,
      campgroundId,
      selectedCaseId: caseId,
    });
    if (
      board.selected?.id !== caseId ||
      ["closure_pending", "closed"].includes(board.selected.status)
    ) {
      throw new Error(
        "Open the case in this campground before attaching evidence.",
      );
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new Error("Choose a file to attach.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateMediaUpload({
      classification: "confidential",
      filename: file.name,
      contentType: file.type,
      byteSize: file.size,
      headerBytes: bytes,
    });
    if (!validation.ok) throw new Error(validation.message);
    const config = getMediaStorageConfig();
    if (!config.projectUrl || !config.secretKey)
      throw new Error("Private incident evidence storage is unavailable.");
    const mediaId = randomUUID();
    // The canonical key builder needs the same authoritative organization scope as the case.
    const auth = await getCampgroundAuthorization(
      session.user.id,
      campgroundId,
    );
    if (!auth) throw new Error("Campground scope is unavailable.");
    const actualObjectKey = buildMediaObjectKey({
      organizationId: auth.organizationId,
      campgroundId,
      assetId: mediaId,
      canonicalExtension: validation.canonicalExtension,
    });
    const adapter = createSupabaseStorageAdapter({
      projectUrl: config.projectUrl,
      secretKey: config.secretKey,
    });
    await adapter.uploadValidatedObject({
      bucketKey: validation.bucketKey,
      objectKey: actualObjectKey,
      contentType: validation.contentType,
      body: new Blob([bytes], { type: validation.contentType }),
    });
    uploaded = {
      bucketKey: validation.bucketKey,
      objectKey: actualObjectKey,
      adapter,
    };
    await addSecurityIncidentAttachment({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      caseId,
      rowVersion: Number(value(formData, "rowVersion")),
      caption: value(formData, "caption"),
      media: {
        id: mediaId,
        mediaKind: validation.mediaKind,
        bucketKey: validation.bucketKey,
        objectKey: actualObjectKey,
        originalFilename: file.name,
        contentType: validation.contentType,
        byteSize: file.size,
        checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      },
    });
    uploaded = null;
  } catch (caught) {
    error = safeError(caught);
    if (uploaded)
      await uploaded.adapter
        .deleteObject({
          bucketKey: uploaded.bucketKey,
          objectKey: uploaded.objectKey,
        })
        .catch(() => undefined);
  }
  finish(
    campgroundId,
    caseId,
    error ?? "Confidential checksum-backed evidence retained.",
    Boolean(error),
  );
}
