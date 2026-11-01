import { NextResponse } from "next/server";

import { ownsAssistanceMedia } from "@/lib/assistance-conversations/postgres.mjs";
import { getCurrentSession } from "@/lib/auth/current-session";
import { hasCampgroundPermission } from "@/lib/authz/postgres.mjs";
import { getMediaAccessDescriptor } from "@/lib/media/postgres.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function GET(
  _request: Request,
  context: { params: Promise<{ mediaId: string }> },
) {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { mediaId } = await context.params;
  if (!UUID.test(mediaId))
    return NextResponse.json(
      { error: "Attachment not found." },
      { status: 404 },
    );
  const asset = await getMediaAccessDescriptor(mediaId);
  if (
    !asset ||
    asset.classification !== "internal" ||
    asset.lifecycleState !== "active" ||
    asset.storageProvider !== "supabase"
  ) {
    return NextResponse.json(
      { error: "Attachment not found." },
      { status: 404 },
    );
  }
  const authorized =
    session.user.accountType === "guest"
      ? await ownsAssistanceMedia({ userId: session.user.id, mediaId })
      : session.user.accountType === "staff" &&
        (await hasCampgroundPermission(
          session.user.id,
          asset.campgroundId,
          "media.read",
        ));
  if (!authorized)
    return NextResponse.json(
      { error: "Attachment not available to this account." },
      { status: 404 },
    );
  const config = getMediaStorageConfig();
  if (!config.projectUrl || !config.secretKey) {
    return NextResponse.json(
      { error: "Secure media service is unavailable." },
      { status: 503 },
    );
  }
  const storage = createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  });
  const signed = await storage.createSignedReadUrl({
    bucketKey: asset.bucketKey,
    objectKey: asset.objectKey,
    expiresIn: config.signedUrlSeconds,
  });
  return NextResponse.redirect(signed.url, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
