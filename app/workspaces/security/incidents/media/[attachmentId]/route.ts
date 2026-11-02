import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getSecurityIncidentAttachment } from "@/lib/security-incidents/postgres.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "@/lib/media/storage.mjs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const session = await getCurrentSession();
  if (session?.user.accountType !== "staff")
    return NextResponse.json(
      { error: "Sign in as authorized staff." },
      { status: 401 },
    );
  const { attachmentId } = await context.params;
  let attachment: Awaited<ReturnType<typeof getSecurityIncidentAttachment>>;
  try {
    attachment = await getSecurityIncidentAttachment({
      actorUserId: session.user.id,
      attachmentId,
    });
  } catch {
    return NextResponse.json(
      { error: "Attachment unavailable." },
      { status: 404 },
    );
  }
  if (!attachment)
    return NextResponse.json(
      { error: "Attachment unavailable." },
      { status: 404 },
    );
  if (attachment.storageProvider !== "supabase")
    return NextResponse.json(
      { error: "Storage unavailable." },
      { status: 503 },
    );
  const config = getMediaStorageConfig();
  if (!config.projectUrl || !config.secretKey)
    return NextResponse.json(
      { error: "Private evidence storage unavailable." },
      { status: 503 },
    );
  const adapter = createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  });
  const signed = await adapter.createSignedReadUrl({
    bucketKey: attachment.bucketKey,
    objectKey: attachment.objectKey,
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
