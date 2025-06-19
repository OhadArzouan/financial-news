/**
 * Script to fix malformed PDF URLs in the database
 */

const { PrismaClient } = require('../app/generated/prisma');

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Main function to find and fix malformed PDF URLs
 */
async function main() {
  try {
    console.log('Finding PDFs with malformed URLs...');
    
    // Find PDFs with URLs ending in %20 (space encoding)
    const pdfsToFix = await prisma.feedItemPdf.findMany({
      where: {
        url: {
          endsWith: '%20'
        }
      }
    });
    
    console.log(`Found ${pdfsToFix.length} PDFs with malformed URLs`);
    
    // Fix each PDF URL
    for (const pdf of pdfsToFix) {
      const oldUrl = pdf.url;
      const newUrl = oldUrl.trim().replace(/%20$/, '');
      
      console.log(`\nFixing PDF ID ${pdf.id}:`);
      console.log(`  Old URL: ${oldUrl}`);
      console.log(`  New URL: ${newUrl}`);
      
      // Update the PDF URL in the database
      await prisma.feedItemPdf.update({
        where: { id: pdf.id },
        data: { url: newUrl }
      });
      
      console.log(`  ✓ Successfully updated PDF ${pdf.id}`);
    }
    
    console.log('\nAll malformed PDF URLs have been fixed!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main();
