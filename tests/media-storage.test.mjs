import assert from "node:assert/strict";
import test from "node:test";

import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "../lib/media/storage.mjs";

test("Build 008 creates stable public media URLs without a server secret", () => {
  const adapter = createSupabaseStorageAdapter({
    projectUrl: "https://example.supabase.co",
  });

  assert.equal(
    adapter.getPublicUrl({
      bucketKey: "icamp-public-media",
      objectKey:
        "11111111-1111-4111-8111-111111111111/" +
        "22222222-2222-4222-8222-222222222222/" +
        "33333333-3333-4333-8333-333333333333.jpg",
    }),
    "https://example.supabase.co/storage/v1/object/public/" +
      "icamp-public-media/" +
      "11111111-1111-4111-8111-111111111111/" +
      "22222222-2222-4222-8222-222222222222/" +
      "33333333-3333-4333-8333-333333333333.jpg",
  );
});

test("Build 008 requests short-lived signed private media URLs server-side", async () => {
  const requests = [];
  const adapter = createSupabaseStorageAdapter({
    projectUrl: "https://example.supabase.co",
    secretKey: "test-server-secret",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          signedURL:
            "/object/sign/icamp-internal-media/" +
            "scope/asset.pdf?token=test-token",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
  });

  const signed = await adapter.createSignedReadUrl({
    bucketKey: "icamp-internal-media",
    objectKey: "scope/asset.pdf",
    expiresIn: 300,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.apikey, "test-server-secret");
  assert.equal(
    requests[0].init.headers.authorization,
    "Bearer test-server-secret",
  );
  assert.deepEqual(JSON.parse(requests[0].init.body), { expiresIn: 300 });
  assert.equal(signed.expiresIn, 300);
  assert.equal(
    signed.url,
    "https://example.supabase.co/storage/v1/object/sign/" +
      "icamp-internal-media/scope/asset.pdf?token=test-token",
  );
});

test("Build 008 rejects unsafe signed URL lifetimes and missing private credentials", async () => {
  const adapter = createSupabaseStorageAdapter({
    projectUrl: "https://example.supabase.co",
  });

  await assert.rejects(
    () =>
      adapter.createSignedReadUrl({
        bucketKey: "icamp-internal-media",
        objectKey: "scope/asset.pdf",
        expiresIn: 3600,
      }),
    /secret key is required/,
  );

  assert.throws(
    () =>
      getMediaStorageConfig({
        ICAMP_MEDIA_SIGNED_URL_SECONDS: "3600",
      }),
    /between 60 and 900 seconds/,
  );
});
