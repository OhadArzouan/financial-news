import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractPdfText } from '@/lib/pdf-extractor';

/**
 * POST handler to extract PDF content for all items in a feed
 * This is useful for retroactively extracting PDF content from existing feed items
 */
export async function POST(request: Request) {
  try {
    // Extract feed ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const idStr = pathParts[pathParts.length - 2];
    const feedId = parseInt(idStr, 10);

    if (isNaN(feedId)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
    }

    // Find the feed
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        items: {
          include: {
            pdfs: true
          }
        }
      }
    });

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // Stats to return
    const stats = {
      totalItems: feed.items.length,
      itemsWithPdfLinks: 0,
      pdfsExtracted: 0,
      pdfsAlreadyExtracted: 0,
      errors: 0
    };

    // Process each feed item
    for (const item of feed.items) {
      try {
        // Skip items that don't have a link
        if (!item.link) continue;

        // Check if the item already has PDFs
        if (item.pdfs && item.pdfs.length > 0) {
          // Check if any PDFs don't have content
          const pdfsWithoutContent = item.pdfs.filter(pdf => !pdf.content);
          
          if (pdfsWithoutContent.length > 0) {
            stats.itemsWithPdfLinks++;
            
            // Extract content for PDFs that don't have content
            for (const pdf of pdfsWithoutContent) {
              try {
                const pdfContent = await extractPdfText(pdf.url);
                
                if (pdfContent) {
                  // Update the PDF with extracted content
                  await prisma.feedItemPdf.update({
                    where: { id: pdf.id },
                    data: { content: pdfContent }
                  });
                  
                  stats.pdfsExtracted++;
                  console.log(`Extracted ${pdfContent.length} chars from PDF: ${pdf.url}`);
                }
              } catch (pdfError) {
                console.error(`Error extracting PDF content for ${pdf.url}:`, pdfError);
                stats.errors++;
              }
            }
          } else {
            stats.pdfsAlreadyExtracted += item.pdfs.length;
          }
          continue;
        }

        // Try to find PDF links in the extended content URL
        if (item.extendedContent) {
          // Simple regex to find PDF links in the extended content
          const pdfLinkRegex = /href=["'](https?:\/\/[^"']+\.pdf)["']/i;
          const match = item.extendedContent.match(pdfLinkRegex);
          
          if (match && match[1]) {
            const pdfUrl = match[1];
            stats.itemsWithPdfLinks++;
            
            try {
              // Extract text from the PDF
              const pdfContent = await extractPdfText(pdfUrl);
              
              if (pdfContent) {
                // Create a new PDF entry
                await prisma.feedItemPdf.create({
                  data: {
                    url: pdfUrl,
                    content: pdfContent,
                    feedItemId: item.id
                  }
                });
                
                stats.pdfsExtracted++;
                console.log(`Extracted ${pdfContent.length} chars from PDF: ${pdfUrl}`);
              }
            } catch (pdfError) {
              console.error(`Error extracting PDF content for ${pdfUrl}:`, pdfError);
              stats.errors++;
            }
          }
        }
      } catch (itemError) {
        console.error(`Error processing item ${item.id}:`, itemError);
        stats.errors++;
      }
    }

    return NextResponse.json({
      message: 'PDF extraction completed',
      feedId,
      stats
    });
  } catch (error) {
    console.error('Error extracting PDFs:', error);
    return NextResponse.json({ error: 'Failed to extract PDFs' }, { status: 500 });
  }
}
