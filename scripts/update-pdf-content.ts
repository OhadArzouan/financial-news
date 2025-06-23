import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { extractPdfText } from '../lib/pdf-extractor-improved';

// Path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'prisma/dev.db');

async function updatePdfContent(pdfId: number) {
  // Open the database connection
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  try {
    console.log(`\n=== Updating PDF Content for ID ${pdfId} ===`);
    
    // Get the PDF URL
    const pdf = await db.get(
      `SELECT p.id, p.url, f.title as "feedItemTitle"
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
    
    // Extract text from the PDF
    console.log('\nExtracting text from PDF...');
    const extractedText = await extractPdfText(pdf.url);
    
    if (!extractedText) {
      console.error('Failed to extract text from PDF');
      return;
    }
    
    console.log(`\nSuccessfully extracted ${extractedText.length} characters`);
    
    // Update the database
    console.log('\nUpdating database...');
    const now = new Date().toISOString();
    
    const result = await db.run(
      `UPDATE "FeedItemPdf"
       SET content = ?, "updatedAt" = ?
       WHERE id = ?`,
      [extractedText, now, pdfId]
    );
    
    console.log(`Database updated: ${result.changes} row(s) affected`);
    
  } catch (error) {
    console.error('Error updating PDF content:', error);
  } finally {
    // Close the database connection
    await db.close();
  }
}

// Get PDF ID from command line or use default
const pdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 339;

// Run the update
updatePdfContent(pdfId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
