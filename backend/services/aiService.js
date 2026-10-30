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

/**
 * Retrieves all configured Gemini API keys in priority order:
 * GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY
 */
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
const TOTAL_BUDGET_MS = Number(process.env.AI_TOTAL_BUDGET_MS) || 80000;
const MIN_ATTEMPT_MS = 3000;
// Keys Google has rejected (invalid / no access); shared across requests until restart.
const rejectedKeys = new Set();

/**
 * Executes LLM completion using configured Gemini API keys (failover pipeline).
 */
async function callLLM(systemInstruction, payload, responseSchema, timeoutMs = 25000, totalBudgetMs = TOTAL_BUDGET_MS) {
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
        console.log(`[AI Service] Calling Gemini (${model}) via ${keyLabel}...`);
        const aiClient = new GoogleGenAI({ apiKey });

        const response = await withTimeout(aiClient.models.generateContent({
          model,
          contents: typeof payload === 'string' ? payload : JSON.stringify(payload),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2
          }
        }), Math.min(timeoutMs, remaining));

        const text = response.text;
        return JSON.parse(text);
      } catch (err) {
        lastError = err;
        console.warn(`[AI Service] Gemini (${model}) failed via ${keyLabel}:`, err.message);
        // 401/403 (bad key, no free tier on the project) will not recover; stop retrying that key.
        if (/"code":\s*(401|403)/.test(err.message || '')) {
          rejectedKeys.add(apiKey);
          console.warn(`[AI Service] ${keyLabel} rejected by Google; skipping it until restart.`);
        }
      }
    }
  }

  throw new Error(`All Gemini API keys failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Executes AI request trying Groq first (Primary), then Gemini (Fallback).
 * Throws error if both Groq and Gemini fail so caller uses deterministic fallback.
 */
async function executeAIWithFallback(systemInstruction, payload, responseSchema, timeoutMs = 25000) {
  const startedAt = Date.now();
  let groqFailed = false;

  console.log('[AI Service] Trying Groq (primary)...');
  try {
    const result = await callGroqLLM(systemInstruction, payload, responseSchema, timeoutMs);
    console.log('[AI Service] Groq succeeded.');
    console.log('[AI Service] provider = groq');
    if (result && typeof result === 'object') {
      result._provider = 'groq';
    }
    return result;
  } catch (groqError) {
    groqFailed = true;
    console.warn('[AI Service] Groq failed. Falling back to Gemini...');
  }

  if (groqFailed) {
    console.log('[AI Service] Trying Gemini...');
    try {
      const result = await callLLM(systemInstruction, payload, responseSchema, timeoutMs, TOTAL_BUDGET_MS - (Date.now() - startedAt));
      console.log('[AI Service] Gemini succeeded.');
      console.log('[AI Service] provider = gemini');
      if (result && typeof result === 'object') {
        result._provider = 'gemini';
      }
      return result;
    } catch (geminiError) {
      console.warn('[AI Service] Groq failed.');
      console.warn('[AI Service] Gemini failed.');
      console.warn('[AI Service] Using deterministic fallback.');
      console.log('[AI Service] provider = deterministic_fallback');
      throw geminiError;
    }
  }
}

/**
 * Generates an AI risk brief.
 */
async function generateCreditBrief(customerName, financialFacts, riskLevel, riskScore, riskFactors) {
  const payload = {
    customer: { name: customerName },
    financialFacts,
    risk: {
      level: riskLevel,
      score: riskScore,
      factors: riskFactors
    }
  };

  const systemInstruction = `You are a banking Relationship Manager risk-brief assistant.
You are given pre-calculated deterministic financial facts and a risk classification.
CRITICAL INSTRUCTIONS:
- Use ONLY the supplied facts.
- Do NOT invent values.
- Do NOT calculate new financial values.
- Do NOT change the risk level.
- Do NOT provide unsupported conclusions.
- Clearly distinguish facts from questions.
- Use concise professional banking language.
- Do NOT make final lending/credit approval decisions (this is decision support for an RM).
- Respond ONLY with valid JSON exactly matching the schema. Do not include markdown formatting or code blocks.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "A concise 2-3 sentence overview of the risk and financial position." },
      keyFindings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 bullet points highlighting key deterministic facts." },
      openQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 questions the RM should ask the customer based on the data." },
      recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-2 recommended next steps for the RM to take." }
    },
    required: ["summary", "keyFindings", "openQuestions", "recommendedActions"]
  };

  try {
    const parsed = await executeAIWithFallback(systemInstruction, payload, responseSchema, 25000);
    if (typeof parsed.summary !== 'string') throw new Error('Invalid summary format');
    if (!Array.isArray(parsed.keyFindings)) throw new Error('Invalid keyFindings format');
    return parsed;
  } catch (error) {
    console.error('[G1] AI Request Failed, returning deterministic credit brief fallback:', error.message);
    const revFormatted = typeof financialFacts?.revenue === 'number' ? `₹${financialFacts.revenue.toLocaleString('en-IN')}` : 'N/A';
    const profitFormatted = typeof financialFacts?.netProfit === 'number' ? `₹${financialFacts.netProfit.toLocaleString('en-IN')}` : 'N/A';
    return {
      summary: `Risk assessment brief for ${customerName}. Evaluated risk profile is ${riskLevel} with a risk score of ${riskScore}. Financial position shows annual revenue of ${revFormatted} and net profit of ${profitFormatted}.`,
      keyFindings: [
        `Risk classification is ${riskLevel} with calculated risk score ${riskScore}.`,
        `Annual revenue: ${revFormatted}.`,
        `Net profit: ${profitFormatted}.`,
        `Key risk drivers: ${Array.isArray(riskFactors) ? riskFactors.join(', ') : 'Standard risk profile'}.`
      ],
      openQuestions: [
        "What is the projected revenue growth and cash flow outlook for the next quarter?",
        "Are there any pending debt commitments or major capital expenditures?",
        "Can the customer provide updated audited financial statements?"
      ],
      recommendedActions: [
        "Schedule a formal review discussion with the relationship management team.",
        "Verify bank statement credits and collateral valuation metrics."
      ],
      _provider: 'deterministic_fallback'
    };
  }
}

