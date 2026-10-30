const mongoose = require('mongoose');

const limitSchema = new mongoose.Schema({
  customer_id: { type: String, required: true },
  limit_id: { type: String, required: true, unique: true },
  limit_product: String,
  currency: String,
  approved_limit: Number,
  utilized: Number,
  available: Number
}, { timestamps: true });

module.exports = mongoose.model('Limit', limitSchema);
