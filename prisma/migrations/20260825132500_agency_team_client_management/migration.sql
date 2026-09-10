-- SocialFlow agency client/team assignment migration.
-- This migration is additive only: no existing table or row is dropped/reset.

CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClientAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "SocialAccount" ADD COLUMN "clientId" TEXT REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD COLUMN "clientId" TEXT REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD COLUMN "createdByUserId" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Client_workspaceId_name_key" ON "Client"("workspaceId", "name");
CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");
CREATE UNIQUE INDEX "ClientAssignment_clientId_userId_key" ON "ClientAssignment"("clientId", "userId");
CREATE INDEX "ClientAssignment_userId_idx" ON "ClientAssignment"("userId");
CREATE INDEX "SocialAccount_clientId_idx" ON "SocialAccount"("clientId");
CREATE INDEX "Post_clientId_idx" ON "Post"("clientId");
CREATE INDEX "Post_createdByUserId_idx" ON "Post"("createdByUserId");
