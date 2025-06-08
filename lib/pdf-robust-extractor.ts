/**
 * Robust PDF text extractor using the pdf-parse library
 */

// Use require instead of import to avoid TypeScript issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

/**
 * Extract text from a PDF buffer using pdf-parse library
 * 
 * @param buffer PDF buffer data
 * @returns Extracted text or placeholder if extraction fails
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    // Options for pdf-parse
    const options = {
      // Limit page rendering to first 50 pages for performance
      max: 50,
      // Don't render annotations
      useSystemFonts: false
    };

    // Parse the PDF
    const data = await pdfParse(buffer, options);
    
    // Get the text content
    let text = data.text || '';
    
    // Clean up the extracted text
    text = cleanExtractedText(text);
    
    // If we couldn't extract anything meaningful, return a placeholder
    if (!text || text.trim().length < 50) {
      return '[PDF content available but text extraction was limited]';
    }
    
    // Return the extracted text (limit to reasonable size)
    return text.substring(0, 500000);
  } catch (error) {
    console.error('Error in PDF extraction:', error);
    
    // Fall back to simple extractor if pdf-parse fails
    try {
      const { extractTextFromPdfBuffer: simpleExtract } = require('./pdf-simple-extractor');
      console.log('Falling back to simple PDF extractor');
      return simpleExtract(buffer);
    } catch (fallbackError) {
      console.error('Fallback extraction also failed:', fallbackError);
      return '[PDF content extraction failed]';
    }
  }
}

/**
 * Clean up extracted text to improve readability
 */
function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Fix broken words at line breaks (common in PDFs)
    .replace(/([a-z])- ([a-z])/gi, '$1$2')
    // Add paragraph breaks where appropriate
    .replace(/\.\s+([A-Z])/g, '.\n\n$1')
    // Clean up any remaining artifacts
    .replace(/\n\s+/g, '\n')
    // Remove non-printable characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .trim();
}
