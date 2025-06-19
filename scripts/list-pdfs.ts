import { prisma } from '../lib/prisma';

async function listPdfs() {
  try {
    console.log('Fetching all PDFs...');
    
    // First, check the count
    const count = await prisma.feedItemPdf.count();
    console.log(`Total PDFs in database: ${count}`);
    
    // Get all PDFs with basic info
    const pdfs = await prisma.feedItemPdf.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        url: true,
        createdAt: true,
        content: true,
        feedItem: {
          select: {
            title: true,
            link: true
          }
        }
      }
    });
    
    // Display a table of PDFs
    console.log('\n=== PDF List ===');
    console.table(pdfs.map(pdf => ({
      id: pdf.id,
      url: pdf.url.substring(0, 50) + (pdf.url.length > 50 ? '...' : ''),
      contentLength: pdf.content?.length || 0,
      feedItemTitle: pdf.feedItem?.title?.substring(0, 30) || 'N/A'
    })));
    
    // Check if ID 279 exists
    console.log('\n=== Checking for ID 279 ===');
    const pdf279 = pdfs.find(p => p.id === 279);
    if (pdf279) {
      console.log('Found PDF with ID 279:');
      console.log({
        id: pdf279.id,
        url: pdf279.url,
        contentLength: pdf279.content?.length || 0,
        feedItemTitle: pdf279.feedItem?.title || 'N/A',
        feedItemUrl: pdf279.feedItem?.link || 'N/A',
        createdAt: pdf279.createdAt
      });
      
      if (pdf279.content) {
        console.log('\nContent preview (first 200 chars):');
        console.log(pdf279.content.substring(0, 200) + '...');
      }
    } else {
      console.log('PDF with ID 279 not found in the results.');
      
      // Check the range around 279
      console.log('\nChecking nearby IDs:');
      const nearby = pdfs.filter(p => p.id >= 270 && p.id <= 290);
      console.table(nearby.map(p => ({
        id: p.id,
        url: p.url.substring(0, 40) + (p.url.length > 40 ? '...' : ''),
        contentLength: p.content?.length || 0
      })));
    }
    
  } catch (error) {
    console.error('Error listing PDFs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listPdfs();
