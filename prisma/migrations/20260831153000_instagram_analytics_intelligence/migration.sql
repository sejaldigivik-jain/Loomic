-- SocialFlow: real Instagram account/content analytics snapshots.
-- Additive only. Existing accounts, tokens, posts, uploads and assignments are untouched.

CREATE TABLE "AccountAnalyticsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socialAccountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "followers" INTEGER,
    "newFollowers" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "accountsEngaged" INTEGER NOT NULL DEFAULT 0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountAnalyticsSnapshot_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountAnalyticsSnapshot_socialAccountId_date_key" ON "AccountAnalyticsSnapshot"("socialAccountId", "date");
CREATE INDEX "AccountAnalyticsSnapshot_socialAccountId_date_idx" ON "AccountAnalyticsSnapshot"("socialAccountId", "date");

CREATE TABLE "InstagramMediaInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socialAccountId" TEXT NOT NULL,
    "externalMediaId" TEXT NOT NULL,
    "caption" TEXT,
    "mediaType" TEXT,
    "mediaProductType" TEXT,
    "permalink" TEXT,
    "thumbnailUrl" TEXT,
    "publishedAt" DATETIME,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" REAL NOT NULL DEFAULT 0,
    "avgWatchTimeMs" REAL,
    "totalWatchTimeMs" REAL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramMediaInsight_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InstagramMediaInsight_socialAccountId_externalMediaId_key" ON "InstagramMediaInsight"("socialAccountId", "externalMediaId");
CREATE INDEX "InstagramMediaInsight_socialAccountId_publishedAt_idx" ON "InstagramMediaInsight"("socialAccountId", "publishedAt");
CREATE INDEX "InstagramMediaInsight_socialAccountId_reach_idx" ON "InstagramMediaInsight"("socialAccountId", "reach");
