import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { content, systemPromptId, startDate, endDate } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const updateData: any = { content };
    
    if (systemPromptId) {
      updateData.systemPromptId = systemPromptId;
    }
    
    if (startDate) {
      updateData.startDate = new Date(startDate);
    }
    
    if (endDate) {
      updateData.endDate = new Date(endDate);
    }

    const updatedSummary = await prisma.summary.update({
      where: { id },
      data: updateData,
      include: {
        systemPrompt: true
      }
    });

    return NextResponse.json({ summary: updatedSummary });
  } catch (error) {
    console.error('Error updating summary:', error);
    return NextResponse.json(
      { error: 'Failed to update summary' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Soft delete by updating isDeleted field to true
    await prisma.summary.update({
      where: { id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ message: 'Summary soft-deleted' });
  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json(
      { error: 'Failed to delete summary' },
      { status: 500 }
    );
  }
}
