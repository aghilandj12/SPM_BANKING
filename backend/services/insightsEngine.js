/**
 * Relationship insights engine (deterministic, explainable, no LLM).
 *
 * From one customer's full holdings it derives:
 *  - alerts:        early-warning signals the RM should act on
 *  - opportunities: next-best-product suggestions, each with the reason it fired
 *  - cashflow:      inflow / outflow / savings rate from account transactions
 *  - health:        a 0-100 relationship health score with its drivers
 */
const { analyzeFinancials } = require('./financialAnalyzer');
const { calculateRisk } = require('./riskEngine');
const { toINR } = require('./currency');

const DAY = 24 * 60 * 60 * 1000;
const SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const daysUntil = (dateStr, today) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : Math.ceil((d - today) / DAY);
};

function monthlyEmi(principal, annualRate, months) {
  const p = Number(principal) || 0;
  const n = Number(months) || 0;
  const r = (Number(annualRate) || 0) / 12 / 100;
  if (!n || p <= 0) return 0;
  if (!r) return p / n;
  const f = Math.pow(1 + r, n);
  return (p * r * f) / (f - 1);
}

function categoriseDebit(description = '') {
  const d = description.toUpperCase();
  if (d.startsWith('EMI')) return 'emi';
  if (d.includes('CREDIT CARD')) return 'cardPayments';
  if (d.startsWith('SIP') || d.startsWith('RD ')) return 'investments';
  if (d.includes('TRANSFER')) return 'transfers';
  return 'spending';
}

/**
 * Splits the last 90 days into three 30-day windows (most recent first).
 */
function analyseCashflow(transactions = [], customer, today) {
  const windows = [0, 1, 2].map(i => ({
    label: i === 0 ? 'Last 30 days' : `${i * 30}-${(i + 1) * 30} days ago`,
    inflow: 0,
    outflow: 0,
    breakdown: { emi: 0, cardPayments: 0, investments: 0, transfers: 0, spending: 0 }
  }));

  let salaryCredits = 0;
  let lastSalaryDate = null;

  for (const t of transactions) {
    const age = Math.floor((today - new Date(t.date)) / DAY);
    if (age < 0 || age >= 90 || isNaN(age)) continue;
    const w = windows[Math.floor(age / 30)];
    const amount = Number(t.amount) || 0;
    if (t.txn_type === 'CREDIT') {
      w.inflow += amount;
      if (/SALARY/i.test(t.description || '')) {
        salaryCredits += 1;
        if (!lastSalaryDate || t.date > lastSalaryDate) lastSalaryDate = t.date;
      }
    } else {
      w.outflow += amount;
      w.breakdown[categoriseDebit(t.description)] += amount;
    }
  }

  const months = windows.map(w => ({ ...w, net: w.inflow - w.outflow }));
  const totalIn = months.reduce((a, m) => a + m.inflow, 0);
  const totalOut = months.reduce((a, m) => a + m.outflow, 0);

  return {
    hasData: transactions.length > 0,
    windows: months,
    avgMonthlyInflow: totalIn / 3,
    avgMonthlyOutflow: totalOut / 3,
    savingsRate: totalIn > 0 ? ((totalIn - totalOut) / totalIn) * 100 : null,
    salaryCredits,
    lastSalaryDate,
    observedEmi: months.reduce((a, m) => a + m.breakdown.emi, 0) / 3,
    isSalaried: customer.employment_type === 'SALARIED'
  };
}

