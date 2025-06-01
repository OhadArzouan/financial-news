import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { refreshFeed, fullRefreshFeed } from '../../../lib/feed-utils';

export async function POST(request: Request) {
  try {
    const { feedId, fullRefresh } = await request.json();

    if (feedId) {
      // Refresh single feed
      const success = fullRefresh ? 
        await fullRefreshFeed(feedId) : 
        await refreshFeed(feedId);

      if (!success) {
        throw new Error(`Failed to refresh feed ${feedId}`);
      }

      return NextResponse.json({
        message: `Successfully ${fullRefresh ? 'fully ' : ''}refreshed feed ${feedId}`,
        success: true
      });
    }

    // Refresh all feeds
    const feeds = await prisma.feed.findMany();
    const results = await Promise.all(
      feeds.map(feed => fullRefresh ? fullRefreshFeed(feed.id) : refreshFeed(feed.id))
    );

    const successCount = results.filter(Boolean).length;

    return NextResponse.json({
      message: `Successfully ${fullRefresh ? 'fully ' : ''}refreshed ${successCount} out of ${feeds.length} feeds`,
      success: true
    });
  } catch (error) {
    console.error('Error refreshing feeds:', error);
    return NextResponse.json(
      { error: 'Failed to refresh feeds' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get all feeds
    const feeds = await prisma.feed.findMany();
    
    // Refresh each feed
    const results = await Promise.all(
      feeds.map(feed => refreshFeed(feed.id))
    );

    // Count successful refreshes
    const successCount = results.filter(Boolean).length;

    return NextResponse.json({
      message: `Successfully refreshed ${successCount} out of ${feeds.length} feeds`,
      success: true
    });
  } catch (error) {
    console.error('Error refreshing feeds:', error);
    return NextResponse.json(
      { error: 'Failed to refresh feeds' },
      { status: 500 }
    );
  }
}

// Enable CORS for this route to allow external services (like cron jobs) to trigger it
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
