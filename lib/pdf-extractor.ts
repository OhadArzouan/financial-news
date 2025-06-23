import { TextItem } from 'pdfjs-dist/types/src/display/api';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry';
import fetch from 'node-fetch';

// Set up the PDF.js worker
if (typeof window === 'undefined') {
  // Node.js environment
  (global as any).pdfjsWorker = pdfjsWorker;
  (global as any).fetch = fetch;
} else {
  // Browser environment
  (window as any).pdfjsWorker = pdfjsWorker;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Simple retry wrapper for async operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError || new Error('Operation failed without error');
}

/**
 * Extracts text from a PDF URL using pdf.js with retry logic
 */
async function extractTextWithPdfJs(url: string): Promise<string | null> {
  console.log(`[pdf.js] Loading PDF from: ${url}`);
  
  try {
    // First, fetch the PDF as array buffer
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Load the PDF document directly from the array buffer
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    });
    
    const pdf = await loadingTask.promise;
    console.log(`[pdf.js] PDF loaded, pages: ${pdf.numPages}`);
    
    let textContent = '';
    const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages for performance
    
    // Extract text from each page
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => {
          // Check if the item has the 'str' property before accessing it
          const textItem = item as TextItem;
          return 'str' in textItem ? textItem.str : '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      textContent += pageText + '\n\n';
    }
    
    // Clean up
    await Promise.all(
      Array.from({ length: maxPages }, (_, i) => i + 1)
        .map(pageNum => pdf.getPage(pageNum).then(page => page.cleanup()))
    );
    
    await pdf.cleanup();
    await pdf.destroy();
    
    console.log(`[pdf.js] Extracted ${textContent.length} characters`);
    return textContent.trim() || null;
    
  } catch (error) {
    console.error('[pdf.js] Error extracting text:', error);
    return null;
  }
}

/**
 * Extracts text from a PDF buffer using pdf-parse (fallback)
 */
async function extractTextWithPdfParse(buffer: Buffer): Promise<string | null> {
  try {
    // Dynamically import pdf-parse to avoid loading it unless needed
    const { default: pdfParse } = await import('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text.trim() || null;
  } catch (error) {
    console.error('[pdf-parse] Error extracting text:', error);
    return null;
  }
}

/**
 * Extracts text from a PDF URL using multiple methods with fallbacks
 */
export async function extractPdfText(url: string): Promise<string | null> {
  console.log(`\n=== Starting PDF extraction from: ${url} ===`);
  
  try {
    // First, fetch the PDF as array buffer
    console.log('\n[1/3] Fetching PDF content...');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Method 1: Try with pdf-parse first (more reliable for some PDFs)
    console.log('\n[2/3] Trying pdf-parse extraction...');
    const pdfParseText = await withRetry(() => 
      extractTextWithPdfParse(buffer)
    );
    
    if (pdfParseText && pdfParseText.length > 100) { // Ensure we got meaningful content
      console.log('pdf-parse extraction successful');
      return pdfParseText;
    }
    
    // Method 2: Try with pdf.js (handles more complex PDFs)
    console.log('\n[3/3] Trying pdf.js extraction...');
    const pdfJsText = await withRetry(() => 
      extractTextWithPdfJs(url)
    );
    
    if (pdfJsText && pdfJsText.length > 100) {
      console.log('pdf.js extraction successful');
      return pdfJsText;
    }
    
    // Last resort: Try direct text extraction
    console.log('\n[Fallback] Trying direct text extraction...');
    const rawText = buffer.toString('utf8');
    if (rawText.length > 100) {
      console.log(`Extracted ${rawText.length} characters using direct text extraction`);
      return rawText;
    }
    
    console.warn('All extraction methods failed or returned insufficient content');
    return null;
    
  } catch (error) {
    console.error(`Error processing PDF (${url}):`, error);
    return null;
  } finally {
    console.log('=== PDF extraction completed ===\n');
  }
}

/**
 * Extracts text from a PDF buffer (for direct buffer input)
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string | null> {
  try {
    // First try pdf-parse
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const text = data.text.trim();
    
    if (text && text.length > 100) {
      return text;
    }
    
    // Fallback to raw text extraction
    const rawText = buffer.toString('utf8');
    return rawText.length > text.length ? rawText : text;
  } catch (error) {
    console.error('Error extracting text from buffer:', error);
    return buffer.toString('utf8');
  }
}
