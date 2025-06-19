/**
 * Script to reprocess a specific PDF by ID
 */
require('dotenv').config();
// Use the project's existing Prisma client
const { prisma } = require('../lib/prisma');
const fetch = require('node-fetch');
const pdfParser = require('../lib/pdf-parser');

// Using the shared Prisma client

// The specific PDF ID to reprocess
const PDF_ID = '104';

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
    
    // Fetch the PDF
    console.log('Downloading PDF...');
    const response = await fetch(pdf.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 RSS Feed Aggregator PDF Extractor',
        'Accept': 'application/pdf,*/*'
      },
      timeout: 45000 // 45 seconds timeout for large PDFs
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }
    
    // Get the PDF as a buffer
    const pdfBuffer = await response.buffer();
    console.log(`Downloaded PDF: ${pdfBuffer.length} bytes`);
    
    // Extract text from the PDF
    console.log('Extracting text from PDF...');
    const newContent = await pdfParser.extractTextFromPdfBuffer(pdfBuffer);
    
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
    const fs = require('fs');
    const path = require('path');
    const previewPath = path.join(__dirname, 'reprocessed-pdf-preview.txt');
    fs.writeFileSync(previewPath, newContent);
    console.log(`Preview saved to: ${previewPath}`);
    
  } catch (error) {
    console.error('Error reprocessing PDF:', error);
  }
}

// Run the script
reprocessPdf();
