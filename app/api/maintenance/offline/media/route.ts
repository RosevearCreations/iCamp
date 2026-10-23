import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import {
  attachOfflineMaintenanceMediaEvidence,
  getOfflineSyncReceipt,
} from "@/lib/offline-maintenance/postgres.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";
import {
  buildMediaObjectKey,
  validateMediaUpload,
} from "@/lib/media/validation.mjs";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Media sync failed.";
  if (message.startsWith("OFFLINE_CONFLICT:")) {
    return NextResponse.json(
      { error: message.replace("OFFLINE_CONFLICT: ", ""), code: "conflict" },
      { status: 409 },
    );
  }
  if (message.startsWith("OFFLINE_FORBIDDEN:")) {
    return NextResponse.json(
      { error: message.replace("OFFLINE_FORBIDDEN: ", ""), code: "forbidden" },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { error: "Queued maintenance media could not be synchronized." },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff") {
    return NextResponse.json(
      { error: "Authentication required.", code: "authentication" },
      { status: 401 },
    );
  }

  let uploaded:
    | {
        bucketKey: string;
        objectKey: string;
        adapter: ReturnType<typeof createSupabaseStorageAdapter>;
      }
    | undefined;

  try {
    const formData = await request.formData();
    const campgroundId = field(formData, "campgroundId");
    const clientOperationId = field(formData, "clientOperationId");
    const workOrderId = field(formData, "workOrderId");
    const expectedWorkOrderRowVersion = Number(
      field(formData, "expectedWorkOrderRowVersion"),
    );
    const caption = field(formData, "caption") || null;
    const source = formData.get("file");

    if (!(source instanceof File) || source.size < 1) {
      return NextResponse.json(
        { error: "Queued media file is missing." },
        { status: 400 },
      );
    }

    const authorization = await getCampgroundAuthorization(
      session.user.id,
      campgroundId,
    );
    if (!authorization) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const bytes = new Uint8Array(await source.arrayBuffer());
    const validation = validateMediaUpload({
      classification: "internal",
      filename: source.name,
      contentType: source.type,
      byteSize: source.size,
      headerBytes: bytes,
    });
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 },
      );
    }

    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const operation = {
      clientOperationId,
      campgroundId,
      operationKind: "work_order_media" as const,
      targetId: workOrderId,
      expectedWorkOrderRowVersion,
      caption,
      fileChecksumSha256: checksumSha256,
    };

    const existing = await getOfflineSyncReceipt({
      actorUserId: session.user.id,
      operation,
    });
    if (existing) {
      return NextResponse.json({ status: "already_applied", receipt: existing });
    }

    const config = getMediaStorageConfig();
    if (!config.projectUrl || !config.secretKey) {
      return NextResponse.json(
        { error: "Secure internal-media storage is unavailable." },
        { status: 503 },
      );
    }

    const objectKey = buildMediaObjectKey({
      organizationId: authorization.organizationId,
      campgroundId,
      assetId: clientOperationId,
      canonicalExtension: validation.canonicalExtension,
    });
    const adapter = createSupabaseStorageAdapter({
      projectUrl: config.projectUrl,
      secretKey: config.secretKey,
    });
    const uploadInput = {
      bucketKey: validation.bucketKey,
      objectKey,
      contentType: validation.contentType,
      body: new Blob([bytes], { type: validation.contentType }),
    };

    try {
      await adapter.uploadValidatedObject(uploadInput);
    } catch {
      await adapter
        .deleteObject({
          bucketKey: validation.bucketKey,
          objectKey,
        })
        .catch(() => undefined);
      await adapter.uploadValidatedObject(uploadInput);
    }

    uploaded = {
      bucketKey: validation.bucketKey,
      objectKey,
      adapter,
    };

    const result = await attachOfflineMaintenanceMediaEvidence({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      operation,
      media: {
        id: clientOperationId,
        mediaKind: validation.mediaKind,
        bucketKey: validation.bucketKey,
        objectKey,
        originalFilename: source.name,
        contentType: validation.contentType,
        byteSize: source.size,
        checksumSha256,
      },
    });
    uploaded = undefined;
    return NextResponse.json(result);
  } catch (error) {
    if (uploaded) {
      await uploaded.adapter
        .deleteObject({
          bucketKey: uploaded.bucketKey,
          objectKey: uploaded.objectKey,
        })
        .catch(() => undefined);
    }
    return errorResponse(error);
  }
}
