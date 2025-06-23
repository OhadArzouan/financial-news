import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function checkPdfContent(pdfId: number) {
  try {
    console.log(`\n=== Checking PDF Record ${pdfId} ===`);
    
    // Get the PDF record
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id: pdfId },
      include: { feedItem: true }
    });

    if (!pdf) {
      console.error(`PDF with ID ${pdfId} not found`);
      return;
    }

    console.log(`\nPDF URL: ${pdf.url}`);
    console.log(`Content length: ${pdf.content?.length || 0} characters`);
    console.log(`Extracted at: ${pdf.extractedAt || 'Not extracted'}`);
    console.log(`Feed item title: ${pdf.feedItem.title}`);
    
    // Save content to file for inspection
    if (pdf.content) {
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `pdf-${pdfId}-content.txt`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, pdf.content);
      console.log(`\nContent saved to: ${filePath}`);
      
      // Show preview
      console.log('\nContent preview:');
      console.log('-------------------');
      console.log(pdf.content.substring(0, 500) + (pdf.content.length > 500 ? '...' : ''));
      console.log('-------------------');
    } else {
      console.log('\nNo content available');
    }
    
  } catch (error) {
    console.error('Error checking PDF content:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get PDF ID from command line or use default
const pdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 279;

// Run the check
checkPdfContent(pdfId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
