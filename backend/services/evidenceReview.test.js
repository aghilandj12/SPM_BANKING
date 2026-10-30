const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEvidenceReview } = require('./evidenceReview');

test('marks matching extracted values against a customer profile', () => {
  const review = buildEvidenceReview({
    extractedCustomer: { name: 'A. Customer', monthly_income: 50000 },
    customerRecord: { name_1: 'A Customer', monthly_income: 50000 },
    fileName: 'payslip.pdf'
  });

  assert.equal(review.status, 'NO_MISMATCHES_FOUND');
  assert.deepEqual(review.comparisons.map(({ status }) => status), ['MATCH', 'MATCH']);
  assert.ok(review.comparisons[0].sources.extracted.includes('payslip.pdf'));
});

test('flags differing values and suggests human verification', () => {
  const review = buildEvidenceReview({
    extractedCustomer: { monthly_income: 60000 },
    customerRecord: { monthly_income: 50000 },
    fileName: 'payslip.pdf'
  });

  assert.equal(review.status, 'MISMATCHES_FOUND');
  assert.equal(review.comparisons[0].status, 'MISMATCH');
  assert.match(review.verificationActions[0], /confirm monthly income/i);
});

test('identifies facts missing from the customer profile', () => {
  const review = buildEvidenceReview({
    extractedCustomer: { employment_type: 'Salaried' },
    customerRecord: {},
    fileName: 'application.pdf',
    missingInformation: ['Employer name']
  });

  assert.equal(review.status, 'REVIEW_REQUIRED');
  assert.deepEqual(review.comparisons.map(({ status }) => status), ['NOT_IN_RECORD']);
  assert.ok(review.verificationActions.some((action) => action.includes('Employer name')));
});

test('asks the RM to select a profile when no customer record is available', () => {
  const review = buildEvidenceReview({
    extractedCustomer: { customer_id: '1001' },
    fileName: 'identity.png',
    ocrUsed: true
  });

  assert.equal(review.status, 'REVIEW_REQUIRED');
  assert.equal(review.extractionMethod, 'OCR plus AI extraction');
  assert.match(review.verificationActions[0], /select a customer profile/i);
});

test('requires review when no comparable facts or extraction flags are present', () => {
  const review = buildEvidenceReview({
    customerRecord: { customer_id: '1001' },
    fileName: 'application.pdf',
    missingInformation: ['Income proof']
  });

  assert.equal(review.status, 'REVIEW_REQUIRED');
  assert.match(review.verificationActions[0], /extraction flagged missing information/i);
});
