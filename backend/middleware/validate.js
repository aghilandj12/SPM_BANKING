const mongoose = require('mongoose');

const CUSTOMER_ID_PATTERN = /^\d{3,12}$/;

// Route param guards: reject malformed ids with 400 before they reach the database.
function validateCustomerIdParam(paramName = 'customerId') {
  return (req, res, next) => {
    const value = String(req.params[paramName] || '').trim();
    if (!CUSTOMER_ID_PATTERN.test(value)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID. Customer IDs are numeric.' });
    }
    req.params[paramName] = value;
    next();
  };
}

function validateObjectIdParam(paramName = 'id') {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[paramName])) {
      return res.status(400).json({ success: false, message: 'Invalid record ID.' });
    }
    next();
  };
}

module.exports = { CUSTOMER_ID_PATTERN, validateCustomerIdParam, validateObjectIdParam };
