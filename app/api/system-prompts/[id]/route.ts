import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
  try {
    // Extract the id from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1]; // Get the ID from the path
    const { name, prompt, temperature } = await request.json();

    const updatedPrompt = await prisma.systemPrompt.update({
      where: { id },
      data: {
        name,
        prompt,
        temperature
      }
    });

    return NextResponse.json({ systemPrompt: updatedPrompt });
  } catch (error) {
    console.error('Error updating system prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update system prompt' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Extract the id from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1]; // Get the ID from the path

    // Don't allow deleting the default prompt
    const prompt = await prisma.systemPrompt.findUnique({
      where: { id }
    });

    if (!prompt) {
      return NextResponse.json(
        { error: 'System prompt not found' },
        { status: 404 }
      );
    }

    if (prompt.name === 'default') {
      return NextResponse.json(
        { error: 'Cannot delete default prompt' },
        { status: 400 }
      );
    }

    await prisma.systemPrompt.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting system prompt:', error);
    return NextResponse.json(
      { error: 'Failed to delete system prompt' },
      { status: 500 }
    );
  }
}
