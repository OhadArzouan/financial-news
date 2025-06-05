/*
  Warnings:

  - A unique constraint covering the columns `[feedId,link]` on the table `FeedItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "FeedItem_feedId_idx" ON "FeedItem"("feedId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_feedId_link_key" ON "FeedItem"("feedId", "link");
