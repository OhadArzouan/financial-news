import { NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../app/generated/prisma';

/**
 * GET handler for fetching total PDF count
 */
export async function GET() {
  const prisma = new PrismaClient();
  
  try {
    // Get total count of PDFs in the database
    const count = await prisma.feedItemPdf.count();
    
    return NextResponse.json({ count });
    
  } catch (error) {
    console.error('Error fetching PDF count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDF count' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
