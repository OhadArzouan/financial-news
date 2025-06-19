import { PrismaClient } from '@prisma/client';
import { extractPdfText } from '../lib/pdf-extractor';
import fs from 'fs';
import path from 'path';

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
    
    // 1. Get the PDF URL from the database
    const pdf = await prisma.$queryRaw`
      SELECT id, url, content, "extractedAt" 
      FROM "FeedItemPdf" 
      WHERE id = ${pdfId} 
      LIMIT 1
    `;
    
    if (!pdf || !pdf[0]) {
      throw new Error(`PDF with ID ${pdfId} not found`);
    }
    
    const pdfData = pdf[0];
    console.log(`Found PDF: ${pdfData.url}`);
    console.log(`Current content length: ${pdfData.content?.length || 0} characters`);

    // 2. Extract text from the PDF
    console.log('\nExtracting text from PDF...');
    const extractedText = await extractPdfText(pdfData.url);
    
    if (!extractedText) {
      throw new Error('Failed to extract text from PDF');
    }

    console.log(`\nSuccessfully extracted ${extractedText.length} characters`);

    // 3. Save the extracted text to a file for verification
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = `pdf-${pdfId}-${Date.now()}.txt`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, extractedText);
    console.log(`\nExtracted content saved to: ${filePath}`);

    // 4. Update the database record using raw query
    console.log('\nUpdating database record...');
    const result = await prisma.$executeRaw`
      UPDATE "FeedItemPdf"
      SET 
        content = ${extractedText},
        "extractedAt" = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'lastExtraction', NOW()::text,
            'extractionMethod', 'enhanced-pdf-extractor',
            'contentLength', ${extractedText.length}
          )
      WHERE id = ${pdfId}
      RETURNING id, LENGTH(content) as content_length
    `;

    console.log('\n✅ Successfully updated PDF record');
    console.log(`Rows affected: ${result}`);
    
    return {
      success: true,
      pdfId,
      contentLength: extractedText.length,
      preview: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''),
      filePath
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
