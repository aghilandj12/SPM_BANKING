const test = require('node:test');
const assert = require('node:assert/strict');
const { buildInsights } = require('./insightsEngine');

const TODAY = new Date('2026-10-29T00:00:00Z');
const daysAgo = (n) => new Date(TODAY.getTime() - n * 86400000).toISOString().split('T')[0];
const daysAhead = (n) => daysAgo(-n);

const baseCustomer = {
  customer_id: '1001', name_1: 'TEST USER', customer_status: '1', kyc_status: 'COMPLETE',
  monthly_income: 100000, employment_type: 'SALARIED', segment: 'AFFLUENT', sector: '1001'
};
const bundle = (overrides = {}) => ({
  customer: baseCustomer, accounts: [], deposits: [], cards: [], loans: [], limits: [],
  collaterals: [], insurance: [], investments: [], transactions: [], ...overrides
});

test('empty relationship produces valid output without crashing', () => {
  const r = buildInsights(bundle(), TODAY);
  assert.ok(r.health.score >= 0 && r.health.score <= 100);
  assert.equal(r.cashflow.hasData, false);
  assert.equal(r.cashflow.savingsRate, null);
});

test('flags overdue loans with severity by DPD', () => {
  const r = buildInsights(bundle({
    loans: [{ loan_id: 'L1', product: 'PERSONAL', currency: 'INR', outstanding: 1e5, sanctioned_amount: 2e5, interest_rate: 12, tenure_months: 24, status: 'PAST_DUE', days_past_due: 95 }]
  }), TODAY);
  const a = r.alerts.find(x => x.category === 'Repayment');
  assert.equal(a.severity, 'HIGH');
  assert.match(a.detail, /NPA/);
});

test('missing salary for a salaried customer raises an attrition alert', () => {
  const r = buildInsights(bundle({
    accounts: [{ account_id: 'A1', account_type: 'SALARY', balance: 50000 }],
    transactions: [{ date: daysAgo(70), description: 'SALARY CREDIT', txn_type: 'CREDIT', amount: 100000, balance_after: 150000 }]
  }), TODAY);
  assert.ok(r.alerts.some(a => a.title === 'Salary credit not seen recently'));
});

test('idle savings suggests a fixed deposit with an amount', () => {
  const r = buildInsights(bundle({ accounts: [{ account_id: 'A1', account_type: 'SAVINGS', balance: 600000 }] }), TODAY);
  const fd = r.opportunities.find(o => o.product === 'Fixed Deposit');
  assert.ok(fd);
  assert.equal(fd.suggestedAmount, 400000);
});

test('expired KYC blocks opportunities and is a HIGH alert', () => {
  const r = buildInsights(bundle({ customer: { ...baseCustomer, kyc_status: 'EXPIRED' } }), TODAY);
  assert.ok(r.alerts.some(a => a.title === 'KYC expired' && a.severity === 'HIGH'));
  assert.ok(r.opportunities.length > 0 && r.opportunities.every(o => o.blockedBy));
});

test('dormant customer only gets a reactivation suggestion', () => {
  const r = buildInsights(bundle({ customer: { ...baseCustomer, customer_status: '2' } }), TODAY);
  assert.equal(r.opportunities.length, 1);
  assert.equal(r.opportunities[0].title, 'Reactivate relationship');
});

test('no credit card offer when a loan is past due', () => {
  const r = buildInsights(bundle({
    loans: [{ loan_id: 'L1', currency: 'INR', outstanding: 1000, sanctioned_amount: 1000, interest_rate: 10, tenure_months: 12, status: 'PAST_DUE', days_past_due: 10 }]
  }), TODAY);
  assert.ok(!r.opportunities.some(o => o.product === 'Credit Card'));
});

test('FD maturing soon without auto-renew is a top retention opportunity', () => {
  const r = buildInsights(bundle({
    deposits: [{ deposit_id: 'FD1', status: 'ACTIVE', maturity_date: daysAhead(10), maturity_amount: 500000, auto_renew: false }]
  }), TODAY);
  assert.equal(r.opportunities[0].product, 'Fixed Deposit');
  assert.match(r.opportunities[0].title, /matures/);
});

test('zero income does not divide by zero', () => {
  const r = buildInsights(bundle({ customer: { ...baseCustomer, monthly_income: 0 } }), TODAY);
  assert.equal(r.emiToIncome, null);
  assert.ok(r.alerts.some(a => a.title === 'Income not recorded'));
});
