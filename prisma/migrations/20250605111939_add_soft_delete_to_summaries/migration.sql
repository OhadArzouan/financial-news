-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Summary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systemPromptId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Summary_systemPromptId_fkey" FOREIGN KEY ("systemPromptId") REFERENCES "SystemPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Summary" ("content", "createdAt", "endDate", "id", "startDate", "systemPromptId") SELECT "content", "createdAt", "endDate", "id", "startDate", "systemPromptId" FROM "Summary";
DROP TABLE "Summary";
ALTER TABLE "new_Summary" RENAME TO "Summary";
CREATE INDEX "Summary_systemPromptId_idx" ON "Summary"("systemPromptId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
