/**
 * Loads everything the bank holds for one customer, or for the whole book,
 * grouped per customer. Used by the list, Customer 360 and insights routes.
 */
const Customer = require('../models/Customer');
const Limit = require('../models/Limit');
const Loan = require('../models/Loan');
const Collateral = require('../models/Collateral');
const Account = require('../models/Account');
const Deposit = require('../models/Deposit');
const Card = require('../models/Card');
const Insurance = require('../models/Insurance');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');

const RELATED = {
  limits: Limit,
  loans: Loan,
  collaterals: Collateral,
  accounts: Account,
  deposits: Deposit,
  cards: Card,
  insurance: Insurance,
  investments: Investment,
  transactions: Transaction
};

async function loadCustomerBundle(customerId) {
  const customer = await Customer.findOne({ customer_id: customerId }).lean();
  if (!customer) return null;
  const keys = Object.keys(RELATED);
  const results = await Promise.all(keys.map(k => RELATED[k].find({ customer_id: customerId }).lean()));
  const bundle = { customer };
  keys.forEach((k, i) => { bundle[k] = results[i]; });
  return bundle;
}

async function loadAllBundles() {
  const keys = Object.keys(RELATED);
  const [customers, ...results] = await Promise.all([
    Customer.find({}).lean(),
    ...keys.map(k => RELATED[k].find({}).lean())
  ]);

  const byCustomer = new Map(customers.map(c => [c.customer_id, { customer: c, ...Object.fromEntries(keys.map(k => [k, []])) }]));
  keys.forEach((k, i) => {
    for (const row of results[i]) {
      const bundle = byCustomer.get(row.customer_id);
      if (bundle) bundle[k].push(row);
    }
  });
  return [...byCustomer.values()];
}

module.exports = { loadCustomerBundle, loadAllBundles };
