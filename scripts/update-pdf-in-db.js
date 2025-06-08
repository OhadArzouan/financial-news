/**
 * Script to update a specific PDF in the database with extracted text
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

// The specific PDF ID to update
const PDF_ID = 104;

// Path to the extracted text file
const EXTRACTED_TEXT_PATH = path.join(__dirname, 'federal-reserve-pdf.txt');

async function updatePdfInDatabase() {
  try {
    console.log(`Updating PDF with ID: ${PDF_ID}`);
    
    // Check if the extracted text file exists
    if (!fs.existsSync(EXTRACTED_TEXT_PATH)) {
      console.error(`Extracted text file not found: ${EXTRACTED_TEXT_PATH}`);
      return;
    }
    
    // Read the extracted text from the file
    const extractedText = fs.readFileSync(EXTRACTED_TEXT_PATH, 'utf8');
    console.log(`Read ${extractedText.length} characters from extracted text file`);
    
    // Find the PDF record
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id: PDF_ID }
    });
    
    if (!pdf) {
      console.error(`PDF with ID ${PDF_ID} not found in database`);
      return;
    }
    
    console.log(`Found PDF in database: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);
    
    // Update the PDF record with the new content
    await prisma.feedItemPdf.update({
      where: { id: PDF_ID },
      data: { content: extractedText }
    });
    
    console.log('PDF content updated successfully in database');
    
  } catch (error) {
    console.error('Error updating PDF in database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updatePdfInDatabase();
