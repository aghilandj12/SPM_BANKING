const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Limit = require('../models/Limit');
const Loan = require('../models/Loan');
const Collateral = require('../models/Collateral');
const { analyzeFinancials } = require('../services/financialAnalyzer');
const { calculateRisk } = require('../services/riskEngine');
const { evaluateLimitIncrease } = require('../services/limitDecisionEngine');
const { generateLimitIncreaseExplanation } = require('../services/aiService');
const Analysis = require('../models/Analysis');
const { validateCustomerIdParam } = require('../middleware/validate');

router.post('/:customerId', validateCustomerIdParam(), async (req, res) => {
  try {
    const customerId = req.params.customerId;
    console.log(`[G4] Limit Increase Ask started: ${customerId}`);
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer could not be found.' });
    }

    const limits = await Limit.find({ customer_id: customerId });
    const loans = await Loan.find({ customer_id: customerId });
    const collaterals = await Collateral.find({ customer_id: customerId });

    // Ensure we have some data
    if (limits.length === 0 && loans.length === 0 && collaterals.length === 0) {
      return res.status(400).json({ success: false, message: 'Insufficient financial data to evaluate a limit increase.' });
    }

    // 1. Deterministic Financial Calculations
    const financialFacts = analyzeFinancials(customer, limits, loans, collaterals);

    // 2. Deterministic Risk Engine
    const risk = calculateRisk(financialFacts);

    // 3. Deterministic Limit Decision Engine
    const decision = evaluateLimitIncrease(financialFacts);

    const customerPayload = {
      id: customer.customer_id,
      name: customer.name_1
    };

    let aiExplanation = null;
    let aiErrorMsg = null;

    // 4. Gemini AI Explanation
    try {
      aiExplanation = await generateLimitIncreaseExplanation(
        customerPayload.name,
        financialFacts,
        risk.level,
        decision
      );
    } catch (aiError) {
      console.error("G4 AI Error:", aiError);
      aiErrorMsg = "AI explanation unavailable. The deterministic decision factors are still available.";
    }

    // Save Analysis History
    try {
      await Analysis.create({
        analysisType: 'G4_LIMIT_INCREASE',
        customerId: customer.customer_id,
        customerName: customer.name_1,
        status: 'COMPLETED',
        summary: `Limit Increase Decision: ${decision.result.replace(/_/g, ' ')}`,
        result: {
          decision,
          aiExplanation,
          aiErrorMsg
        }
      });
    } catch (e) {
      console.error("[G4] Failed to save analysis history", e);
    }

    console.log(`[G4] Decision generated: ${decision.result}`);

    // 5. Build final response
    res.json({
      success: true,
      customer: customerPayload,
      financialFacts,
      risk,
      decision,
      aiExplanation,
      aiErrorMsg
    });

  } catch (error) {
    console.error("G4 Route Error:", error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

module.exports = router;
