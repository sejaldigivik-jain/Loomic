-- Safe/idempotent repair for the already-existing AccountAssignment table.
-- Does not delete or overwrite existing assignment rows.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS "AccountAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socialAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountAssignment_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountAssignment_socialAccountId_userId_key"
ON "AccountAssignment"("socialAccountId", "userId");

CREATE INDEX IF NOT EXISTS "AccountAssignment_userId_idx"
ON "AccountAssignment"("userId");

CREATE INDEX IF NOT EXISTS "AccountAssignment_socialAccountId_idx"
ON "AccountAssignment"("socialAccountId");
