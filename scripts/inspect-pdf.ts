import fs from 'fs';
import { promisify } from 'util';
import fetch from 'node-fetch';

const writeFile = promisify(fs.writeFile);

async function inspectPdf(url: string) {
  try {
    console.log(`Downloading PDF from: ${url}`);
    
    // Download the PDF
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    console.log(`Downloaded ${buffer.length} bytes`);
    
    // Save the PDF for inspection
    const outputPath = 'temp-inspect.pdf';
    await writeFile(outputPath, buffer);
    console.log(`PDF saved to: ${outputPath}`);
    
    // Check file type
    const fileType = require('file-type');
    const type = await fileType.fromBuffer(buffer);
    console.log('File type:', type);
    
    // Try to extract text using different methods
    await tryExtractText(buffer, 'pdf-parse');
    
  } catch (error) {
    console.error('Error inspecting PDF:', error);
  }
}

async function tryExtractText(buffer: Buffer, method: string) {
  try {
    console.log(`\n=== Trying extraction with ${method} ===`);
    
    let text = '';
    
    switch (method) {
      case 'pdf-parse':
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        text = data.text;
        break;
      
      case 'pdf2json':
        const { parse } = require('pdf2json');
        const pdf2json = new parse();
        text = await new Promise((resolve, reject) => {
          let result = '';
          pdf2json.on('pdfParser_dataError', reject);
          pdf2json.on('pdfParser_dataReady', (pdfData: any) => {
            resolve(pdfData.Pages.map((page: any) => 
              page.Texts.map((text: any) => 
                decodeURIComponent(text.R[0].T)
              ).join(' ')
            ).join('\n'));
          });
          pdf2json.parseBuffer(buffer);
        });
        break;
      
      case 'pdf-parse-binary':
        // Try with binary mode
        const pdfParseBinary = require('pdf-parse');
        const dataBinary = await pdfParseBinary(buffer, { pagerender: renderPage });
        text = dataBinary.text;
        break;
    }
    
    console.log(`Extracted ${text.length} characters`);
    console.log('First 500 chars:');
    console.log(text.substring(0, 500));
    
    return text;
    
  } catch (error) {
    console.error(`Error with ${method}:`, error);
    return null;
  }
}

// Custom page renderer for pdf-parse
function renderPage(pageData: any) {
  return pageData.getTextContent().then((textContent: any) => {
    const viewport = pageData.getViewport({ scale: 1.0 });
    const text = [];
    
    for (const item of textContent.items) {
      text.push(item.str);
    }
    
    return text.join(' ');
  });
}

// Get URL from command line or use default
const pdfUrl = process.argv[2] || 'https://www.federalreserve.gov/newsevents/pressreleases/files/chaircensusletter.pdf';

inspectPdf(pdfUrl);
