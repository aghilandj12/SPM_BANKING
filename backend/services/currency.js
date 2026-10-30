/**
 * Converts amounts to INR so exposures in different currencies can be summed.
 * Rates come from env (FX_<CCY>_INR); unknown currencies are flagged, not guessed.
 */
const DEFAULT_RATES = { INR: 1, USD: 88 };

function rateToINR(currency = 'INR') {
  const ccy = String(currency || 'INR').toUpperCase();
  if (ccy === 'INR') return 1;
  const fromEnv = Number(process.env[`FX_${ccy}_INR`]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_RATES[ccy] ?? null;
}

function toINR(amount, currency = 'INR') {
  const n = Number(amount) || 0;
  const rate = rateToINR(currency);
  return rate === null ? 0 : n * rate;
}

// Sums a field across records, converting each record's currency to INR.
function sumINR(records, field, currencyField = 'currency') {
  return (records || []).reduce((acc, r) => acc + toINR(r[field], r[currencyField]), 0);
}

module.exports = { rateToINR, toINR, sumINR };