/**
 * Generates loan counselling prep.
 */
async function generateCounsellingPrep(customerFacts, ragContext) {
  const systemInstruction = `You are a banking Relationship Manager assistant preparing for a product counselling discussion (loans, accounts, deposits, cards, insurance or investments).
You are given a set of customer financial facts and retrieved knowledge base context about the bank's policies/products.
CRITICAL INSTRUCTIONS:
- Use ONLY the supplied customer facts.
- Use ONLY the retrieved knowledge for product/policy information.
- Do NOT invent bank policies or eligibility criteria.
- Do NOT invent documents.
- Do NOT make approval or sanction decisions.
- Clearly identify questions that require RM verification.
- Keep the response concise.
- Produce structured JSON only.`;

  const payload = { customerFacts, retrievedKnowledge: ragContext };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      customerSnapshot: { type: Type.ARRAY, items: { type: Type.STRING } },
      talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
      questionsToAsk: { type: Type.ARRAY, items: { type: Type.STRING } },
      documentChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
      productConsiderations: { type: Type.ARRAY, items: { type: Type.STRING } },
      potentialConcerns: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["customerSnapshot", "talkingPoints", "questionsToAsk", "documentChecklist", "productConsiderations", "potentialConcerns"]
  };

  try {
    const parsed = await executeAIWithFallback(systemInstruction, payload, responseSchema, 25000);
    if (!Array.isArray(parsed.customerSnapshot)) throw new Error('Invalid format');
    return parsed;
  } catch (error) {
    console.error('[G2] AI Request Failed, returning deterministic counselling prep fallback:', error.message);
    const name = customerFacts?.name || customerFacts?.customer?.name || 'Customer';
    return {
      customerSnapshot: [
        `Customer Name: ${name}`,
        `Monthly Income: ${customerFacts?.monthlyIncome ? '₹' + customerFacts.monthlyIncome.toLocaleString('en-IN') : 'N/A'}`,
        `Employment Type: ${customerFacts?.employmentType || 'Self-Employed / Salaried'}`
      ],
      talkingPoints: [
        "Discuss current loan eligibility criteria and product options.",
        "Review credit score requirements and debt-to-income ratio guidelines."
      ],
      questionsToAsk: [
        "What is the target loan amount and requested tenure?",
        "Are there secondary sources of income or co-applicants?"
      ],
      documentChecklist: [
        "Government ID (PAN / Aadhaar)",
        "Latest 6 Months Bank Statements",
        "Last 2 Years Income Tax Returns / Salary Slips"
      ],
      productConsiderations: [
        "Personal Loan / Business Facility",
        "Secured Loan against Property / Collateral"
      ],
      potentialConcerns: [
        "High existing EMI obligations relative to monthly income.",
        "Pending document verification or CKYC status."
      ],
      _provider: 'deterministic_fallback'
    };
  }
}

