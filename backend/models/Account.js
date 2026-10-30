const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  account_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  account_type: String,
  account_number: String,
  ifsc: String,
  branch: String,
  currency: String,
  balance: Number,
  avg_monthly_balance: Number,
  interest_rate: Number,
  opened_date: String,
  status: String
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
