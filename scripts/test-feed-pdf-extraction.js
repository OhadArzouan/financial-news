// Test script for PDF extraction in the feed refresh process
require('dotenv').config();

// Use ts-node to register TypeScript
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

const { PrismaClient } = require('@prisma/client');
const { refreshFeed } = require('../lib/feed-utils');


const prisma = new PrismaClient();

// Feed URL with PDFs - Federal Reserve Press Releases (often contains PDFs)
const TEST_FEED_URL = 'https://www.federalreserve.gov/feeds/press_all.xml';

async function main() {
  try {
    console.log('Creating test feed...');
    
    // Create a test feed or use existing one
    let feed = await prisma.feed.findFirst({
      where: {
        url: TEST_FEED_URL
      }
    });
    
    if (!feed) {
      feed = await prisma.feed.create({
        data: {
          title: 'Federal Reserve Press Releases',
          url: TEST_FEED_URL,
          description: 'Test feed for PDF extraction'
        }
      });
      console.log(`Created new test feed with ID: ${feed.id}`);
    } else {
      console.log(`Using existing feed with ID: ${feed.id}`);
    }
    
    // Refresh the feed to process new items and extract PDFs
    console.log('Refreshing feed to process items and extract PDFs...');
    await refreshFeed(feed.id);
    
    // Check for feed items with PDFs
    console.log('Checking for feed items with PDFs...');
    const feedItemsWithPdfs = await prisma.feedItemPdf.findMany({
      include: {
        feedItem: true
      }
    });
    
    if (feedItemsWithPdfs.length === 0) {
      console.log('No PDFs found in feed items.');
    } else {
      console.log(`Found ${feedItemsWithPdfs.length} PDFs in feed items:`);
      
      // Display info about each PDF
      for (const pdf of feedItemsWithPdfs) {
        console.log('\n-----------------------------------');
        console.log(`PDF URL: ${pdf.url}`);
        console.log(`Feed Item: ${pdf.feedItem.title}`);
        console.log(`Extracted content length: ${pdf.content?.length || 0} characters`);
        
        if (pdf.content) {
          // Show a preview of the extracted content
          console.log('\nContent preview:');
          console.log(pdf.content.substring(0, 500) + '...');
        } else {
          console.log('No content extracted from PDF.');
        }
      }
    }
    
  } catch (error) {
    console.error('Error testing PDF extraction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
