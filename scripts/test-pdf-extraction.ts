import { extractPdfText } from '../lib/pdf-extractor';
import fs from 'fs/promises';

async function testPdfExtraction(url: string) {
  try {
    console.log(`Testing PDF extraction for: ${url}`);
    const text = await extractPdfText(url);
    
    if (text) {
      console.log('\n=== Extraction Successful ===');
      console.log(`Extracted ${text.length} characters`);
      console.log('\n=== First 500 characters ===');
      console.log(text.substring(0, 500));
      
      // Save the extracted text to a file for inspection
      await fs.writeFile('extracted-text.txt', text);
      console.log('\nFull text saved to extracted-text.txt');
    } else {
      console.error('Failed to extract text from PDF');
    }
  } catch (error) {
    console.error('Error during PDF extraction test:', error);
  }
}

// Test with the Federal Reserve PDF that was having issues
const testUrl = 'https://www.federalreserve.gov/newsevents/pressreleases/files/chaircensusletter.pdf';
testPdfExtraction(testUrl);
