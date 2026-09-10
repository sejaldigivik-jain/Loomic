/**
 * SocialFlow — Supabase Storage helpers.
 *
 * Media used to be written to ./public/uploads on the local disk. That works
 * for a single always-on server, but not on Vercel: serverless functions get a
 * read-only filesystem, and anything written to /tmp disappears when the
 * function is recycled. Media now lives in a public Supabase Storage bucket, so
 * every uploaded file gets a permanent URL.
 *
 * A permanent URL matters beyond hosting: Instagram/Facebook publish by
 * *fetching* the media URL from Meta's servers, so the URL has to stay
 * reachable. The old Cloudflare-tunnel URLs changed on every restart, which is
 * why publish-service.ts still rebases legacy `/uploads/*` links.
 */
import { StorageClient } from "@supabase/storage-js";

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "media";

/**
 * Vercel caps serverless request bodies at 4.5 MB, so anything routed through
 * our own API has to stay under that. Images go through the server (sharp
 * normalizes them to JPEG for Instagram), videos are uploaded straight from the
 * browser to Supabase and never touch this limit.
 */
export const MAX_IMAGE_UPLOAD_MB = Math.max(
  1,
  Number(process.env.MAX_IMAGE_UPLOAD_MB ?? process.env.MAX_UPLOAD_MB ?? "4") || 4
);

/**
 * Supabase's Free plan rejects individual files above 50 MB. Raise this (and
 * the project's storage limit) after upgrading the Supabase plan.
 */
export const MAX_VIDEO_UPLOAD_MB = Math.max(
  1,
  Number(process.env.MAX_VIDEO_UPLOAD_MB ?? "50") || 50
);

export const MAX_IMAGE_SIZE = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
export const MAX_VIDEO_SIZE = MAX_VIDEO_UPLOAD_MB * 1024 * 1024;

let cachedAdminClient: StorageClient | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it in Vercel → Settings → Environment Variables ` +
        `(and in .env for local development). See .env.example.`
    );
  }
  return value;
}

/**
 * Server-only Storage client using the service role key, which bypasses row
 * level security -- it must never be imported into a client component or
 * prefixed with NEXT_PUBLIC_.
 *
 * We use @supabase/storage-js rather than the full @supabase/supabase-js on
 * purpose: the umbrella client also constructs a realtime/WebSocket client,
 * which throws on Node 20 and pulls in code this app never uses.
 */
export function storageAdmin(): StorageClient {
  if (cachedAdminClient) return cachedAdminClient;

  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  cachedAdminClient = new StorageClient(`${url}/storage/v1`, {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  });
  return cachedAdminClient;
}

/** Public URL for an object already stored in the media bucket. */
export function publicUrlFor(objectPath: string): string {
  const { data } = storageAdmin().from(STORAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * Build the stored object path. Files are grouped per workspace so a workspace's
 * media can be located (or purged) without scanning the whole bucket.
 */
export function buildObjectPath(workspaceId: string | null, filename: string): string {
  const scope = workspaceId && /^[A-Za-z0-9_-]+$/.test(workspaceId) ? workspaceId : "shared";
  return `${scope}/${filename}`;
}

/** Upload a server-side buffer (used for sharp-normalized images). */
export async function uploadBuffer(
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await storageAdmin()
    .from(STORAGE_BUCKET)
    .upload(objectPath, body, {
      contentType,
      // Object names are UUIDs, so a collision means a retry of the same file.
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }
  return publicUrlFor(objectPath);
}

/**
 * Create a short-lived signed upload URL so the browser can send a video
 * directly to Supabase Storage, bypassing Vercel's 4.5 MB request body limit.
 */
export async function createSignedUpload(objectPath: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}> {
  const { data, error } = await storageAdmin()
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    throw new Error(`Could not create upload URL: ${error?.message ?? "unknown error"}`);
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: publicUrlFor(objectPath),
  };
}
