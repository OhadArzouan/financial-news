import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const summaries = await prisma.summary.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summaries' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Summary creation request body:', body);
    
    const { startDate, endDate, content, systemPromptId, overwrite } = body;

    if (!startDate || !endDate || !content || !systemPromptId) {
      console.log('Missing required fields:', { startDate, endDate, contentProvided: !!content, systemPromptId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if a summary already exists for this exact date range and prompt
    const existingSummary = await prisma.summary.findFirst({
      where: {
        AND: [
          { startDate: new Date(startDate) },
          { endDate: new Date(endDate) },
          { systemPromptId }
        ]
      }
    });

    // Log the check details for debugging
    console.log('Checking for duplicate with:', {
      startDateCheck: new Date(startDate).toISOString(),
      endDateCheck: new Date(endDate).toISOString(),
      systemPromptIdCheck: systemPromptId,
      foundDuplicate: !!existingSummary,
      existingSummaryId: existingSummary?.id
    });

    if (existingSummary) {
      // If overwrite flag is true, update the existing summary instead of returning an error
      if (overwrite) {
        const updatedSummary = await prisma.summary.update({
          where: { id: existingSummary.id },
          data: { content }
        });
        
        return NextResponse.json({ 
          summary: updatedSummary, 
          message: 'Existing summary was updated'
        });
      } else {
        return NextResponse.json(
          { error: 'A summary already exists for this exact date range and prompt' },
          { status: 409 }
        );
      }
    }

    const newSummary = await prisma.summary.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        content,
        systemPromptId
      },
    });

    return NextResponse.json({ summary: newSummary });
  } catch (error) {
    console.error('Error creating summary:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to create summary: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
