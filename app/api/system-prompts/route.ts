import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const systemPrompts = await prisma.systemPrompt.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({ systemPrompts: systemPrompts });
  } catch (error) {
    console.error('Error fetching system prompts:', error);
    return NextResponse.json({ error: 'Failed to fetch system prompts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, prompt, temperature } = await request.json();

    if (!name || !prompt || temperature === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = await prisma.systemPrompt.create({
      data: {
        name,
        prompt,
        temperature
      }
    });

    return NextResponse.json({ systemPrompt });
  } catch (error) {
    console.error('Error creating system prompt:', error);
    return NextResponse.json({ error: 'Failed to create system prompt' }, { status: 500 });
  }
}
