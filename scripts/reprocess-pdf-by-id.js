/**
 * Script to reprocess a PDF by ID
 * Usage: node reprocess-pdf-by-id.js <pdf_id>
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { PrismaClient } = require('../app/generated/prisma');
const pdfParser = require('../lib/pdf-parser');

// Initialize Prisma client
const prisma = new PrismaClient();

// Get PDF ID from command line arguments
const PDF_ID = parseInt(process.argv[2], 10);

if (isNaN(PDF_ID)) {
  console.error('Please provide a valid PDF ID as a command line argument');
  console.error('Usage: node reprocess-pdf-by-id.js <pdf_id>');
  process.exit(1);
}

/**
 * Download a PDF from a URL
 * @param {string} url URL to download from
 * @returns {Promise<Buffer>} PDF buffer
 */
async function downloadPdf(url) {
  console.log(`Downloading PDF from ${url}...`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 RSS Feed Aggregator/1.0',
      'Accept': 'application/pdf,*/*'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`Downloaded PDF: ${buffer.length} bytes`);
  return buffer;
}

/**
 * Main function to extract text from a PDF and update it in the database
 */
async function main() {
  try {
    // Get the PDF from the database
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id: PDF_ID }
    });
    
    if (!pdf) {
      console.error(`PDF with ID ${PDF_ID} not found`);
      process.exit(1);
    }
    
    console.log(`Processing PDF ${PDF_ID}: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);
    
    // Download the PDF
    const pdfBuffer = await downloadPdf(pdf.url);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'pdf-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Save the PDF buffer to a file for debugging
    const pdfFilename = `pdf-${PDF_ID}.pdf`;
    const debugFilePath = path.join(outputDir, pdfFilename);
    fs.writeFileSync(debugFilePath, pdfBuffer);
    console.log(`Saved PDF to ${debugFilePath} for debugging`);
    
    // Extract text from the PDF
    console.log('Extracting text from PDF...');
    const extractedText = await pdfParser.extractTextFromPdfBuffer(pdfBuffer);
    
    if (!extractedText || extractedText.length === 0) {
      console.error('Extraction produced no text');
      process.exit(1);
    }
    
    console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
    console.log('Text preview:', extractedText.substring(0, 200) + '...');
    
    // Save the extracted text to a file for debugging
    const textFilename = `text-${PDF_ID}.txt`;
    const textFilePath = path.join(outputDir, textFilename);
    fs.writeFileSync(textFilePath, extractedText);
    console.log(`Saved extracted text to ${textFilePath}`);
    
    // Update the PDF in the database
    await prisma.feedItemPdf.update({
      where: { id: PDF_ID },
      data: { content: extractedText }
    });
    
    console.log(`Successfully updated PDF ${PDF_ID} in the database`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main();
