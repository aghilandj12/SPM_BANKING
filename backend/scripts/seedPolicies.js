/**
 * Loads the product policy documents in backend/knowledge/*.txt into the
 * productpolicies collection, which G2's RAG retrieval reads from.
 * Upserts by file name, so edited files simply replace their stored copy.
 *
 * Usage: node scripts/seedPolicies.js
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ProductPolicy = require('../models/ProductPolicy');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');

function categoryFor(file) {
  if (file.includes('loan')) return 'LOAN';
  if (file.includes('account')) return 'ACCOUNT';
  if (file.includes('deposit')) return 'DEPOSIT';
  if (file.includes('card')) return 'CARD';
  if (file.includes('insurance')) return 'INSURANCE';
  if (file.includes('fund') || file.includes('investment')) return 'INVESTMENT';
  return 'GENERAL';
}

async function seedPolicies() {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.txt'));
  const ops = files.map(file => {
    const text = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
    return {
      updateOne: {
        filter: { source: file },
        update: { $set: { title: text.split('\n')[0].trim(), category: categoryFor(file), text } },
        upsert: true
      }
    };
  });
  if (ops.length) await ProductPolicy.bulkWrite(ops);
  console.log(`ProductPolicy: ${ops.length} records`);
}

module.exports = seedPolicies;

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB()
    .then(seedPolicies)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(`Error: ${err}`);
      process.exit(1);
    });
}
