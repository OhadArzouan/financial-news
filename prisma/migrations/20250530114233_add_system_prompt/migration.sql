/*
  Warnings:

  - Added the required column `systemPromptId` to the `Summary` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    CONSTRAINT "Summary_systemPromptId_fkey" FOREIGN KEY ("systemPromptId") REFERENCES "SystemPrompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Summary" ("content", "createdAt", "endDate", "id", "startDate") SELECT "content", "createdAt", "endDate", "id", "startDate" FROM "Summary";
DROP TABLE "Summary";
ALTER TABLE "new_Summary" RENAME TO "Summary";
CREATE INDEX "Summary_systemPromptId_idx" ON "Summary"("systemPromptId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_name_key" ON "SystemPrompt"("name");
