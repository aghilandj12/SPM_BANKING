const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
const connectDB = require('../config/db');

const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const Limit = require('../models/Limit');
const Collateral = require('../models/Collateral');
const Analysis = require('../models/Analysis');
const seedBankProducts = require('./seedBankProducts');
const seedPolicies = require('./seedPolicies');

const DATASET_DIR = path.join(__dirname, '..', '..', 'dataset');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

const importData = async () => {
  await connectDB();

  try {
    // Clear existing data
    await Customer.deleteMany();
    await Loan.deleteMany();
    await Limit.deleteMany();
    await Collateral.deleteMany();
    await Analysis.deleteMany();

    console.log('Data cleared.');

    const customersData = await parseCSV(path.join(DATASET_DIR, 'customers.csv'));
    const limitsData = await parseCSV(path.join(DATASET_DIR, 'limits_collateral.csv'));
    const loansData = await parseCSV(path.join(DATASET_DIR, 'loans.csv'));

    // Format numbers
    const customers = customersData.map(c => ({
      ...c,
      monthly_income: Number(c.monthly_income) || 0
    }));

    const limits = [];
    const collaterals = [];

    limitsData.forEach(l => {
      limits.push({
        customer_id: l.customer_id,
        limit_id: l.limit_id,
        limit_product: l.limit_product,
        currency: l.currency,
        approved_limit: Number(l.approved_limit) || 0,
        utilized: Number(l.utilized) || 0,
        available: Number(l.available) || 0,
      });

      if (l.collateral_id) {
        collaterals.push({
          customer_id: l.customer_id,
          collateral_id: l.collateral_id,
          collateral_type: l.collateral_type,
          collateral_value: Number(l.collateral_value) || 0,
        });
      }
    });

    const loans = loansData.map(l => ({
      ...l,
      sanctioned_amount: Number(l.sanctioned_amount) || 0,
      outstanding: Number(l.outstanding) || 0,
      interest_rate: Number(l.interest_rate) || 0,
      tenure_months: Number(l.tenure_months) || 0,
      days_past_due: Number(l.days_past_due) || 0,
      collateral_value: Number(l.collateral_value) || 0,
      limit_amount: Number(l.limit_amount) || 0,
    }));

    await Customer.insertMany(customers);
    await Limit.insertMany(limits);
    await Collateral.insertMany(collaterals);
    await Loan.insertMany(loans);
    await seedBankProducts();
    await seedPolicies();

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
};

importData();
