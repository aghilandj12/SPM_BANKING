const { sumINR, rateToINR } = require('./currency');

// Coverage reported when there is nothing outstanding to cover.
const NO_EXPOSURE_COVERAGE = 99;

/**
 * Analyzes financial records (Limits, Loans, Collaterals) to produce deterministic metrics.
 * All amounts are normalised to INR so multi-currency exposures add up correctly.
 */
function analyzeFinancials(customer, limits = [], loans = [], collaterals = []) {
  // Aggregate limits
  const creditLimit = sumINR(limits, 'approved_limit');
  const outstanding = sumINR(limits, 'utilized');

  // Aggregate collaterals (recorded in INR)
  const collateralValue = collaterals.reduce((acc, curr) => acc + (Number(curr.collateral_value) || 0), 0);

  // Aggregate existing loans; closed loans carry no exposure
  const openLoans = loans.filter(l => l.status !== 'CLOSED');
  const existingLoanExposure = sumINR(openLoans, 'outstanding');

  // Calculate metrics safely
  const utilizationPct = creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0;
  const availableCredit = Math.max(0, creditLimit - outstanding);
  const collateralCoverage = outstanding > 0 ? (collateralValue / outstanding) : NO_EXPOSURE_COVERAGE;

  const monthlyIncome = Math.max(0, Number(customer.monthly_income) || 0);
  const annualIncome = monthlyIncome * 12;

  // Repayment / DPD indicators (open loans only)
  const maxDPD = openLoans.length > 0 ? Math.max(...openLoans.map(l => Number(l.days_past_due) || 0)) : 0;
  const pastDueLoans = openLoans.filter(l => (Number(l.days_past_due) || 0) > 0 || l.status === 'PAST_DUE').length;

  const unconvertedCurrencies = [...new Set([...limits, ...loans].map(r => r.currency).filter(c => c && rateToINR(c) === null))];

  return {
    creditLimit,
    outstanding,
    utilizationPct,
    availableCredit,
    collateralValue,
    collateralCoverage,
    annualIncome,
    existingLoanExposure,
    repaymentIndicator: maxDPD > 0 ? `Max DPD: ${maxDPD} days` : pastDueLoans > 0 ? 'Past due (DPD not reported)' : 'No delays',
    maxDPD,
    pastDueLoans,
    kycStatus: customer.kyc_status || 'UNKNOWN',
    customerStatus: customer.customer_status === '1' ? 'ACTIVE' : 'DORMANT',
    hasRevolvingLimit: limits.length > 0,
    unconvertedCurrencies
  };
}

module.exports = {
  analyzeFinancials,
  NO_EXPOSURE_COVERAGE
};
