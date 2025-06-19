/**
 * Enhanced PDF text extractor that works by searching for text patterns
 * without requiring complex parsing libraries
 * 
 * @param buffer PDF buffer data
 * @returns Extracted text or null if extraction fails
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string {
  try {
    // Convert buffer to string (this will have binary data mixed with text)
    // Use latin1 encoding to better preserve binary data as we'll parse it manually
    const pdfString = buffer.toString('latin1', 0, Math.min(buffer.length, 10000000));
    
    // Collection for extracted text
    const extractedStrings: string[] = [];
    
    // PDF text extraction strategies
    
    // Strategy 1: Extract text from text objects (BT...ET blocks)
    // These are the most reliable sources of text in PDFs
    const textBlocks = extractTextBlocks(pdfString);
    for (const block of textBlocks) {
      const textStrings = extractStringsFromTextBlock(block);
      extractedStrings.push(...textStrings);
    }
    
    // Strategy 2: Look for text strings in content streams
    // This catches text that might not be in proper BT/ET blocks
    const contentStreams = extractContentStreams(pdfString);
    for (const stream of contentStreams) {
      // Skip streams that are likely to be images or other binary data
      if (isLikelyBinaryStream(stream)) continue;
      
      const textStrings = extractStringsFromStream(stream);
      extractedStrings.push(...textStrings);
    }
    
    // Strategy 3: Look for standalone text strings throughout the document
    // This is a fallback for PDFs with unusual structure
    const standaloneStrings = extractStandaloneStrings(pdfString);
    extractedStrings.push(...standaloneStrings);
    
    // Strategy 4: Extract text from object streams
    // Some PDFs store text in object streams with specific encoding
    const objectStreams = extractObjectStreams(pdfString);
    for (const stream of objectStreams) {
      const textStrings = extractStringsFromObjectStream(stream);
      extractedStrings.push(...textStrings);
    }
    
    // Strategy 5: Extract text from ToUnicode CMap entries
    // These contain character mapping information that can help with text extraction
    const cmapEntries = extractToUnicodeCMaps(pdfString);
    for (const cmap of cmapEntries) {
      const textStrings = extractStringsFromCMap(cmap);
      extractedStrings.push(...textStrings);
    }
    
    // Process and combine the extracted strings
    const finalText = postProcessExtractedText(extractedStrings);
    
    // If we couldn't extract anything meaningful, try a more aggressive approach
    if (!finalText || finalText.trim().length < 50) {
      // Last resort: extract any string that looks like text
      const lastResortStrings = extractAllPossibleText(pdfString);
      const lastResortText = postProcessExtractedText(lastResortStrings);
      
      if (lastResortText && lastResortText.trim().length >= 50) {
        return lastResortText.substring(0, 500000);
      }
      
      return '[PDF content available but text extraction was limited]';
    }
    
    // Return the extracted text (limit to reasonable size)
    return finalText.substring(0, 500000);
  } catch (error) {
    console.error('Error in enhanced PDF extraction:', error);
    return '[PDF content extraction failed]';
  }
}

/**
 * Extract text blocks (BT...ET) from a PDF string
 */
function extractTextBlocks(pdfString: string): string[] {
  const blocks: string[] = [];
  const regex = /BT([\s\S]*?)ET/g;
  let match;
  
  while ((match = regex.exec(pdfString)) !== null) {
    if (match[1] && match[1].length > 0) {
      blocks.push(match[1]);
    }
  }
  
  return blocks;
}

/**
 * Extract text strings from a text block
 */
