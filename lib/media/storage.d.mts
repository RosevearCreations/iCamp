export interface MediaStorageConfig {
  provider: "supabase";
  projectUrl: string | null;
  secretKey: string | null;
  signedUrlSeconds: number;
}

export interface StorageObjectInput {
  bucketKey: string;
  objectKey: string;
}

export interface ValidatedUploadInput extends StorageObjectInput {
  contentType: string;
  body: BodyInit;
}

export interface SignedReadInput extends StorageObjectInput {
  expiresIn: number;
}

export interface SupabaseStorageAdapter {
  provider: "supabase";
  getPublicUrl(input: StorageObjectInput): string;
  uploadValidatedObject(input: ValidatedUploadInput): Promise<unknown>;
  createSignedReadUrl(input: SignedReadInput): Promise<{
    url: string;
    expiresIn: number;
  }>;
}

export function getMediaStorageConfig(
  env?: NodeJS.ProcessEnv,
): MediaStorageConfig;

export function createSupabaseStorageAdapter(input: {
  projectUrl: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): SupabaseStorageAdapter;
