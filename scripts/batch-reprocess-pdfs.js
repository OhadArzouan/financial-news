/**
 * Script to batch reprocess multiple PDFs
 * This script can reprocess all PDFs with insufficient content
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { PrismaClient } = require('../app/generated/prisma');
const pdfParser = require('../lib/pdf-parser');

// Initialize Prisma client
const prisma = new PrismaClient();

// Minimum acceptable content length (in characters)
const MIN_CONTENT_LENGTH = 100;

// Output directory for debug files
const OUTPUT_DIR = path.join(__dirname, 'pdf-output');

/**
 * Download a PDF from a URL
 * @param {string} url URL to download from
 * @returns {Promise<Buffer>} PDF buffer
 */
async function downloadPdf(url) {
  console.log(`Downloading PDF from ${url}...`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 RSS Feed Aggregator/1.0',
        'Accept': 'application/pdf,*/*'
      },
      timeout: 30000 // 30 seconds timeout
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`Downloaded PDF: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error(`Error downloading PDF: ${error.message}`);
    return null;
  }
}

/**
 * Process a single PDF
 * @param {Object} pdf PDF object from database
 * @returns {Promise<boolean>} Success status
 */
async function processPdf(pdf) {
  try {
    console.log(`\nProcessing PDF ${pdf.id}: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);
    
    // Download the PDF
    const pdfBuffer = await downloadPdf(pdf.url);
    if (!pdfBuffer) {
      console.error(`Failed to download PDF ${pdf.id}`);
      return false;
    }
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR);
    }
    
    // Save the PDF buffer to a file for debugging
    const pdfFilename = `pdf-${pdf.id}.pdf`;
    const debugFilePath = path.join(OUTPUT_DIR, pdfFilename);
    fs.writeFileSync(debugFilePath, pdfBuffer);
    console.log(`Saved PDF to ${debugFilePath} for debugging`);
    
    // Extract text from the PDF
    console.log('Extracting text from PDF...');
    const extractedText = await pdfParser.extractTextFromPdfBuffer(pdfBuffer);
    
    if (!extractedText || extractedText.length === 0) {
      console.error(`Extraction produced no text for PDF ${pdf.id}`);
      return false;
    }
    
    console.log(`Successfully extracted ${extractedText.length} characters from PDF ${pdf.id}`);
    console.log('Text preview:', extractedText.substring(0, 200) + '...');
    
    // Save the extracted text to a file for debugging
    const textFilename = `text-${pdf.id}.txt`;
    const textFilePath = path.join(OUTPUT_DIR, textFilename);
    fs.writeFileSync(textFilePath, extractedText);
    console.log(`Saved extracted text to ${textFilePath}`);
    
    // Update the PDF in the database
    await prisma.feedItemPdf.update({
      where: { id: pdf.id },
      data: { content: extractedText }
    });
    
    console.log(`Successfully updated PDF ${pdf.id} in the database`);
    return true;
  } catch (error) {
    console.error(`Error processing PDF ${pdf.id}:`, error);
    return false;
  }
}

/**
 * Main function to find and reprocess PDFs with insufficient content
 */
async function main() {
  try {
    console.log('Finding PDFs that need reprocessing...');
    
    // Find PDFs with null, empty, or short content
    const pdfsToReprocess = await prisma.feedItemPdf.findMany({
      where: {
        OR: [
          { content: null },
          { content: '' },
          // We'll filter for short content in memory
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Get PDFs with some content to check for short content
    const pdfsWithContent = await prisma.feedItemPdf.findMany({
      where: {
        NOT: {
          OR: [
            { content: null },
            { content: '' }
          ]
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Filter PDFs with short content
    const shortContentPdfs = pdfsWithContent.filter(pdf => 
      pdf.content && pdf.content.length < MIN_CONTENT_LENGTH
    );
    
    // Combine the results
    const allPdfsToReprocess = [
      ...pdfsToReprocess,
      ...shortContentPdfs
    ];
    
    // Remove duplicates (in case a PDF appears in both lists)
    const uniquePdfsToReprocess = Array.from(
      new Map(allPdfsToReprocess.map(pdf => [pdf.id, pdf])).values()
    );
    
    console.log(`Found ${uniquePdfsToReprocess.length} PDFs that need reprocessing`);
    
    // Process each PDF
    let successCount = 0;
    let failureCount = 0;
    
    for (const pdf of uniquePdfsToReprocess) {
      const success = await processPdf(pdf);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Add a small delay between processing to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\nBatch processing complete!`);
    console.log(`Successfully processed: ${successCount} PDFs`);
    console.log(`Failed to process: ${failureCount} PDFs`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main();
