/*
  Warnings:

  - You are about to drop the column `pdfUrl` on the `FeedItem` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "FeedItemPdf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "feedItemId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedItemPdf_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "processedContent" TEXT,
    "extendedContent" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "feedId" INTEGER NOT NULL,
    "author" TEXT,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedItem_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FeedItem" ("author", "category", "content", "createdAt", "description", "extendedContent", "feedId", "id", "link", "processedContent", "publishedAt", "title") SELECT "author", "category", "content", "createdAt", "description", "extendedContent", "feedId", "id", "link", "processedContent", "publishedAt", "title" FROM "FeedItem";
DROP TABLE "FeedItem";
ALTER TABLE "new_FeedItem" RENAME TO "FeedItem";
CREATE INDEX "FeedItem_feedId_idx" ON "FeedItem"("feedId");
CREATE UNIQUE INDEX "FeedItem_feedId_link_key" ON "FeedItem"("feedId", "link");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FeedItemPdf_feedItemId_idx" ON "FeedItemPdf"("feedItemId");
