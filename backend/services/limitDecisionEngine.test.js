const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateLimitIncrease } = require('./limitDecisionEngine');

const healthy = {
  utilizationPct: 30,
  collateralCoverage: 2,
  annualIncome: 2400000,
  outstanding: 300000,
  repaymentIndicator: 'No delays',
  kycStatus: 'COMPLETE',
  customerStatus: 'ACTIVE',
  hasRevolvingLimit: true
};

test('healthy, compliant customer gets ASK', () => {
  assert.equal(evaluateLimitIncrease(healthy).result, 'ASK');
});

test('expired KYC forces HOLD_OFF even when finances are strong', () => {
  const d = evaluateLimitIncrease({ ...healthy, kycStatus: 'EXPIRED' });
  assert.equal(d.result, 'HOLD_OFF');
  assert.ok(d.conditions.some(c => /re-KYC/.test(c)));
});

test('dormant relationship forces HOLD_OFF', () => {
  assert.equal(evaluateLimitIncrease({ ...healthy, customerStatus: 'DORMANT' }).result, 'HOLD_OFF');
});

test('no existing limit is treated as a new application, never a plain ASK', () => {
  const d = evaluateLimitIncrease({ ...healthy, hasRevolvingLimit: false, utilizationPct: 0, outstanding: 0 });
  assert.equal(d.result, 'ASK_WITH_CONDITIONS');
});

test('non-numeric inputs do not crash the engine', () => {
  const d = evaluateLimitIncrease({ ...healthy, utilizationPct: undefined, collateralCoverage: 'abc', annualIncome: null });
  assert.ok(['ASK', 'ASK_WITH_CONDITIONS', 'HOLD_OFF'].includes(d.result));
});
