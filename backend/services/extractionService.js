const { GoogleGenAI, Type } = require('@google/genai');
const { callGroqLLM } = require('./groqService');

const withTimeout = (promise, ms) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`AI Request timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

function getGeminiApiKeys() {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY
  ].filter(key => key && typeof key === 'string' && key.trim() !== '');

  return [...new Set(keys)];
}

// Total time allowed for all Gemini attempts in one request (override with env).
const TOTAL_BUDGET_MS = Number(process.env.EXTRACTION_TOTAL_BUDGET_MS) || 110000;
const MIN_ATTEMPT_MS = 3000;
// Keys Google has rejected (invalid / no access); shared across requests until restart.
const rejectedKeys = new Set();

async function callLLM(systemInstruction, contents, responseSchema, timeoutMs = 25000, totalBudgetMs = TOTAL_BUDGET_MS) {
  const keys = getGeminiApiKeys();
  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError = null;

  if (keys.length === 0) {
    throw new Error('No Gemini API keys configured (GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3).');
  }

  // Fastest model first on every key, then slower models. Stop once the time budget is
  // spent so the route can answer before the browser's request timeout.
  const deadline = Date.now() + totalBudgetMs;
  for (const model of modelsToTry) {
    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
      const apiKey = keys[keyIdx];
      if (rejectedKeys.has(apiKey)) continue;
      const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : '****';
      const keyLabel = `Key ${keyIdx + 1} (${maskedKey})`;
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) {
        throw new Error(`Gemini time budget of ${Math.round(totalBudgetMs / 1000)}s exhausted. Last error: ${lastError?.message || 'Unknown'}`);
      }
      try {
        console.log(`[Extraction Service] Calling Gemini (${model}) via ${keyLabel}...`);
        const aiClient = new GoogleGenAI({ apiKey });

        const response = await withTimeout(aiClient.models.generateContent({
          model,
          contents: contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.1
          }
        }), Math.min(timeoutMs, remaining));

        const text = response.text;
        return JSON.parse(text);
      } catch (err) {
        lastError = err;
        console.warn(`[Extraction Service] Gemini (${model}) failed via ${keyLabel}:`, err.message);
        // 401/403 (bad key, no free tier on the project) will not recover; stop retrying that key.
        if (/"code":\s*(401|403)/.test(err.message || '')) {
          rejectedKeys.add(apiKey);
          console.warn(`[Extraction Service] ${keyLabel} rejected by Google; skipping it until restart.`);
        }
      }
    }
  }

  throw new Error(`All Gemini API keys failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Normalizes extracted date strings to YYYY-MM-DD.
 * Returns null if invalid or unparseable.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  let day, month, year;

  const regexDDMMYYYY = /^(\d{2})[-/\.](\d{2})[-/\.](\d{4})$/;
  const matchDDMMYYYY = dateStr.match(regexDDMMYYYY);
  if (matchDDMMYYYY) {
    day = parseInt(matchDDMMYYYY[1], 10);
    month = parseInt(matchDDMMYYYY[2], 10);
    year = parseInt(matchDDMMYYYY[3], 10);
  } else {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    } else {
      return null;
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Executes Extraction request trying Groq first (Primary), then Gemini (Fallback).
 */
async function executeExtractionWithFallback(systemInstruction, text, responseSchema, timeoutMs = 55000) {
  const startedAt = Date.now();
  let groqFailed = false;

  console.log('[Extraction Service] Trying Groq (primary)...');
  try {
    const result = await callGroqLLM(systemInstruction, text, responseSchema, timeoutMs);
    console.log('[Extraction Service] Groq succeeded.');
    console.log('[Extraction Service] provider = groq');
    if (result && typeof result === 'object') {
      result._provider = 'groq';
    }
    return result;
  } catch (groqError) {
    groqFailed = true;
    console.warn('[Extraction Service] Groq failed. Falling back to Gemini...');
  }

  if (groqFailed) {
    console.log('[Extraction Service] Trying Gemini...');
    try {
      const result = await callLLM(systemInstruction, text, responseSchema, timeoutMs, TOTAL_BUDGET_MS - (Date.now() - startedAt));
      console.log('[Extraction Service] Gemini succeeded.');
      console.log('[Extraction Service] provider = gemini');
      if (result && typeof result === 'object') {
        result._provider = 'gemini';
      }
      return result;
    } catch (geminiError) {
      console.warn('[Extraction Service] Groq failed.');
      console.warn('[Extraction Service] Gemini failed.');
      console.warn('[Extraction Service] Using deterministic fallback.');
      console.log('[Extraction Service] provider = deterministic_fallback');
      throw geminiError;
    }
  }
}

/**
 * Extracts structured data and generates a summary from document text using Groq primary & Gemini fallback.
 * @param {string} documentText - The text extracted from the document
 * @returns {Promise<Object>} { extractedData, summary }
 */
async function extractDocumentData(documentText) {
  const systemInstruction = `You are a banking document information extraction engine.
Your task is to summarize loan or KYC notes into structured bullets that an officer can scan quickly.

The supplied document is the only source of truth.

Rules:
1. First, classify the document into one of the following types: KYC_PROFILE, LOAN_APPLICATION, INCOME_PROOF, BANK_STATEMENT, IDENTITY_PROOF, ADDRESS_PROOF, PROPERTY_DOCUMENT, COLLATERAL_DOCUMENT, OTHER.
2. Extract only information explicitly present in the document.
3. Never invent information. Never infer missing values.
4. NEVER use today's date, upload date, server date, or file creation date. If a date is not in the document, return null.
5. If a date is unclear or ambiguous, do not guess.
6. Extract dates with their meaning (e.g., "Date of Birth", "Issue Date").
7. Extract customer information (name, id, dob, address, etc.) if present.
8. Extract document-specific facts (e.g. kyc_status for KYC, loan_type for Loan) into document_facts. Do not force loan fields into KYC documents, or vice-versa.
9. Populate fields only if they are actually present in the document. Leave as null if not found.
10. Preserve numeric financial values accurately. Do not calculate annual income. Return monthly income if present.
11. Generate short, structured bullets for key_findings, missing_information, attention_flags, and open_questions based strictly on the document type and content.
12. Do not hallucinate or enrich values using external knowledge.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      document_type: { type: Type.STRING },
      document_type_confidence: { type: Type.NUMBER },
      customer: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, nullable: true },
          customer_id: { type: Type.STRING, nullable: true },
          date_of_birth: { type: Type.STRING, nullable: true },
          address: { type: Type.STRING, nullable: true },
          nationality: { type: Type.STRING, nullable: true },
          residence: { type: Type.STRING, nullable: true },
          employment_type: { type: Type.STRING, nullable: true },
          employer: { type: Type.STRING, nullable: true },
          monthly_income: { type: Type.NUMBER, nullable: true }
        }
      },
      document_facts: {
        type: Type.OBJECT,
        properties: {
          kyc_status: { type: Type.STRING, nullable: true },
          ckyc_status: { type: Type.STRING, nullable: true },
          risk_categorization: { type: Type.STRING, nullable: true },
          loan_type: { type: Type.STRING, nullable: true },
          requested_amount: { type: Type.NUMBER, nullable: true },
          loan_amount: { type: Type.NUMBER, nullable: true },
          tenure: { type: Type.STRING, nullable: true },
          interest_rate: { type: Type.STRING, nullable: true },
          purpose: { type: Type.STRING, nullable: true },
          collateral: { type: Type.STRING, nullable: true },
          pay_period: { type: Type.STRING, nullable: true },
          gross_income: { type: Type.NUMBER, nullable: true },
          net_income: { type: Type.NUMBER, nullable: true },
          deductions: { type: Type.NUMBER, nullable: true },
          account_number_masked: { type: Type.STRING, nullable: true },
          statement_period: { type: Type.STRING, nullable: true },
          opening_balance: { type: Type.NUMBER, nullable: true },
          closing_balance: { type: Type.NUMBER, nullable: true },
          transaction_count: { type: Type.NUMBER, nullable: true },
          document_number_masked: { type: Type.STRING, nullable: true },
          issuing_authority: { type: Type.STRING, nullable: true },
          property_address: { type: Type.STRING, nullable: true },
          property_type: { type: Type.STRING, nullable: true },
          owner: { type: Type.STRING, nullable: true },
          area: { type: Type.STRING, nullable: true },
          registration_number: { type: Type.STRING, nullable: true },
          valuation: { type: Type.NUMBER, nullable: true }
        }
      },
      dates: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            value: { type: Type.STRING }
          }
        }
      },
      submitted_documents: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      summary: { type: Type.STRING },
      key_findings: { type: Type.ARRAY, items: { type: Type.STRING } },
      missing_information: { type: Type.ARRAY, items: { type: Type.STRING } },
      attention_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
      open_questions: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["document_type", "customer", "document_facts", "dates", "summary", "key_findings"]
  };

  try {
    const text = `DOCUMENT TEXT:\n${documentText}`;
    const parsed = await executeExtractionWithFallback(systemInstruction, text, responseSchema, 55000);
    if (!parsed.document_type || !parsed.summary) {
      throw new Error('Missing structured sections');
    }

    // Backend Deterministic Normalization
    let data = parsed;
    
    // Filter out nulls from customer and document_facts
    if (data.customer) {
      Object.keys(data.customer).forEach(key => {
        if (data.customer[key] === null || data.customer[key] === undefined) {
          delete data.customer[key];
        }
      });
    }
    
    if (data.document_facts) {
      Object.keys(data.document_facts).forEach(key => {
        if (data.document_facts[key] === null || data.document_facts[key] === undefined) {
          delete data.document_facts[key];
        }
      });
    }
    
    // Date Normalization
    if (data.customer && data.customer.date_of_birth) {
      data.customer.date_of_birth = normalizeDate(data.customer.date_of_birth) || data.customer.date_of_birth;
    }

    if (data.dates) {
      data.dates = data.dates
        .map(d => {
          const norm = normalizeDate(d.value);
          if (!norm) return null;
          return { label: d.label, value: norm };
        })
        .filter(Boolean);
    }

    // Calculate annual income if monthly income exists
    if (data.customer && data.customer.monthly_income != null) {
      data.annual_income = data.customer.monthly_income * 12;
      data.annual_income_source = "derived_from_monthly_income";
    } else {
      data.annual_income_source = null;
    }

    return data;
  } catch (error) {
    console.error('LLM Extraction Failed:', error.message);
    throw new Error('Unable to extract document data from the available AI services. Please try again.');
  }
}

module.exports = {
  extractDocumentData
};
