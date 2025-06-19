/**
 * Simple test script for PDF extraction using our JavaScript PDF parser
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

// Import the PDF parser
const pdfParser = require('../lib/pdf-parser');

// URL of the PDF to test - Federal Reserve press release PDF
const pdfUrl = 'https://www.federalreserve.gov/newsevents/pressreleases/files/orders20250605a1.pdf';

// Function to download and process a PDF
async function downloadAndExtractPdf(url) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading PDF from ${url}...`);
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download PDF: ${res.statusCode} ${res.statusMessage}`));
        return;
      }
      
      const chunks = [];
      
      res.on('data', (chunk) => chunks.push(chunk));
      
      res.on('end', async () => {
        try {
          console.log('Download complete. Extracting text...');
          const buffer = Buffer.concat(chunks);
          
          // Extract text using the pdf-parse library
          const text = await pdfParser.extractTextFromPdfBuffer(buffer);
          
          console.log(`\nExtracted ${text.length} characters of text.`);
          console.log('\n--- First 1000 characters of extracted text ---\n');
          console.log(text.substring(0, 1000));
          console.log('\n--- End of preview ---\n');
          
          // Save the extracted text to a file for inspection
          const outputPath = path.join(__dirname, 'extracted-pdf-text.txt');
          fs.writeFileSync(outputPath, text);
          console.log(`Full extracted text saved to: ${outputPath}`);
          
          resolve(text);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Run the test
async function runTest() {
  try {
    await downloadAndExtractPdf(pdfUrl);
    console.log('\nPDF extraction test completed successfully!');
  } catch (error) {
    console.error('Error during PDF extraction test:', error);
  }
}

// Execute the test
runTest();
