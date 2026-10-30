const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  card_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  card_type: String,
  network: String,
  variant: String,
  card_number_masked: String,
  linked_account_id: String,
  credit_limit: Number,
  outstanding: Number,
  minimum_due: Number,
  due_date: String,
  reward_points: Number,
  expiry: String,
  status: String
}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);
