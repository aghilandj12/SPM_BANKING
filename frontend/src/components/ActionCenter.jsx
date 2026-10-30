import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { fmtINR, labelize, g2Link } from '../utils';
import { AlertTriangle, Lightbulb, HeartPulse, Users } from 'lucide-react';

const SEVERITY_CLASS = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-neutral' };
const PAGE_SIZE = 25;

export default function ActionCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('alerts');
  const [severity, setSeverity] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [product, setProduct] = useState('ALL');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    api.getPortfolioInsights()
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || err.message));
  }, []);

  useEffect(() => { setShown(PAGE_SIZE); }, [view, severity, category, product, search]);

  const term = search.trim().toLowerCase();
  const matchesSearch = (row) => !term || row.customerName?.toLowerCase().includes(term) || String(row.customerId).includes(term);

  const alerts = useMemo(() => (data?.alerts || []).filter(a =>
    (severity === 'ALL' || a.severity === severity) && (category === 'ALL' || a.category === category) && matchesSearch(a)
  ), [data, severity, category, term]); // eslint-disable-line react-hooks/exhaustive-deps

  const opportunities = useMemo(() => (data?.opportunities || []).filter(o =>
    (product === 'ALL' || o.product === product) && matchesSearch(o)
  ), [data, product, term]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="card empty-state">Error: {error}</div>;
  if (!data) return <div>Loading...</div>;

  const rows = view === 'alerts' ? alerts : opportunities;
  const stats = [
    { label: 'High-priority alerts', value: data.alertsBySeverity.HIGH || 0, icon: AlertTriangle, sub: `${(data.alertsBySeverity.MEDIUM || 0)} medium · ${(data.alertsBySeverity.LOW || 0)} low` },
    { label: 'Opportunities', value: data.opportunities.length, icon: Lightbulb, sub: `${Object.keys(data.opportunitiesByProduct).length} product types` },
    { label: 'Critical / Watch', value: `${data.healthBands.CRITICAL} / ${data.healthBands.WATCH}`, icon: HeartPulse, sub: 'Relationships needing attention' },
    { label: 'Customers scanned', value: data.customers, icon: Users, sub: `Generated ${new Date(data.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` }
  ];

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: '22px' }}>
        {stats.map(sc => {
          const Icon = sc.icon;
          return (
            <div key={sc.label} className="card stat-card">
              <div className="stat-card-header">
                <div className="stat-label">{sc.label}</div>
                <div className="stat-icon"><Icon size={16} /></div>
              </div>
              <div className="stat-value small">{sc.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-600)' }}>{sc.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="tabs">
        <button className={`tab ${view === 'alerts' ? 'active' : ''}`} onClick={() => setView('alerts')}>
          Early-warning alerts <span className="tab-count">{data.alerts.length}</span>
        </button>
        <button className={`tab ${view === 'opps' ? 'active' : ''}`} onClick={() => setView('opps')}>
          Next-best products <span className="tab-count">{data.opportunities.length}</span>
        </button>
      </div>

      <div className="history-filters">
        <input className="filter-input" type="text" placeholder="Search customer name or ID" value={search} onChange={e => setSearch(e.target.value)} />
        {view === 'alerts' ? (
          <>
            <select value={severity} onChange={e => setSeverity(e.target.value)}>
              <option value="ALL">All severities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="ALL">All categories</option>
              {Object.entries(data.alertsByCategory).map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
            </select>
          </>
        ) : (
          <select value={product} onChange={e => setProduct(e.target.value)}>
            <option value="ALL">All products</option>
            {Object.entries(data.opportunitiesByProduct).map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
          </select>
        )}
      </div>

      <div className="card" style={{ padding: '6px 8px' }}>
        {rows.length === 0 ? (
          <div className="empty-state"><div className="glyph">◌</div>Nothing matches these filters.</div>
        ) : (
          <div className="table-scroll">
            <table>
              {view === 'alerts' ? (
                <>
                  <thead><tr><th>Severity</th><th>Customer</th><th>Signal</th><th>Suggested action</th></tr></thead>
                  <tbody>
                    {rows.slice(0, shown).map((a, i) => (
                      <tr key={i} className="row-link" onClick={() => navigate(`/customer-360/${a.customerId}`)}>
                        <td><span className={`badge ${SEVERITY_CLASS[a.severity]}`}>{a.severity}</span></td>
                        <td>{a.customerName}<div className="sub mono">{a.customerId} · {a.category}</div></td>
                        <td><b>{a.title}</b><div className="sub">{a.detail}</div></td>
                        <td style={{ color: 'var(--text-600)' }}>{a.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><th>Product</th><th>Customer</th><th>Why</th><th style={{ textAlign: 'right' }}>Suggested</th><th></th></tr></thead>
                  <tbody>
                    {rows.slice(0, shown).map((o, i) => (
                      <tr key={i}>
                        <td><span className="badge badge-gold">{o.product}</span></td>
                        <td className="row-link-cell" onClick={() => navigate(`/customer-360/${o.customerId}`)}>
                          {o.customerName}<div className="sub mono">{o.customerId}{o.segment ? ` · ${labelize(o.segment)}` : ''}</div>
                        </td>
                        <td><b>{o.title}</b><div className="sub">{o.reason}</div></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{o.suggestedAmount > 0 ? fmtINR(o.suggestedAmount) : '—'}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(g2Link(o.customerId, o))}>Prepare pitch</button></td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
        {rows.length > shown && (
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <button className="btn btn-ghost" onClick={() => setShown(n => n + PAGE_SIZE)}>Show more ({rows.length - shown} remaining)</button>
          </div>
        )}
      </div>
    </>
  );
}
