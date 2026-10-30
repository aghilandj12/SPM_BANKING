const { GoogleGenAI, Type } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testStructured() {
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      greeting: { type: Type.STRING },
      status: { type: Type.STRING }
    },
    required: ["greeting", "status"]
  };

  try {
    console.log('Testing gemini-flash-latest with responseSchema...');
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'Say hello in structured JSON format.',
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });
    console.log('SUCCESS:', res.text);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}
testStructured();








