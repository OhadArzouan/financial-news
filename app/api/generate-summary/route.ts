import { NextResponse } from 'next/server';
import { generateWeeklySummary } from '@/lib/openai-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Generate summary request:', body);
    
    const { startDate, endDate, systemPromptId } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const summaryContent = await generateWeeklySummary(
      new Date(startDate),
      new Date(endDate),
      systemPromptId
    );

    return NextResponse.json({ content: summaryContent });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
