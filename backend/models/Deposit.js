const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  deposit_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  deposit_type: String,
  currency: String,
  principal: Number,
  monthly_installment: Number,
  interest_rate: Number,
  tenure_months: Number,
  start_date: String,
  maturity_date: String,
  maturity_amount: Number,
  auto_renew: Boolean,
  status: String
}, { timestamps: true });

module.exports = mongoose.model('Deposit', depositSchema);
