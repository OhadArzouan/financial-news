/*
  Warnings:

  - You are about to drop the column `description` on the `FeedItemPdf` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `FeedItemPdf` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeedItemPdf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "content" TEXT,
    "feedItemId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedItemPdf_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FeedItemPdf" ("createdAt", "feedItemId", "id", "url") SELECT "createdAt", "feedItemId", "id", "url" FROM "FeedItemPdf";
DROP TABLE "FeedItemPdf";
ALTER TABLE "new_FeedItemPdf" RENAME TO "FeedItemPdf";
CREATE INDEX "FeedItemPdf_feedItemId_idx" ON "FeedItemPdf"("feedItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
