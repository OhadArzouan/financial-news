import { extractPdfText } from '../lib/pdf-extractor-new';

async function testPdfExtraction(url: string) {
  try {
    console.log(`Testing PDF extraction from: ${url}`);
    const text = await extractPdfText(url);
    
    if (text) {
      console.log('\n=== Extraction successful! ===');
      console.log(`Extracted ${text.length} characters`);
      console.log('\nPreview:');
      console.log(text.substring(0, 500) + '...');
      
      // Save to file for inspection
      const fs = await import('fs');
      const path = await import('path');
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `extracted-${Date.now()}.txt`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, text);
      console.log(`\nFull text saved to: ${filePath}`);
    } else {
      console.error('Failed to extract text from PDF');
    }
  } catch (error) {
    console.error('Error testing PDF extraction:', error);
  }
}

// Test with the Federal Reserve PDF
const testUrl = 'https://www.federalreserve.gov/newsevents/pressreleases/files/chaircensusletter.pdf';
testPdfExtraction(testUrl);
