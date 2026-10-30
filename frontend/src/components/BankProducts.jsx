import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { fmtINR, fmtPct, labelize } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Wallet, PiggyBank, Landmark, CreditCard, ShieldCheck, TrendingUp, Users } from 'lucide-react';

// Each product line: which summary fields to show and how to label them.
const LINES = [
  { key: 'accounts', title: 'Savings & Current Accounts', icon: Wallet, cols: [['balance', 'Balance']] },
  { key: 'deposits', title: 'Fixed & Recurring Deposits', icon: PiggyBank, cols: [['balance', 'Principal']] },
  { key: 'loans', title: 'Loans (INR equivalent)', icon: Landmark, cols: [['sanctioned', 'Sanctioned'], ['balance', 'Outstanding']] },
  { key: 'limits', title: 'Credit Limits', icon: Landmark, cols: [['approved', 'Approved'], ['balance', 'Utilised']] },
  { key: 'cards', title: 'Cards', icon: CreditCard, cols: [['limit', 'Credit Limit'], ['balance', 'Outstanding']] },
  { key: 'insurance', title: 'Insurance (Bancassurance)', icon: ShieldCheck, cols: [['cover', 'Sum Assured'], ['premium', 'Premium']] },
  { key: 'investments', title: 'Investments & Wealth', icon: TrendingUp, cols: [['invested', 'Invested'], ['balance', 'Current Value']] }
];

function LineCard({ line, rows }) {
  const Icon = line.icon;
  return (
    <div className="card">
      <div className="card-title">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon size={15} color="var(--blue-600)" /> {line.title}</span>
        <span className="badge badge-neutral">{rows.reduce((a, r) => a + r.count, 0)}</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '18px' }}>No data</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Product</th><th style={{ textAlign: 'right' }}>Count</th>
              {line.cols.map(([, label]) => <th key={label} style={{ textAlign: 'right' }}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r._id || 'none'}>
                <td>{labelize(r._id)}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{r.count}</td>
                {line.cols.map(([field, label]) => <td key={label} className="mono" style={{ textAlign: 'right' }}>{fmtINR(r[field] || 0)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function BankProducts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getBankSummary()
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || err.message));
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>Loading...</div>;

  const t = data.totals;
  const pl = data.productLines;
  const chartData = [
    { name: 'CASA', value: t.casa },
    { name: 'Term Deposits', value: t.termDeposits },
    { name: 'Loans', value: t.advances },
    { name: 'Card O/S', value: pl.cards.reduce((a, r) => a + (r.balance || 0), 0) },
    { name: 'Investments', value: t.aum }
  ];

  const stats = [
    { label: 'Customers', value: t.customers, icon: Users },
    { label: 'Total Deposits', value: fmtINR(t.totalDeposits), icon: PiggyBank, sub: `CASA ratio ${fmtPct(t.casaRatio)}` },
    { label: 'Loan Book', value: fmtINR(t.advances), icon: Landmark, sub: `Credit-deposit ${fmtPct(t.creditDepositRatio)}` },
    { label: 'Investments AUM', value: fmtINR(t.aum), icon: TrendingUp, sub: `${t.cardsIssued} cards · ${t.policies} policies` }
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
              {sc.sub && <div style={{ fontSize: '12px', color: 'var(--text-600)' }}>{sc.sub}</div>}
            </div>
          );
        })}
      </div>

      <div className="grid cols-2" style={{ marginBottom: '6px' }}>
        <div className="card">
          <div className="card-title">Balance Sheet by Product Line</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-600)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 10000000).toFixed(1)}Cr`} tick={{ fontSize: 11, fill: 'var(--text-600)' }} axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={v => fmtINR(v)} cursor={{ fill: 'var(--gold-100)' }} />
              <Bar dataKey="value" fill="var(--blue-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-title">Customer Base</div>
          <table>
            <thead><tr><th>Segment</th><th style={{ textAlign: 'right' }}>Customers</th></tr></thead>
            <tbody>
              {data.segments.map(sg => <tr key={sg._id || 'none'}><td>{labelize(sg._id)}</td><td className="mono" style={{ textAlign: 'right' }}>{sg.count}</td></tr>)}
            </tbody>
          </table>
          <div className="divider"></div>
          <table>
            <thead><tr><th>KYC Status</th><th style={{ textAlign: 'right' }}>Customers</th></tr></thead>
            <tbody>
              {data.kyc.map(k => (
                <tr key={k._id || 'none'}>
                  <td><span className={`badge ${k._id === 'COMPLETE' ? 'badge-low' : k._id === 'PENDING' ? 'badge-medium' : 'badge-high'}`}>{labelize(k._id)}</span></td>
                  <td className="mono" style={{ textAlign: 'right' }}>{k.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-title">Product Lines</div>
      <div className="grid cols-2">
        {LINES.map(line => <LineCard key={line.key} line={line} rows={pl[line.key] || []} />)}
      </div>
    </>
  );
}
