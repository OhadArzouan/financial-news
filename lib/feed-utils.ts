import Parser from 'rss-parser';
import { prisma } from './prisma';
import { parse } from 'node-html-parser';

const parser = new Parser({
  headers: {
    'User-Agent': 'RSS Feed Aggregator/1.0',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
  }
});

export async function refreshFeed(feedId: number) {
  try {
    // Get the feed from database
    const feed = await prisma.feed.findUnique({
      where: { id: feedId }
    });

    if (!feed) {
      throw new Error(`Feed with id ${feedId} not found`);
    }

    // Fetch the feed content
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    const feedContent = await response.text();
    const parsedFeed = await parser.parseString(feedContent);

    // Only update lastFetched timestamp and optional fields, preserve original title
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        lastFetched: new Date(),
        description: feed.description || parsedFeed.description, // Only update if not set
        author: feed.author || parsedFeed.managingEditor || parsedFeed['managingeditor'], // Only update if not set
      }
    });

    // Helper function to process HTML content
    const processContent = (content: string | null): string | null => {
      if (!content) return null;
      if (/<[a-z][\s\S]*>/i.test(content)) {
        try {
          const root = parse(content);
          const textNodes: string[] = [];
          const walk = (node: any) => {
            if (node.nodeType === 3) { // Text node
              const text = node.text.trim();
              if (text) textNodes.push(text);
            } else if (node.childNodes) {
              node.childNodes.forEach(walk);
            }
            // Add newline after block elements
            if (node.tagName && /^(div|p|br|h[1-6]|ul|ol|li|blockquote|pre)$/i.test(node.tagName)) {
              textNodes.push('\n');
            }
          };
          walk(root);
          return textNodes
            .join(' ')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
        } catch (error) {
          console.error('Error processing HTML content:', error);
          return content;
        }
      }
      return content;
    };

    // Add new items
    if (parsedFeed.items) {
      for (const item of parsedFeed.items) {
        // Try to create the item, if it already exists (by URL), skip it
        try {
          await prisma.feedItem.create({
            data: {
              title: item.title || 'Untitled Item',
              url: item.link || '',
              description: item.contentSnippet || item.description || null,
              content: item.content || null,
              processedContent: processContent(item.content || item.contentSnippet || item.description),
              publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              author: item.author || item.creator || null,
              category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
              feedId: feed.id,
            },
          });
        } catch (error) {
          // If the error is due to a unique constraint violation (duplicate URL), ignore it
          if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
            throw error;
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`Error refreshing feed ${feedId}:`, error);
    return false;
  }
}
