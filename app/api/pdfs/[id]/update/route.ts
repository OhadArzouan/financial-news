import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractPdfText } from '@/lib/pdf-extractor';

/**
 * POST handler to update a specific PDF's content
 * This is useful for reprocessing PDFs with improved extraction
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid PDF ID' }, { status: 400 });
    }
    
    // Find the PDF
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id }
    });
    
    if (!pdf) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }
    
    console.log(`Reprocessing PDF ${id}: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);
    
    // Extract text from the PDF URL
    let newContent = await extractPdfText(pdf.url);
    
    // If extraction completely failed, try a direct approach as last resort
    if (!newContent) {
      try {
        console.log('Attempting direct extraction as last resort...');
        const response = await fetch(pdf.url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer && buffer.length > 0) {
            const pdfParser = require('../../../../../lib/pdf-parser');
            newContent = await pdfParser.extractTextFromPdfBuffer(buffer);
            console.log(`Direct extraction result: ${newContent?.length || 0} characters`);
          }
        }
      } catch (directError) {
        console.error('Direct extraction failed:', directError);
      }
    }
    
    // If we still couldn't extract anything, return an error
    if (!newContent) {
      return NextResponse.json({
        error: 'Failed to extract new content',
        pdfId: id,
        url: pdf.url
      }, { status: 500 });
    }
    
    // Even if the content is short, we'll use it anyway
    console.log(`Using extracted content: ${newContent.length} characters`);
    
    // Update the PDF with the new content
    await prisma.feedItemPdf.update({
      where: { id },
      data: { content: newContent }
    });
    
    return NextResponse.json({
      message: 'PDF content updated successfully',
      pdfId: id,
      url: pdf.url,
      contentLength: newContent.length,
      preview: newContent.substring(0, 200) + '...'
    });
    
  } catch (error) {
    console.error('Error updating PDF content:', error);
    return NextResponse.json({ error: 'Failed to update PDF content' }, { status: 500 });
  }
}
