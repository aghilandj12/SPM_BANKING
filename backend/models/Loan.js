const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  loan_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  product: String,
  currency: String,
  sanctioned_amount: Number,
  outstanding: Number,
  interest_rate: Number,
  tenure_months: Number,
  start_date: String,
  status: String,
  days_past_due: Number,
  collateral_value: Number,
  limit_amount: Number
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
