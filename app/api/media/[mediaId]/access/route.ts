import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { hasCampgroundPermission } from "@/lib/authz/postgres.mjs";
import { getMediaAccessDescriptor } from "@/lib/media/postgres.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ mediaId: string }> },
) {
  const { mediaId } = await context.params;

  if (!uuidPattern.test(mediaId)) {
    return NextResponse.json(
      { error: "Media was not found." },
      { status: 404 },
    );
  }

  const asset = await getMediaAccessDescriptor(mediaId);

  if (!asset || asset.lifecycleState !== "active") {
    return NextResponse.json({ error: "Media was not found." }, { status: 404 });
  }

  if (asset.storageProvider !== "supabase") {
    return NextResponse.json(
      { error: "Media storage is temporarily unavailable." },
      { status: 503 },
    );
  }

  const config = getMediaStorageConfig();

  if (!config.projectUrl) {
    return NextResponse.json(
      { error: "Media storage is temporarily unavailable." },
      { status: 503 },
    );
  }

  const adapter = createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  });

  if (asset.classification === "public") {
    return NextResponse.json({
      access: "public",
      url: adapter.getPublicUrl({
        bucketKey: asset.bucketKey,
        objectKey: asset.objectKey,
      }),
    });
  }

  const session = await getCurrentSession();

  if (!session || session.user.accountType !== "staff") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const permission =
    asset.classification === "confidential"
      ? "media.confidential.read"
      : "media.read";

  const allowed = await hasCampgroundPermission(
    session.user.id,
    asset.campgroundId,
    permission,
  );

  if (!allowed) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  if (!config.secretKey) {
    return NextResponse.json(
      { error: "Private media access is temporarily unavailable." },
      { status: 503 },
    );
  }

  const signed = await adapter.createSignedReadUrl({
    bucketKey: asset.bucketKey,
    objectKey: asset.objectKey,
    expiresIn: config.signedUrlSeconds,
  });

  return NextResponse.json({
    access: "signed",
    url: signed.url,
    expiresIn: signed.expiresIn,
  });
}
