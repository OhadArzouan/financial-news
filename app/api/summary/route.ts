import { NextResponse } from 'next/server';
import { generateWeeklySummary } from '../../../lib/openai-utils';
import { prisma } from '../../../lib/prisma';

export async function DELETE() {
  try {
    await prisma.summary.deleteMany();
    return NextResponse.json({ message: 'All summaries deleted successfully' });
  } catch (error) {
    console.error('Error deleting summaries:', error);
    return NextResponse.json(
      { error: 'Failed to delete summaries' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { startDate, endDate } = await request.json();
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Parse the dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Generate summary
    const summary = await generateWeeklySummary(start, end);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error in summary generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
