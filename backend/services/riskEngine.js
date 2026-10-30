/**
 * Deterministic risk engine that calculates a score and level based on financial facts.
 * Does not call the LLM.
 */
function calculateRisk(facts) {
  // Safe extraction
  const { utilizationPct, collateralCoverage, annualIncome, existingLoanExposure, outstanding } = facts;

  // Simple scoring logic based on existing project constraints/prototype
  // utilizationPct is 0-100+
  const utilScore = Math.min(100, utilizationPct);
  const covScore = collateralCoverage >= 1.5 ? 15 : collateralCoverage >= 1.0 ? 45 : 80;
  
  const totalExposure = outstanding + existingLoanExposure;
  const incomeRatio = totalExposure > 0 ? annualIncome / totalExposure : 99;
  const incScore = incomeRatio >= 1.5 ? 15 : incomeRatio >= 0.8 ? 45 : 80;

  const exposureRatio = facts.creditLimit ? existingLoanExposure / facts.creditLimit : 0;
  const expScore = exposureRatio >= 0.6 ? 80 : exposureRatio >= 0.3 ? 45 : 15;

  const score = Math.round(utilScore * 0.35 + covScore * 0.25 + incScore * 0.2 + expScore * 0.2);
  
  let level = 'HIGH';
  if (score < 35) level = 'LOW';
  else if (score < 65) level = 'MEDIUM';

  const factors = [
    `Utilization is ${utilizationPct > 75 ? 'High' : utilizationPct >= 50 ? 'Medium' : 'Low'}`,
    `Collateral coverage is ${collateralCoverage >= 1.5 ? 'Good' : collateralCoverage >= 1.0 ? 'Moderate' : 'Weak'}`,
    `Income adequacy is ${incomeRatio >= 1.5 ? 'Good' : incomeRatio >= 0.8 ? 'Moderate' : 'Weak'}`,
    `Existing exposure relative to limit is ${exposureRatio >= 0.6 ? 'High' : exposureRatio >= 0.3 ? 'Medium' : 'Low'}`
  ];

  return {
    level,
    score,
    factors
  };
}

module.exports = {
  calculateRisk
};
