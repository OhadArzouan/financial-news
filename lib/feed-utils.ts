import Parser from 'rss-parser';
import { prisma } from './prisma';
import { parse } from 'node-html-parser';
import fetch from 'node-fetch';
import { extractPdfText } from './pdf-extractor';

const parser = new Parser({
  headers: {
    'User-Agent': 'RSS Feed Aggregator/1.0',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
  }
});

// Helper function to extract PDF URLs from HTML content
async function extractPdfUrls(html: string | null, baseUrl: string): Promise<string | null> {
  if (!html) return null;
  
  try {
    const root = parse(html);
    // Look for links with .pdf in the href
    const pdfLinks = root.querySelectorAll('a[href*=".pdf"]');
    
    if (pdfLinks.length > 0) {
      // Return the first PDF link found
      const pdfUrl = pdfLinks[0].getAttribute('href');
      if (pdfUrl) {
        // Handle relative URLs
        if (pdfUrl.startsWith('/')) {
          // Construct absolute URL from base URL
          try {
            const baseUrlObj = new URL(baseUrl);
            return `${baseUrlObj.protocol}//${baseUrlObj.host}${pdfUrl}`;
          } catch (urlError) {
            console.error('Error parsing base URL:', urlError);
            return null;
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
            return new URL(pdfUrl, baseDirectory).toString();
          } catch (urlError) {
            console.error('Error creating absolute URL from relative path:', urlError);
            return null;
          }
        }
        return pdfUrl;
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting PDF URLs:', error);
    return null;
  }
}

// Helper function to fetch extended content from a URL
async function fetchExtendedContent(url: string): Promise<{content: string | null, pdfUrl: string | null}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch extended content from ${url}: ${response.status} ${response.statusText}`);
      return { content: null, pdfUrl: null };
    }
    
    const html = await response.text();
    
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
    const pdfUrl = await extractPdfUrls(html, url);
    
    // Process the content to clean it up
    const processedContent = processContent(mainContent);
    
    return {
      content: processedContent,
      pdfUrl
    };
  } catch (error) {
    console.error(`Error fetching extended content from ${url}:`, error);
    return { content: null, pdfUrl: null };
  }
}

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
      for (const item of parsedFeed.items) {
        // Skip items without links
        if (!item.link || typeof item.link !== 'string') continue;
        
        // Check if the item already exists in the database
        const existingItem = await prisma.feedItem.findUnique({
          where: {
            feedId_link: {
              feedId: feed.id,
              link: item.link || ''
            }
          }
        });
        
        // Skip if the item already exists
        if (existingItem) continue;
        
        // Try to fetch extended content and PDF links if there's a URL
        let extendedContent = null;
        let pdfUrl = null;
        
        try {
          if (item.link) {
            const result = await fetchExtendedContent(item.link);
            extendedContent = result.content;
            pdfUrl = result.pdfUrl;
            
            if (pdfUrl) {
              console.log(`Found PDF link for ${item.title}: ${pdfUrl}`);
            
              // Extract text from the PDF
              const pdfContent = await extractPdfText(pdfUrl);
            
              // Create the feed item first
              const createdItem = await prisma.feedItem.create({
                data: {
                  title: item.title || 'Untitled Item',
                  link: item.link || '',
                  description: item.contentSnippet || item.description || null,
                  content: item.content || null,
                  processedContent: processContent(item.content || item.contentSnippet || item.description),
                  extendedContent,
                  publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                  author: item.author || item.creator || null,
                  category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
                  feedId: feed.id,
                }
              });
            
              // Save the PDF and its content to the database
              await prisma.feedItemPdf.create({
                data: {
                  url: pdfUrl,
                  content: pdfContent,
                  feedItemId: createdItem.id
                }
              });
            
              console.log(`Saved PDF content (${pdfContent?.length || 0} chars) for new item: ${item.title}`);
            
              // Skip the regular item creation since we've already created it
              continue;
            }
          }
        } catch (contentError) {
          console.error(`Error fetching extended content for ${item.title}:`, contentError);
        }
        
        // Create the feed item
        try {
          const createdItem = await prisma.feedItem.create({
            data: {
              title: item.title || 'Untitled Item',
              link: item.link || '',
              description: item.contentSnippet || item.description || null,
              content: item.content || null,
              processedContent: processContent(item.content || item.contentSnippet || item.description),
              extendedContent,
              publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              author: item.author || item.creator || null,
              category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
              feedId: feed.id,
            }
          });
          
          // If we have a PDF URL but couldn't process it earlier, try again
          if (pdfUrl) {
            try {
              // Extract text from the PDF
              const pdfContent = await extractPdfText(pdfUrl);
              
              // Save the PDF and its content to the database
              await prisma.feedItemPdf.create({
                data: {
                  url: pdfUrl,
                  content: pdfContent,
                  feedItemId: createdItem.id
                }
              });
              
              console.log(`Saved PDF content (${pdfContent?.length || 0} chars) for item: ${item.title}`);
            } catch (pdfError) {
              console.error(`Error processing PDF for ${item.title}:`, pdfError);
            }
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
          const existingItem = await prisma.feedItem.findUnique({
            where: {
              feedId_link: {
                feedId: feed.id,
                link: item.link || ''
              }
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
            // First, try to fetch extended content if there's a link
            let extendedContent = null;
            let pdfUrl = null;
            
            if (item.link) {
              try {
                console.log(`Fetching extended content for item: ${item.title} at ${item.link}`);
                const result = await fetchExtendedContent(item.link);
                extendedContent = result.content;
                pdfUrl = result.pdfUrl;
                
                if (extendedContent) {
                  console.log(`Successfully fetched extended content for ${item.title}`);
                }
                
                if (pdfUrl) {
                  console.log(`Found PDF link for ${item.title}: ${pdfUrl}`);
                }
              } catch (contentError) {
                console.error(`Error fetching extended content for ${item.title}:`, contentError);
              }
            }
            
            // Create the feed item
            try {
              const createdItem = await prisma.feedItem.create({
                data: {
                  title: item.title || 'Untitled Item',
                  link: item.link || '',
                  description: item.contentSnippet || item.description || null,
                  content: item.content || null,
                  processedContent: processContent(item.content || item.contentSnippet || item.description),
                  extendedContent,
                  publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                  author: item.author || item.creator || null,
                  category: Array.isArray(item.categories) ? item.categories[0] : (item.category || null),
                  feedId: feed.id,
                }
              });
              
              // If we have a PDF URL but couldn't process it earlier, try again
              if (pdfUrl) {
                try {
                  // Extract text from the PDF
                  const pdfContent = await extractPdfText(pdfUrl);
                  
                  // Save the PDF and its content to the database
                  await prisma.feedItemPdf.create({
                    data: {
                      url: pdfUrl,
                      content: pdfContent,
                      feedItemId: createdItem.id
                    }
                  });
                  
                  console.log(`Saved PDF content (${pdfContent?.length || 0} chars) for item: ${item.title}`);
                } catch (pdfError) {
                  console.error(`Error processing PDF for ${item.title}:`, pdfError);
                }
              }
            } catch (error) {
              // If the error is due to a unique constraint violation (duplicate URL), ignore it
              if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
                throw error;
              }
            }
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
