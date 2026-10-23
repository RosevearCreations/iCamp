"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import {
  attachCamperAssistanceMediaEvidence,
  createCamperAssistanceRequest,
  getCamperAssistanceRequestForMedia,
} from "@/lib/camper-assistance/postgres.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";
import {
  buildMediaObjectKey,
  validateMediaUpload,
} from "@/lib/media/validation.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return (
    error instanceof Error ? error.message : "Assistance request action failed."
  ).slice(0, 300);
}

function pathFor(reservationId: string) {
  return "/guest/assistance?reservation=" + encodeURIComponent(reservationId);
}

async function guestSession(path: string) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }
  return session;
}

async function uploadMediaForRequest({
  userId,
  requestId,
  file,
}: {
  userId: string;
  requestId: string;
  file: File;
}) {
  const request = await getCamperAssistanceRequestForMedia({
    userId,
    requestId,
  });
  if (!request) {
    throw new Error("Assistance request was not found.");
  }
  if (request.mediaCount >= 5) {
    throw new Error(
      "A maximum of five media attachments is supported per assistance request.",
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateMediaUpload({
    classification: "internal",
    filename: file.name,
    contentType: file.type,
    byteSize: file.size,
    headerBytes: bytes,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const config = getMediaStorageConfig();
  if (!config.projectUrl || !config.secretKey) {
    throw new Error("Secure internal-media storage is unavailable.");
  }

  const mediaId = randomUUID();
  const objectKey = buildMediaObjectKey({
    organizationId: request.organizationId,
    campgroundId: request.campgroundId,
    assetId: mediaId,
    canonicalExtension: validation.canonicalExtension,
  });
  const adapter = createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  });
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");

  await adapter.uploadValidatedObject({
    bucketKey: validation.bucketKey,
    objectKey,
    contentType: validation.contentType,
    body: new Blob([bytes], { type: validation.contentType }),
  });

  try {
    return await attachCamperAssistanceMediaEvidence({
      userId,
      requestId,
      media: {
        id: mediaId,
        mediaKind: validation.mediaKind,
        bucketKey: validation.bucketKey,
        objectKey,
        originalFilename: file.name,
        contentType: validation.contentType,
        byteSize: file.size,
        checksumSha256,
      },
    });
  } catch (error) {
    await adapter
      .deleteObject({
        bucketKey: validation.bucketKey,
        objectKey,
      })
      .catch(() => undefined);
    throw error;
  }
}

export async function createCamperAssistanceRequestAction(formData: FormData) {
  const reservationId = text(formData, "reservationId");
  const path = pathFor(reservationId);
  const session = await guestSession(path);
  let attachmentError: string | null = null;

  try {
    const result = await createCamperAssistanceRequest({
      userId: session.user.id,
      reservationId,
      clientRequestId: text(formData, "clientRequestId"),
      sourceChannel: "web",
      input: {
        category: text(formData, "category"),
        severity: text(formData, "severity"),
        summary: text(formData, "summary"),
        details: text(formData, "details"),
        contactPreference: text(formData, "contactPreference"),
      },
    });

    const createdRequestId = result.request?.id ?? null;
    const file = formData.get("file");
    if (file instanceof File && file.size > 0 && createdRequestId) {
      try {
        await uploadMediaForRequest({
          userId: session.user.id,
          requestId: createdRequestId,
          file,
        });
      } catch (error) {
        attachmentError = errorMessage(error);
      }
    }

    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  const saved = "&saved=" + encodeURIComponent("Assistance request submitted.");
  if (attachmentError) {
    redirect(
      path +
        saved +
        "&error=" +
        encodeURIComponent(
          "The request is saved, but its attachment was not added: " +
            attachmentError,
        ),
    );
  }

  redirect(path + saved);
}

export async function addCamperAssistanceMediaAction(formData: FormData) {
  const reservationId = text(formData, "reservationId");
  const requestId = text(formData, "requestId");
  const path = pathFor(reservationId);
  const session = await guestSession(path);

  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size < 1) {
      throw new Error("Choose an image or PDF to attach.");
    }

    await uploadMediaForRequest({
      userId: session.user.id,
      requestId,
      file,
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(path + "&saved=" + encodeURIComponent("Attachment added."));
}
