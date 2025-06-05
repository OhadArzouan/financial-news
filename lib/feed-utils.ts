import Parser from 'rss-parser';
import { prisma } from './prisma';
import { parse } from 'node-html-parser';

const parser = new Parser({
  headers: {
    'User-Agent': 'RSS Feed Aggregator/1.0',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
  }
});

// Helper function to process HTML content
function processContent(content: string | null): string | null {
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
}

export async function fullRefreshFeed(feedId: number) {
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

    // Update lastFetched timestamp and optional fields
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        lastFetched: new Date(),
        description: parsedFeed.description || null,
        author: parsedFeed.managingEditor || parsedFeed['managingeditor'] || null,
      }
    });

    // Update or create items
    if (parsedFeed.items) {
      await Promise.all(parsedFeed.items.map(async item => {
        const existingItem = await prisma.feedItem.findFirst({
          where: {
            feedId: feed.id,
            link: item.link || ''
          }
        });

        const itemData = {
          title: item.title || 'Untitled Item',
          link: item.link || '',
          description: item.contentSnippet || item.description || null,
          content: item['content:encoded'] || item.content || item.description || null,
          processedContent: processContent(item['content:encoded'] || item.content || item.description || null),
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          author: item.creator || item.author || null,
          category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
          feedId: feed.id,
        };

        if (existingItem) {
          await prisma.feedItem.update({
            where: { id: existingItem.id },
            data: itemData
          });
        } else {
          await prisma.feedItem.create({
            data: itemData
          });
        }
      }));
    }

    return true;
  } catch (error) {
    console.error(`Error fully refreshing feed ${feedId}:`, error);
    return false;
  }
}

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
        try {
          // First try to find an existing item with the same feedId and URL
          const existingItem = await prisma.feedItem.findFirst({
            where: {
              feedId: feed.id,
              link: item.link || ''
            }
          });

          if (existingItem) {
            // Update existing item
            await prisma.feedItem.update({
              where: { id: existingItem.id },
              data: {
                title: item.title || 'Untitled Item',
                description: item.contentSnippet || item.description || null,
                content: item.content || null,
                processedContent: processContent(item.content || item.contentSnippet || item.description),
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                author: item.author || item.creator || null,
                category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
              }
            });
          } else {
            // Create new item
            await prisma.feedItem.create({
              data: {
                title: item.title || 'Untitled Item',
                link: item.link || '',
                description: item.contentSnippet || item.description || null,
                content: item.content || null,
                processedContent: processContent(item.content || item.contentSnippet || item.description),
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                author: item.author || item.creator || null,
                category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
                feedId: feed.id,
              }
            });
          }
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
