const express = require('express');
const router = express.Router();
const { loadAllBundles, loadCustomerBundle } = require('../services/customerData');
const { buildInsights } = require('../services/insightsEngine');
const { validateCustomerIdParam } = require('../middleware/validate');

// List row: the same INR-normalised figures and backend risk score used by G1/G4.
function toListRow(bundle, today) {
  const c = bundle.customer;
  const insights = buildInsights(bundle, today);
  const { facts, risk, health, alerts, opportunities } = insights;
  return {
    id: c.customer_id,
    name: c.name_1,
    status: c.customer_status === '1' ? 'Active' : 'Dormant',
    income: c.monthly_income || 0,
    segment: c.segment || null,
    kycStatus: c.kyc_status || null,
    creditLimit: facts.creditLimit,
    outstanding: facts.outstanding,
    collateral: facts.collateralValue,
    existingLoan: facts.existingLoanExposure,
    riskScore: risk.score,
    riskLevel: risk.level,
    healthScore: health.score,
    healthBand: health.band,
    alertCounts: {
      HIGH: alerts.filter(a => a.severity === 'HIGH').length,
      MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
      LOW: alerts.filter(a => a.severity === 'LOW').length
    },
    opportunityCount: opportunities.filter(o => !o.blockedBy).length
  };
}

router.get('/', async (req, res) => {
  try {
    const today = new Date();
    const bundles = await loadAllBundles();
    res.json(bundles.map(b => toListRow(b, today)));
  } catch (error) {
    console.error('Customers Route Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load customers.' });
  }
});

router.get('/:customerId', validateCustomerIdParam(), async (req, res) => {
  try {
    const bundle = await loadCustomerBundle(req.params.customerId);
    if (!bundle) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json(toListRow(bundle, new Date()));
  } catch (error) {
    console.error('Customer Route Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load customer.' });
  }
});

module.exports = router;
