import fetch from 'node-fetch';
import { extractTextFromPdfBuffer } from './pdf-simple-extractor';

/**
 * Extracts text from a PDF URL
 * @param url URL of the PDF to extract text from
 * @returns Extracted text or placeholder if extraction fails
 */
export async function extractTextFromPdf(url: string): Promise<string | null> {
  try {
    console.log(`Fetching PDF from ${url}`);
    
    // Download the PDF
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RSS Feed Aggregator/1.0',
      },
      // @ts-ignore - node-fetch types don't include timeout but it's supported
      timeout: 30000 // 30 seconds timeout for PDF download
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch PDF from ${url}: ${response.status} ${response.statusText}`);
      return `[PDF could not be downloaded - HTTP ${response.status}]`;
    }
    
    const pdfBuffer = await response.buffer();
    
    // Quick validation check
    if (!pdfBuffer || pdfBuffer.length < 100 || pdfBuffer.toString('ascii', 0, 5) !== '%PDF-') {
      console.error(`Invalid PDF content from ${url}`);
      return `[Invalid PDF content from ${url}]`;
    }
    
    console.log(`Successfully downloaded PDF (${pdfBuffer.length} bytes)`);
    
    // Use our simple PDF text extractor
    const extractedText = extractTextFromPdfBuffer(pdfBuffer);
    
    if (extractedText && extractedText.length > 0) {
      console.log(`Successfully extracted ${extractedText.length} characters of text from PDF`);
      return extractedText;
    } else {
      console.log('No text could be extracted from PDF');
      return `[PDF downloaded but no text content could be extracted]`;
    }
  } catch (error: any) {
    console.error(`PDF extraction error:`, error?.message || error);
    return `[PDF extraction failed: ${error?.message || 'unknown error'}]`;
  }
}
