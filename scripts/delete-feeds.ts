import { prisma } from '../lib/prisma';

async function deleteFeedByName(name: string) {
  try {
    // Find all matching feeds
    const feeds = await prisma.feed.findMany({
      where: {
        title: {
          contains: name
        }
      }
    });

    if (feeds.length === 0) {
      console.log(`No feeds found with name containing "${name}"`);
      return;
    }

    // Delete each feed and its items
    for (const feed of feeds) {
      // Delete all feed items first
      await prisma.feedItem.deleteMany({
        where: { feedId: feed.id }
      });

      // Then delete the feed
      await prisma.feed.delete({
        where: { id: feed.id }
      });

      console.log(`Successfully deleted feed "${feed.title}" (ID: ${feed.id}) and all its items`);
    }

    console.log(`Total feeds deleted: ${feeds.length}`);
  } catch (error) {
    console.error(`Error deleting ${name} feed:`, error);
  }
}

async function deleteFeeds() {
  try {
    const feedsToDelete = ['[DELETE]'];
    
    for (const feedName of feedsToDelete) {
      await deleteFeedByName(feedName);
    }
  } catch (error) {
    console.error('Error in delete feeds script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteFeeds();
