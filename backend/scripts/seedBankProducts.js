/**
 * Generates the non-loan side of the bank for every existing customer:
 * profile/contact details, CASA accounts, FD/RD deposits, cards, insurance,
 * investments and the last 90 days of account transactions.
 *
 * Additive: it only replaces the collections it owns and never touches
 * loans, limits, collateral, users or saved analyses.
 * Data is deterministic per customer_id, so re-running gives the same result.
 *
 * Usage: node scripts/seedBankProducts.js
 */
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const Account = require('../models/Account');
const Deposit = require('../models/Deposit');
const Card = require('../models/Card');
const Insurance = require('../models/Insurance');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');

const DAY = 24 * 60 * 60 * 1000;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isoDate = (d) => d.toISOString().split('T')[0];
const addMonths = (dateStr, months) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return isoDate(d);
};
const round = (n, step = 1) => Math.round(n / step) * step;

const LIFE_PLANS = ['Term Shield Plus', 'Family Protect Term'];
const HEALTH_PLANS = ['Family Health Floater', 'Health Secure Individual'];
const FUND_SCHEMES = [
  'Large Cap Equity Fund - Growth',
  'Flexi Cap Fund - Growth',
  'Balanced Advantage Fund - Growth',
  'Short Duration Debt Fund - Growth',
  'ELSS Tax Saver Fund - Growth'
];

function segmentFor(income) {
  if (income >= 300000) return 'WEALTH';
  if (income >= 150000) return 'PREMIUM';
  if (income >= 75000) return 'AFFLUENT';
  return 'MASS';
}

