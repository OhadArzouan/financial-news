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
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Checks if text is likely to be gibberish
 * Uses multiple heuristics to determine if text is readable
 */
function isGibberish(text: string): boolean {
  if (!text || text.length < 50) return true;
  
  // Check 1: Binary data often contains null bytes and control characters
  const binaryCharCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
  if (binaryCharCount > text.length * 0.05) {
    console.log('[Quality Check] Failed binary character check');
    return true;
  }
  
  // Check 2: High ratio of special characters and symbols to alphanumeric
  const specialCharCount = (text.match(/[^\w\s.,;:?!()[\]{}'"«»""''—–-]/g) || []).length;
  if (specialCharCount > text.length * 0.3) {
    console.log('[Quality Check] Failed special character ratio check');
    return true;
  }
  
  // Check 3: Check for common PDF binary markers
  const pdfMarkers = [
    'obj', 'endobj', 'stream', 'endstream', 'xref', 'trailer',
    '/Filter', '/FlateDecode', '/Length', '/Type', '/Page'
  ];
  
  const markerMatches = pdfMarkers.filter(marker => 
    text.includes(marker) && 
    // Make sure it's not just part of normal text
    (text.includes(`/${marker}`) || text.includes(`${marker}>>`) || text.includes(`<<${marker}`))
  );
  
  if (markerMatches.length > 3) {
    console.log('[Quality Check] Failed PDF marker check');
    return true;
  }
  
  // Check 4: Check for reasonable word distribution
  const words = text.split(/\s+/);
  const wordLengths = words.map(w => w.length);
  const avgWordLength = wordLengths.reduce((sum, len) => sum + len, 0) / words.length;
  
  if (avgWordLength > 15) {
    console.log('[Quality Check] Failed average word length check');
    return true;
  }
  
  // Check 5: Check for reasonable sentence structure
  const sentences = text.split(/[.!?]+/);
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentenceLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentences.length;
  
  if (avgSentenceLength > 50 || avgSentenceLength < 1) {
    console.log('[Quality Check] Failed sentence structure check');
    return true;
  }
  
  // Check 6: Check for common English words (at least some should be present)
  const commonWords = ['the', 'and', 'to', 'of', 'in', 'for', 'is', 'on', 'that', 'by'];
  const commonWordsFound = commonWords.filter(word => 
    text.toLowerCase().includes(` ${word} `) || 
    text.toLowerCase().startsWith(`${word} `)
  );
  
  if (commonWordsFound.length < 3) {
    console.log('[Quality Check] Failed common words check');
    return true;
  }
  
  return false;
}

/**
 * Extracts text from a PDF URL using pdf.js
 */
async function extractWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    console.log('[pdf.js] Loading PDF from array buffer');
    
    // Load the PDF document directly from the array buffer
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      // Using type assertion to add standardFontDataUrl
      ...(({
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`
      } as any))
    });
    
    const pdf = await loadingTask.promise;
    console.log(`[pdf.js] PDF loaded, pages: ${pdf.numPages}`);
    
    let textContent = '';
    const maxPages = Math.min(pdf.numPages, 100); // Process up to 100 pages
    
    // Extract text from each page
    for (let i = 1; i <= maxPages; i++) {
      console.log(`[pdf.js] Processing page ${i}/${maxPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      const pageText = content.items
        .filter(item => 'str' in item)
        .map(item => (item as any).str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      textContent += pageText + '\n\n';
    }
    
    // Clean up
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
 * Extracts text from a PDF buffer using pdf-parse
 */
async function extractWithPdfParse(buffer: Buffer): Promise<string | null> {
  try {
    console.log('[pdf-parse] Extracting text from buffer');
    // Dynamically import pdf-parse to avoid loading it unless needed
    const { default: pdfParse } = await import('pdf-parse');
    const data = await pdfParse(buffer);
    console.log(`[pdf-parse] Extracted ${data.text.length} characters`);
    return data.text.trim() || null;
  } catch (error) {
    console.error('[pdf-parse] Error extracting text:', error);
    return null;
  }
}

/**
 * Extracts text using Mozilla's pdf.js with a different configuration
 */
async function extractWithPdfJsAlternate(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    console.log('[pdf.js-alt] Loading PDF with alternate configuration');
    
    // Load the PDF document with different configuration
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true
    });
    
    const pdf = await loadingTask.promise;
    console.log(`[pdf.js-alt] PDF loaded, pages: ${pdf.numPages}`);
    
    let textContent = '';
    const maxPages = Math.min(pdf.numPages, 100); // Process up to 100 pages
    
    // Extract text from each page using a different approach
    for (let i = 1; i <= maxPages; i++) {
      console.log(`[pdf.js-alt] Processing page ${i}/${maxPages}`);
      const page = await pdf.getPage(i);
      
      // Use a different approach to extract text
      const textContent2 = await page.getTextContent({
        // Using type assertion for additional options
        ...(({
          normalizeWhitespace: true
        } as any)),
        disableCombineTextItems: false,
      });
      
      const pageText = textContent2.items
        .filter(item => 'str' in item)
        .map(item => (item as any).str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      textContent += pageText + '\n\n';
    }
    
    // Clean up
    await pdf.cleanup();
    await pdf.destroy();
    
    console.log(`[pdf.js-alt] Extracted ${textContent.length} characters`);
    return textContent.trim() || null;
    
  } catch (error) {
    console.error('[pdf.js-alt] Error extracting text:', error);
    return null;
  }
}

/**
 * Simple retry wrapper for async operations
 */
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
 * Extracts text from a PDF URL using multiple methods with fallbacks
 * and quality checks to ensure readable content
 */
export async function extractPdfText(url: string): Promise<string | null> {
  console.log(`\n=== Starting PDF extraction from: ${url} ===`);
  
  try {
    // First, fetch the PDF as array buffer
    console.log('\n[1/5] Fetching PDF content...');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Method 1: Try with pdf-parse
    console.log('\n[2/5] Trying pdf-parse extraction...');
    const pdfParseText = await withRetry(() => 
      extractWithPdfParse(buffer)
    ).catch(err => {
      console.error('pdf-parse extraction failed:', err);
      return null;
    });
    
    if (pdfParseText && pdfParseText.length > 100 && !isGibberish(pdfParseText)) {
      console.log('✅ pdf-parse extraction successful with quality content');
      return pdfParseText;
    } else if (pdfParseText) {
      console.log('⚠️ pdf-parse extraction returned content but it appears to be gibberish');
    }
    
    // Method 2: Try with pdf.js
    console.log('\n[3/5] Trying pdf.js extraction...');
    const pdfJsText = await withRetry(() => 
      extractWithPdfJs(arrayBuffer)
    ).catch(err => {
      console.error('pdf.js extraction failed:', err);
      return null;
    });
    
    if (pdfJsText && pdfJsText.length > 100 && !isGibberish(pdfJsText)) {
      console.log('✅ pdf.js extraction successful with quality content');
      return pdfJsText;
    } else if (pdfJsText) {
      console.log('⚠️ pdf.js extraction returned content but it appears to be gibberish');
    }
    
    // Method 3: Try with pdf.js alternate configuration
    console.log('\n[4/5] Trying pdf.js with alternate configuration...');
    const pdfJsAltText = await withRetry(() => 
      extractWithPdfJsAlternate(arrayBuffer)
    ).catch(err => {
      console.error('pdf.js alternate extraction failed:', err);
      return null;
    });
    
    if (pdfJsAltText && pdfJsAltText.length > 100 && !isGibberish(pdfJsAltText)) {
      console.log('✅ pdf.js alternate extraction successful with quality content');
      return pdfJsAltText;
    } else if (pdfJsAltText) {
      console.log('⚠️ pdf.js alternate extraction returned content but it appears to be gibberish');
    }
    
    // Method 4: Last resort - return the best result we have, even if it's gibberish
    console.log('\n[5/5] All quality checks failed, selecting best available content...');
    
    // Choose the longest non-null result
    const results = [
      { source: 'pdf-parse', text: pdfParseText },
      { source: 'pdf.js', text: pdfJsText },
      { source: 'pdf.js-alt', text: pdfJsAltText }
    ].filter(r => r.text !== null);
    
    if (results.length > 0) {
      // Sort by length (longest first)
      results.sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
      
      console.log(`⚠️ Using best available content from ${results[0].source} (${results[0].text?.length} chars)`);
      return results[0].text;
    }
    
    console.error('❌ All extraction methods failed');
    return null;
    
  } catch (error) {
    console.error('Error during PDF extraction:', error);
    return null;
  } finally {
    console.log('=== PDF extraction completed ===\n');
  }
}
