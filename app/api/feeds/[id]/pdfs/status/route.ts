import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const feedId = parseInt(params.id);
    
    if (isNaN(feedId)) {
      return NextResponse.json(
        { error: 'Invalid feed ID' },
        { status: 400 }
      );
    }

    // Get all PDFs for this feed with their extraction status
    const pdfs = await prisma.feedItemPdf.findMany({
      where: {
        feedItem: {
          feedId: feedId
        }
      },
      select: {
        id: true,
        url: true,
        extractionStatus: true,
        extractionAttempts: true,
        lastExtractedAt: true,
        lastError: true,
        feedItemId: true,
        feedItem: {
          select: {
            title: true,
            link: true
          }
        }
      },
      orderBy: {
        lastExtractedAt: 'desc'
      }
    });

    // Group by status for summary
    const statusSummary = pdfs.reduce((acc, pdf) => {
      const status = pdf.extractionStatus || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get counts for each status
    const total = pdfs.length;
    const success = pdfs.filter(p => p.extractionStatus === 'SUCCESS').length;
    const failed = pdfs.filter(p => p.extractionStatus === 'FAILED').length;
    const pending = pdfs.filter(p => p.extractionStatus === 'PENDING').length;
    const retrying = pdfs.filter(p => p.extractionStatus === 'RETRYING').length;

    return NextResponse.json({
      summary: {
        total,
        success,
        failed,
        pending,
        retrying,
        byStatus: statusSummary
      },
      pdfs
    });

  } catch (error) {
    console.error('Error fetching PDF status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDF status' },
      { status: 500 }
    );
  }
}
