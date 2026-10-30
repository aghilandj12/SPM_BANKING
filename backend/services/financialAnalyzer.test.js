const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeFinancials, NO_EXPOSURE_COVERAGE } = require('./financialAnalyzer');
const { toINR, rateToINR } = require('./currency');

const customer = { monthly_income: 100000, kyc_status: 'COMPLETE', customer_status: '1' };

test('converts USD exposure to INR before summing', () => {
  const facts = analyzeFinancials(customer, [], [
    { currency: 'INR', outstanding: 100000, status: 'CURRENT' },
    { currency: 'USD', outstanding: 1000, status: 'CURRENT' }
  ], []);
  assert.equal(facts.existingLoanExposure, 100000 + 1000 * rateToINR('USD'));
});

test('ignores closed loans for exposure and DPD', () => {
  const facts = analyzeFinancials(customer, [], [
    { currency: 'INR', outstanding: 50000, status: 'CLOSED', days_past_due: 45 }
  ], []);
  assert.equal(facts.existingLoanExposure, 0);
  assert.equal(facts.repaymentIndicator, 'No delays');
});

test('nothing outstanding means collateral is not a weakness', () => {
  const facts = analyzeFinancials(customer, [{ approved_limit: 500000, utilized: 0, currency: 'INR' }], [], []);
  assert.equal(facts.collateralCoverage, NO_EXPOSURE_COVERAGE);
  assert.equal(facts.utilizationPct, 0);
});

test('handles missing income and empty records without NaN', () => {
  const facts = analyzeFinancials({}, [], [], []);
  for (const key of ['creditLimit', 'outstanding', 'utilizationPct', 'annualIncome', 'existingLoanExposure']) {
    assert.ok(Number.isFinite(facts[key]), `${key} should be finite`);
  }
  assert.equal(facts.kycStatus, 'UNKNOWN');
  assert.equal(facts.customerStatus, 'DORMANT');
});

test('unknown currencies are flagged, not silently converted', () => {
  assert.equal(toINR(100, 'XYZ'), 0);
  const facts = analyzeFinancials(customer, [], [{ currency: 'XYZ', outstanding: 100, status: 'CURRENT' }], []);
  assert.deepEqual(facts.unconvertedCurrencies, ['XYZ']);
});
