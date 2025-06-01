import OpenAI from 'openai';
import { prisma } from './prisma';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('OpenAI client initialized');

const DEFAULT_SYSTEM_PROMPT = `You are an expert content analyst and summarizer. Your task is to analyze RSS feed items and create a concise, insightful weekly summary. Focus on:
1. Key themes and trends
2. Most significant developments
3. Interesting patterns or connections between different items
Be concise but informative. Use bullet points for clarity.`;

export async function generateWeeklySummary(startDate: Date, endDate: Date, systemPromptId?: string): Promise<string> {
  // Fetch last week's items
  const items = await prisma.feedItem.findMany({
    where: {
      publishedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      feed: {
        select: {
          title: true
        }
      }
    },
    orderBy: {
      publishedAt: 'desc'
    }
  });

  if (items.length === 0) {
    return "No feed items found for the specified date range.";
  }

  // Prepare content for OpenAI
  const content = items.map(item => ({
    title: item.title,
    source: item.feed.title,
    date: item.publishedAt,
    content: item.processedContent || item.description || 'No content available'
  }));

  // Create the prompt
  const prompt = `Please analyze the following ${items.length} articles from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}:\n\n` +
    content.map(item => 
      `Source: ${item.source}\nTitle: ${item.title}\nDate: ${new Date(item.date).toLocaleDateString()}\nContent: ${item.content}\n---`
    ).join('\n\n');

  try {
    // Get or create system prompt
    let systemPrompt;
    if (systemPromptId) {
      systemPrompt = await prisma.systemPrompt.findUnique({
        where: { id: systemPromptId }
      });
      if (!systemPrompt) {
        throw new Error(`System prompt with id ${systemPromptId} not found`);
      }
    } else {
      // Use default system prompt
      systemPrompt = await prisma.systemPrompt.findFirst({
        where: { name: 'default' }
      });
      
      if (!systemPrompt) {
        // Create default system prompt if it doesn't exist
        systemPrompt = await prisma.systemPrompt.create({
          data: {
            name: 'default',
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: 0.7
          }
        });
      }
    }

    console.log('OpenAI API Key:', process.env.OPENAI_API_KEY?.slice(0, 10) + '...');
    console.log('Items count:', items.length);
    console.log('Prompt length:', prompt.length);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt.prompt },
        { role: "user", content: prompt }
      ],
      temperature: systemPrompt.temperature,
      max_tokens: 1000
    });

    const summaryContent = completion.choices[0]?.message?.content || "Failed to generate summary.";
    
    // Save the summary to the database
    await prisma.summary.create({
      data: {
        content: summaryContent,
        startDate,
        endDate,
        systemPromptId: systemPrompt.id
      }
    });

    return summaryContent;
  } catch (error: any) {
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      param: error.param
    });
    if (error.response) {
      console.error('OpenAI response:', error.response.data);
    }
    // Handle specific error types
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your billing details.');
    } else if (error.code === 'model_not_found') {
      throw new Error('GPT-4 model not available. Please ensure you have access to GPT-4.');
    } else {
      throw new Error(`Failed to generate weekly summary: ${error.message}`);
    }
  }
}
