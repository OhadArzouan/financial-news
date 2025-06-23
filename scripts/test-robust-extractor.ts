import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { extractPdfText } from '../lib/pdf-extractor-robust';

// Path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'prisma/dev.db');

async function testRobustExtraction(pdfId: number) {
  try {
    // Open the database connection
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    console.log(`\n=== Testing Robust PDF Extraction for ID ${pdfId} ===`);
    
    // Get the PDF URL
    const pdf = await db.get(
      `SELECT p.id, p.url, p.content, f.title as "feedItemTitle"
       FROM "FeedItemPdf" p
       JOIN "FeedItem" f ON p."feedItemId" = f.id
       WHERE p.id = ?`,
      [pdfId]
    );

    if (!pdf) {
      console.error(`PDF with ID ${pdfId} not found`);
      return;
    }

    console.log(`\nPDF URL: ${pdf.url}`);
    console.log(`Feed item title: ${pdf.feedItemTitle}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);
    
    if (pdf.content) {
      console.log(`\nCurrent content preview:`);
      console.log('-------------------');
      console.log(pdf.content.substring(0, 300) + '...');
      console.log('-------------------');
    }
    
    // Extract text using our robust extractor
    console.log('\nExtracting text with robust extractor...');
    const extractedText = await extractPdfText(pdf.url);
    
    if (extractedText) {
      console.log(`\n✅ Extraction successful! Got ${extractedText.length} characters`);
      
      // Save to file for inspection
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `pdf-${pdfId}-robust.txt`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, extractedText);
      console.log(`\nSaved to: ${filePath}`);
      
      // Show preview
      console.log('\nNew content preview:');
      console.log('-------------------');
      console.log(extractedText.substring(0, 300) + '...');
      console.log('-------------------');
      
      // Ask if user wants to update the database
      console.log('\nWould you like to update the database with this new content?');
      console.log('Run the following command to update:');
      console.log(`npx tsx scripts/update-with-robust.ts ${pdfId}`);
    } else {
      console.error('\n❌ Failed to extract text from PDF');
    }
    
    // Close the database connection
    await db.close();
    
  } catch (error) {
    console.error('Error testing robust extraction:', error);
  }
}

// Get PDF ID from command line or use default
const pdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 339;

// Run the test
testRobustExtraction(pdfId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
