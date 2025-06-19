/**
 * Script to reprocess a specific PDF by ID
 */
import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { extractPdfText } from '../lib/pdf-extractor';

// The specific PDF ID to reprocess
const PDF_ID = 104;

async function reprocessPdf() {
  try {
    console.log(`Reprocessing PDF with ID: ${PDF_ID}`);
    
    // Find the PDF record
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id: PDF_ID }
    });
    
    if (!pdf) {
      console.error(`PDF with ID ${PDF_ID} not found`);
      return;
    }
    
    console.log(`Found PDF: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);
    
    // Extract text from the PDF with our improved extractor
    console.log('Extracting text with improved extractor...');
    const newContent = await extractPdfText(pdf.url);
    
    if (!newContent) {
      console.error('Failed to extract new content');
      return;
    }
    
    console.log(`Extracted ${newContent.length} characters of new content`);
    
    // Update the PDF record with the new content
    await prisma.feedItemPdf.update({
      where: { id: PDF_ID },
      data: { content: newContent }
    });
    
    console.log('PDF content updated successfully');
    
    // Save a preview of the new content to a file
    const previewPath = path.join(__dirname, 'reprocessed-pdf-preview.txt');
    fs.writeFileSync(previewPath, newContent);
    console.log(`Preview saved to: ${previewPath}`);
    
  } catch (error) {
    console.error('Error reprocessing PDF:', error);
  }
}

// Run the script
reprocessPdf();
