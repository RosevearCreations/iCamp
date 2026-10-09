"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { sanitizeOverheadImage } from "@/lib/map-images/image-processing.mjs";
import {
  publishMapVersion,
  registerOverheadMapVersion,
  setActiveMapVersion,
} from "@/lib/map-images/postgres.mjs";
import {
  buildMediaObjectKey,
  validateMediaUpload,
} from "@/lib/media/validation.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";

const path = "/workspaces/management/campgrounds/maps";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberField(formData: FormData, key: string) {
  return Number(field(formData, key));
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function uploadOverheadImageAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map",
    path,
  );
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campgroundId,
  );

  if (!authorization?.permissions.includes("media.manage")) {
    throw new Error("Media management permission is required for map uploads.");
  }

  const upload = formData.get("image");
  if (!(upload instanceof File)) {
    throw new Error("Choose an overhead image to upload.");
  }

  const rawBytes = new Uint8Array(await upload.arrayBuffer());
  const validated = validateMediaUpload({
    classification: "internal",
    filename: upload.name,
    contentType: upload.type,
    byteSize: upload.size,
    headerBytes: rawBytes,
  });

  if (!validated.ok || validated.mediaKind !== "image") {
    throw new Error(
      validated.ok ? "Overhead map must be an image." : validated.message,
    );
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(validated.contentType)) {
    throw new Error("Overhead maps support JPEG, PNG and WebP images only.");
  }

  const sanitized = sanitizeOverheadImage(rawBytes, validated.contentType);
  const checksumSha256 = createHash("sha256")
    .update(sanitized.bytes)
    .digest("hex");
  const mediaAssetId = randomUUID();
  const objectKey = buildMediaObjectKey({
    organizationId: authorization.organizationId,
    campgroundId,
    assetId: mediaAssetId,
    canonicalExtension: validated.canonicalExtension,
  });
  const config = getMediaStorageConfig();

  if (!config.projectUrl || !config.secretKey) {
    throw new Error(
      "Map upload storage is not configured. A server-only Supabase storage URL and secret key are required.",
    );
  }

  const adapter = createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  });

  await adapter.uploadValidatedObject({
    bucketKey: validated.bucketKey,
    objectKey,
    contentType: validated.contentType,
    body: sanitized.bytes,
  });

  try {
    await registerOverheadMapVersion({
      actorUserId: session.user.id,
      organizationId: authorization.organizationId,
      campgroundId,
      mediaAssetId,
      storageProvider: adapter.provider,
      bucketKey: validated.bucketKey,
      objectKey,
      originalFilename: upload.name,
      contentType: validated.contentType,
      byteSize: sanitized.bytes.byteLength,
      checksumSha256,
      width: sanitized.width,
      height: sanitized.height,
      label: field(formData, "label"),
      notes: field(formData, "notes"),
      reason: field(formData, "reason"),
    });
  } catch (error) {
    await adapter
      .deleteObject({ bucketKey: validated.bucketKey, objectKey })
      .catch(() => undefined);
    throw error;
  }

  finish(campgroundId, "Overhead image version uploaded.");
}

export async function setActiveMapVersionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map",
    path,
  );

  await setActiveMapVersion({
    actorUserId: session.user.id,
    campgroundId,
    mapVersionId: field(formData, "mapVersionId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
  });

  finish(campgroundId, "Active map image version updated.");
}

export async function publishMapVersionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map.publish",
    path,
  );

  await publishMapVersion({
    actorUserId: session.user.id,
    campgroundId,
    mapVersionId: field(formData, "mapVersionId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
    reason: field(formData, "reason"),
  });

  finish(campgroundId, "Published map image version updated.");
}
