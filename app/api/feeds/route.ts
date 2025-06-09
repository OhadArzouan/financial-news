import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { prisma } from '../../../lib/prisma';
import { processContent } from '../../../lib/content-processor';

const parser = new Parser({
  headers: {
    'User-Agent': 'RSS Feed Aggregator/1.0',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
  },
  requestOptions: {
    timeout: 10000
  }
});

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    // Fetch the feed content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    const feedContent = await response.text();
    
    // Parse the feed content
    const feed = await parser.parseString(feedContent);
    
    // Create the feed in the database
    const newFeed = await prisma.feed.create({
      data: {
        title: feed.title || 'Untitled Feed',
        url: url,
        description: feed.description || null,
        lastFetched: new Date(),
        author: feed.managingEditor || feed['managingeditor'] || null,
      },
    });

    // Create feed items
    if (feed.items) {
      await Promise.all(
        feed.items.map((item) =>
          prisma.feedItem.create({
            data: {
              title: item.title || 'Untitled',
              link: item.link || '',
              description: item.contentSnippet || item.description || null,
              content: item['content:encoded'] || item.content || item.description || null,
              processedContent: processContent(item['content:encoded'] || item.content || item.description || null),
              publishedAt: new Date(item.pubDate || item.isoDate || new Date()),
              author: item.creator || item.author || null,
              category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
              feedId: newFeed.id,
            },
          })
        )
      );
    }

    return NextResponse.json(newFeed);
  } catch (error) {
    console.error('Error adding feed:', error);
    let errorMessage = 'Failed to add feed';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('406')) {
        errorMessage = 'The RSS feed server rejected our request. Please verify the feed URL.';
        statusCode = 406;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function GET() {
  try {
    const feeds = await prisma.feed.findMany({
      include: {
        items: {
          include: {
            pdfs: true
          },
          orderBy: {
            publishedAt: 'desc' as const,
          },
          take: 50,
        },
      },
      orderBy: {
        title: 'asc' as const,
      },
    });
    
    console.log('Fetched feeds with items:', JSON.stringify(feeds, null, 2));
    return NextResponse.json(feeds);
  } catch (error) {
    console.error('Error fetching feeds:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
