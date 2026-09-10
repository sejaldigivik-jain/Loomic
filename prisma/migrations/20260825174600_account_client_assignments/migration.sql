-- SocialFlow Final11: connected social accounts are the agency clients.
-- Add a direct many-to-many assignment from team users to connected accounts.
-- Existing Client/ClientAssignment tables are intentionally preserved for backward compatibility.

CREATE TABLE "AccountAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socialAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountAssignment_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountAssignment_socialAccountId_userId_key" ON "AccountAssignment"("socialAccountId", "userId");
CREATE INDEX "AccountAssignment_userId_idx" ON "AccountAssignment"("userId");
CREATE INDEX "AccountAssignment_socialAccountId_idx" ON "AccountAssignment"("socialAccountId");

-- Carry forward any assignments made through the previous separate-Client patch.
-- One old Client assignment becomes an assignment to every connected account that was attached to that Client.
INSERT OR IGNORE INTO "AccountAssignment" ("id", "socialAccountId", "userId", "assignedAt")
SELECT
  'aa_' || lower(hex(randomblob(16))),
  sa."id",
  ca."userId",
  CURRENT_TIMESTAMP
FROM "SocialAccount" sa
JOIN "ClientAssignment" ca ON ca."clientId" = sa."clientId"
WHERE sa."clientId" IS NOT NULL;
