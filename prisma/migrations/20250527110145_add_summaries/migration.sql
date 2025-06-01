-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Save content to processedContent if not already set
UPDATE "FeedItem"
SET "processedContent" = "content"
WHERE "processedContent" IS NULL AND "content" IS NOT NULL;

CREATE TABLE "new_FeedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "link" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "feedId" INTEGER NOT NULL,
    "processedContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" TEXT,
    "category" TEXT,
    CONSTRAINT "FeedItem_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy data and map url to link
INSERT INTO "new_FeedItem" (
    "id", "title", "description", "link", "publishedAt", 
    "feedId", "processedContent", "createdAt", "author", "category"
) 
SELECT 
    "id", "title", "description", "url", "publishedAt", 
    "feedId", "processedContent", "createdAt", "author", "category"
FROM "FeedItem";

DROP TABLE "FeedItem";
ALTER TABLE "new_FeedItem" RENAME TO "FeedItem";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
