import { NextResponse } from 'next/server';
import { generateWeeklySummary } from '@/lib/openai-utils';

export async function POST(request: Request) {
  try {
    const { startDate, endDate, systemPromptId } = await request.json();

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
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