function buildAlerts(ctx) {
  const { customer, facts, loans, cards, limits, insurance, accounts, transactions, cashflow, emiToIncome, today } = ctx;
  const alerts = [];
  const add = (severity, category, title, detail, action) => alerts.push({ severity, category, title, detail, action });

  // Repayment
  loans.filter(l => l.status !== 'CLOSED' && ((Number(l.days_past_due) || 0) > 0 || l.status === 'PAST_DUE')).forEach(l => {
    const dpd = Number(l.days_past_due) || 0;
    add(dpd >= 60 ? 'HIGH' : 'MEDIUM', 'Repayment',
      `${l.product || 'Loan'} ${l.loan_id} overdue${dpd ? ` by ${dpd} days` : ''}`,
      `Outstanding ${l.currency || 'INR'} ${Math.round(l.outstanding || 0).toLocaleString('en-IN')}.${dpd >= 90 ? ' At risk of NPA classification (90+ DPD).' : ''}`,
      'Call the customer and agree a cure plan before the next EMI date.');
  });

  // Compliance
  if (customer.kyc_status === 'EXPIRED') {
    add('HIGH', 'Compliance', 'KYC expired', 'Transactions and new products may be restricted until re-KYC.', 'Collect fresh KYC documents.');
  } else if (customer.kyc_status === 'PENDING') {
    add('MEDIUM', 'Compliance', 'KYC pending', 'KYC verification is incomplete.', 'Follow up on pending KYC documents.');
  } else if (!customer.kyc_status) {
    add('MEDIUM', 'Compliance', 'KYC status missing', 'No KYC status recorded for this customer.', 'Verify KYC status with operations.');
  }

  if (facts.customerStatus === 'DORMANT') {
    add('MEDIUM', 'Engagement', 'Relationship dormant', 'No customer-initiated activity on record.', 'Reach out to reactivate or understand attrition reasons.');
  }

  // Affordability
  if (emiToIncome !== null && emiToIncome > 60) {
    add('HIGH', 'Affordability', `EMI burden ${emiToIncome.toFixed(0)}% of income`, 'Above the 60% FOIR ceiling used across loan policies.', 'Avoid new credit; consider restructuring or tenure extension.');
  } else if (emiToIncome !== null && emiToIncome > 50) {
    add('MEDIUM', 'Affordability', `EMI burden ${emiToIncome.toFixed(0)}% of income`, 'Approaching the 60% FOIR ceiling.', 'Review before offering further credit.');
  }
  if (!(Number(customer.monthly_income) > 0)) {
    add('MEDIUM', 'Data quality', 'Income not recorded', 'Risk and affordability checks assume zero income.', 'Capture current income proof.');
  }

  // Cards & limits
  cards.filter(k => k.card_type === 'CREDIT' && k.credit_limit > 0).forEach(k => {
    const util = (k.outstanding / k.credit_limit) * 100;
    if (util >= 90) add('HIGH', 'Credit cards', `Card ${k.card_number_masked?.slice(-4) || ''} at ${util.toFixed(0)}% of limit`, 'Very high revolving usage often precedes delinquency.', 'Check for financial stress; offer EMI conversion.');
    else if (util >= 75) add('MEDIUM', 'Credit cards', `Card ${k.card_number_masked?.slice(-4) || ''} at ${util.toFixed(0)}% of limit`, 'High revolving usage.', 'Monitor and discuss repayment pattern.');
    const due = daysUntil(k.due_date, today);
    if (k.outstanding > 0 && due !== null && due >= 0 && due <= 7) {
      add('LOW', 'Credit cards', `Card payment due in ${due} day(s)`, `Minimum due ₹${Math.round(k.minimum_due || 0).toLocaleString('en-IN')}.`, 'Send a payment reminder.');
    }
  });
  limits.forEach(l => {
    if (l.approved_limit > 0 && l.utilized / l.approved_limit >= 0.9) {
      add('MEDIUM', 'Limits', `${l.limit_product || 'Limit'} ${l.limit_id} ${((l.utilized / l.approved_limit) * 100).toFixed(0)}% utilised`, 'Little headroom left on the sanctioned limit.', 'Assess whether a limit review (G4) is warranted.');
    }
  });

  // Cash-flow signals
  if (cashflow.isSalaried && facts.customerStatus === 'ACTIVE' && cashflow.hasData) {
    const sinceSalary = cashflow.lastSalaryDate ? Math.floor((today - new Date(cashflow.lastSalaryDate)) / DAY) : null;
    if (sinceSalary === null || sinceSalary > 35) {
      add('HIGH', 'Cash flow', 'Salary credit not seen recently',
        sinceSalary === null ? 'No salary credit in the last 90 days.' : `Last salary credit was ${sinceSalary} days ago.`,
        'Check for a job change or salary account switch (attrition risk).');
    }
  }
  const primary = accounts[0];
  if (primary && transactions.length) {
    const oldest = [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    const opening = oldest.txn_type === 'CREDIT' ? oldest.balance_after - oldest.amount : oldest.balance_after + oldest.amount;
    if (opening > 0 && primary.balance < opening * 0.5) {
      add('MEDIUM', 'Cash flow', `Balance down ${(100 - (primary.balance / opening) * 100).toFixed(0)}% in 90 days`, 'Sharp fall in the primary account balance.', 'Understand the outflow; possible funds moving to another bank.');
    }
  }

  // Renewals
  insurance.forEach(p => {
    const d = daysUntil(p.renewal_date, today);
    if (d !== null && d >= 0 && d <= 30) {
      add('LOW', 'Insurance', `${p.plan_name} renews in ${d} day(s)`, `Premium ₹${Math.round(p.premium || 0).toLocaleString('en-IN')}.`, 'Remind the customer to avoid a coverage lapse.');
    }
  });

  if (facts.unconvertedCurrencies.length) {
    add('LOW', 'Data quality', 'Unconverted currency exposure', `No FX rate for ${facts.unconvertedCurrencies.join(', ')}; excluded from totals.`, 'Add FX_<CCY>_INR to the backend configuration.');
  }

  return alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

function buildOpportunities(ctx) {
  const { customer, facts, risk, loans, cards, insurance, investments, accounts, deposits, emiToIncome, today } = ctx;
  const income = Number(customer.monthly_income) || 0;
  const active = facts.customerStatus === 'ACTIVE';
  const kycOk = facts.kycStatus === 'COMPLETE';
  const creditClean = facts.pastDueLoans === 0;
  const has = (list, field, value) => list.some(x => x[field] === value);
  const opps = [];
  const add = (product, title, reason, score, extra = {}) => opps.push({ product, title, reason, score, ...extra });

  if (!active) {
    add('Savings Account', 'Reactivate relationship', 'Relationship is dormant; reactivation comes before any cross-sell.', 90);
    return opps;
  }

  // Protection gaps
  if (!has(insurance, 'policy_type', 'HEALTH')) {
    add('Health Insurance', 'Health cover gap', 'No health policy on record with the bank.', 70);
  }
  const lifeCover = insurance.filter(p => p.policy_type === 'LIFE').reduce((a, p) => a + (p.sum_assured || 0), 0);
  const recommendedLife = income * 12 * 10;
  const liabilities = facts.existingLoanExposure;
  if (income > 0 && lifeCover < recommendedLife && (liabilities > 0 || income >= 75000)) {
    add('Life Insurance', 'Life cover gap',
      `Life cover ₹${(lifeCover / 1e5).toFixed(1)}L vs ~10x annual income ₹${(recommendedLife / 1e5).toFixed(1)}L${liabilities > 0 ? `, with ₹${(liabilities / 1e5).toFixed(1)}L of loans outstanding` : ''}.`,
      liabilities > 0 ? 80 : 60, { suggestedAmount: Math.round(recommendedLife - lifeCover) });
  }
  if (loans.some(l => l.product === 'HOME' && l.status !== 'CLOSED') && !has(insurance, 'policy_type', 'HOME')) {
    add('Home Insurance', 'Unprotected home loan', 'Home loan without home insurance covering the property.', 75);
  }

  // Idle balances -> deposits / investments
  const casa = accounts.filter(a => a.account_type !== 'CURRENT').reduce((a, x) => a + (x.balance || 0), 0);
  if (income > 0 && casa > income * 3) {
    const idle = Math.round(casa - income * 2);
    add('Fixed Deposit', 'Idle savings balance', `Savings of ₹${(casa / 1e5).toFixed(1)}L exceed 3 months of income; ~₹${(idle / 1e5).toFixed(1)}L could earn FD rates instead of 3%.`, 65, { suggestedAmount: idle });
  }
  deposits.filter(d => d.status === 'ACTIVE').forEach(d => {
    const days = daysUntil(d.maturity_date, today);
    if (days !== null && days >= 0 && days <= 30) {
      add('Fixed Deposit', `Deposit ${d.deposit_id} matures in ${days} day(s)`, `₹${(d.maturity_amount / 1e5).toFixed(1)}L maturing${d.auto_renew ? ' (auto-renew on)' : ' with no renewal instruction'}; retain the funds.`, d.auto_renew ? 55 : 85, { suggestedAmount: d.maturity_amount });
    }
  });
  const affluent = ['AFFLUENT', 'PREMIUM', 'WEALTH'].includes(customer.segment);
  if (investments.length === 0 && affluent && income > 0) {
    add('Mutual Fund / SIP', 'No investments with the bank', `${customer.segment.toLowerCase()} customer with no wealth products; a SIP of ~10% of income fits a long-term plan.`, 60, { suggestedAmount: Math.round(income * 0.1 / 500) * 500 });
  }

  // Credit products only for clean, affordable, low/medium risk relationships
  const affordable = emiToIncome === null || emiToIncome <= 40;
  if (!cards.some(k => k.card_type === 'CREDIT') && creditClean && affordable && risk.level !== 'HIGH' && income >= 25000) {
    add('Credit Card', 'No credit card', 'Clean repayment record and affordable EMI burden.', 50);
  }

  // Business banking
  const isBusiness = customer.employment_type === 'BUSINESS' || customer.sector === '2001';
  if (isBusiness && !has(accounts, 'account_type', 'CURRENT')) {
    add('Current Account', 'Business without current account', 'Business customer transacting through savings only.', 70);
  }

  return opps
    .map(o => (kycOk ? o : { ...o, blockedBy: 'Complete re-KYC before offering new products.', score: o.score - 30 }))
    .sort((a, b) => b.score - a.score);
}

function buildHealth({ risk, facts, cashflow, productLines }) {
  const drivers = [];
  const credit = Math.max(0, Math.round((100 - risk.score) * 0.4 - Math.min(15, facts.pastDueLoans * 8)));
  drivers.push({ name: 'Credit risk', points: credit, max: 40, note: `Risk score ${risk.score}/100${facts.pastDueLoans ? `, ${facts.pastDueLoans} loan(s) past due` : ''}` });

  const engagement = Math.round((productLines / 6) * 20);
  drivers.push({ name: 'Product depth', points: engagement, max: 20, note: `${productLines} of 6 product lines held` });

  let flow = 10;
  let flowNote = 'No recent transactions';
  if (cashflow.savingsRate !== null) {
    flow = cashflow.savingsRate >= 20 ? 20 : cashflow.savingsRate >= 0 ? 12 : 4;
    flowNote = `Savings rate ${cashflow.savingsRate.toFixed(0)}% over 90 days`;
  }
  drivers.push({ name: 'Cash flow', points: flow, max: 20, note: flowNote });

  let compliance = facts.kycStatus === 'COMPLETE' ? 20 : facts.kycStatus === 'PENDING' ? 10 : 0;
  if (facts.customerStatus === 'DORMANT') compliance = 0;
  drivers.push({ name: 'Compliance & activity', points: compliance, max: 20, note: `KYC ${facts.kycStatus.toLowerCase()}, ${facts.customerStatus.toLowerCase()}` });

  const score = drivers.reduce((a, d) => a + d.points, 0);
  const band = score >= 75 ? 'STRONG' : score >= 50 ? 'STABLE' : score >= 30 ? 'WATCH' : 'CRITICAL';
  return { score, band, drivers };
}

/**
 * @param {object} bundle { customer, accounts, deposits, cards, loans, limits, collaterals, insurance, investments, transactions }
 */
function buildInsights(bundle, today = new Date()) {
  const {
    customer, accounts = [], deposits = [], cards = [], loans = [], limits = [],
    collaterals = [], insurance = [], investments = [], transactions = []
  } = bundle;

  const facts = analyzeFinancials(customer, limits, loans, collaterals);
  const risk = calculateRisk(facts);
  const income = Number(customer.monthly_income) || 0;
  const emi = loans
    .filter(l => l.status !== 'CLOSED')
    .reduce((a, l) => a + toINR(monthlyEmi(l.sanctioned_amount, l.interest_rate, l.tenure_months), l.currency), 0);
  const emiToIncome = income > 0 ? (emi / income) * 100 : null;
  const cashflow = analyseCashflow(transactions, customer, today);

  const productLines = [accounts, deposits, cards.filter(c => c.card_type === 'CREDIT'), loans.filter(l => l.status !== 'CLOSED'), insurance, investments]
    .filter(list => list.length > 0).length;

  const ctx = { customer, facts, risk, accounts, deposits, cards, loans, limits, insurance, investments, transactions, cashflow, emiToIncome, today };

  return {
    facts,
    risk,
    monthlyEmi: Math.round(emi),
    emiToIncome,
    alerts: buildAlerts(ctx),
    opportunities: buildOpportunities(ctx),
    cashflow,
    health: buildHealth({ risk, facts, cashflow, productLines })
  };
}

module.exports = { buildInsights, analyseCashflow, monthlyEmi };
