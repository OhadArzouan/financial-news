/**
 * Script to extract text from a PDF and update it in the database
 * This script bypasses the API route to directly update the database
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { PrismaClient } = require('../app/generated/prisma');
const pdfParser = require('../lib/pdf-parser');

// Initialize Prisma client
const prisma = new PrismaClient();

// PDF ID to update
const PDF_ID = 104;

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
    
    // Save the PDF buffer to a file for debugging
    const debugFilePath = path.join(__dirname, 'debug-pdf.pdf');
    fs.writeFileSync(debugFilePath, pdfBuffer);
    console.log(`Saved PDF to ${debugFilePath} for debugging`);
    
    // Extract text from the PDF
    console.log('Extracting text from PDF...');
    const extractedText = await pdfParser.extractTextFromPdfBuffer(pdfBuffer);
    
    if (!extractedText || extractedText.length < 50) {
      console.error(`Extraction produced insufficient text (${extractedText?.length || 0} chars)`);
      process.exit(1);
    }
    
    console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
    console.log('Text preview:', extractedText.substring(0, 200) + '...');
    
    // Save the extracted text to a file for debugging
    const textFilePath = path.join(__dirname, 'extracted-text.txt');
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
