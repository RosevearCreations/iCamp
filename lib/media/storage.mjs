function cleanBaseUrl(value) {
  const normalized = String(value ?? "").trim().replace(/\/+$/u, "");

  if (!/^https:\/\//u.test(normalized)) {
    throw new Error("Supabase Storage URL must use HTTPS.");
  }

  return normalized;
}

function encodeObjectPath(value) {
  return String(value)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeExpiresIn(value) {
  const parsed = Number(value ?? 300);

  if (!Number.isInteger(parsed) || parsed < 60 || parsed > 900) {
    throw new Error(
      "Private media signed URL lifetime must be between 60 and 900 seconds.",
    );
  }

  return parsed;
}

function storageHeaders(secretKey) {
  return {
    apikey: secretKey,
    authorization: "Bearer " + secretKey,
  };
}

function normalizeSignedUrl(projectUrl, signedURL) {
  if (/^https:\/\//u.test(signedURL)) {
    return signedURL;
  }

  if (signedURL.startsWith("/storage/v1/")) {
    return projectUrl + signedURL;
  }

  if (signedURL.startsWith("/object/")) {
    return projectUrl + "/storage/v1" + signedURL;
  }

  return projectUrl + "/storage/v1/" + signedURL.replace(/^\/+/, "");
}

export function getMediaStorageConfig(env = process.env) {
  const provider = (env.ICAMP_MEDIA_STORAGE_PROVIDER ?? "supabase")
    .trim()
    .toLowerCase();

  if (provider !== "supabase") {
    throw new Error("Unsupported media storage provider.");
  }

  const projectUrl = env.ICAMP_SUPABASE_URL ?? env.SUPABASE_URL;
  const secretKey =
    env.ICAMP_SUPABASE_SECRET_KEY ??
    env.SUPABASE_SECRET_KEY ??
    env.SUPABASE_SERVICE_ROLE_KEY ??
    null;

  return {
    provider,
    projectUrl: projectUrl ? cleanBaseUrl(projectUrl) : null,
    secretKey: secretKey?.trim() || null,
    signedUrlSeconds: normalizeExpiresIn(
      env.ICAMP_MEDIA_SIGNED_URL_SECONDS ?? 300,
    ),
  };
}

export function createSupabaseStorageAdapter({
  projectUrl,
  secretKey,
  fetchImpl = globalThis.fetch,
}) {
  const baseUrl = cleanBaseUrl(projectUrl);
  const key = String(secretKey ?? "").trim();

  if (!key) {
    throw new Error("Supabase Storage secret key is required.");
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  async function checkedJson(response, action) {
    if (!response.ok) {
      throw new Error(action + " failed with status " + response.status + ".");
    }

    return response.json();
  }

  return Object.freeze({
    provider: "supabase",

    getPublicUrl({ bucketKey, objectKey }) {
      return (
        baseUrl +
        "/storage/v1/object/public/" +
        encodeURIComponent(bucketKey) +
        "/" +
        encodeObjectPath(objectKey)
      );
    },

    async uploadValidatedObject({
      bucketKey,
      objectKey,
      contentType,
      body,
    }) {
      const response = await fetchImpl(
        baseUrl +
          "/storage/v1/object/" +
          encodeURIComponent(bucketKey) +
          "/" +
          encodeObjectPath(objectKey),
        {
          method: "POST",
          headers: {
            ...storageHeaders(key),
            "content-type": contentType,
            "x-upsert": "false",
          },
          body,
        },
      );

      return checkedJson(response, "Storage upload");
    },

    async createSignedReadUrl({ bucketKey, objectKey, expiresIn }) {
      const lifetime = normalizeExpiresIn(expiresIn);
      const response = await fetchImpl(
        baseUrl +
          "/storage/v1/object/sign/" +
          encodeURIComponent(bucketKey) +
          "/" +
          encodeObjectPath(objectKey),
        {
          method: "POST",
          headers: {
            ...storageHeaders(key),
            "content-type": "application/json",
          },
          body: JSON.stringify({ expiresIn: lifetime }),
        },
      );
      const payload = await checkedJson(response, "Signed media access");
      const signedURL = payload.signedURL ?? payload.signedUrl;

      if (!signedURL || typeof signedURL !== "string") {
        throw new Error("Storage provider returned no signed URL.");
      }

      return {
        url: normalizeSignedUrl(baseUrl, signedURL),
        expiresIn: lifetime,
      };
    },
  });
}
