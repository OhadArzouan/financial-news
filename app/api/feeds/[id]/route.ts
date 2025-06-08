import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function DELETE(request: Request) {
  try {
    // Extract the id from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const idStr = pathParts[pathParts.length - 1]; // Get the ID from the path
    const feedId = parseInt(idStr);
    
    if (isNaN(feedId)) {
      return NextResponse.json(
        { error: 'Invalid feed ID' },
        { status: 400 }
      );
    }

    // Delete the feed (this will cascade delete all items due to the relation)
    await prisma.feed.delete({
      where: { id: feedId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feed:', error);
    return NextResponse.json(
      { error: 'Failed to delete feed' },
      { status: 500 }
    );
  }
}
