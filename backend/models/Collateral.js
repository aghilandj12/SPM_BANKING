const mongoose = require('mongoose');

const collateralSchema = new mongoose.Schema({
  customer_id: { type: String, required: true },
  collateral_id: { type: String, required: true, unique: true },
  collateral_type: String,
  collateral_value: Number
}, { timestamps: true });

module.exports = mongoose.model('Collateral', collateralSchema);
