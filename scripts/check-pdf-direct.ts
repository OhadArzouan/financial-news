import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

// Path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'prisma/dev.db');

async function checkPdfContent(pdfId: number) {
  try {
    // Open the database connection
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    console.log(`\n=== Checking PDF Record ${pdfId} ===`);
    
    // Get the PDF record
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
    console.log(`Content length: ${pdf.content?.length || 0} characters`);
    console.log(`Feed item title: ${pdf.feedItemTitle}`);
    
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
    
    // Close the database connection
    await db.close();
    
  } catch (error) {
    console.error('Error checking PDF content:', error);
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
