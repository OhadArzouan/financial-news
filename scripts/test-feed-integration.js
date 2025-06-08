/**
 * Integration test for PDF extraction in the RSS Feed Aggregator
 * 
 * This script tests the end-to-end flow of:
 * 1. Creating a feed with a URL that contains PDFs
 * 2. Refreshing the feed to trigger PDF extraction
 * 3. Verifying that PDFs were properly extracted and stored
 */

// Import required modules
const { PrismaClient } = require('../app/generated/prisma');
const fetch = require('node-fetch');
const Parser = require('rss-parser');
const pdfParser = require('../lib/pdf-parser');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize RSS parser
const parser = new Parser({
  headers: {
    'User-Agent': 'RSS Feed Aggregator/1.0',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
  }
});

// Test feed URL - Federal Reserve Press Releases (often contains PDFs)
const TEST_FEED_URL = 'https://www.federalreserve.gov/feeds/press_all.xml';

/**
 * Main test function
 */
async function runIntegrationTest() {
  try {
    console.log('Starting PDF extraction integration test...');
    
    // Step 1: Create or find test feed
    let feed = await prisma.feed.findFirst({
      where: { url: TEST_FEED_URL }
    });
    
    if (!feed) {
      console.log('Creating test feed...');
      feed = await prisma.feed.create({
        data: {
          title: 'Federal Reserve Press Releases',
          url: TEST_FEED_URL,
          description: 'Test feed for PDF extraction integration'
        }
      });
      console.log(`Created test feed with ID: ${feed.id}`);
    } else {
      console.log(`Using existing feed with ID: ${feed.id}`);
    }
    
    // Step 2: Fetch and process the feed
    console.log(`Fetching feed from ${TEST_FEED_URL}...`);
    const response = await fetch(TEST_FEED_URL, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }
    
    const xml = await response.text();
    const parsedFeed = await parser.parseString(xml);
    
    console.log(`Feed contains ${parsedFeed.items.length} items`);
    
    // Step 3: Process a few items (limit to 3 for testing)
    const itemsToProcess = parsedFeed.items.slice(0, 3);
    
    console.log(`Processing ${itemsToProcess.length} feed items...`);
    
    // Track statistics
    let stats = {
      itemsProcessed: 0,
      pdfsFound: 0,
      pdfsExtracted: 0,
      totalCharactersExtracted: 0
    };
    
    // Process each item
    for (const item of itemsToProcess) {
      if (!item.link) continue;
      
      console.log(`\nProcessing item: ${item.title}`);
      stats.itemsProcessed++;
      
      // Check if item already exists
      const existingItem = await prisma.feedItem.findFirst({
        where: {
          feedId: feed.id,
          link: item.link
        }
      });
      
      if (existingItem) {
        console.log(`Item already exists, skipping: ${item.title}`);
        continue;
      }
      
      // Extract PDF links from the item's link
      console.log(`Checking for PDFs in ${item.link}...`);
      const pdfUrl = await extractPdfUrlFromPage(item.link);
      
      if (pdfUrl) {
        console.log(`Found PDF: ${pdfUrl}`);
        stats.pdfsFound++;
        
        // Extract text from the PDF
        console.log('Extracting text from PDF...');
        const pdfContent = await downloadAndExtractPdf(pdfUrl);
        
        if (pdfContent) {
          stats.pdfsExtracted++;
          stats.totalCharactersExtracted += pdfContent.length;
          
          // Create feed item
          const feedItem = await prisma.feedItem.create({
            data: {
              title: item.title || 'Untitled Item',
              link: item.link,
              description: item.contentSnippet || item.description || null,
              content: item.content || null,
              publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              author: item.author || item.creator || null,
              feedId: feed.id
            }
          });
          
          // Save PDF content
          await prisma.feedItemPdf.create({
            data: {
              url: pdfUrl,
              content: pdfContent,
              feedItemId: feedItem.id
            }
          });
          
          console.log(`Saved feed item and PDF content (${pdfContent.length} chars)`);
        }
      } else {
        console.log('No PDFs found in this item');
      }
    }
    
    // Step 4: Print test results
    console.log('\n--- Integration Test Results ---');
    console.log(`Items processed: ${stats.itemsProcessed}`);
    console.log(`PDFs found: ${stats.pdfsFound}`);
    console.log(`PDFs with text extracted: ${stats.pdfsExtracted}`);
    console.log(`Total characters extracted: ${stats.totalCharactersExtracted}`);
    console.log('-------------------------------');
    
    if (stats.pdfsExtracted > 0) {
      console.log('\nTest PASSED: Successfully extracted text from PDFs in feed items');
    } else if (stats.pdfsFound > 0) {
      console.log('\nTest FAILED: Found PDFs but failed to extract text');
    } else if (stats.itemsProcessed > 0) {
      console.log('\nTest INCONCLUSIVE: Processed items but found no PDFs to extract');
    } else {
      console.log('\nTest FAILED: No items were processed');
    }
    
  } catch (error) {
    console.error('Integration test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Extract PDF URLs from a webpage
 */
async function extractPdfUrlFromPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    
    // Simple regex to find PDF links
    const pdfLinkRegex = /href=["'](https?:\/\/[^"']+\.pdf)["']/i;
    const match = html.match(pdfLinkRegex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting PDF URLs from ${url}:`, error);
    return null;
  }
}

/**
 * Download and extract text from a PDF
 */
async function downloadAndExtractPdf(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0'
      },
      timeout: 30000
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const buffer = await response.buffer();
    return await pdfParser.extractTextFromPdfBuffer(buffer);
  } catch (error) {
    console.error(`Error extracting text from PDF ${url}:`, error);
    return null;
  }
}

// Run the integration test
runIntegrationTest();