function emi(principal, annualRate, months) {
  const r = annualRate / 12 / 100;
  if (!r || !months) return months ? principal / months : 0;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

function generateForCustomer(c, customerLoans, today) {
  const rand = mulberry32(Number(c.customer_id) * 7919);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (min, max) => min + rand() * (max - min);
  const chance = (p) => rand() < p;

  const id = c.customer_id;
  const income = c.monthly_income || 50000;
  const dormant = c.customer_status !== '1';
  const isBusiness = c.employment_type === 'BUSINESS' || c.sector === '2001';
  const city = (c.town_country || '').split('/')[0] || 'MAIN';
  const branch = `${city} MAIN BRANCH`;
  const ifsc = `MRDN0${String(Math.abs(city.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)) % 100000).padStart(6, '0')}`;
  const customerSince = isoDate(new Date(today.getTime() - between(2, 15) * 365 * DAY));

  // --- Profile ---
  const [first, ...rest] = (c.name_1 || 'CUSTOMER').toLowerCase().split(' ');
  const profile = {
    phone: `+91 ${pick(['98', '97', '99', '91', '88'])}${String(Math.floor(between(10000000, 99999999)))}`,
    email: `${first}.${rest.join('') || id}@example.com`,
    pan_masked: `XXXXX${String(Math.floor(between(1000, 9999)))}${String.fromCharCode(65 + Math.floor(rand() * 26))}`,
    segment: segmentFor(income),
    home_branch: branch,
    customer_since: customerSince
  };

  // --- CASA accounts ---
  const accounts = [];
  const addAccount = (type, balance, rate) => {
    const n = accounts.length + 1;
    accounts.push({
      account_id: `AC${id}${n}`,
      customer_id: id,
      account_type: type,
      account_number: `5010${id}${String(n).padStart(4, '0')}`,
      ifsc,
      branch,
      currency: 'INR',
      balance: round(balance),
      avg_monthly_balance: round(balance * between(0.7, 1.1)),
      interest_rate: rate,
      opened_date: addMonths(customerSince, n === 1 ? 0 : Math.floor(between(6, 48))),
      status: dormant ? 'DORMANT' : 'ACTIVE'
    });
  };
  addAccount(c.employment_type === 'SALARIED' ? 'SALARY' : 'SAVINGS', income * between(0.4, 3.5), 3.0);
  if (isBusiness) addAccount('CURRENT', income * between(1.5, 6), 0);
  if (chance(0.25)) addAccount('SAVINGS', income * between(0.2, 2), 3.0);
  const primary = accounts[0];

  // --- Term deposits ---
  const deposits = [];
  const fdCount = Math.floor(between(0, income > 150000 ? 4 : 2.5));
  for (let i = 0; i < fdCount; i++) {
    const principal = round(income * between(1, 8), 1000);
    const tenure = pick([12, 18, 24, 36, 60]);
    const rate = Number(between(6.5, 7.6).toFixed(2));
    const start = isoDate(new Date(today.getTime() - between(30, 700) * DAY));
    const maturity = addMonths(start, tenure);
    deposits.push({
      deposit_id: `FD${id}${i + 1}`,
      customer_id: id,
      deposit_type: 'FIXED_DEPOSIT',
      currency: 'INR',
      principal,
      monthly_installment: 0,
      interest_rate: rate,
      tenure_months: tenure,
      start_date: start,
      maturity_date: maturity,
      maturity_amount: round(principal * Math.pow(1 + rate / 400, tenure / 3)),
      auto_renew: chance(0.6),
      status: new Date(maturity) < today ? 'MATURED' : 'ACTIVE'
    });
  }
  if (chance(0.35)) {
    const inst = round(income * between(0.05, 0.15), 500);
    const tenure = pick([12, 24, 36]);
    const rate = Number(between(6.25, 7.1).toFixed(2));
    const start = isoDate(new Date(today.getTime() - between(30, 400) * DAY));
    const r = rate / 1200;
    deposits.push({
      deposit_id: `RD${id}1`,
      customer_id: id,
      deposit_type: 'RECURRING_DEPOSIT',
      currency: 'INR',
      principal: inst * tenure,
      monthly_installment: inst,
      interest_rate: rate,
      tenure_months: tenure,
      start_date: start,
      maturity_date: addMonths(start, tenure),
      maturity_amount: round(inst * ((Math.pow(1 + r, tenure) - 1) / r) * (1 + r)),
      auto_renew: false,
      status: 'ACTIVE'
    });
  }

  // --- Cards ---
  const cards = [];
  const expiry = () => {
    const d = new Date(today.getTime() + between(200, 1500) * DAY);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
  };
  accounts.filter(a => a.account_type !== 'CURRENT').forEach((a, i) => {
    cards.push({
      card_id: `DC${id}${i + 1}`,
      customer_id: id,
      card_type: 'DEBIT',
      network: pick(['RUPAY', 'VISA', 'MASTERCARD']),
      variant: profile.segment === 'MASS' ? 'Classic' : 'Platinum',
      card_number_masked: `XXXX XXXX XXXX ${Math.floor(between(1000, 9999))}`,
      linked_account_id: a.account_id,
      credit_limit: 0,
      outstanding: 0,
      minimum_due: 0,
      due_date: null,
      reward_points: 0,
      expiry: expiry(),
      status: dormant ? 'BLOCKED' : 'ACTIVE'
    });
  });
  if (!dormant && chance(0.7)) {
    const limit = round(income * between(1.5, 4), 5000);
    const outstanding = round(limit * between(0.05, 0.85));
    cards.push({
      card_id: `CC${id}1`,
      customer_id: id,
      card_type: 'CREDIT',
      network: pick(['VISA', 'MASTERCARD', 'RUPAY']),
      variant: { MASS: 'Classic', AFFLUENT: 'Gold', PREMIUM: 'Platinum', WEALTH: 'Signature' }[profile.segment],
      card_number_masked: `XXXX XXXX XXXX ${Math.floor(between(1000, 9999))}`,
      linked_account_id: primary.account_id,
      credit_limit: limit,
      outstanding,
      minimum_due: round(Math.max(outstanding * 0.05, outstanding > 0 ? 200 : 0)),
      due_date: isoDate(new Date(today.getTime() + between(3, 25) * DAY)),
      reward_points: Math.floor(between(500, 40000)),
      expiry: expiry(),
      status: 'ACTIVE'
    });
  }

  // --- Insurance (bancassurance) ---
  const insurance = [];
  const addPolicy = (type, plan, insurer, sumAssured, premium, frequency) => {
    const start = isoDate(new Date(today.getTime() - between(60, 1500) * DAY));
    const renewal = new Date(start);
    while (renewal < today) renewal.setFullYear(renewal.getFullYear() + 1);
    insurance.push({
      policy_id: `IN${id}${insurance.length + 1}`,
      customer_id: id,
      policy_type: type,
      plan_name: plan,
      insurer,
      sum_assured: round(sumAssured, 10000),
      premium: round(premium, 10),
      premium_frequency: frequency,
      start_date: start,
      renewal_date: isoDate(renewal),
      nominee: 'Spouse',
      status: 'IN_FORCE'
    });
  };
  if (chance(0.5)) addPolicy('LIFE', pick(LIFE_PLANS), 'Partner Life Insurer', income * 12 * between(8, 15), income * 12 * between(0.008, 0.015), 'ANNUAL');
  if (chance(0.55)) addPolicy('HEALTH', pick(HEALTH_PLANS), 'Partner General Insurer', pick([500000, 1000000, 1500000, 2500000]), between(12000, 38000), 'ANNUAL');
  const homeLoan = customerLoans.find(l => l.product === 'HOME');
  if (homeLoan) addPolicy('HOME', 'Home Shield (Loan Protect)', 'Partner General Insurer', homeLoan.sanctioned_amount, homeLoan.sanctioned_amount * 0.0006, 'ANNUAL');

  // --- Investments ---
  const investments = [];
  const invCount = Math.floor(between(0, income > 100000 ? 4 : 2.2));
  for (let i = 0; i < invCount; i++) {
    const type = pick(['MUTUAL_FUND', 'MUTUAL_FUND', 'DEMAT_EQUITY', 'BONDS', 'PPF', 'NPS']);
    const invested = round(income * between(1, 10), 1000);
    const growth = type === 'DEMAT_EQUITY' ? between(-0.15, 0.45) : type === 'MUTUAL_FUND' ? between(-0.05, 0.35) : between(0.04, 0.18);
    const scheme = {
      MUTUAL_FUND: pick(FUND_SCHEMES),
      DEMAT_EQUITY: 'Equity Holdings (Demat)',
      BONDS: 'Tax-Free Bonds Series',
      PPF: 'Public Provident Fund',
      NPS: 'National Pension System - Tier I'
    }[type];
    investments.push({
      investment_id: `IV${id}${i + 1}`,
      customer_id: id,
      investment_type: type,
      scheme_name: scheme,
      invested_amount: invested,
      current_value: round(invested * (1 + growth)),
      sip_amount: type === 'MUTUAL_FUND' && chance(0.6) ? round(income * between(0.03, 0.1), 500) : 0,
      start_date: isoDate(new Date(today.getTime() - between(180, 2000) * DAY)),
      status: 'ACTIVE'
    });
  }

  // --- Transactions on primary account (last 90 days) ---
  const raw = [];
  if (!dormant) {
    for (let m = 0; m < 3; m++) {
      const monthStart = new Date(today.getTime() - (m * 30 + 29) * DAY);
      if (c.employment_type === 'SALARIED') {
        raw.push({ day: monthStart, description: 'SALARY CREDIT - EMPLOYER PAYROLL', channel: 'NEFT', txn_type: 'CREDIT', amount: income });
      } else {
        raw.push({ day: new Date(monthStart.getTime() + 4 * DAY), description: 'BUSINESS RECEIPTS - CLIENT PAYMENT', channel: 'RTGS', txn_type: 'CREDIT', amount: round(income * between(0.8, 1.3)) });
      }
      customerLoans.filter(l => l.status !== 'CLOSED').forEach(l => {
        if (l.currency !== 'INR') return;
        raw.push({ day: new Date(monthStart.getTime() + 5 * DAY), description: `EMI DEBIT - ${l.loan_id}`, channel: 'NACH', txn_type: 'DEBIT', amount: round(emi(l.sanctioned_amount, l.interest_rate, l.tenure_months)) });
      });
      const cc = cards.find(k => k.card_type === 'CREDIT');
      if (cc) raw.push({ day: new Date(monthStart.getTime() + 18 * DAY), description: `CREDIT CARD BILL PAYMENT - ${cc.card_number_masked.slice(-4)}`, channel: 'NETBANKING', txn_type: 'DEBIT', amount: round(cc.credit_limit * between(0.05, 0.3)) });
      const rd = deposits.find(d => d.deposit_type === 'RECURRING_DEPOSIT');
      if (rd) raw.push({ day: new Date(monthStart.getTime() + 7 * DAY), description: `RD INSTALLMENT - ${rd.deposit_id}`, channel: 'AUTO', txn_type: 'DEBIT', amount: rd.monthly_installment });
      investments.filter(v => v.sip_amount > 0).forEach(v => {
        raw.push({ day: new Date(monthStart.getTime() + 10 * DAY), description: `SIP - ${v.scheme_name}`, channel: 'NACH', txn_type: 'DEBIT', amount: v.sip_amount });
      });
      const spends = 4 + Math.floor(rand() * 5);
      for (let s = 0; s < spends; s++) {
        const kind = pick([
          ['UPI/GROCERY STORE', 'UPI', 0.004, 0.02],
          ['UPI/FUEL STATION', 'UPI', 0.004, 0.015],
          ['UPI/RESTAURANT', 'UPI', 0.003, 0.015],
          ['ATM CASH WITHDRAWAL', 'ATM', 0.02, 0.08],
          ['BILLPAY/ELECTRICITY', 'NETBANKING', 0.01, 0.03],
          ['POS/ONLINE SHOPPING', 'POS', 0.01, 0.06],
          ['IMPS/TRANSFER TO SELF', 'IMPS', 0.05, 0.15]
        ]);
        raw.push({ day: new Date(monthStart.getTime() + between(1, 29) * DAY), description: kind[0], channel: kind[1], txn_type: 'DEBIT', amount: round(income * between(kind[2], kind[3]), 10) });
      }
    }
    raw.push({ day: new Date(today.getTime() - 2 * DAY), description: 'SAVINGS INTEREST CREDIT', channel: 'SYSTEM', txn_type: 'CREDIT', amount: round(primary.balance * 0.03 / 4) });
  }

  // Walk backwards from the current balance so balance_after is consistent.
  raw.sort((a, b) => a.day - b.day);
  // Lift the current balance if the 90-day history would ever dip below zero.
  let lowest = primary.balance;
  let probe = primary.balance;
  for (let i = raw.length - 1; i >= 0; i--) {
    probe = raw[i].txn_type === 'CREDIT' ? probe - raw[i].amount : probe + raw[i].amount;
    lowest = Math.min(lowest, probe);
  }
  if (lowest < 0) {
    primary.balance = round(primary.balance - lowest + income * 0.25);
    primary.avg_monthly_balance = round(primary.balance * between(0.7, 1.1));
  }
  let running = primary.balance;
  const transactions = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    const t = raw[i];
    transactions.unshift({
      txn_id: `TX${id}${String(i + 1).padStart(3, '0')}`,
      customer_id: id,
      account_id: primary.account_id,
      date: isoDate(t.day),
      description: t.description,
      channel: t.channel,
      txn_type: t.txn_type,
      amount: t.amount,
      balance_after: running
    });
    running = t.txn_type === 'CREDIT' ? running - t.amount : running + t.amount;
  }

  return { profile, accounts, deposits, cards, insurance, investments, transactions };
}

