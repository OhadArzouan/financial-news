/**
 * Script to directly extract text from the Federal Reserve PDF
 * without using the database
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const pdfParser = require('../lib/pdf-parser');

// The specific Federal Reserve PDF URL
const PDF_URL = 'https://www.federalreserve.gov/newsevents/pressreleases/files/enf20150702a1.pdf';

async function extractFederalReservePdf() {
  try {
    console.log(`Extracting text from Federal Reserve PDF: ${PDF_URL}`);
    
    // Fetch the PDF
    console.log('Downloading PDF...');
    const response = await fetch(PDF_URL, {
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
    const startTime = Date.now();
    const extractedText = await pdfParser.extractTextFromPdfBuffer(pdfBuffer);
    const endTime = Date.now();
    
    if (!extractedText) {
      console.error('Failed to extract text');
      return;
    }
    
    console.log(`Extraction completed in ${(endTime - startTime) / 1000} seconds`);
    console.log(`Extracted ${extractedText.length} characters of text`);
    
    // Preview the first 500 characters
    console.log('\nText preview:');
    console.log('=============');
    console.log(extractedText.substring(0, 500) + '...');
    
    // Save the extracted text to a file
    const outputPath = path.join(__dirname, 'federal-reserve-pdf.txt');
    fs.writeFileSync(outputPath, extractedText);
    console.log(`\nFull extracted text saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error extracting PDF:', error);
  }
}

// Run the extraction
extractFederalReservePdf();
