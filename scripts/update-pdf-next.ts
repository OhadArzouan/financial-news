// This script uses Next.js environment and Prisma client
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client with explicit database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function updatePdfRecord(pdfId: number) {
  try {
    console.log(`\n=== Updating PDF Record ${pdfId} ===`);
    
    // 1. Get the PDF record
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id: pdfId },
      include: { feedItem: true }
    });

    if (!pdf) {
      throw new Error(`PDF with ID ${pdfId} not found`);
    }

    console.log(`Found PDF: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);

    // 2. Extract text from the PDF
    console.log('\nExtracting text from PDF...');
    const { extractPdfText } = await import('../lib/pdf-extractor');
    const extractedText = await extractPdfText(pdf.url);
    
    if (!extractedText) {
      throw new Error('Failed to extract text from PDF');
    }

    console.log(`\nSuccessfully extracted ${extractedText.length} characters`);

    // 3. Update the database record
    console.log('\nUpdating database record...');
    const updatedPdf = await prisma.feedItemPdf.update({
      where: { id: pdfId },
      data: {
        content: extractedText,
        extractedAt: new Date(),
        metadata: {
          ...(typeof pdf.metadata === 'object' ? pdf.metadata : {}),
          lastExtraction: new Date().toISOString(),
          extractionMethod: 'enhanced-pdf-extractor',
          contentLength: extractedText.length
        }
      },
    });

    console.log('\n✅ Successfully updated PDF record');
    console.log(`New content length: ${updatedPdf.content?.length || 0} characters`);
    
    return {
      success: true,
      pdfId: updatedPdf.id,
      contentLength: extractedText.length,
      preview: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '')
    };
    
  } catch (error) {
    console.error('\n❌ Error updating PDF record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Get PDF ID from command line or use default (375 for the Federal Reserve PDF)
const pdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 375;

// Run the update
updatePdfRecord(pdfId)
  .then(result => {
    console.log('\n=== Update Completed ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
