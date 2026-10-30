const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  analysisType: { 
    type: String, 
    required: true,
    enum: [
      'G1_CREDIT_EXPOSURE',
      'G2_LOAN_COUNSELLING',
      'G3_DOCUMENT_SUMMARY',
      'G4_LIMIT_INCREASE'
    ]
  },
  customerId: { type: String, required: true },
  customerName: { type: String },
  status: { 
    type: String, 
    required: true,
    enum: ['COMPLETED', 'FAILED']
  },
  summary: { type: String },
  result: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Analysis', analysisSchema);
