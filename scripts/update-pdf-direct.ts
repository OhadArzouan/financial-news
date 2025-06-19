import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { extractPdfText } from '../lib/pdf-extractor';
import fs from 'fs';
import path from 'path';

// Path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'prisma/dev.db');

async function updatePdfRecord(pdfId: number) {
  // Open the database connection
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  try {
    console.log(`\n=== Updating PDF Record ${pdfId} ===`);
    
    // 1. Get the PDF URL from the database
    const pdf = await db.get(
      'SELECT id, url, content, "extractedAt" FROM "FeedItemPdf" WHERE id = ?',
      [pdfId]
    );

    if (!pdf) {
      throw new Error(`PDF with ID ${pdfId} not found`);
    }
    
    console.log(`Found PDF: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);

    // 2. Extract text from the PDF
    console.log('\nExtracting text from PDF...');
    const extractedText = await extractPdfText(pdf.url);
    
    if (!extractedText) {
      throw new Error('Failed to extract text from PDF');
    }

    console.log(`\nSuccessfully extracted ${extractedText.length} characters`);

    // 3. Save the extracted text to a file for verification
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = `pdf-${pdfId}-${Date.now()}.txt`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, extractedText);
    console.log(`\nExtracted content saved to: ${filePath}`);

    // 4. Prepare metadata
    const metadata = {
      ...(pdf.metadata ? JSON.parse(pdf.metadata) : {}),
      lastExtraction: new Date().toISOString(),
      extractionMethod: 'enhanced-pdf-extractor',
      contentLength: extractedText.length
    };

    // 5. Update the database record
    console.log('\nUpdating database record...');
    const result = await db.run(
      `UPDATE "FeedItemPdf" 
       SET content = ?, 
           "extractedAt" = datetime('now'), 
           metadata = ? 
       WHERE id = ?`,
      [extractedText, JSON.stringify(metadata), pdfId]
    );

    console.log('\n✅ Successfully updated PDF record');
    console.log(`Rows affected: ${result.changes}`);
    
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
    await db.close();
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
