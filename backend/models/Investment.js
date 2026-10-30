const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  investment_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  investment_type: String,
  scheme_name: String,
  invested_amount: Number,
  current_value: Number,
  sip_amount: Number,
  start_date: String,
  status: String
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);
