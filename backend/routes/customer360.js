const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const { loadCustomerBundle } = require('../services/customerData');
const { buildInsights, monthlyEmi } = require('../services/insightsEngine');
const { validateCustomerIdParam } = require('../middleware/validate');

const sum = (arr, key) => arr.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

router.get('/:id', validateCustomerIdParam('id'), async (req, res) => {
  try {
    const customerId = req.params.id;
    const bundle = await loadCustomerBundle(customerId);

    if (!bundle) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const c = bundle.customer;
    const today = new Date();
    const insights = buildInsights(bundle, today);
    const { facts } = insights;
    const history = await Analysis.find({ customerId }).sort({ createdAt: -1 }).lean();

    const loans = bundle.loans.map(l => ({
      ...l,
      emi: l.status === 'CLOSED' ? 0 : Math.round(monthlyEmi(l.sanctioned_amount, l.interest_rate, l.tenure_months)),
      maturity_date: l.start_date && l.tenure_months ? addMonths(l.start_date, l.tenure_months) : null
    }));

    const transactions = [...bundle.transactions]
      .sort((a, b) => (a.date === b.date ? (a.txn_id < b.txn_id ? 1 : -1) : (a.date < b.date ? 1 : -1)))
      .slice(0, 60);

    const creditCards = bundle.cards.filter(k => k.card_type === 'CREDIT');
    const casaBalance = sum(bundle.accounts, 'balance');
    const termDeposits = sum(bundle.deposits.filter(d => d.status === 'ACTIVE'), 'principal');
    const investmentValue = sum(bundle.investments, 'current_value');
    const cardOutstanding = sum(creditCards, 'outstanding');
    const totalAssets = casaBalance + termDeposits + investmentValue;
    const totalLiabilities = facts.existingLoanExposure + cardOutstanding;

    const summary = {
      casaBalance,
      termDeposits,
      investmentValue,
      insuranceCover: sum(bundle.insurance, 'sum_assured'),
      cardOutstanding,
      totalAssets,
      totalLiabilities,
      netPosition: totalAssets - totalLiabilities,
      monthlyEmi: insights.monthlyEmi,
      emiToIncome: insights.emiToIncome ?? 0,
      productsHeld: bundle.accounts.length + bundle.deposits.length + bundle.cards.length +
        loans.filter(l => l.status !== 'CLOSED').length + bundle.insurance.length + bundle.investments.length
    };

    res.json({
      id: c.customer_id,
      name: c.name_1,
      status: c.customer_status === '1' ? 'Active' : 'Dormant',
      income: c.monthly_income || 0,
      creditLimit: facts.creditLimit,
      outstanding: facts.outstanding,
      collateral: facts.collateralValue,
      existingLoan: facts.existingLoanExposure,
      risk: insights.risk,
      profile: {
        customerId: c.customer_id,
        mnemonic: c.mnemonic,
        shortName: c.short_name,
        fullName: c.name_1,
        dateOfBirth: c.date_of_birth,
        nationality: c.nationality,
        residence: c.residence,
        address: [c.street, c.town_country].filter(Boolean).join(', '),
        phone: c.phone,
        email: c.email,
        panMasked: c.pan_masked,
        employmentType: c.employment_type,
        monthlyIncome: c.monthly_income || 0,
        sector: c.sector === '2001' ? 'Business / SME' : 'Individual',
        segment: c.segment,
        homeBranch: c.home_branch,
        accountOfficer: c.account_officer,
        customerSince: c.customer_since,
        kycStatus: c.kyc_status
      },
      summary,
      insights: {
        health: insights.health,
        alerts: insights.alerts,
        opportunities: insights.opportunities,
        cashflow: insights.cashflow
      },
      accounts: bundle.accounts,
      deposits: bundle.deposits,
      cards: bundle.cards,
      loans,
      limits: bundle.limits,
      collaterals: bundle.collaterals,
      insurance: bundle.insurance,
      investments: bundle.investments,
      transactions,
      history: history.map(h => ({
        id: h._id,
        date: h.createdAt ? h.createdAt.toISOString().split('T')[0] : '',
        module: h.analysisType,
        status: h.status,
        result: h.summary || ''
      }))
    });
  } catch (error) {
    console.error('Customer360 Route Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load customer profile.' });
  }
});

module.exports = router;
