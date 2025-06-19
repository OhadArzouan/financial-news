import { extractPdfText } from '../lib/pdf-extractor';
import { prisma } from '../lib/prisma';

async function testPdfExtraction(pdfId: number) {
  try {
    console.log(`Testing PDF extraction for ID: ${pdfId}`);
    
    // Get the PDF from the database
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id: pdfId },
      include: {
        feedItem: {
          select: {
            title: true,
            link: true
          }
        }
      }
    });

    if (!pdf) {
      console.error(`PDF with ID ${pdfId} not found`);
      // Try to list available PDFs to help debug
      const pdfs = await prisma.feedItemPdf.findMany({
        take: 5,
        orderBy: { id: 'desc' },
        include: { feedItem: { select: { title: true } } }
      });
      console.log('\nRecent PDFs in database:');
      console.table(pdfs.map(p => ({
        id: p.id,
        url: p.url,
        contentLength: p.content?.length || 0,
        feedItemTitle: p.feedItem?.title || 'N/A'
      })));
      return;
    }

    if (!pdf) {
      console.error(`PDF with ID ${pdfId} not found`);
      return;
    }

    console.log(`Found PDF: ${pdf.feedItem?.title || 'Untitled'}`);
    console.log(`PDF URL: ${pdf.url}`);
    console.log(`Feed Item URL: ${pdf.feedItem?.link || 'N/A'}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);
    
    if (pdf.content) {
      console.log('Current content preview:', pdf.content.substring(0, 200) + '...');
    }

    // Test the extraction
    console.log('\n=== Testing PDF Extraction ===');
    const extractedText = await extractPdfText(pdf.url);
    
    console.log('\n=== Extraction Results ===');
    console.log(`Extracted ${extractedText?.length || 0} characters`);
    
    if (extractedText) {
      console.log('\n=== Extracted Text Preview ===');
      console.log(extractedText.substring(0, 500) + '...');
      
      console.log('\n=== Text Analysis ===');
      console.log(`First 100 chars: ${extractedText.substring(0, 100)}`);
      console.log(`Contains HTML: ${extractedText.includes('<') && extractedText.includes('>') ? 'Yes' : 'No'}`);
      console.log(`Contains binary data: ${/\ufffd/.test(extractedText) ? 'Yes' : 'No'}`);
    }
    
  } catch (error) {
    console.error('Error testing PDF extraction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get the PDF ID from command line arguments or use the default (279)
const pdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 279;

if (isNaN(pdfId)) {
  console.error('Invalid PDF ID. Please provide a number.');
  process.exit(1);
}

testPdfExtraction(pdfId);
