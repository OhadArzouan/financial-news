import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshSingleFeed } from '@/lib/refresh-utils';

export async function POST() {
  try {
    // Get all feeds
    const feeds = await prisma.feed.findMany();
    
    if (!feeds || feeds.length === 0) {
      return NextResponse.json(
        { message: 'No feeds found to refresh' },
        { status: 200 }
      );
    }

    // Directly use the shared utility function for each feed
    const refreshPromises = feeds.map(async (feed) => {
      try {
        const result = await refreshSingleFeed(feed.id);
        return {
          ...result,
          title: feed.title || result.feedTitle,
          success: true
        };
      } catch (error) {
        console.error(`Error refreshing feed ${feed.id} (${feed.title}):`, error);
        return {
          feedId: feed.id,
          title: feed.title,
          success: false,
          error: (error as Error).message
        };
      }
    });

    // Wait for all refresh operations to complete
    const results = await Promise.all(refreshPromises);
    
    return NextResponse.json({
      success: true,
      message: `Refreshed ${results.filter(r => r.success).length}/${feeds.length} feeds`,
      results
    });
  } catch (error) {
    console.error('Error in bulk feed refresh:', error);
    return NextResponse.json(
      { error: `Failed to refresh feeds: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
