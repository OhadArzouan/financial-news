import { prisma } from '../lib/prisma';

async function deleteFDICFeed() {
  try {
    // Find all FDIC feeds
    const fdicFeeds = await prisma.feed.findMany({
      where: {
        title: {
          contains: 'FDIC'
        }
      }
    });

    if (fdicFeeds.length === 0) {
      console.log('No FDIC feeds found');
      return;
    }

    // Delete each feed and its items
    for (const feed of fdicFeeds) {
      // Delete all feed items first
      await prisma.feedItem.deleteMany({
        where: { feedId: feed.id }
      });

      // Then delete the feed
      await prisma.feed.delete({
        where: { id: feed.id }
      });

      console.log(`Successfully deleted FDIC feed "${feed.title}" (ID: ${feed.id}) and all its items`);
    }

    console.log(`Total feeds deleted: ${fdicFeeds.length}`);
  } catch (error) {
    console.error('Error deleting FDIC feed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteFDICFeed();
