import { NextResponse } from 'next/server';
import { PrismaClient } from '../../../../app/generated/prisma';

// Minimum acceptable content length (in characters)
const MIN_CONTENT_LENGTH = 100;

/**
 * GET handler for fetching PDFs that need reprocessing
 * This identifies PDFs with missing or insufficient content
 */
export async function GET() {
  const prisma = new PrismaClient();
  
  try {
    // Find PDFs with null or empty content
    const emptyPdfs = await prisma.feedItemPdf.findMany({
      where: {
        OR: [
          { content: null },
          { content: '' }
        ]
      },
      include: {
        feedItem: {
          select: {
            title: true,
            link: true,
            feedId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Find all PDFs with some content
    const allPdfs = await prisma.feedItemPdf.findMany({
      where: {
        NOT: {
          OR: [
            { content: null },
            { content: '' }
          ]
        }
      },
      include: {
        feedItem: {
          select: {
            title: true,
            link: true,
            feedId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Filter PDFs with short content
    const shortContentPdfs = allPdfs.filter(pdf => 
      pdf.content && pdf.content.length < MIN_CONTENT_LENGTH
    );
    
    // Combine the results
    const pdfsToReprocess = [...emptyPdfs, ...shortContentPdfs];
    
    return NextResponse.json({ 
      pdfs: pdfsToReprocess,
      totalCount: pdfsToReprocess.length,
      emptyCount: emptyPdfs.length,
      shortCount: shortContentPdfs.length
    });
    
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDFs' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
