
export function fmtINR(n){
  if(n === null || n === undefined) return '—';
  return '₹' + (n/100000).toLocaleString('en-IN',{maximumFractionDigits:2}) + ' L';
}
export function fmtMoney(n, currency = 'INR'){
  if(n === null || n === undefined) return '—';
  const symbol = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency + ' ';
  return symbol + Math.round(n).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US');
}
export function fmtDate(s){
  if(!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN',{day:'2-digit', month:'short', year:'numeric'});
}
export function labelize(s){
  if(!s) return '—';
  return String(s).replace(/_/g,' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}
// Deep link into G2 counselling pre-filled for a suggested product.
export function g2Link(customerId, opp){
  const params = new URLSearchParams({ customer: customerId, product: opp.product });
  if (opp.suggestedAmount > 0) params.set('amount', String(Math.round(opp.suggestedAmount)));
  return `/g2?${params.toString()}`;
}
export function fmtPct(n){ return n.toFixed(1) + '%'; }
export function fmtX(n){ return n.toFixed(2) + 'x'; }
export function todayStr(){
  return new Date().toLocaleDateString('en-IN',{day:'2-digit', month:'short', year:'numeric'});
}

// Mirrors backend/services/financialAnalyzer + riskEngine (annual income, no-exposure coverage).
export function calcMetrics(c){
  const outstanding = Number(c.outstanding) || 0;
  const creditLimit = Number(c.creditLimit) || 0;
  const existingLoan = Number(c.existingLoan) || 0;
  const utilization = creditLimit ? (outstanding / creditLimit) * 100 : 0;
  const coverage = outstanding > 0 ? ((Number(c.collateral) || 0) / outstanding) : 99;
  const totalExposure = outstanding + existingLoan;
  const incomeRatio = totalExposure > 0 ? ((Number(c.income) || 0) * 12) / totalExposure : 99;
  const exposureRatio = creditLimit ? existingLoan / creditLimit : 0;
  return {utilization, coverage, totalExposure, incomeRatio, exposureRatio};
}

export function riskEngine(m){
  const utilScore = Math.min(100, m.utilization);
  const covScore = m.coverage >= 1.5 ? 15 : m.coverage >= 1.0 ? 45 : 80;
  const incScore = m.incomeRatio >= 1.5 ? 15 : m.incomeRatio >= 0.8 ? 45 : 80;
  const expScore = m.exposureRatio >= 0.6 ? 80 : m.exposureRatio >= 0.3 ? 45 : 15;
  const score = Math.round(utilScore*0.35 + covScore*0.25 + incScore*0.2 + expScore*0.2);
  const level = score < 35 ? 'LOW' : score < 65 ? 'MEDIUM' : 'HIGH';
  const factors = {
    utilization: m.utilization > 75 ? 'High' : m.utilization >= 50 ? 'Medium' : 'Low',
    collateral: m.coverage >= 1.5 ? 'Good' : m.coverage >= 1.0 ? 'Moderate' : 'Weak',
    income: m.incomeRatio >= 1.5 ? 'Good' : m.incomeRatio >= 0.8 ? 'Moderate' : 'Weak',
    exposure: m.exposureRatio >= 0.6 ? 'High' : m.exposureRatio >= 0.3 ? 'Medium' : 'Low',
  };
  return {score, level, factors};
}

// Prefer the score computed by the backend so every screen agrees with G1/G4.
export function customerRisk(c){
  if (c && c.riskLevel && Number.isFinite(c.riskScore)) return { level: c.riskLevel, score: c.riskScore };
  const r = riskEngine(calcMetrics(c || {}));
  return { level: r.level, score: r.score };
}

export function healthBadgeClass(band){
  return band === 'STRONG' ? 'badge-low' : band === 'STABLE' ? 'badge-neutral' : band === 'WATCH' ? 'badge-medium' : 'badge-high';
}

export function badgeClass(lvl){
  return lvl === 'LOW' ? 'badge-low' : lvl === 'MEDIUM' ? 'badge-medium' : 'badge-high';
}

export function decisionEngine(factors){
  if(factors.collateral === 'Weak' || factors.income === 'Weak') return 'HOLD';
  if(factors.utilization === 'High') return 'CONDITIONS';
  if(factors.collateral === 'Good' && factors.income === 'Good') return 'ASK';
  return 'CONDITIONS';
}

export function decisionLabel(code){
  return code === 'ASK' ? 'ASK' : code === 'CONDITIONS' ? 'ASK WITH CONDITIONS' : 'HOLD OFF';
}

export function decisionIcon(code){
  return code === 'ASK' ? '✓' : code === 'CONDITIONS' ? '⚠' : '✕';
}