function extractStringsFromTextBlock(block: string): string[] {
  const strings: string[] = [];
  
  // Extract regular string literals (text in parentheses)
  const textRegex = /\(([^\)\\]+(?:\\.[^\)\\]*)*)\)/g;
  let textMatch;
  while ((textMatch = textRegex.exec(block)) !== null) {
    let text = textMatch[1];
    text = cleanPdfText(text);
    
    if (text && text.trim() && text.length > 1 && isProbablyText(text)) {
      strings.push(text.trim());
    }
  }
  
  // Extract hex strings
  const hexRegex = /<([0-9A-Fa-f]+)>/g;
  let hexMatch;
  while ((hexMatch = hexRegex.exec(block)) !== null) {
    const hexText = hexToText(hexMatch[1]);
    if (hexText && hexText.trim() && hexText.length > 1 && isProbablyText(hexText)) {
      strings.push(hexText.trim());
    }
  }
  
  return strings;
}

/**
 * Extract content streams from a PDF string
 */
function extractContentStreams(pdfString: string): string[] {
  const streams: string[] = [];
  const regex = /stream[\r\n]+([\s\S]*?)endstream/g;
  let match;
  
  while ((match = regex.exec(pdfString)) !== null) {
    if (match[1] && match[1].length > 0) {
      streams.push(match[1]);
    }
  }
  
  return streams;
}

/**
 * Check if a stream is likely to be binary data (image, etc.) rather than text
 */
function isLikelyBinaryStream(stream: string): boolean {
  // Check for image filter indicators
  if (/\/DCTDecode|\/FlateDecode|\/LZWDecode|\/ASCII85Decode|\/ASCIIHexDecode|\/JPXDecode|\/CCITTFaxDecode|\/JBIG2Decode/i.test(stream)) {
    return true;
  }
  
  // Check for high concentration of non-printable characters
  let printableCount = 0;
  let totalCount = 0;
  
  // Only sample the first 1000 characters for performance
  const sampleSize = Math.min(stream.length, 1000);
  for (let i = 0; i < sampleSize; i++) {
    totalCount++;
    const charCode = stream.charCodeAt(i);
    if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
      printableCount++;
    }
  }
  
  // If less than 30% of characters are printable, it's likely binary
  return (printableCount / totalCount) < 0.3;
}

/**
 * Extract text strings from a content stream
 */
function extractStringsFromStream(stream: string): string[] {
  const strings: string[] = [];
  
  // Extract regular string literals (text in parentheses)
  const textRegex = /\(([^\)\\]+(?:\\.[^\)\\]*)*)\)/g;
  let textMatch;
  while ((textMatch = textRegex.exec(stream)) !== null) {
    let text = textMatch[1];
    text = cleanPdfText(text);
    
    if (text && text.trim() && text.length > 1 && isProbablyText(text)) {
      strings.push(text.trim());
    }
  }
  
  // Extract hex strings
  const hexRegex = /<([0-9A-Fa-f]+)>/g;
  let hexMatch;
  while ((hexMatch = hexRegex.exec(stream)) !== null) {
    const hexText = hexToText(hexMatch[1]);
    if (hexText && hexText.trim() && hexText.length > 1 && isProbablyText(hexText)) {
      strings.push(hexText.trim());
    }
  }
  
  return strings;
}

/**
 * Extract standalone text strings from a PDF string
 */
function extractStandaloneStrings(pdfString: string): string[] {
  const strings: string[] = [];
  
  // Look for text that appears to be actual content (not metadata or structure)
  // We'll look for longer strings that are likely to be meaningful text
  const textRegex = /\(([^\)\\]{10,}(?:\\.[^\)\\]*)*)\)/g;
  let textMatch;
  while ((textMatch = textRegex.exec(pdfString)) !== null) {
    let text = textMatch[1];
    text = cleanPdfText(text);
    
    // Apply stricter filtering for standalone strings to avoid metadata
    if (text && text.trim() && text.length > 10 && isProbablyText(text) && !isLikelyMetadata(text)) {
      strings.push(text.trim());
    }
  }
  
  return strings;
}

/**
 * Check if text is likely to be metadata rather than content
 */