/**
 * Generates an explanation for the deterministic limit increase decision.
 */
async function generateLimitIncreaseExplanation(customerName, financialFacts, riskLevel, decisionResult) {
  const payload = { customerName, financialFacts, riskLevel, decisionResult };

  const systemInstruction = `You are a banking Relationship Manager decision-support explanation assistant.
The decision (ASK, ASK_WITH_CONDITIONS, or HOLD_OFF) has already been determined by deterministic rules.
CRITICAL INSTRUCTIONS:
- Do NOT change the decision.
- Do NOT recalculate financial metrics.
- Do NOT invent financial values or customer information.
- Explain ONLY the supplied factors and conditions.
- Clearly identify items requiring RM verification based on conditions.
- Do NOT approve or reject credit.
- Do NOT make an autonomous lending decision.
- Produce structured JSON only.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "1-2 sentences explaining the decision based on the factors." },
      reasoning: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Bullet points explaining the factors." },
      conditions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Any conditions identified." },
      openQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Questions for the RM to verify." },
      recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Next actions for RM." }
    },
    required: ["summary", "reasoning", "conditions", "openQuestions", "recommendedNextSteps"]
  };

  try {
    const parsed = await executeAIWithFallback(systemInstruction, payload, responseSchema, 25000);
    if (typeof parsed.summary !== 'string') throw new Error('Invalid format');
    return parsed;
  } catch (error) {
    console.error('[G4] AI Request Failed, returning deterministic limit increase fallback:', error.message);
    const decision = decisionResult?.decision || 'HOLD_OFF';
    return {
      summary: `Limit increase decision evaluated as ${decision} for ${customerName} based on financial facts and risk level (${riskLevel}).`,
      reasoning: [
        `Risk level: ${riskLevel}.`,
        `Decision determined by rule engine: ${decision}.`,
        `Current credit metrics evaluated.`
      ],
      conditions: decisionResult?.conditions || ["Verify recent 3-month account credits.", "Confirm zero defaults."],
      openQuestions: [
        "Can the customer provide collateral or a guarantor?",
        "Has the account maintained minimum average quarterly balance?"
      ],
      recommendedNextSteps: [
        "Review request with Credit Officer.",
        "Obtain updated income proofs."
      ],
      _provider: 'deterministic_fallback'
    };
  }
}

/**
 * Generates chatbot response with customer context.
 */
async function generateChatbotResponse(userQuestion, customerContext, systemInstruction = null) {
  const defaultSystemInstruction = systemInstruction || `You are an expert Banking AI Assistant.
You answer user questions based strictly on the provided customer CSV/database context and financial metrics.
CRITICAL INSTRUCTIONS:
- Do NOT invent financial values or customer details.
- Use ONLY the provided context.
- Produce concise, clear, and professional responses.
- Respond in JSON format with "answer" and "keyPoints" properties.`;

  const payload = {
    userQuestion,
    customerContext
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      answer: { type: Type.STRING },
      keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["answer"]
  };

  try {
    const parsed = await executeAIWithFallback(defaultSystemInstruction, payload, responseSchema, 25000);
    return parsed;
  } catch (error) {
    console.error('[Chatbot] AI Request Failed, returning deterministic chatbot fallback:', error.message);
    return {
      answer: `Unable to process question via AI. Based on recorded context for ${customerContext?.name || customerContext?.customer?.name || 'the customer'}, please verify account details with relationship management.`,
      keyPoints: ["Refer to customer 360 profile", "Check active loans and limits"],
      _provider: 'deterministic_fallback'
    };
  }
}

module.exports = {
  generateCreditBrief,
  generateCounsellingPrep,
  generateLimitIncreaseExplanation,
  generateChatbotResponse,
  executeAIWithFallback
};
