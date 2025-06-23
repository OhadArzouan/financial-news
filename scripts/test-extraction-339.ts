import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry';

// Set up the PDF.js worker
if (typeof window === 'undefined') {
  // Node.js environment
  (global as any).pdfjsWorker = pdfjsWorker;
  (global as any).fetch = fetch;
}

// Path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'prisma/dev.db');

async function extractWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    console.log('[pdf.js] Loading PDF from array buffer');
    
    // Load the PDF document directly from the array buffer
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    });
    
    const pdf = await loadingTask.promise;
    console.log(`[pdf.js] PDF loaded, pages: ${pdf.numPages}`);
    
    let textContent = '';
    const maxPages = Math.min(pdf.numPages, 50); // Process up to 50 pages
    
    // Extract text from each page
    for (let i = 1; i <= maxPages; i++) {
      console.log(`[pdf.js] Processing page ${i}/${maxPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      const pageText = content.items
        .filter(item => 'str' in item)
        .map(item => (item as any).str)
        .join(' ')
        .replace(/\\s+/g, ' ')
        .trim();
      
      textContent += pageText + '\\n\\n';
    }
    
    // Clean up
    await pdf.cleanup();
    await pdf.destroy();
    
    console.log(`[pdf.js] Extracted ${textContent.length} characters`);
    return textContent.trim() || null;
    
  } catch (error) {
    console.error('[pdf.js] Error extracting text:', error);
    return null;
  }
}

async function extractWithPdfParse(buffer: Buffer): Promise<string | null> {
  try {
    console.log('[pdf-parse] Extracting text from buffer');
    // Dynamically import pdf-parse to avoid loading it unless needed
    const { default: pdfParse } = await import('pdf-parse');
    const data = await pdfParse(buffer);
    console.log(`[pdf-parse] Extracted ${data.text.length} characters`);
    return data.text.trim() || null;
  } catch (error) {
    console.error('[pdf-parse] Error extracting text:', error);
    return null;
  }
}

async function testPdfExtraction(pdfId: number) {
  try {
    // Open the database connection
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    console.log(`\\n=== Testing PDF Extraction for ID ${pdfId} ===`);
    
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

    console.log(`\\nPDF URL: ${pdf.url}`);
    console.log(`Feed item title: ${pdf.feedItemTitle}`);
    
    // Fetch the PDF
    console.log('\\nFetching PDF...');
    const response = await fetch(pdf.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Try extraction with pdf-parse
    console.log('\\n1. Trying extraction with pdf-parse...');
    const pdfParseText = await extractWithPdfParse(buffer);
    
    if (pdfParseText && pdfParseText.length > 100) {
      console.log('\\n✅ pdf-parse extraction successful!');
      
      // Save to file
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `pdf-${pdfId}-pdf-parse.txt`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, pdfParseText);
      console.log(`Saved to: ${filePath}`);
      
      // Show preview
      console.log('\\nPreview:');
      console.log('-------------------');
      console.log(pdfParseText.substring(0, 500) + '...');
      console.log('-------------------');
    } else {
      console.log('\\n❌ pdf-parse extraction failed or returned insufficient content');
    }
    
    // Try extraction with pdf.js
    console.log('\\n2. Trying extraction with pdf.js...');
    const pdfJsText = await extractWithPdfJs(arrayBuffer);
    
    if (pdfJsText && pdfJsText.length > 100) {
      console.log('\\n✅ pdf.js extraction successful!');
      
      // Save to file
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `pdf-${pdfId}-pdf-js.txt`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, pdfJsText);
      console.log(`Saved to: ${filePath}`);
      
      // Show preview
      console.log('\\nPreview:');
      console.log('-------------------');
      console.log(pdfJsText.substring(0, 500) + '...');
      console.log('-------------------');
    } else {
      console.log('\\n❌ pdf.js extraction failed or returned insufficient content');
    }
    
    // Close the database connection
    await db.close();
    
  } catch (error) {
    console.error('Error testing PDF extraction:', error);
  }
}

// Get PDF ID from command line or use default
const pdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 339;

// Run the test
testPdfExtraction(pdfId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
