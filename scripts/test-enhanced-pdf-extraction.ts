import { extractPdfText } from '../lib/pdf-extractor';

async function testPdfExtraction(pdfUrl: string) {
  console.log(`\n=== Testing PDF Extraction ===`);
  console.log(`URL: ${pdfUrl}`);
  
  try {
    console.log('\nStarting extraction...');
    const startTime = Date.now();
    
    const text = await extractPdfText(pdfUrl);
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nExtraction completed in ${duration.toFixed(2)} seconds`);
    
    if (text) {
      console.log(`\nExtracted ${text.length} characters`);
      console.log('\n=== Content Preview (first 500 chars) ===');
      console.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      
      // Save full content to file for inspection
      const fs = require('fs');
      const path = require('path');
      const outputDir = path.join(__dirname, '../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `extracted-${Date.now()}.txt`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, text);
      console.log(`\nFull content saved to: ${filePath}`);
      
      return { success: true, textLength: text.length, filePath };
    } else {
      console.error('\n❌ Failed to extract text from PDF');
      return { success: false, error: 'No text extracted' };
    }
  } catch (error) {
    console.error('\n❌ Error during extraction:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Get URL from command line or use default
const testUrl = process.argv[2] || 'https://www.federalreserve.gov/newsevents/pressreleases/files/chaircensusletter.pdf';

// Run the test
testPdfExtraction(testUrl)
  .then(result => {
    console.log('\n=== Test Completed ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
