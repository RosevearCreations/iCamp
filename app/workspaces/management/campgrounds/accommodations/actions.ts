"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import {
  archiveAccommodationGalleryImage,
  registerAccommodationGalleryImage,
  updateAccommodationGalleryImage,
} from "@/lib/gallery/postgres.mjs";
import {
  assertMatchingGalleryAspectRatio,
  inspectGalleryWebpVariant,
} from "@/lib/gallery/image-processing.mjs";
import { sanitizeOverheadImage } from "@/lib/map-images/image-processing.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";
import {
  buildMediaObjectKey,
  validateMediaUpload,
} from "@/lib/media/validation.mjs";
import {
  createAccommodation,
  updateAccommodation,
  updateCampsiteDetails,
  updateRentalCottageDetails,
} from "@/lib/accommodations/postgres.mjs";
import {
  addCottageInventoryChecklistItem,
  createCottageHousekeepingTemplate,
  createCottageTurnover,
  recordCottageDamageInspection,
  recordCottageTurnoverItemCheck,
} from "@/lib/housekeeping/postgres.mjs";

const path = "/workspaces/management/campgrounds/accommodations";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.has(key);
}

function requiredFile(formData: FormData, key: string, label: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size < 1) {
    throw new Error(label + " is required.");
  }
  return value;
}

function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function blobBody(bytes: Uint8Array, contentType: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: contentType });
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function createAccommodationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await createAccommodation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    sectionId: field(formData, "sectionId"),
    subsectionId: field(formData, "subsectionId") || null,
    kind: field(formData, "kind"),
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
  });

  finish(campgroundId, "Accommodation created.");
}

export async function updateAccommodationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateAccommodation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    sectionId: field(formData, "sectionId"),
    subsectionId: field(formData, "subsectionId") || null,
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
    lifecycleState: field(formData, "lifecycleState"),
  });

  finish(campgroundId, "Accommodation saved.");
}

export async function updateCampsiteDetailsAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateCampsiteDetails({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedDetailRowVersion: Number(field(formData, "detailRowVersion")),
    campsiteType: field(formData, "campsiteType"),
    serviceLevel: field(formData, "serviceLevel"),
    stayProfile: field(formData, "stayProfile"),
    isWaterfront: checked(formData, "isWaterfront"),
    electricalAmperage: Number(field(formData, "electricalAmperage")),
    waterService: field(formData, "waterService"),
    wastewaterService: field(formData, "wastewaterService"),
    wifiService: field(formData, "wifiService"),
    siteLengthMeters: field(formData, "siteLengthMeters") || null,
    siteWidthMeters: field(formData, "siteWidthMeters") || null,
    maxRvLengthMeters: field(formData, "maxRvLengthMeters") || null,
    maxRvWidthMeters: field(formData, "maxRvWidthMeters") || null,
    maxRvHeightMeters: field(formData, "maxRvHeightMeters") || null,
    surfaceType: field(formData, "surfaceType"),
    pullThrough: checked(formData, "pullThrough"),
    shadeLevel: field(formData, "shadeLevel"),
    hasFireRing: checked(formData, "hasFireRing"),
    hasPicnicTable: checked(formData, "hasPicnicTable"),
  });

  finish(campgroundId, "Campsite details saved.");
}

export async function updateRentalCottageDetailsAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateRentalCottageDetails({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedDetailRowVersion: Number(field(formData, "detailRowVersion")),
    cottageStyle: field(formData, "cottageStyle"),
    bedroomCount: field(formData, "bedroomCount"),
    bedCount: field(formData, "bedCount"),
    maxOccupancy: field(formData, "maxOccupancy"),
    kitchenType: field(formData, "kitchenType"),
    washroomType: field(formData, "washroomType"),
    showerType: field(formData, "showerType"),
    heatingType: field(formData, "heatingType"),
    coolingType: field(formData, "coolingType"),
    hasRefrigerator: checked(formData, "hasRefrigerator"),
    hasCooktop: checked(formData, "hasCooktop"),
    hasOven: checked(formData, "hasOven"),
    hasMicrowave: checked(formData, "hasMicrowave"),
    stepFreeAccess: checked(formData, "stepFreeAccess"),
    accessibleWashroom: checked(formData, "accessibleWashroom"),
    viewType: field(formData, "viewType"),
  });

  finish(campgroundId, "Rental cottage details saved.");
}

export async function createCottageHousekeepingTemplateAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await createCottageHousekeepingTemplate({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    name: field(formData, "name"),
    turnoverType: field(formData, "turnoverType"),
    expectedMinutes: field(formData, "expectedMinutes"),
    linenRequirements: field(formData, "linenRequirements"),
    housekeepingRequirements: field(formData, "housekeepingRequirements"),
    damageInspectionRequired: checked(formData, "damageInspectionRequired"),
    securityInspectionRequired: checked(formData, "securityInspectionRequired"),
  });

  finish(campgroundId, "Cottage turnover template created.");
}

export async function addCottageInventoryChecklistItemAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await addCottageInventoryChecklistItem({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
    category: field(formData, "category"),
    name: field(formData, "name"),
    requiredQuantity: field(formData, "requiredQuantity"),
    unit: field(formData, "unit"),
    expectedCondition: field(formData, "expectedCondition"),
    sortOrder: field(formData, "sortOrder"),
    isRequired: checked(formData, "isRequired"),
  });

  finish(campgroundId, "Cottage inventory checklist item added.");
}

export async function createCottageTurnoverAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await createCottageTurnover({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
    notes: field(formData, "notes"),
  });

  finish(campgroundId, "Cottage turnover started.");
}

export async function recordCottageTurnoverItemCheckAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await recordCottageTurnoverItemCheck({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    turnoverId: field(formData, "turnoverId"),
    checkId: field(formData, "checkId"),
    issueFound: checked(formData, "issueFound"),
    notes: field(formData, "notes"),
  });

  finish(campgroundId, "Turnover checklist evidence saved.");
}

export async function recordCottageDamageInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await recordCottageDamageInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    turnoverId: field(formData, "turnoverId"),
    linenComplete: checked(formData, "linenComplete"),
    housekeepingComplete: checked(formData, "housekeepingComplete"),
    damageFound: checked(formData, "damageFound"),
    securityIssueFound: checked(formData, "securityIssueFound"),
    damageNotes: field(formData, "damageNotes"),
    securityNotes: field(formData, "securityNotes"),
  });

  finish(campgroundId, "Cottage readiness inspection recorded.");
}


export async function uploadAccommodationGalleryImageAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const accommodationId = field(formData, "accommodationId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campgroundId,
  );

  if (!authorization?.permissions.includes("media.manage")) {
    throw new Error(
      "Media management permission is required for public gallery uploads.",
    );
  }

  const sourceFile = requiredFile(formData, "sourceImage", "Public image");
  const thumbnailFile = requiredFile(
    formData,
    "thumbnailImage",
    "Prepared thumbnail",
  );
  const optimizedFile = requiredFile(
    formData,
    "optimizedImage",
    "Prepared optimized image",
  );

  const sourceBytes = new Uint8Array(await sourceFile.arrayBuffer());
  const sourceValidation = validateMediaUpload({
    classification: "public",
    filename: sourceFile.name,
    contentType: sourceFile.type,
    byteSize: sourceFile.size,
    headerBytes: sourceBytes,
  });

  if (!sourceValidation.ok || sourceValidation.mediaKind !== "image") {
    throw new Error(
      sourceValidation.ok
        ? "Public gallery media must be an image."
        : sourceValidation.message,
    );
  }

  if (
    !["image/jpeg", "image/png", "image/webp"].includes(
      sourceValidation.contentType,
    )
  ) {
    throw new Error("Public galleries support JPEG, PNG and WebP images only.");
  }

  if (sourceValidation.bucketKey !== "icamp-public-media") {
    throw new Error("Public gallery uploads must use the public media bucket.");
  }

  const sanitizedSource = sanitizeOverheadImage(
    sourceBytes,
    sourceValidation.contentType,
  );

  async function variant(file: File, kind: "thumbnail" | "optimized") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateMediaUpload({
      classification: "public",
      filename: file.name,
      contentType: file.type,
      byteSize: file.size,
      headerBytes: bytes,
    });

    if (
      !validation.ok ||
      validation.mediaKind !== "image" ||
      validation.contentType !== "image/webp"
    ) {
      throw new Error(
        validation.ok
          ? "Prepared gallery variants must be WebP images."
          : validation.message,
      );
    }

    const dimensions = inspectGalleryWebpVariant(bytes, kind);
    assertMatchingGalleryAspectRatio(sanitizedSource, dimensions);

    return { bytes, validation, dimensions };
  }

  const [thumbnailVariant, optimizedVariant] = await Promise.all([
    variant(thumbnailFile, "thumbnail"),
    variant(optimizedFile, "optimized"),
  ]);

  const sourceId = randomUUID();
  const thumbnailId = randomUUID();
  const optimizedId = randomUUID();

  const sourceObjectKey = buildMediaObjectKey({
    organizationId: authorization.organizationId,
    campgroundId,
    assetId: sourceId,
    canonicalExtension: sourceValidation.canonicalExtension,
  });
  const thumbnailObjectKey = buildMediaObjectKey({
    organizationId: authorization.organizationId,
    campgroundId,
    assetId: thumbnailId,
    canonicalExtension: thumbnailVariant.validation.canonicalExtension,
  });
  const optimizedObjectKey = buildMediaObjectKey({
    organizationId: authorization.organizationId,
    campgroundId,
    assetId: optimizedId,
    canonicalExtension: optimizedVariant.validation.canonicalExtension,
  });

  const config = getMediaStorageConfig();
  if (!config.projectUrl || !config.secretKey) {
    throw new Error(
      "Public gallery storage is not configured. Server-only Supabase storage settings are required.",
    );
  }

  const adapter = createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  });

  const uploads = [
    {
      id: sourceId,
      bucketKey: sourceValidation.bucketKey,
      objectKey: sourceObjectKey,
      originalFilename: sourceFile.name,
      contentType: sourceValidation.contentType,
      byteSize: sanitizedSource.bytes.byteLength,
      checksumSha256: checksum(sanitizedSource.bytes),
      width: sanitizedSource.width,
      height: sanitizedSource.height,
      body: blobBody(sanitizedSource.bytes, sourceValidation.contentType),
    },
    {
      id: thumbnailId,
      bucketKey: thumbnailVariant.validation.bucketKey,
      objectKey: thumbnailObjectKey,
      originalFilename: thumbnailFile.name,
      contentType: thumbnailVariant.validation.contentType,
      byteSize: thumbnailVariant.bytes.byteLength,
      checksumSha256: checksum(thumbnailVariant.bytes),
      width: thumbnailVariant.dimensions.width,
      height: thumbnailVariant.dimensions.height,
      body: blobBody(
        thumbnailVariant.bytes,
        thumbnailVariant.validation.contentType,
      ),
    },
    {
      id: optimizedId,
      bucketKey: optimizedVariant.validation.bucketKey,
      objectKey: optimizedObjectKey,
      originalFilename: optimizedFile.name,
      contentType: optimizedVariant.validation.contentType,
      byteSize: optimizedVariant.bytes.byteLength,
      checksumSha256: checksum(optimizedVariant.bytes),
      width: optimizedVariant.dimensions.width,
      height: optimizedVariant.dimensions.height,
      body: blobBody(
        optimizedVariant.bytes,
        optimizedVariant.validation.contentType,
      ),
    },
  ];

  const uploaded: Array<{ bucketKey: string; objectKey: string }> = [];

  try {
    for (const media of uploads) {
      await adapter.uploadValidatedObject({
        bucketKey: media.bucketKey,
        objectKey: media.objectKey,
        contentType: media.contentType,
        body: media.body,
      });
      uploaded.push({
        bucketKey: media.bucketKey,
        objectKey: media.objectKey,
      });
    }

    const [source, thumbnail, optimized] = uploads.map(
      ({ body: _body, ...media }) => media,
    );

    await registerAccommodationGalleryImage({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      organizationId: authorization.organizationId,
      campgroundId,
      accommodationId,
      caption: field(formData, "caption"),
      altText: field(formData, "altText"),
      source,
      thumbnail,
      optimized,
    });
  } catch (error) {
    await Promise.all(
      uploaded.map((media) => adapter.deleteObject(media).catch(() => undefined)),
    );
    throw error;
  }

  finish(campgroundId, "Public gallery image added.");
}

export async function updateAccommodationGalleryImageAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateAccommodationGalleryImage({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    galleryImageId: field(formData, "galleryImageId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    caption: field(formData, "caption"),
    altText: field(formData, "altText"),
    sortOrder: field(formData, "sortOrder"),
    makeHero: checked(formData, "makeHero"),
  });

  finish(campgroundId, "Public gallery details saved.");
}

export async function archiveAccommodationGalleryImageAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await archiveAccommodationGalleryImage({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    galleryImageId: field(formData, "galleryImageId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(campgroundId, "Image removed from the public gallery.");
}
