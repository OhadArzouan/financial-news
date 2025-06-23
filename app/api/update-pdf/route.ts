import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractPdfText } from '@/lib/pdf-extractor-fixed';

// Define the type for the PDF metadata
interface PdfMetadata {
  lastExtraction?: string;
  extractionMethod?: string;
  contentLength?: number;
  [key: string]: any;
}

export async function POST(request: Request) {
  try {
    const { pdfId } = await request.json();
    const id = parseInt(pdfId, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid PDF ID' },
        { status: 400 }
      );
    }

    console.log(`\n=== Updating PDF Record ${id} ===`);
    
    // 1. Get the PDF record
    const pdf = await prisma.feedItemPdf.findUnique({
      where: { id },
      include: { feedItem: true }
    });

    if (!pdf) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      );
    }

    console.log(`Found PDF: ${pdf.url}`);
    console.log(`Current content length: ${pdf.content?.length || 0} characters`);

    // 2. Extract text from the PDF
    console.log('\nExtracting text from PDF...');
    let extractedText: string | null = null;
    let extractionError: Error | null = null;
    
    try {
      // Use the robust PDF extractor with built-in gibberish detection and multiple fallbacks
      extractedText = await extractPdfText(pdf.url);
      console.log(`Extraction completed. Got ${extractedText?.length || 0} characters`);
      
      if (!extractedText) {
        console.error('No content was extracted from the PDF');
        extractionError = new Error('No content was extracted from the PDF');
        
        return NextResponse.json(
          { 
            error: 'Failed to extract text from PDF',
            details: {
              mainError: 'No content extracted after trying all extraction methods',
              url: pdf.url,
              contentLength: 0
            }
          },
          { status: 500 }
        );
      }
    } catch (error: unknown) {
      console.error('Error during PDF extraction:', error);
      extractionError = error instanceof Error ? error : new Error(String(error));
      
      return NextResponse.json(
        { 
          error: 'Error during PDF extraction',
          details: {
            mainError: extractionError.message,
            url: pdf.url
          }
        },
        { status: 500 }
      );
    }

    console.log(`\nSuccessfully extracted ${extractedText.length} characters`);

    // 3. Prepare update data with proper typing
    console.log('\nUpdating database record...');
    
    // Get existing metadata safely
    const pdfMetadata: PdfMetadata = (pdf as any).metadata || {};
    
    // Prepare the update data
    const updateData: any = {
      content: extractedText,
      metadata: {
        ...pdfMetadata,
        lastExtraction: new Date().toISOString(),
        extractionMethod: 'robust-pdf-extractor',
        contentLength: extractedText.length
      }
    };

    // Only include extractedAt if it exists in the schema
    if ('extractedAt' in pdf) {
      updateData.extractedAt = new Date();
    }

    // Update the record
    const updatedPdf = await prisma.feedItemPdf.update({
      where: { id },
      data: updateData,
    });

    console.log('\n✅ Successfully updated PDF record');
    console.log(`New content length: ${updatedPdf.content?.length || 0} characters`);
    
    return NextResponse.json({
      success: true,
      pdfId: updatedPdf.id,
      contentLength: extractedText.length,
      preview: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '')
    });
    
  } catch (error) {
    console.error('\n❌ Error updating PDF record:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
