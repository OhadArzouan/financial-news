import { prisma } from './prisma';
import Parser from 'rss-parser';
import { parse } from 'node-html-parser';
import fetch from 'node-fetch';
import { extractTextFromPdf } from './pdf-utils';

const parser = new Parser({
  headers: {
    'User-Agent': 'RSS Feed Aggregator/1.0',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
  }
});

// Helper function to extract PDF URLs from HTML content
export async function extractPdfUrls(html: string | null, baseUrl: string): Promise<string[]> {
  if (!html) return [];
  
  try {
    const root = parse(html);
    // Look for links with .pdf in the href
    const pdfLinks = root.querySelectorAll('a[href*=".pdf"]');
    const pdfUrls: string[] = [];
    
    // Process all PDF links found
    for (const linkElement of pdfLinks) {
      const pdfUrl = linkElement.getAttribute('href');
      if (pdfUrl) {
        let absoluteUrl = pdfUrl;
        
        // Handle relative URLs
        if (pdfUrl.startsWith('/')) {
          // Construct absolute URL from base URL
          try {
            const baseUrlObj = new URL(baseUrl);
            absoluteUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${pdfUrl}`;
          } catch (urlError) {
            console.error('Error parsing base URL:', urlError);
            continue; // Skip this URL and continue with the next one
          }
        } else if (!pdfUrl.startsWith('http')) {
          // Handle other relative paths
          try {
            // Remove filename from base URL to get the directory
            let baseDirectory = baseUrl;
            const lastSlashIndex = baseUrl.lastIndexOf('/');
            if (lastSlashIndex > 8) { // Check if there's a path component (http://x/)
              baseDirectory = baseUrl.substring(0, lastSlashIndex + 1);
            }
            absoluteUrl = new URL(pdfUrl, baseDirectory).toString();
          } catch (urlError) {
            console.error('Error creating absolute URL from relative path:', urlError);
            continue; // Skip this URL and continue with the next one
          }
        }
        
        // Only add unique URLs to the result
        if (!pdfUrls.includes(absoluteUrl)) {
          pdfUrls.push(absoluteUrl);
        }
      }
    }
    
    return pdfUrls;
  } catch (error) {
    console.error('Error extracting PDF URLs:', error);
    return [];
  }
}

// Helper function to fetch extended content from a URL
export async function fetchExtendedContent(url: string): Promise<{content: string | null, pdfUrls: string[]}> {
  try {
    console.log(`Fetching extended content from ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      // @ts-ignore - node-fetch types don't include timeout but it's supported
      timeout: 10000 // 10 seconds timeout
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch extended content from ${url}: ${response.status} ${response.statusText}`);
      return { content: null, pdfUrls: [] };
    }
    
    const html = await response.text();
    console.log(`Received HTML response of length ${html.length} from ${url}`);
    
    // Extract the main content
    const root = parse(html);
    
    // Try to find the main content using common content containers
    const contentSelectors = [
      'article', 'main', '.content', '#content', '.post-content',
      '.article-content', '.entry-content', '.post'
    ];
    
    let mainContent = null;
    for (const selector of contentSelectors) {
      const element = root.querySelector(selector);
      if (element) {
        mainContent = element.text;
        break;
      }
    }
    
    // If no content found with selectors, try to get at least some meaningful text
    if (!mainContent) {
      // Remove script, style, nav, header, footer elements
      const elements = root.querySelectorAll('script, style, nav, header, footer, aside');
      elements.forEach(el => el.remove());
      
      // Get the remaining text content
      mainContent = root.text;
    }
    
    // Extract PDF URLs
    const pdfUrls = await extractPdfUrls(html, url);
    if (pdfUrls.length > 0) {
      console.log(`Found ${pdfUrls.length} PDF links:`, pdfUrls);
    }
    
    // Process the content to clean it up
    const processedContent = processContent(mainContent);
    
    return {
      content: processedContent,
      pdfUrls
    };
  } catch (error) {
    console.error(`Error fetching extended content from ${url}:`, error);
    return { content: null, pdfUrls: [] };
  }
}

// Helper function to process HTML content
export function processContent(content: string | null): string | null {
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

// Main function to refresh a single feed
export async function refreshSingleFeed(feedId: number) {
  try {
    // Get the feed from database
    const feed = await prisma.feed.findUnique({
      where: { id: feedId }
    });

    if (!feed) {
      throw new Error(`Feed with id ${feedId} not found`);
    }

    console.log(`Refreshing feed: ${feed.title} (${feed.url})`);

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
    console.log(`Parsed feed with ${parsedFeed.items?.length || 0} items`);

    // Update lastFetched timestamp
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        lastFetched: new Date(),
        description: feed.description || parsedFeed.description,
        author: feed.author || parsedFeed.managingEditor || parsedFeed['managingeditor'],
      }
    });

    const results = {
      newItems: 0,
      updatedItems: 0,
      itemsWithExtendedContent: 0,
      itemsWithPDFs: 0,
      totalPDFs: 0
    };

      // Process each feed item
    if (parsedFeed.items && parsedFeed.items.length > 0) {
      for (const item of parsedFeed.items) {
        try {
          // Check if item already exists
          const existingItem = await prisma.feedItem.findFirst({
            where: {
              feedId: feed.id,
              link: item.link || ''
            }
          });

          // Try to fetch extended content if there's a link
          let extendedContent = null;
          let pdfUrls: string[] = [];
          
          if (item.link) {
            try {
              console.log(`Fetching extended content for item: ${item.title} at ${item.link}`);
              const result = await fetchExtendedContent(item.link);
              extendedContent = result.content;
              pdfUrls = result.pdfUrls;
              
              if (extendedContent) {
                console.log(`Successfully fetched extended content for ${item.title}`);
                results.itemsWithExtendedContent++;
              }
              
              if (pdfUrls.length > 0) {
                console.log(`Found ${pdfUrls.length} PDF links for ${item.title}:`, pdfUrls);
                results.itemsWithPDFs++;
                results.totalPDFs += pdfUrls.length;
              }
            } catch (contentError) {
              console.error(`Error fetching extended content for ${item.title}:`, contentError);
            }
          }

          if (existingItem) {
            // Update existing item
            const updatedItem = await prisma.feedItem.update({
              where: { id: existingItem.id },
              data: {
                title: item.title || 'Untitled Item',
                description: item.contentSnippet || item.description || null,
                content: item.content || item['content:encoded'] || null,
                processedContent: processContent(item.content || item['content:encoded'] || item.contentSnippet || item.description),
                extendedContent,
                publishedAt: item.pubDate ? new Date(item.pubDate) : existingItem.publishedAt,
                author: item.author || item.creator || null,
                category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
              }
            });
            
            // First, delete any existing PDFs for this item
            await prisma.feedItemPdf.deleteMany({
              where: {
                feedItemId: existingItem.id
              }
            });
            
            // Then create new PDF entries
            if (pdfUrls.length > 0) {
              // Process each PDF URL
              for (const pdfUrl of pdfUrls) {
                // Try to extract text content from the PDF
                const pdfContent = await extractTextFromPdf(pdfUrl);
                
                // Create the PDF entry
                await prisma.feedItemPdf.create({
                  data: {
                    url: pdfUrl,
                    content: pdfContent,
                    feedItemId: existingItem.id
                  }
                });
              }
            }
            
            results.updatedItems++;
          } else {
            // Create new item
            const newFeedItem = await prisma.feedItem.create({
              data: {
                title: item.title || 'Untitled Item',
                link: item.link || '',
                description: item.contentSnippet || item.description || null,
                content: item.content || item['content:encoded'] || null,
                processedContent: processContent(item.content || item['content:encoded'] || item.contentSnippet || item.description),
                extendedContent,
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                author: item.author || item.creator || null,
                category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
                feedId: feed.id,
              }
            });
            
            // Create PDF entries for the new feed item
            if (pdfUrls.length > 0) {
              // Process each PDF URL
              for (const pdfUrl of pdfUrls) {
                // Try to extract text content from the PDF
                const pdfContent = await extractTextFromPdf(pdfUrl);
                
                // Create the PDF entry
                await prisma.feedItemPdf.create({
                  data: {
                    url: pdfUrl,
                    content: pdfContent,
                    feedItemId: newFeedItem.id
                  }
                });
              }
            }
            
            results.newItems++;
          }
        } catch (error) {
          console.error(`Error processing item "${item.title}":`, error);
        }
      }
    }

    return {
      success: true,
      feedId: feed.id,
      feedTitle: feed.title,
      itemsProcessed: parsedFeed.items?.length || 0,
      results
    };
  } catch (error) {
    console.error(`Error refreshing feed ${feedId}:`, error);
    throw error;
  }
}
