const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  txn_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true, index: true },
  account_id: String,
  date: String,
  description: String,
  channel: String,
  txn_type: { type: String, enum: ['CREDIT', 'DEBIT'] },
  amount: Number,
  balance_after: Number
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
