/**
 * Robust PDF text extractor using the pdf-parse library
 */

// Import pdf-parse with a try-catch to handle potential issues with test files
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.error('Error loading pdf-parse:', error.message);
  // Provide a fallback implementation if pdf-parse fails to load
  pdfParse = async (buffer, options) => {
    return { text: 'PDF extraction unavailable' };
  };
}

/**
 * Extract text from a PDF buffer using pdf-parse library
 * 
 * @param {Buffer} buffer PDF buffer data
 * @returns {Promise<string>} Extracted text or placeholder if extraction fails
 */
async function extractTextFromPdfBuffer(buffer) {
  try {
    console.log('Starting PDF extraction with buffer size:', buffer.length);
    
    // First attempt with standard options
    let text = await attemptExtraction(buffer, {
      // Increased page limit to handle longer documents
      max: 100,
      // Use system fonts for better character recognition
      useSystemFonts: true
    });
    
    console.log(`First extraction attempt result: ${text.length} characters`);
    
    // If the first attempt yielded limited results, try with a custom renderer
    if (!text || text.length < 1000) {
      console.log('First extraction attempt yielded limited results, trying alternative method...');
      
      // Second attempt with custom renderer to handle complex PDFs
      const customRenderedText = await attemptExtraction(buffer, {
        max: 100,
        useSystemFonts: true,
        // Custom renderer to improve text extraction
        pagerender: renderPage
      });
      
      console.log(`Custom renderer extraction result: ${customRenderedText.length} characters`);
      
      // Use the result with more text
      if (customRenderedText && customRenderedText.length > text.length) {
        console.log('Using custom renderer result as it produced more text');
        text = customRenderedText;
      }
    }
    
    // Third attempt with different options if still limited results
    if (!text || text.length < 1000) {
      console.log('Previous extraction attempts yielded limited results, trying with different options...');
      
      const alternativeText = await attemptExtraction(buffer, {
        max: 200,  // Try with more pages
        useSystemFonts: true,
        verbosity: 1  // Increase verbosity for more detailed extraction
      });
      
      console.log(`Alternative extraction result: ${alternativeText.length} characters`);
      
      // Use the result with more text
      if (alternativeText && alternativeText.length > text.length) {
        console.log('Using alternative extraction result as it produced more text');
        text = alternativeText;
      }
    }
    
    // Log the final result
    console.log(`Final extraction result: ${text.length} characters`);
    if (text.length > 0) {
      console.log('Text preview:', text.substring(0, 200) + '...');
    }
    
    return text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

/**
 * Attempt PDF extraction with specific options
 * 
 * @param {Buffer} buffer PDF buffer
 * @param {Object} options Extraction options
 * @returns {Promise<string>} Extracted and cleaned text
 */
async function attemptExtraction(buffer, options) {
  try {
    console.log('Attempting extraction with options:', JSON.stringify(options));
    const data = await pdfParse(buffer, options);
    console.log(`Extraction result: ${data.text?.length || 0} characters`);
    // Get the text content
    let text = data.text || '';
    
    // Clean up the extracted text
    return cleanExtractedText(text);
  } catch (error) {
    console.error('PDF extraction error:', error.message);
    return '';
  }
}

/**
 * Custom page renderer for complex PDFs
 * 
 * @param {Object} pageData Page data from pdf-parse
 * @returns {Promise<string>} Rendered page text
 */
async function renderPage(pageData) {
  // Check if page contains text
  const renderOptions = {
    normalizeWhitespace: true,
    disableCombineTextItems: false
  };
  
  return pageData.getTextContent(renderOptions)
    .then(textContent => {
      let lastY, text = '';
      for (const item of textContent.items) {
        if (lastY == item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      return text;
    });
}

/**
 * Clean up extracted text to improve readability while preserving structure
 * 
 * @param {string} text The raw extracted text
 * @returns {string} Cleaned text
 */
function cleanExtractedText(text) {
  if (!text) return '';
  
  // First, preserve paragraph structure by marking real paragraphs
  let processedText = text
    // Remove non-printable characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Normalize line endings
    .replace(/\r\n|\r/g, '\n')
    // Mark paragraph breaks (sentences ending with period followed by capital letter)
    .replace(/\.\s+([A-Z])/g, '.\n\n$1')
    // Fix broken words at line breaks (common in PDFs)
    .replace(/([a-z])- *\n *([a-z])/gi, '$1$2')
    // Replace multiple blank lines with a single one
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    // Normalize spaces within lines (not at line breaks)
    .replace(/([^\n])\s{2,}([^\n])/g, '$1 $2');
  
  // Handle bullet points and numbered lists
  processedText = processedText
    // Preserve bullet points
    .replace(/^[•\-*]\s*/gm, '• ')
    // Preserve numbered lists
    .replace(/^(\d+\.?)\s*/gm, '$1 ');
  
  // Final cleanup
  return processedText
    // Remove trailing/leading whitespace
    .trim();
}

/**
 * Export the function for use in other modules
 */
module.exports = {
  extractTextFromPdfBuffer
};
