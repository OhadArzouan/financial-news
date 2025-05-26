import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { refreshFeed } from '../../../lib/feed-utils';

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
