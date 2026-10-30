const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Generate embeddings for a single text chunk.
 * 
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} The vector embedding
 */
async function generateEmbedding(text) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing or invalid.');
  }

  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text
    });
    // The google genai sdk returns an object with embeddings
    return response.embeddings[0].values;
  } catch (error) {
    console.error('Embedding Generation Failed:', error.message);
    throw new Error(error.message);
  }
}

module.exports = {
  generateEmbedding
};
