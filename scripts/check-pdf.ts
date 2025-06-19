import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPdf(pdfId: number) {
  try {
    console.log(`Checking PDF with ID: ${pdfId}`);
    
    // Check if the PDF exists
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id: pdfId },
      include: {
        feedItem: {
          select: {
            title: true,
            link: true,
            publishedAt: true
          }
        }
      }
    });

    if (!pdf) {
      console.log(`PDF with ID ${pdfId} not found.`);
      
      // Find the closest IDs
      const previous = await prisma.feedItemPdf.findFirst({
        where: { id: { lt: pdfId } },
        orderBy: { id: 'desc' },
        take: 1
      });
      
      const next = await prisma.feedItemPdf.findFirst({
        where: { id: { gt: pdfId } },
        orderBy: { id: 'asc' },
        take: 1
      });
      
      console.log('\nClosest PDFs:');
      if (previous) console.log(`- Previous ID: ${previous.id} (${previous.url})`);
      if (next) console.log(`- Next ID: ${next.id} (${next.url})`);
      
      return;
    }
    
    // If we found the PDF, show its details
    console.log('\n=== PDF Details ===');
    console.log(`ID: ${pdf.id}`);
    console.log(`URL: ${pdf.url}`);
    console.log(`Content Length: ${pdf.content?.length || 0} characters`);
    console.log(`Created At: ${pdf.createdAt}`);
    console.log(`Feed Item: ${pdf.feedItem?.title || 'N/A'}`);
    console.log(`Feed Item URL: ${pdf.feedItem?.link || 'N/A'}`);
    console.log(`Published At: ${pdf.feedItem?.publishedAt || 'N/A'}`);
    
    if (pdf.content) {
      console.log('\n=== Content Preview (first 200 chars) ===');
      console.log(pdf.content.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('Error checking PDF:', error);
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

checkPdf(pdfId);
