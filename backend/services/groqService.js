const axios = require('axios');

/**
 * Safely masks API keys so sensitive credentials are never printed in logs.
 * e.g., "gsk_1234567890abcdef" -> "gsk_...cdef"
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return 'UNSET';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * Executes an LLM completion using Groq's OpenAI-compatible API endpoint.
 * Accepts systemInstruction, payload/userPrompt, optional responseSchema, and timeoutMs.
 */
async function callGroqLLM(systemInstruction, payload, responseSchema = null, timeoutMs = 25000) {
  const apiKey = process.env.GROQ_API_KEY;
  const apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error('GROQ_API_KEY is missing or unconfigured in environment.');
  }

  const maskedKey = maskApiKey(apiKey);
  console.log(`[AI Service] Invoking Groq (${model}) via endpoint ${apiUrl} [Key: ${maskedKey}]...`);

  const messages = [];
  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: typeof systemInstruction === 'string' ? systemInstruction : JSON.stringify(systemInstruction)
    });
  }

  const userContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
  messages.push({
    role: 'user',
    content: userContent
  });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  try {
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      timeout: timeoutMs
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new Error('Groq returned an empty response content.');
    }

    // Clean potential markdown backticks (```json ... ```)
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(cleanedContent);
    return parsed;
  } catch (err) {
    // If json_object mode fails due to model incompatibility, retry once without response_format
    if (err.response && err.response.status === 400 && err.response.data?.error?.message?.includes('response_format')) {
      console.warn(`[AI Service] Groq json_object format not supported by model (${model}), retrying standard request...`);
      delete requestBody.response_format;
      try {
        const retryResponse = await axios.post(apiUrl, requestBody, {
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          timeout: timeoutMs
        });
        const retryContent = retryResponse.data?.choices?.[0]?.message?.content;
        if (!retryContent) throw new Error('Groq returned empty response on retry.');
        let cleaned = retryContent.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
        }
        return JSON.parse(cleaned);
      } catch (retryErr) {
        const maskedErrMsg = retryErr.message ? retryErr.message.replace(apiKey, maskedKey) : 'Unknown error';
        console.warn(`[AI Service] Groq retry failed [Key: ${maskedKey}]:`, maskedErrMsg);
        throw new Error(`Groq API request failed: ${maskedErrMsg}`);
      }
    }

    const errorDetail = err.response?.data?.error?.message || err.message || 'Unknown error';
    const safeErrorMsg = errorDetail.replace(apiKey, maskedKey);
    console.warn(`[AI Service] Groq call failed [Key: ${maskedKey}]:`, safeErrorMsg);
    throw new Error(`Groq API request failed: ${safeErrorMsg}`);
  }
}

module.exports = {
  callGroqLLM,
  maskApiKey
};
