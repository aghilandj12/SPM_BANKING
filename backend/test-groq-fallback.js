const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const { maskApiKey } = require('./services/groqService');
const { generateCreditBrief, generateCounsellingPrep, generateLimitIncreaseExplanation, generateChatbotResponse } = require('./services/aiService');
const { extractDocumentData } = require('./services/extractionService');

async function runAllTests() {
  console.log('====================================================');
  console.log('GROQ PRIMARY & GEMINI FALLBACK COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // --- TEST 1: Key Masking Security ---
  console.log('--- TEST 1: API Key Masking Security ---');
  const dummyGroqKey = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz';
  const maskedGroq = maskApiKey(dummyGroqKey);
  assert(maskedGroq === 'gsk_...wxyz', 'Groq API Key correctly masked (gsk_...wxyz)');
  assert(!maskedGroq.includes('1234567890'), 'Full API key is never printed');

  const dummyGeminiKey = 'AQ.Ab8DummyGeminiKeySampleForTesting123456789';
  const maskedGemini = maskApiKey(dummyGeminiKey);
  assert(maskedGemini === 'AQ.A...6789', 'Gemini API Key correctly masked (AQ.A...6789)');

  // --- Create Mock Groq Server for Provider Testing ---
  let mockMode = 'SUCCESS'; // 'SUCCESS', 'FAIL'
  let groqCalled = false;

  const mockServer = http.createServer((req, res) => {
    groqCalled = true;
    if (mockMode === 'SUCCESS') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Mock Groq Risk Assessment Brief for Harish Sharma.",
                keyFindings: ["Revenue is stable at 5M INR", "Net profit is 1.2M INR"],
                openQuestions: ["What is next quarter's cash flow forecast?"],
                recommendedActions: ["Proceed with credit review"],
                customerSnapshot: ["Customer Name: HARISH SHARMA", "Monthly Income: ₹163,447"],
                talkingPoints: ["Discuss loan terms"],
                questionsToAsk: ["Target loan amount?"],
                documentChecklist: ["PAN Card", "Aadhaar Card"],
                productConsiderations: ["Personal Loan"],
                potentialConcerns: ["Existing EMI obligations"],
                reasoning: ["Risk level is LOW"],
                conditions: ["Verify recent 3-month account credits"],
                recommendedNextSteps: ["Review with Credit Officer"],
                document_type: "KYC_PROFILE",
                customer: { name: "HARISH SHARMA", customer_id: "100124" },
                document_facts: { kyc_status: "PENDING" },
                dates: [{ label: "DOB", value: "1988-07-22" }],
                answer: "Customer Harish Sharma has a monthly income of 163,447 INR with active status.",
                keyPoints: ["Monthly income: 163447", "Status: Active"]
              })
            }
          }
        ]
      }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: "Invalid Groq API Key" } }));
    }
  });

  await new Promise(resolve => mockServer.listen(9876, resolve));
  process.env.GROQ_API_URL = 'http://localhost:9876/v1/chat/completions';
  process.env.GROQ_API_KEY = 'gsk_test_mock_key_12345';

  // --- TEST 2: Groq Primary Success (Gemini NOT called) ---
  console.log('\n--- TEST 2: Groq Primary Success (Groq called -> response returned -> Gemini NOT called) ---');
  mockMode = 'SUCCESS';
  groqCalled = false;

  const g1Success = await generateCreditBrief('HARISH SHARMA', { revenue: 5000000 }, 'LOW', 20, []);
  assert(groqCalled === true, 'Groq API was called first');
  assert(g1Success._provider === 'groq', 'Response provider is groq');
  assert(g1Success.summary.includes('Mock Groq'), 'Received response from Groq');

  // --- TEST 3: Groq Failure -> Fallback to Gemini / Deterministic Fallback ---
  console.log('\n--- TEST 3: Groq Failure -> Automatic Fallback ---');
  mockMode = 'FAIL';
  groqCalled = false;

  const g1Fallback = await generateCreditBrief('HARISH SHARMA', { revenue: 5000000, netProfit: 1200000 }, 'MEDIUM', 50, ['High debt']);
  assert(groqCalled === true, 'Groq API was called first and failed');
  assert(g1Fallback._provider !== 'groq', `Fell back cleanly to secondary provider (${g1Fallback._provider})`);
  assert(g1Fallback.summary !== undefined, 'Fallback returned valid credit brief structure');

  // --- TEST 4: G2 Counselling Prep Schema ---
  console.log('\n--- TEST 4: G2 Counselling Prep Provider & Schema ---');
  mockMode = 'SUCCESS';
  const g2Result = await generateCounsellingPrep({ name: 'HARISH SHARMA', monthlyIncome: 163447 }, 'Policy context');
  assert(g2Result._provider === 'groq', 'G2 used Groq primary provider');
  assert(Array.isArray(g2Result.customerSnapshot), 'G2 returned customerSnapshot array');
  assert(Array.isArray(g2Result.talkingPoints), 'G2 returned talkingPoints array');

  // --- TEST 5: G4 Limit Increase Explanation Schema ---
  console.log('\n--- TEST 5: G4 Limit Increase Explanation Provider & Schema ---');
  mockMode = 'SUCCESS';
  const g4Result = await generateLimitIncreaseExplanation('HARISH SHARMA', { revenue: 5000000 }, 'LOW', { decision: 'ASK' });
  assert(g4Result._provider === 'groq', 'G4 used Groq primary provider');
  assert(typeof g4Result.summary === 'string', 'G4 returned summary string');
  assert(Array.isArray(g4Result.reasoning), 'G4 returned reasoning array');

  // --- TEST 6: Chatbot Context & Provider ---
  console.log('\n--- TEST 6: Chatbot Response Customer Context & Provider ---');
  mockMode = 'SUCCESS';
  const chatResult = await generateChatbotResponse('What is the monthly income?', { name: 'HARISH SHARMA', monthly_income: 163447 });
  assert(chatResult._provider === 'groq', 'Chatbot used Groq primary provider');
  assert(chatResult.answer !== undefined, 'Chatbot returned valid answer field');

  // --- TEST 7: G3 Document Extraction Schema ---
  console.log('\n--- TEST 7: G3 Document Extraction Provider & Schema ---');
  mockMode = 'SUCCESS';
  const docResult = await extractDocumentData('Sample KYC Document Text');
  assert(docResult._provider === 'groq', 'G3 Document extraction used Groq primary provider');
  assert(docResult.document_type === 'KYC_PROFILE', 'G3 extracted correct document_type');
  assert(docResult.customer.name === 'HARISH SHARMA', 'G3 preserved customer name');

  mockServer.close();

  console.log('\n====================================================');
  console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runAllTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
