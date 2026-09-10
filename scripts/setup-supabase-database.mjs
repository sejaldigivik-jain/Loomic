/**
 * Prepares the Supabase schema, then copies Final12 data from SQLite.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env");
const prismaCli = resolve(root, "node_modules", "prisma", "build", "index.js");

function readEnvValue(source, key) {
  const match = source.match(
    new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

if (!existsSync(envPath)) {
  console.error("[SocialFlow] .env was not found.");
  console.error("[SocialFlow] Copy the Supabase connection strings into .env first.");
  process.exit(1);
}

const env = readFileSync(envPath, "utf8");
const databaseUrl = readEnvValue(env, "DATABASE_URL");
const directUrl = readEnvValue(env, "DIRECT_URL");

if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.error("[SocialFlow] DATABASE_URL must be a Supabase PostgreSQL URL.");
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(directUrl)) {
  console.error("[SocialFlow] DIRECT_URL must be a Supabase PostgreSQL URL.");
  process.exit(1);
}

if (!existsSync(resolve(root, "db", "custom.db"))) {
  console.error("[SocialFlow] db/custom.db was not found. The SQLite source data is required for migration.");
  process.exit(1);
}

if (!existsSync(prismaCli)) {
  console.error("[SocialFlow] Prisma CLI was not found. Run npm install first.");
  process.exit(1);
}

function run(command, args, label) {
  console.log(`\\n[SocialFlow] ${label}...`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  if (result.error || result.status !== 0) {
    console.error(`[SocialFlow] ${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [prismaCli, "generate"], "Generating PostgreSQL Prisma Client");
run(process.execPath, [prismaCli, "db", "push", "--skip-generate"], "Creating/updating SocialFlow tables in Supabase");
run(process.execPath, [resolve(root, "scripts", "migrate-sqlite-to-supabase.mjs")], "Copying SQLite data to Supabase");

console.log("\\n[SocialFlow] Supabase database conversion finished.");