async function seedBankProducts() {
  const today = new Date();
  const customers = await Customer.find({}).lean();
  const loans = await Loan.find({}).lean();

  const all = { accounts: [], deposits: [], cards: [], insurance: [], investments: [], transactions: [] };
  const profileUpdates = [];

  for (const c of customers) {
    const generated = generateForCustomer(c, loans.filter(l => l.customer_id === c.customer_id), today);
    profileUpdates.push({ updateOne: { filter: { _id: c._id }, update: { $set: generated.profile } } });
    Object.keys(all).forEach(k => all[k].push(...generated[k]));
  }

  if (profileUpdates.length) await Customer.bulkWrite(profileUpdates);

  const targets = [
    [Account, all.accounts],
    [Deposit, all.deposits],
    [Card, all.cards],
    [Insurance, all.insurance],
    [Investment, all.investments],
    [Transaction, all.transactions]
  ];
  for (const [Model, docs] of targets) {
    await Model.deleteMany({});
    if (docs.length) await Model.insertMany(docs);
    console.log(`${Model.modelName}: ${docs.length} records`);
  }
  console.log(`Customer profiles updated: ${profileUpdates.length}`);
}

module.exports = seedBankProducts;

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB()
    .then(seedBankProducts)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(`Error: ${err}`);
      process.exit(1);
    });
}
