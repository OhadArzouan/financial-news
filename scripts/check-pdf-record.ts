import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPdfRecord(id: number) {
  try {
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id },
      include: { feedItem: true }
    });
    
    console.log('PDF Record:');
    console.log(JSON.stringify(pdf, null, 2));
    
    if (pdf) {
      console.log('\nContent Length:', pdf.content?.length || 0);
      console.log('Content Preview:', pdf.content?.substring(0, 200) + '...');
    } else {
      console.log('No PDF found with ID:', id);
    }
  } catch (error) {
    console.error('Error fetching PDF record:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get ID from command line or use default
const pdfId = process.argv[2] ? parseInt(process.argv[2], 10) : 375;
checkPdfRecord(pdfId);
