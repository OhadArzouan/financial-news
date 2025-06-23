import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { extractPdfText } from '../lib/pdf-extractor-robust';

// Path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'prisma/dev.db');

/**
 * Check if content is likely gibberish
 */
function isGibberish(text: string | null): boolean {
  if (!text || text.length < 100) return true;
  
  // Check for binary data markers
  const binaryCharCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
  if (binaryCharCount > text.length * 0.05) {
    return true;
  }
  
  // Check for PDF binary markers
  const pdfMarkers = [
    'obj', 'endobj', 'stream', 'endstream', 'xref', 'trailer',
    '/Filter', '/FlateDecode', '/Length', '/Type', '/Page'
  ];
  
  const markerMatches = pdfMarkers.filter(marker => 
    text.includes(marker) && 
    (text.includes(`/${marker}`) || text.includes(`${marker}>>`) || text.includes(`<<${marker}`))
  );
  
  if (markerMatches.length > 3) {
    return true;
  }
  
  // Check for common English words
  const commonWords = ['the', 'and', 'to', 'of', 'in', 'for', 'is', 'on', 'that', 'by'];
  const commonWordsFound = commonWords.filter(word => 
    text.toLowerCase().includes(` ${word} `) || 
    text.toLowerCase().startsWith(`${word} `)
  );
  
  if (commonWordsFound.length < 3) {
    return true;
  }
  
  return false;
}

async function updateAllPdfs() {
  // Open the database connection
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  try {
    console.log('\n=== Scanning for PDFs with gibberish content ===');
    
    // Get all PDFs
    const pdfs = await db.all(
      `SELECT p.id, p.url, p.content, f.title as "feedItemTitle"
       FROM "FeedItemPdf" p
       JOIN "FeedItem" f ON p."feedItemId" = f.id
       ORDER BY p.id`
    );

    console.log(`Found ${pdfs.length} PDFs in the database`);
    
    // Filter for PDFs with gibberish content or no content
    const problematicPdfs = pdfs.filter(pdf => !pdf.content || isGibberish(pdf.content));
    
    console.log(`Found ${problematicPdfs.length} PDFs with gibberish or no content`);
    
    if (problematicPdfs.length === 0) {
      console.log('No problematic PDFs found. All PDFs have valid content.');
      return;
    }
    
    // Process each problematic PDF
    for (const pdf of problematicPdfs) {
      console.log(`\n----- Processing PDF ID ${pdf.id}: ${pdf.feedItemTitle} -----`);
      console.log(`URL: ${pdf.url}`);
      console.log(`Current content length: ${pdf.content?.length || 0} characters`);
      
      if (pdf.content) {
        console.log(`Current content preview: ${pdf.content.substring(0, 100)}...`);
      } else {
        console.log('No current content');
      }
      
      // Extract text using robust extractor
      console.log('\nExtracting text with robust extractor...');
      const extractedText = await extractPdfText(pdf.url).catch(error => {
        console.error(`Error extracting text from PDF ${pdf.id}:`, error);
        return null;
      });
      
      if (!extractedText) {
        console.log(`❌ Failed to extract text from PDF ${pdf.id}`);
        continue;
      }
      
      console.log(`✅ Successfully extracted ${extractedText.length} characters`);
      console.log(`New content preview: ${extractedText.substring(0, 100)}...`);
      
      // Update the database
      console.log('Updating database...');
      const result = await db.run(
        `UPDATE "FeedItemPdf"
         SET content = ?
         WHERE id = ?`,
        [extractedText, pdf.id]
      );
      
      console.log(`Database updated: ${result.changes} row(s) affected`);
    }
    
    console.log('\n=== PDF update process completed ===');
    
  } catch (error) {
    console.error('Error updating PDFs:', error);
  } finally {
    // Close the database connection
    await db.close();
  }
}

// Run the update
updateAllPdfs()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
