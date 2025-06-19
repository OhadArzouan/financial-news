/**
 * Enhanced PDF text extractor module that uses the JavaScript pdf-parser
 * with retry mechanism and improved error handling
 */

import fetch from 'node-fetch';

// Import the JavaScript PDF parser
// Using require because the module doesn't have TypeScript types
const pdfParser = require('./pdf-parser');

/**
 * Configuration for PDF extraction
 */
const PDF_EXTRACTION_CONFIG = {
  maxRetries: 3,           // Maximum number of retry attempts
  timeout: 30000,          // 30 seconds timeout for large PDFs
  minAcceptableLength: 50 // Minimum acceptable extracted text length
};

/**
 * Extract text from a PDF URL with retry mechanism
 * 
 * @param url URL of the PDF to extract text from
 * @returns Extracted text or null if extraction failed
 */
export async function extractPdfText(url: string): Promise<string | null> {
  let attempts = 0;
  let lastError: Error | null = null;
  
  while (attempts <= PDF_EXTRACTION_CONFIG.maxRetries) {
    try {
      attempts++;
      console.log(`Extracting text from PDF (attempt ${attempts}): ${url}`);
      
      // Fetch the PDF with appropriate headers
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 RSS Feed Aggregator/1.0',
          'Accept': 'application/pdf,*/*'
        },
        timeout: PDF_EXTRACTION_CONFIG.timeout
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      // Get the PDF as a buffer
      const buffer = await response.buffer();
      if (!buffer || buffer.length === 0) {
        throw new Error('Received empty PDF buffer');
      }
      
      console.log(`Downloaded PDF: ${buffer.length} bytes`);
      
      // Extract text from the PDF buffer
      console.log('Calling extractTextFromPdfBuffer...');
      const extractedText = await pdfParser.extractTextFromPdfBuffer(buffer);
      console.log(`Raw extraction result: ${extractedText?.length || 0} characters`);
      
      // For debugging, log a preview of the extracted text
      if (extractedText) {
        console.log('Text preview:', extractedText.substring(0, 100) + '...');
      }
      
      // Validate extraction result
      if (!extractedText || extractedText.length < PDF_EXTRACTION_CONFIG.minAcceptableLength) {
        throw new Error(`Extraction produced insufficient text (${extractedText?.length || 0} chars)`);
      }
      
      console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
      return extractedText;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Error extracting text from PDF ${url} (attempt ${attempts}):`, error);
      
      // If we've reached max retries, give up
      if (attempts > PDF_EXTRACTION_CONFIG.maxRetries) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      const backoffMs = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
      console.log(`Waiting ${backoffMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  console.error(`All extraction attempts failed for ${url}:`, lastError);
  
  // For debugging purposes, try a direct extraction without validation
  try {
    console.log('Attempting direct extraction without validation as last resort...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 RSS Feed Aggregator/1.0',
        'Accept': 'application/pdf,*/*'
      },
      timeout: PDF_EXTRACTION_CONFIG.timeout
    });
    
    if (response.ok) {
      const buffer = await response.buffer();
      if (buffer && buffer.length > 0) {
        const directText = await pdfParser.extractTextFromPdfBuffer(buffer);
        console.log(`Direct extraction result: ${directText?.length || 0} characters`);
        if (directText && directText.length > 0) {
          console.log('Returning direct extraction result despite validation failure');
          return directText;
        }
      }
    }
  } catch (directError) {
    console.error('Direct extraction also failed:', directError);
  }
  
  return null;
}
