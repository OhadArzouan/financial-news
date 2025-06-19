/*
  Warnings:

  - Added the required column `updatedAt` to the `FeedItemPdf` table without a default value. This is not possible if the table is not empty.

*/
-- SQLite doesn't support adding NOT NULL columns with default values to existing tables
-- So we'll create a new table with all the columns and copy the data over

-- Disable foreign key checks temporarily
PRAGMA foreign_keys=OFF;

-- Rename the old table
ALTER TABLE "FeedItemPdf" RENAME TO "FeedItemPdf_old";

-- Create the new table with all columns
CREATE TABLE "FeedItemPdf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "content" TEXT,
    "feedItemId" INTEGER NOT NULL,
    "extractionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "extractionAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastExtractedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedItemPdf_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy data from old table to new table
INSERT INTO "FeedItemPdf" (
    "id",
    "url",
    "content",
    "feedItemId",
    "createdAt",
    "updatedAt"
)
SELECT 
    "id",
    "url",
    "content",
    "feedItemId",
    "createdAt",
    "createdAt" AS "updatedAt"
FROM "FeedItemPdf_old";

-- Create the new index for extraction status
CREATE INDEX "FeedItemPdf_extractionStatus_idx" ON "FeedItemPdf"("extractionStatus");

-- Drop the old table
DROP TABLE "FeedItemPdf_old";

-- Re-enable foreign key checks
PRAGMA foreign_keys=ON;
