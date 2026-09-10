import { PrismaClient } from "@prisma/client";

/**
 * SocialFlow database client.
 *
 * Final12 now uses Supabase PostgreSQL through Prisma.
 * DATABASE_URL must point to the Supabase Postgres connection used by the app.
 * DIRECT_URL is used by Prisma CLI commands through prisma/schema.prisma.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
