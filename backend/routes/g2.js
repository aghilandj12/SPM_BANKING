const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const { retrieveRelevantContext } = require('../services/ragService');
const { generateCounsellingPrep } = require('../services/aiService');
const Analysis = require('../models/Analysis');
const { validateCustomerIdParam } = require('../middleware/validate');

const SUPPORTED_PRODUCTS = [
  'Home Loan', 'Personal Loan', 'Education Loan', 'Business Loan', 'Vehicle Loan', 'Gold Loan',
  'Savings Account', 'Current Account', 'Fixed Deposit', 'Recurring Deposit',
  'Credit Card', 'Life Insurance', 'Health Insurance', 'Home Insurance', 'Mutual Fund / SIP'
];
const MAX_REQUESTED_AMOUNT = 1e10; // ₹1,000 crore

router.post('/:customerId', validateCustomerIdParam(), async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const { productType } = req.body;
    console.log(`[G2] Counselling started: ${customerId} (${productType})`);
    
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Product type is required.' });
    }
    if (!SUPPORTED_PRODUCTS.includes(productType)) {
      return res.status(400).json({ success: false, message: `Unsupported product. Choose one of: ${SUPPORTED_PRODUCTS.join(', ')}.` });
    }

    let requestedAmount = null;
    if (req.body.requestedAmount !== undefined && req.body.requestedAmount !== null && req.body.requestedAmount !== '') {
      requestedAmount = Number(req.body.requestedAmount);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > MAX_REQUESTED_AMOUNT) {
        return res.status(400).json({ success: false, message: 'Requested amount must be a positive number up to ₹1,000 crore.' });
      }
    }

    const customer = await Customer.findOne({ customer_id: customerId });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Insufficient customer information for counselling preparation.' });
    }

    const loans = await Loan.find({ customer_id: customerId });
    const existingLoanExposure = loans.reduce((acc, curr) => acc + (curr.outstanding || 0), 0);
    const annualIncome = (customer.monthly_income || 0) * 12;

    const customerFacts = {
      customer: {
        name: customer.name_1
      },
      product: {
        type: productType,
        amount: requestedAmount
      },
      financialFacts: {
        annualIncome,
        existingLoanExposure
      }
    };

    const query = `Prepare counselling information for a ${productType} customer. Identify relevant eligibility considerations, required documents, discussion points and questions.`;
    
    let ragContext;
    try {
      ragContext = await retrieveRelevantContext(query, 3, productType);
      console.log(`[G2] RAG context retrieved for: ${productType}`);
    } catch (e) {
      return res.status(503).json({ success: false, message: e.message });
    }

    try {
      const g2Response = await generateCounsellingPrep(customerFacts, ragContext);
      
      // Save Analysis History
      try {
        await Analysis.create({
          analysisType: 'G2_LOAN_COUNSELLING',
          customerId: customer.customer_id,
          customerName: customer.name_1,
          status: 'COMPLETED',
          summary: `Prepared counselling for ${productType}.`,
          result: {
            g2Response
          }
        });
      } catch (e) {
        console.error("Failed to save G2 analysis history", e);
      }

      console.log(`[G2] Counselling completed: ${customerId}`);
      res.json({
        success: true,
        data: g2Response
      });
    } catch (aiError) {
      console.error("G2 AI Error:", aiError);
      return res.status(503).json({
        success: false,
        message: aiError.message
      });
    }

  } catch (error) {
    console.error("G2 Route Error:", error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

module.exports = router;
