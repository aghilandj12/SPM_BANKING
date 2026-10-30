const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const Limit = require('../models/Limit');
const Account = require('../models/Account');
const Deposit = require('../models/Deposit');
const Card = require('../models/Card');
const Insurance = require('../models/Insurance');
const Investment = require('../models/Investment');
const { toINR } = require('../services/currency');

// Groups a collection by one field, returning count and summed value(s) per group.
const breakdown = (Model, groupField, sums, match = {}) => {
  const group = { _id: `$${groupField}`, count: { $sum: 1 } };
  Object.entries(sums).forEach(([as, field]) => { group[as] = { $sum: `$${field}` }; });
  return Model.aggregate([{ $match: match }, { $group: group }, { $sort: { count: -1 } }]);
};

const total = (rows, key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0);

// Loans can be in several currencies, so they are grouped in JS after converting to INR.
async function loanBreakdown() {
  const loans = await Loan.find({}, { product: 1, currency: 1, sanctioned_amount: 1, outstanding: 1 }).lean();
  const groups = new Map();
  for (const l of loans) {
    const g = groups.get(l.product) || { _id: l.product, count: 0, sanctioned: 0, balance: 0 };
    g.count += 1;
    g.sanctioned += toINR(l.sanctioned_amount, l.currency);
    g.balance += toINR(l.outstanding, l.currency);
    groups.set(l.product, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// GET /api/bank/summary - bank-wide position across every product line
router.get('/summary', async (req, res) => {
  try {
    const [
      customerCount, segments, kyc,
      accounts, deposits, loans, limits, cards, insurance, investments
    ] = await Promise.all([
      Customer.countDocuments(),
      breakdown(Customer, 'segment', {}),
      breakdown(Customer, 'kyc_status', {}),
      breakdown(Account, 'account_type', { balance: 'balance' }),
      breakdown(Deposit, 'deposit_type', { balance: 'principal' }, { status: 'ACTIVE' }),
      loanBreakdown(),
      breakdown(Limit, 'limit_product', { approved: 'approved_limit', balance: 'utilized' }),
      breakdown(Card, 'card_type', { limit: 'credit_limit', balance: 'outstanding' }),
      breakdown(Insurance, 'policy_type', { cover: 'sum_assured', premium: 'premium' }),
      breakdown(Investment, 'investment_type', { invested: 'invested_amount', balance: 'current_value' })
    ]);

    const casa = total(accounts, 'balance');
    const termDeposits = total(deposits, 'balance');
    const advances = total(loans, 'balance');

    res.json({
      success: true,
      data: {
        totals: {
          customers: customerCount,
          casa,
          termDeposits,
          totalDeposits: casa + termDeposits,
          advances,
          creditDepositRatio: casa + termDeposits ? (advances / (casa + termDeposits)) * 100 : 0,
          casaRatio: casa + termDeposits ? (casa / (casa + termDeposits)) * 100 : 0,
          cardsIssued: total(cards, 'count'),
          policies: total(insurance, 'count'),
          aum: total(investments, 'balance')
        },
        segments,
        kyc,
        productLines: { accounts, deposits, loans, limits, cards, insurance, investments }
      }
    });
  } catch (error) {
    console.error('Bank Summary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to build bank summary.' });
  }
});

module.exports = router;