function isLikelyMetadata(text: string): boolean {
  // Common PDF metadata patterns
  const metadataPatterns = [
    /^Adobe/i,
    /^PDF/i,
    /^Acrobat/i,
    /^uuid:/i,
    /^\d+\s+\d+\s+obj/,
    /^endobj/,
    /^xref/,
    /^trailer/,
    /^startxref/,
    /^%%EOF/
  ];
  
  for (const pattern of metadataPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Clean PDF text by handling escape sequences and common encoding issues
 */
function cleanPdfText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\([0-9]{3})/g, (match, octal) => {
      // Convert octal escape sequences to characters
      return String.fromCharCode(parseInt(octal, 8));
    });
}

/**
 * Convert hex string to text
 */
function hexToText(hex: string): string {
  let text = '';
  for (let i = 0; i < hex.length; i += 2) {
    if (i + 1 < hex.length) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      // Only include printable ASCII characters and common whitespace
      if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
        text += String.fromCharCode(charCode);
      }
    }
  }
  return text;
}

/**
 * Check if a string is likely to be actual text rather than binary data or metadata
 */
function isProbablyText(text: string): boolean {
  // Check if the string contains mostly printable ASCII characters
  let printableCount = 0;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
      printableCount++;
    }
  }
  
  // If more than 80% of characters are printable, it's probably text
  return (printableCount / text.length) > 0.8;
}

/**
 * Post-process extracted text to improve readability
 */
/**
 * Extract object streams from a PDF string
 * Object streams may contain text with different encoding than regular streams
 */
function extractObjectStreams(pdfString: string): string[] {
  const streams: string[] = [];
  const regex = /\d+\s+\d+\s+obj[\r\n]+<<[\s\S]*?>>[\r\n]+stream[\r\n]+(([\s\S]*?))endstream/g;
  let match;
  
  while ((match = regex.exec(pdfString)) !== null) {
    if (match[1] && match[1].length > 0) {
      streams.push(match[1]);
    }
  }
  
  return streams;
}

/**
 * Extract strings from an object stream
 * Object streams often contain text with specific encoding
 */
function extractStringsFromObjectStream(stream: string): string[] {
  // Similar to extractStringsFromStream but with additional filtering
  const strings: string[] = [];
  
  // Extract regular string literals with more permissive pattern
  const textRegex = /\(([^\)\\]*(?:\\.[^\)\\]*)*)\)/g;
  let textMatch;
  while ((textMatch = textRegex.exec(stream)) !== null) {
    let text = textMatch[1];
    text = cleanPdfText(text);
    
    if (text && text.trim() && isProbablyText(text)) {
      strings.push(text.trim());
    }
  }
  
  // Extract hex strings with more permissive pattern
  const hexRegex = /<([0-9A-Fa-f]*)>/g;
  let hexMatch;
  while ((hexMatch = hexRegex.exec(stream)) !== null) {
    if (hexMatch[1] && hexMatch[1].length > 0) {
      const hexText = hexToText(hexMatch[1]);
      if (hexText && hexText.trim() && isProbablyText(hexText)) {
        strings.push(hexText.trim());
      }
    }
  }
  
  return strings;
}

/**
 * Extract ToUnicode CMap entries from a PDF string
 * CMaps contain character mapping information that can help with text extraction
 */
function extractToUnicodeCMaps(pdfString: string): string[] {
  const cmaps: string[] = [];
  const regex = /\/ToUnicode[\s\r\n]+<<[\s\S]*?>>[\s\r\n]+stream[\r\n]+(([\s\S]*?))endstream/g;
  let match;
  
  while ((match = regex.exec(pdfString)) !== null) {
    if (match[1] && match[1].length > 0) {
      cmaps.push(match[1]);
    }
  }
  
  return cmaps;
}

/**
 * Extract strings from a CMap
 */
