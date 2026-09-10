/**
 * One-time Supabase Storage setup for SocialFlow.
 *
 * Creates the public bucket that uploaded images and videos live in. Media has
 * to be publicly readable because Instagram/Facebook publish by fetching the
 * media URL from Meta's own servers.
 *
 * Usage:  node scripts/setup-supabase-storage.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { StorageClient } from "@supabase/storage-js";
import { readFileSync } from "node:fs";

// Minimal .env reader so the script runs without extra dependencies.
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env locally (e.g. running in CI) — rely on the real environment.
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "media";
const maxVideoMb = Number(process.env.MAX_VIDEO_UPLOAD_MB ?? "50") || 50;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Copy them from Supabase Dashboard -> Project Settings -> API into .env.");
  process.exit(1);
}

// storage-js directly, not supabase-js: the umbrella client also builds a
// realtime/WebSocket client, which throws on Node 20.
const storage = new StorageClient(`${url.replace(/\/$/, "")}/storage/v1`, {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
});

const { data: buckets, error: listError } = await storage.listBuckets();
if (listError) {
  console.error(`Could not reach Supabase Storage: ${listError.message}`);
  process.exit(1);
}

const existing = buckets.find((entry) => entry.name === bucket);

if (existing) {
  console.log(`Bucket "${bucket}" already exists (public: ${existing.public}).`);
  if (!existing.public) {
    const { error } = await storage.updateBucket(bucket, { public: true });
    if (error) {
      console.error(`Could not make the bucket public: ${error.message}`);
      process.exit(1);
    }
    console.log(`Bucket "${bucket}" is now public.`);
  }
} else {
  const { error } = await storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: `${maxVideoMb}MB`,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"],
  });
  if (error) {
    console.error(`Could not create bucket "${bucket}": ${error.message}`);
    process.exit(1);
  }
  console.log(`Created public bucket "${bucket}" with a ${maxVideoMb} MB per-file limit.`);
}

console.log("\nSupabase Storage is ready. Uploaded media will be served from:");
console.log(`  ${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/...`);
