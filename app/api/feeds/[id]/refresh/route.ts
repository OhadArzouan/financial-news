import { NextResponse } from 'next/server';
import { refreshSingleFeed } from '@/lib/refresh-utils';

export async function POST(request: Request) {
  // Extract the id from the URL path
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const idStr = pathParts[pathParts.length - 2]; // Get the ID from the path
  const feedId = parseInt(idStr, 10);
  
  if (isNaN(feedId)) {
    return NextResponse.json(
      { error: 'Invalid feed ID' },
      { status: 400 }
    );
  }
  
  try {
    // Use the shared utility to refresh the feed
    const result = await refreshSingleFeed(feedId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error refreshing feed ${feedId}:`, error);
    return NextResponse.json(
      { error: `Failed to refresh feed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