function extractStringsFromCMap(cmap: string): string[] {
  const strings: string[] = [];
  
  // Look for text in beginbfchar...endbfchar blocks
  const bfcharRegex = /beginbfchar[\s\r\n]+(([\s\S]*?))endbfchar/g;
  let bfcharMatch;
  while ((bfcharMatch = bfcharRegex.exec(cmap)) !== null) {
    if (bfcharMatch[1]) {
      // Extract hex strings that represent Unicode characters
      const hexPairs = bfcharMatch[1].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || [];
      for (const pair of hexPairs) {
        const unicodeMatch = pair.match(/<[0-9A-Fa-f]+>\s*<([0-9A-Fa-f]+)>/); 
        if (unicodeMatch && unicodeMatch[1]) {
          const hexText = hexToText(unicodeMatch[1]);
          if (hexText && hexText.trim() && isProbablyText(hexText)) {
            strings.push(hexText.trim());
          }
        }
      }
    }
  }
  
  return strings;
}

/**
 * Extract all possible text from a PDF string as a last resort
 */
function extractAllPossibleText(pdfString: string): string[] {
  const strings: string[] = [];
  
  // More aggressive text extraction - look for any string that might be text
  // This is a last resort when other methods fail
  
  // Look for any parenthesized text that might be content
  const textRegex = /\(([^\)\\]{3,}(?:\\.[^\)\\]*)*)\)/g;
  let textMatch;
  while ((textMatch = textRegex.exec(pdfString)) !== null) {
    let text = textMatch[1];
    text = cleanPdfText(text);
    
    // Less strict filtering to catch more potential text
    if (text && text.trim().length > 3) {
      // Check if it has a reasonable ratio of alphanumeric characters
      const alphaNumericCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
      if (alphaNumericCount > text.length * 0.3) {
        strings.push(text.trim());
      }
    }
  }
  
  // Extract any hex strings that might represent text
  const hexRegex = /<([0-9A-Fa-f]{6,})>/g;
  let hexMatch;
  while ((hexMatch = hexRegex.exec(pdfString)) !== null) {
    const hexText = hexToText(hexMatch[1]);
    if (hexText && hexText.trim().length > 3) {
      const alphaNumericCount = (hexText.match(/[a-zA-Z0-9]/g) || []).length;
      if (alphaNumericCount > hexText.length * 0.3) {
        strings.push(hexText.trim());
      }
    }
  }
  
  return strings;
}

/**
 * Post-process extracted text to improve readability
 */
function postProcessExtractedText(extractedStrings: string[]): string {
  // Filter out very short strings and duplicates
  const filteredStrings = extractedStrings
    .filter(s => s.length > 1) // Remove single characters
    .filter((s, i, arr) => arr.indexOf(s) === i); // Remove duplicates
  
  // Join strings with appropriate spacing
  let text = filteredStrings.join(' ');
  
  // Clean up common PDF extraction artifacts
  text = text
    // Fix excessive spaces
    .replace(/\s+/g, ' ')
    // Fix broken words at line breaks (common in PDFs)
    .replace(/([a-z])- ([a-z])/gi, '$1$2')
    // Add paragraph breaks where appropriate
    .replace(/\.\s+([A-Z])/g, '.\n\n$1')
    .replace(/\n\s+/g, '\n')
    // Remove non-printable characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Remove common PDF artifacts
    .replace(/endobj|endstream|startxref|xref|trailer/g, '')
    // Remove isolated numbers that are likely page numbers or object references
    .replace(/\s+\d+\s+/g, ' ')
    // Clean up any remaining PDF syntax artifacts
    .replace(/\s+obj\s+/g, ' ')
    // Additional cleanup for better readability
    .replace(/\(cid:\d+\)/g, '') // Remove CID markers
    .replace(/\s*\d+\s+Tf\s*/g, ' ') // Remove font commands
    .replace(/\s*\d+(\.\d+)?\s+\d+(\.\d+)?\s+Td\s*/g, ' ') // Remove positioning commands
    .replace(/\s*\d+(\.\d+)?\s+g\s*/g, ' ') // Remove graphics commands
    .replace(/\s*BT\s*|\s*ET\s*/g, ' '); // Remove text block markers
  
  return text.trim();
}
