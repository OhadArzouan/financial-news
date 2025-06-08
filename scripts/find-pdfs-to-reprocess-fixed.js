/**
 * Script to find PDFs that need reprocessing
 * This identifies PDFs with missing or insufficient content
 */

const { PrismaClient } = require('../app/generated/prisma');

// Initialize Prisma client
const prisma = new PrismaClient();

// Minimum acceptable content length (in characters)
const MIN_CONTENT_LENGTH = 100;

/**
 * Main function to find PDFs that need reprocessing
 */
async function main() {
  try {
    console.log('Finding PDFs that need reprocessing...');
    
    // First, find PDFs with null or empty content
    const emptyPdfs = await prisma.feedItemPdf.findMany({
      where: {
        OR: [
          { content: null },
          { content: '' }
        ]
      },
      include: {
        feedItem: {
          select: {
            title: true,
            link: true,
            feedId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${emptyPdfs.length} PDFs with null or empty content`);
    
    // Then, find all PDFs with some content and filter for short content
    const allPdfs = await prisma.feedItemPdf.findMany({
      where: {
        NOT: {
          OR: [
            { content: null },
            { content: '' }
          ]
        }
      },
      include: {
        feedItem: {
          select: {
            title: true,
            link: true,
            feedId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Filter PDFs with short content
    const shortContentPdfs = allPdfs.filter(pdf => 
      pdf.content && pdf.content.length < MIN_CONTENT_LENGTH
    );
    
    console.log(`Found ${shortContentPdfs.length} PDFs with short content (< ${MIN_CONTENT_LENGTH} chars)`);
    
    // Combine the results
    const pdfsToReprocess = [...emptyPdfs, ...shortContentPdfs];
    
    console.log(`Found ${pdfsToReprocess.length} total PDFs that need reprocessing`);
    
    // Display information about each PDF
    pdfsToReprocess.forEach((pdf, index) => {
      console.log(`\n[${index + 1}] PDF ID: ${pdf.id}`);
      console.log(`    Title: ${pdf.feedItem?.title || 'Unknown'}`);
      console.log(`    Link: ${pdf.feedItem?.link || 'Unknown'}`);
      console.log(`    PDF URL: ${pdf.url}`);
      console.log(`    Content Length: ${pdf.content?.length || 0} characters`);
      console.log(`    Created At: ${pdf.createdAt}`);
    });
    
    console.log('\nTo reprocess a specific PDF, run:');
    console.log('node scripts/reprocess-pdf-by-id.js <pdf_id>');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main();
