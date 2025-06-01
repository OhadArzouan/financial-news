import OpenAI from 'openai';

async function testOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  console.log('API Key:', process.env.OPENAI_API_KEY.slice(0, 10) + '...');

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Hello, this is a test message. Please respond with 'OK' if you receive this." }
      ],
    });

    console.log('Response:', completion.choices[0]?.message?.content);
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
  }
}

testOpenAI();
