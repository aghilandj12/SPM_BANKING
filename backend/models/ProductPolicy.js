const mongoose = require('mongoose');

const productPolicySchema = new mongoose.Schema({
  source: { type: String, required: true, unique: true },
  title: String,
  category: String,
  text: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('ProductPolicy', productPolicySchema);
