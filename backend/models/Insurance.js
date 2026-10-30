const mongoose = require('mongoose');

const insuranceSchema = new mongoose.Schema({
  policy_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  policy_type: String,
  plan_name: String,
  insurer: String,
  sum_assured: Number,
  premium: Number,
  premium_frequency: String,
  start_date: String,
  renewal_date: String,
  nominee: String,
  status: String
}, { timestamps: true });

module.exports = mongoose.model('Insurance', insuranceSchema);
