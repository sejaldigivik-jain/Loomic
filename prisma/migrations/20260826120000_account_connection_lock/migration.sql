-- Permanent owner-only password protecting new social account connections.
-- This migration is additive only: existing accounts, tokens, posts and uploads are untouched.
CREATE TABLE "AccountConnectionLock" (
    "workspaceId" TEXT NOT NULL PRIMARY KEY,
    "passwordHash" TEXT NOT NULL,
    "setByUserId" TEXT NOT NULL,
    "setAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" DATETIME,
    "lockedUntil" DATETIME,
    CONSTRAINT "AccountConnectionLock_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AccountConnectionGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "AccountConnectionGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountConnectionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountConnectionGrant_workspaceId_idx" ON "AccountConnectionGrant"("workspaceId");
CREATE INDEX "AccountConnectionGrant_userId_idx" ON "AccountConnectionGrant"("userId");
CREATE INDEX "AccountConnectionGrant_expiresAt_idx" ON "AccountConnectionGrant"("expiresAt");
