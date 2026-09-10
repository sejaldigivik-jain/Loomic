/**
 * SocialFlow local-development bootstrap for Supabase PostgreSQL.
 *
 * `npm run dev` invokes this automatically.
 * It generates Prisma Client, but deliberately does NOT run `prisma db push`
 * against the remote Supabase database on every development start.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env");
const envExamplePath = resolve(root, ".env.example");

function secret() {
  return randomBytes(32).toString("hex");
}

function readDatabaseSetting(source, key) {
  const match = source.match(
    new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

function buildFreshEnv() {
  let source = existsSync(envExamplePath)
    ? readFileSync(envExamplePath, "utf8")
    : [
        'DATABASE_URL="postgresql://YOUR_SUPABASE_SESSION_POOLER_URL"',
        'DIRECT_URL="postgresql://YOUR_SUPABASE_SESSION_POOLER_URL"',
        "",
      ].join("\\n");

  source = source
    .replace(/JWT_SECRET="[^"]*"/, `JWT_SECRET="${secret()}"`)
    .replace(/TOKEN_ENCRYPTION_KEY="[^"]*"/, `TOKEN_ENCRYPTION_KEY="${secret()}"`)
    .replace(/CRON_SECRET="[^"]*"/, `CRON_SECRET="${secret()}"`);

  return source;
}

if (!existsSync(envPath)) {
  writeFileSync(envPath, buildFreshEnv(), "utf8");
  console.error("[SocialFlow] Created .env from .env.example.");
  console.error("[SocialFlow] Add your Supabase DATABASE_URL and DIRECT_URL, then run npm run dev again.");
  process.exit(1);
}

const envSource = readFileSync(envPath, "utf8");
const databaseUrl = readDatabaseSetting(envSource, "DATABASE_URL");
const directUrl = readDatabaseSetting(envSource, "DIRECT_URL");

if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.error("[SocialFlow] DATABASE_URL is not a PostgreSQL/Supabase URL.");
  console.error("[SocialFlow] Final12 has been converted from SQLite to Supabase PostgreSQL.");
  console.error("[SocialFlow] Update DATABASE_URL in .env using Supabase Dashboard -> Connect.");
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(directUrl)) {
  console.error("[SocialFlow] DIRECT_URL is missing or is not a PostgreSQL/Supabase URL.");
  console.error("[SocialFlow] Add the Supabase Session pooler (port 5432) or Direct connection URL.");
  process.exit(1);
}

// Execute Prisma's JS CLI entrypoint directly with Node.
// This preserves the existing Windows-safe behavior.
const prismaCli = resolve(root, "node_modules", "prisma", "build", "index.js");
if (!existsSync(prismaCli)) {
  console.error("[SocialFlow] Prisma CLI is not installed correctly. Run npm install and try again.");
  console.error(`[SocialFlow] Missing: ${prismaCli}`);
  process.exit(1);
}

function runPrisma(args, label) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  if (result.error) {
    console.error(`[SocialFlow] ${label} could not start:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[SocialFlow] ${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log("[SocialFlow] Generating Prisma client for Supabase PostgreSQL...");
runPrisma(["generate"], "Prisma generate");
console.log("[SocialFlow] Prisma client is ready. Remote schema is not modified during normal app startup.");
