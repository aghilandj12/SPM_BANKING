const express = require('express');
const router = express.Router();
const { loadAllBundles } = require('../services/customerData');
const { buildInsights } = require('../services/insightsEngine');

const SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

// GET /api/insights/portfolio - RM Action Center: every alert and opportunity across the book
router.get('/portfolio', async (req, res) => {
  try {
    const today = new Date();
    const bundles = await loadAllBundles();

    const alerts = [];
    const opportunities = [];
    const healthBands = { STRONG: 0, STABLE: 0, WATCH: 0, CRITICAL: 0 };

    for (const bundle of bundles) {
      const c = bundle.customer;
      const insights = buildInsights(bundle, today);
      const who = { customerId: c.customer_id, customerName: c.name_1, segment: c.segment || null, healthScore: insights.health.score };
      healthBands[insights.health.band] += 1;
      insights.alerts.forEach(a => alerts.push({ ...who, ...a }));
      insights.opportunities.filter(o => !o.blockedBy).forEach(o => opportunities.push({ ...who, ...o }));
    }

    alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.healthScore - b.healthScore);
    opportunities.sort((a, b) => b.score - a.score);

    const countBy = (list, key) => list.reduce((acc, x) => { acc[x[key]] = (acc[x[key]] || 0) + 1; return acc; }, {});

    res.json({
      success: true,
      data: {
        generatedAt: today.toISOString(),
        customers: bundles.length,
        healthBands,
        alertsBySeverity: countBy(alerts, 'severity'),
        alertsByCategory: countBy(alerts, 'category'),
        opportunitiesByProduct: countBy(opportunities, 'product'),
        alerts,
        opportunities
      }
    });
  } catch (error) {
    console.error('Insights Route Error:', error);
    res.status(500).json({ success: false, message: 'Failed to build portfolio insights.' });
  }
});

module.exports = router;
