/**
 * One-time SQLite -> Supabase PostgreSQL data migration for SocialFlow Final12.
 *
 * Source: db/custom.db (read-only)
 * Target: DIRECT_URL from .env (Supabase Postgres)
 *
 * The script creates NO schema. Run `npm run db:supabase:push` first.
 * Existing target data is never overwritten. The target must be empty.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const envPath = resolve(root, ".env");

function loadDotEnv(path) {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnv(envPath);

const sqlitePath = resolve(
  root,
  process.env.SOURCE_SQLITE_PATH || "db/custom.db",
);

const sourceOnly = process.argv.includes("--source-only");

if (!existsSync(sqlitePath)) {
  console.error(`[SocialFlow] SQLite source database was not found: ${sqlitePath}`);
  process.exit(1);
}

const sqlite = new DatabaseSync(sqlitePath, {
  readOnly: true,
});

const sqliteTables = new Set(
  sqlite
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name <> '_prisma_migrations'`,
    )
    .all()
    .map((row) => String(row.name)),
);

console.log(`[SocialFlow] SQLite source: ${sqlitePath}`);
console.log(`[SocialFlow] Source tables: ${sqliteTables.size}`);

if (sourceOnly) {
  let total = 0;
  for (const table of [...sqliteTables].sort()) {
    const count = Number(
      sqlite.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count,
    );
    total += count;
    console.log(`  ${table}: ${count}`);
  }
  console.log(`[SocialFlow] Source rows: ${total}`);
  sqlite.close();
  process.exit(0);
}

const directUrl = process.env.DIRECT_URL || "";
if (!/^postgres(ql)?:\/\//i.test(directUrl)) {
  console.error("[SocialFlow] DIRECT_URL is missing or invalid in .env.");
  console.error("[SocialFlow] Use the Supabase Session pooler (port 5432) or Direct connection URL.");
  sqlite.close();
  process.exit(1);
}

// Use the non-transaction-pooled URL for the one-time data migration.
process.env.DATABASE_URL = directUrl;

const { PrismaClient, Prisma } = await import("@prisma/client");
const prisma = new PrismaClient({
  log: ["error"],
});

function delegateName(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function scalarFields(model) {
  return model.fields.filter((field) => field.kind === "scalar");
}

function dependencyOrder(models) {
  const modelNames = new Set(models.map((model) => model.name));
  const dependencies = new Map(
    models.map((model) => [model.name, new Set()]),
  );

  for (const model of models) {
    for (const field of model.fields) {
      if (
        field.kind === "object" &&
        Array.isArray(field.relationFromFields) &&
        field.relationFromFields.length > 0 &&
        field.type !== model.name &&
        modelNames.has(field.type)
      ) {
        dependencies.get(model.name).add(field.type);
      }
    }
  }

  const remaining = new Set(models.map((model) => model.name));
  const order = [];

  while (remaining.size > 0) {
    let progressed = false;

    for (const name of [...remaining]) {
      const deps = dependencies.get(name);
      const ready = [...deps].every((dep) => !remaining.has(dep));

      if (ready) {
        order.push(name);
        remaining.delete(name);
        progressed = true;
      }
    }

    if (!progressed) {
      // A self/circular optional relation should not block the migration.
      order.push(...remaining);
      break;
    }
  }

  return order;
}

function convertValue(field, value) {
  if (value === null || value === undefined) return null;

  switch (field.type) {
    case "DateTime": {
      const date =
        typeof value === "number"
          ? new Date(value)
          : /^\d+$/.test(String(value))
            ? new Date(Number(value))
            : new Date(String(value));

      if (Number.isNaN(date.getTime())) {
        throw new Error(
          `Invalid DateTime value for ${field.name}: ${String(value)}`,
        );
      }

      return date;
    }

    case "Boolean":
      return Boolean(Number(value));

    case "Int":
    case "Float":
      return Number(value);

    case "String":
    default:
      return value;
  }
}

function sqliteRowsForModel(model) {
  if (!sqliteTables.has(model.name)) return [];

  const fields = scalarFields(model);
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  const rows = sqlite.prepare(`SELECT * FROM "${model.name}"`).all();

  return rows.map((row) => {
    const data = {};

    for (const [column, value] of Object.entries(row)) {
      const field = fieldMap.get(column);
      if (!field) continue;
      data[column] = convertValue(field, value);
    }

    return data;
  });
}

async function targetCount(modelName) {
  const delegate = prisma[delegateName(modelName)];
  if (!delegate?.count) return 0;
  return delegate.count();
}

async function insertInChunks(modelName, rows, chunkSize = 200) {
  if (!rows.length) return 0;

  const delegate = prisma[delegateName(modelName)];
  if (!delegate?.createMany) {
    throw new Error(`Prisma delegate not found for model ${modelName}`);
  }

  let inserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const result = await delegate.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  return inserted;
}

try {
  await prisma.$queryRaw`SELECT 1`;

  const models = Prisma.dmmf.datamodel.models.filter(
    (model) => sqliteTables.has(model.name),
  );
  const order = dependencyOrder(models);

  console.log("[SocialFlow] Verifying that the Supabase target is empty...");

  const occupied = [];
  for (const name of order) {
    const count = await targetCount(name);
    if (count > 0) occupied.push(`${name}=${count}`);
  }

  if (occupied.length) {
    console.error("[SocialFlow] Migration stopped because the Supabase target already contains SocialFlow data:");
    for (const item of occupied) console.error(`  ${item}`);
    console.error("[SocialFlow] Use a new/empty Supabase project or clear the target intentionally before retrying.");
    process.exitCode = 2;
  } else {
    console.log("[SocialFlow] Target is empty. Starting migration...");

    const sourceCounts = new Map();
    const insertedCounts = new Map();

    for (const name of order) {
      const model = models.find((item) => item.name === name);
      const rows = sqliteRowsForModel(model);
      sourceCounts.set(name, rows.length);

      if (!rows.length) {
        insertedCounts.set(name, 0);
        continue;
      }

      const inserted = await insertInChunks(name, rows);
      insertedCounts.set(name, inserted);
      console.log(`  ${name}: ${inserted}/${rows.length}`);
    }

    console.log("[SocialFlow] Verifying row counts...");

    const mismatches = [];
    let sourceTotal = 0;
    let targetTotal = 0;

    for (const name of order) {
      const sourceCount = sourceCounts.get(name) ?? 0;
      const target = await targetCount(name);
      sourceTotal += sourceCount;
      targetTotal += target;

      if (sourceCount !== target) {
        mismatches.push(`${name}: SQLite=${sourceCount}, Supabase=${target}`);
      }
    }

    if (mismatches.length) {
      console.error("[SocialFlow] Migration completed with count mismatches:");
      for (const mismatch of mismatches) console.error(`  ${mismatch}`);
      process.exitCode = 3;
    } else {
      console.log(`[SocialFlow] Migration verified: ${sourceTotal} rows copied.`);
      console.log("[SocialFlow] SQLite remains untouched as your rollback backup.");
      console.log("[SocialFlow] SocialFlow is ready to use Supabase PostgreSQL.");
    }
  }
} catch (error) {
  console.error(
    "[SocialFlow] Supabase migration failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
} finally {
  sqlite.close();
  await prisma.$disconnect();
}
