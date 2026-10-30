import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { calcMetrics, riskEngine, badgeClass, healthBadgeClass, fmtINR, fmtMoney, fmtDate, fmtPct, labelize, g2Link } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'insights', label: 'Insights' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'deposits', label: 'Deposits' },
  { key: 'loans', label: 'Loans & Limits' },
  { key: 'cards', label: 'Cards' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'investments', label: 'Investments' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'history', label: 'AI Analyses' }
];

function DataTable({ columns, rows, empty }) {
  if (!rows || rows.length === 0) {
    return <div className="empty-state"><div className="glyph">◌</div>{empty}</div>;
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>{columns.map(col => <th key={col.label} style={col.right ? { textAlign: 'right' } : undefined}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._id || i}>
              {columns.map(col => (
                <td key={col.label} className={col.mono ? 'mono' : undefined} style={col.right ? { textAlign: 'right' } : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ value }) {
  const good = ['ACTIVE', 'CURRENT', 'IN_FORCE', 'COMPLETE', 'COMPLETED'];
  const bad = ['DORMANT', 'BLOCKED', 'PAST_DUE', 'OVERDUE', 'NPA', 'EXPIRED', 'LAPSED', 'FAILED'];
  const warn = ['PENDING', 'MATURED'];
  const cls = good.includes(value) ? 'badge-low' : bad.includes(value) ? 'badge-high' : warn.includes(value) ? 'badge-medium' : 'badge-neutral';
  return <span className={`badge ${cls}`}>{labelize(value)}</span>;
}

function KV({ label, value, mono }) {
  return (
    <div className="kv-row">
      <div className="kv-label">{label}</div>
      <div className={`kv-value ${mono ? 'mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}

export default function Customer360() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [txnFilter, setTxnFilter] = useState('ALL');

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const res = await api.getCustomer360(id);
        setCustomer(res.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
    setTab('overview');
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!customer) return <div>Customer not found</div>;

  const m = calcMetrics(customer);
  const r = customer.risk || riskEngine(m);
  const ins = customer.insights || { alerts: [], opportunities: [], health: null, cashflow: null };
  const p = customer.profile || {};
  const s = customer.summary || {};
  const counts = {
    accounts: customer.accounts?.length || 0,
    deposits: customer.deposits?.length || 0,
    loans: (customer.loans?.length || 0) + (customer.limits?.length || 0),
    cards: customer.cards?.length || 0,
    insurance: customer.insurance?.length || 0,
    investments: customer.investments?.length || 0,
    transactions: customer.transactions?.length || 0,
    history: customer.history?.length || 0,
    insights: ins.alerts.length
  };
  const initials = (customer.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
  const age = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth)) / (365.25 * 24 * 3600 * 1000)) : null;
  const kycExpired = p.kycStatus && p.kycStatus !== 'COMPLETE';
  const transactions = (customer.transactions || []).filter(t => txnFilter === 'ALL' || t.txn_type === txnFilter);

  return (
    <>
      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="profile-head">
          <div className="profile-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '20px' }}>{customer.name}</h2>
            <div style={{ color: 'var(--text-400)', fontSize: '12.5px', marginTop: '3px' }}>
              <span className={`status-dot ${customer.status === 'Active' ? 'status-active' : 'status-dormant'}`}></span>
              {customer.status} &middot; Customer <span className="mono">{customer.id}</span>
              {p.customerSince && <> &middot; With bank since {fmtDate(p.customerSince)}</>}
            </div>
            <div className="profile-badges">
              {p.segment && <span className="badge badge-gold">{labelize(p.segment)}</span>}
              <span className={`badge ${p.kycStatus === 'COMPLETE' ? 'badge-low' : p.kycStatus === 'PENDING' ? 'badge-medium' : 'badge-high'}`}>KYC {labelize(p.kycStatus)}</span>
              <span className={`badge ${badgeClass(r.level)}`}>{r.level} RISK</span>
              {ins.health && <span className={`badge ${healthBadgeClass(ins.health.band)}`} title="Relationship health score">Health {ins.health.score} · {labelize(ins.health.band)}</span>}
              {p.employmentType && <span className="badge badge-neutral">{labelize(p.employmentType)}</span>}
            </div>
          </div>
        </div>

        <div className="divider"></div>
        <div className="grid cols-6">
          <div className="metric-box"><div className="label">Total Assets</div><div className="value">{fmtINR(s.totalAssets)}</div></div>
          <div className="metric-box"><div className="label">Total Liabilities</div><div className="value">{fmtINR(s.totalLiabilities)}</div></div>
          <div className="metric-box"><div className="label">Net Position</div><div className="value" style={{ color: s.netPosition < 0 ? 'var(--risk-high)' : 'var(--risk-low)' }}>{fmtINR(s.netPosition)}</div></div>
          <div className="metric-box"><div className="label">Monthly EMI</div><div className="value">{fmtMoney(s.monthlyEmi)}</div></div>
          <div className="metric-box"><div className="label">EMI / Income</div><div className="value">{fmtPct(s.emiToIncome || 0)}</div></div>
          <div className="metric-box"><div className="label">Products Held</div><div className="value">{s.productsHeld ?? 0}</div></div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}{counts[t.key] !== undefined && <span className="tab-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {kycExpired && (
            <div className="alert-banner">
              KYC is {labelize(p.kycStatus).toLowerCase()}. Complete re-KYC before opening new products or enhancing limits.
            </div>
          )}
          {ins.alerts.filter(a => a.severity === 'HIGH').length > 0 && (
            <div className="card" style={{ marginBottom: '16px', borderColor: 'var(--risk-high-bg)' }}>
              <div className="card-title">
                Needs attention
                <button className="btn btn-ghost btn-sm" onClick={() => setTab('insights')}>All insights</button>
              </div>
              {ins.alerts.filter(a => a.severity === 'HIGH').slice(0, 3).map((a, i) => (
                <div key={i} className="insight-item">
                  <div className="insight-title"><span className="badge badge-high">HIGH</span>{a.title}</div>
                  <div className="insight-detail">{a.action}</div>
                </div>
              ))}
            </div>
          )}
          <div className="grid cols-2">
            <div className="card">
              <div className="card-title">Personal Details</div>
              <KV label="Full name" value={p.fullName} />
              <KV label="Short name / Mnemonic" value={[p.shortName, p.mnemonic].filter(Boolean).join(' · ')} />
              <KV label="Date of birth" value={p.dateOfBirth ? `${fmtDate(p.dateOfBirth)}${age ? ` (${age} yrs)` : ''}` : null} />
              <KV label="Nationality / Residence" value={[p.nationality, p.residence].filter(Boolean).join(' / ')} />
              <KV label="PAN" value={p.panMasked} mono />
              <KV label="Employment" value={labelize(p.employmentType)} />
              <KV label="Monthly income" value={fmtMoney(p.monthlyIncome)} mono />
              <KV label="Customer type" value={p.sector} />
            </div>
            <div className="card">
              <div className="card-title">Contact & Relationship</div>
              <KV label="Phone" value={p.phone} mono />
              <KV label="Email" value={p.email} />
              <KV label="Address" value={p.address} />
              <KV label="Home branch" value={p.homeBranch} />
              <KV label="Account officer" value={p.accountOfficer ? `RM #${p.accountOfficer}` : null} />
              <KV label="Customer since" value={fmtDate(p.customerSince)} />
              <KV label="Segment" value={labelize(p.segment)} />
              <KV label="KYC status" value={labelize(p.kycStatus)} />
            </div>
          </div>

          <div className="section-title">Holdings at a Glance</div>
          <div className="grid cols-4">
            <div className="module-card" onClick={() => setTab('accounts')}><h3>{fmtINR(s.casaBalance)}</h3><p>Savings & current balance · {counts.accounts} account(s)</p></div>
            <div className="module-card" onClick={() => setTab('deposits')}><h3>{fmtINR(s.termDeposits)}</h3><p>Active fixed & recurring deposits</p></div>
            <div className="module-card" onClick={() => setTab('investments')}><h3>{fmtINR(s.investmentValue)}</h3><p>Investments current value</p></div>
            <div className="module-card" onClick={() => setTab('insurance')}><h3>{fmtINR(s.insuranceCover)}</h3><p>Insurance cover · {counts.insurance} policy(ies)</p></div>
            <div className="module-card" onClick={() => setTab('loans')}><h3>{fmtINR(customer.existingLoan)}</h3><p>Loan outstanding · {customer.loans?.length || 0} loan(s)</p></div>
            <div className="module-card" onClick={() => setTab('loans')}><h3>{fmtINR(customer.creditLimit)}</h3><p>Approved limits · {fmtINR(customer.outstanding)} utilised</p></div>
            <div className="module-card" onClick={() => setTab('cards')}><h3>{fmtINR(s.cardOutstanding)}</h3><p>Credit card outstanding · {counts.cards} card(s)</p></div>
            <div className="module-card" onClick={() => setTab('loans')}><h3>{fmtINR(customer.collateral)}</h3><p>Collateral held</p></div>
          </div>

          <div className="section-title">Credit Risk</div>
          <div className="grid cols-4">
            <div className="metric-box"><div className="label">Risk Score</div><div className="value">{r.score} / 100</div></div>
            <div className="metric-box"><div className="label">Total Exposure</div><div className="value">{fmtINR(m.totalExposure)}</div></div>
            <div className="metric-box"><div className="label">Limit Utilisation</div><div className="value">{fmtPct(m.utilization)}</div></div>
            <div className="metric-box"><div className="label">Collateral Cover</div><div className="value">{m.coverage.toFixed(2)}x</div></div>
          </div>

          <div className="section-title">AI Tools</div>
          <div className="grid cols-4" style={{ marginBottom: '8px' }}>
            <div className="module-card" onClick={() => navigate('/g1')}><h3>Credit Brief</h3><p>G1 risk analysis</p></div>
            <div className="module-card" onClick={() => navigate('/g2')}><h3>Counselling Prep</h3><p>G2 product meeting prep</p></div>
            <div className="module-card" onClick={() => navigate('/g3')}><h3>Documents</h3><p>G3 extraction</p></div>
            <div className="module-card" onClick={() => navigate('/g4')}><h3>Limit Increase</h3><p>G4 decision</p></div>
          </div>
        </>
      )}


      {tab === 'insights' && (
        <>
          <div className="grid cols-2">
            <div className="card">
              <div className="card-title">Relationship Health</div>
              {ins.health ? (
                <>
                  <div className="health-ring" style={{ marginBottom: '18px' }}>
                    <div className="health-score">{ins.health.score}</div>
                    <div>
                      <span className={`badge ${healthBadgeClass(ins.health.band)}`}>{labelize(ins.health.band)}</span>
                      <div className="insight-detail">Out of 100 · credit risk, product depth, cash flow and compliance</div>
                    </div>
                  </div>
                  {ins.health.drivers.map(d => (
                    <div key={d.name} className="driver-row">
                      <div className="driver-head"><span>{d.name}</span><span className="mono">{d.points}/{d.max}</span></div>
                      <div className="driver-bar"><div className="driver-fill" style={{ width: `${(d.points / d.max) * 100}%` }}></div></div>
                      <div className="insight-detail">{d.note}</div>
                    </div>
                  ))}
                </>
              ) : <div className="empty-state">No health data.</div>}
            </div>

            <div className="card">
              <div className="card-title">Cash Flow · last 90 days</div>
              {ins.cashflow?.hasData ? (
                <>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={[...ins.cashflow.windows].reverse()} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-600)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `${(v / 100000).toFixed(1)}L`} tick={{ fontSize: 11, fill: 'var(--text-600)' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={v => fmtMoney(v)} cursor={{ fill: 'var(--gold-100)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="inflow" name="Inflow" fill="var(--risk-low)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outflow" name="Outflow" fill="var(--blue-500)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="grid cols-3" style={{ marginTop: '12px' }}>
                    <div className="metric-box"><div className="label">Avg inflow / mo</div><div className="value" style={{ fontSize: '15px' }}>{fmtMoney(ins.cashflow.avgMonthlyInflow)}</div></div>
                    <div className="metric-box"><div className="label">Avg outflow / mo</div><div className="value" style={{ fontSize: '15px' }}>{fmtMoney(ins.cashflow.avgMonthlyOutflow)}</div></div>
                    <div className="metric-box"><div className="label">Savings rate</div><div className="value" style={{ fontSize: '15px', color: ins.cashflow.savingsRate < 0 ? 'var(--risk-high)' : undefined }}>{ins.cashflow.savingsRate === null ? '—' : fmtPct(ins.cashflow.savingsRate)}</div></div>
                  </div>
                  {ins.cashflow.isSalaried && (
                    <div className="insight-detail" style={{ marginTop: '10px' }}>
                      Salary credits seen: {ins.cashflow.salaryCredits} in 90 days{ins.cashflow.lastSalaryDate ? ` · last on ${fmtDate(ins.cashflow.lastSalaryDate)}` : ''}
                    </div>
                  )}
                </>
              ) : <div className="empty-state"><div className="glyph">◌</div>No transactions in the last 90 days.</div>}
            </div>
          </div>

          <div className="grid cols-2" style={{ marginTop: '16px' }}>
            <div className="card">
              <div className="card-title">Early-warning Alerts <span className="badge badge-neutral">{ins.alerts.length}</span></div>
              {ins.alerts.length === 0 ? <div className="empty-state">No alerts. This relationship looks healthy.</div> : ins.alerts.map((a, i) => (
                <div key={i} className="insight-item">
                  <div className="insight-title">
                    <span className={`badge ${a.severity === 'HIGH' ? 'badge-high' : a.severity === 'MEDIUM' ? 'badge-medium' : 'badge-neutral'}`}>{a.severity}</span>
                    {a.title}
                  </div>
                  <div className="insight-detail">{a.detail}</div>
                  <div className="insight-detail"><b>Action:</b> {a.action}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">Next-best Products <span className="badge badge-neutral">{ins.opportunities.length}</span></div>
              {ins.opportunities.length === 0 ? <div className="empty-state">No product gaps found.</div> : ins.opportunities.map((o, i) => (
                <div key={i} className="insight-item">
                  <div className="insight-title" style={{ justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span className="badge badge-gold">{o.product}</span>{o.title}</span>
                    {!o.blockedBy && <button className="btn btn-ghost btn-sm" onClick={() => navigate(g2Link(customer.id, o))}>Prepare pitch</button>}
                  </div>
                  <div className="insight-detail">{o.reason}{o.suggestedAmount > 0 ? ` Suggested: ${fmtINR(o.suggestedAmount)}.` : ''}</div>
                  {o.blockedBy && <div className="insight-detail" style={{ color: 'var(--risk-high)' }}>{o.blockedBy}</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'accounts' && (
        <div className="card" style={{ padding: '6px 8px' }}>
          <DataTable
            empty="No savings or current accounts."
            rows={customer.accounts}
            columns={[
              { label: 'Type', render: a => labelize(a.account_type) },
              { label: 'Account No.', mono: true, render: a => a.account_number },
              { label: 'Branch / IFSC', render: a => <>{a.branch}<div className="sub mono">{a.ifsc}</div></> },
              { label: 'Opened', render: a => fmtDate(a.opened_date) },
              { label: 'Rate', mono: true, right: true, render: a => a.interest_rate ? `${a.interest_rate}%` : '—' },
              { label: 'Avg Monthly Bal.', mono: true, right: true, render: a => fmtMoney(a.avg_monthly_balance, a.currency) },
              { label: 'Balance', mono: true, right: true, render: a => <b>{fmtMoney(a.balance, a.currency)}</b> },
              { label: 'Status', render: a => <StatusBadge value={a.status} /> }
            ]}
          />
        </div>
      )}

      {tab === 'deposits' && (
        <div className="card" style={{ padding: '6px 8px' }}>
          <DataTable
            empty="No fixed or recurring deposits."
            rows={customer.deposits}
            columns={[
              { label: 'Deposit', render: d => <>{labelize(d.deposit_type)}<div className="sub mono">{d.deposit_id}</div></> },
              { label: 'Principal', mono: true, right: true, render: d => <>{fmtMoney(d.principal, d.currency)}{d.monthly_installment > 0 && <div className="sub">{fmtMoney(d.monthly_installment)}/mo</div>}</> },
              { label: 'Rate', mono: true, right: true, render: d => `${d.interest_rate}%` },
              { label: 'Tenure', right: true, render: d => `${d.tenure_months} mo` },
              { label: 'Start', render: d => fmtDate(d.start_date) },
              { label: 'Maturity', render: d => fmtDate(d.maturity_date) },
              { label: 'Maturity Value', mono: true, right: true, render: d => fmtMoney(d.maturity_amount, d.currency) },
              { label: 'Auto-renew', render: d => d.auto_renew ? 'Yes' : 'No' },
              { label: 'Status', render: d => <StatusBadge value={d.status} /> }
            ]}
          />
        </div>
      )}

      {tab === 'loans' && (
        <>
          <div className="section-title">Loans</div>
          <div className="card" style={{ padding: '6px 8px' }}>
            <DataTable
              empty="No loans."
              rows={customer.loans}
              columns={[
                { label: 'Loan', render: l => <>{labelize(l.product)}<div className="sub mono">{l.loan_id}</div></> },
                { label: 'Sanctioned', mono: true, right: true, render: l => fmtMoney(l.sanctioned_amount, l.currency) },
                { label: 'Outstanding', mono: true, right: true, render: l => <b>{fmtMoney(l.outstanding, l.currency)}</b> },
                { label: 'Rate', mono: true, right: true, render: l => `${l.interest_rate}%` },
                { label: 'EMI', mono: true, right: true, render: l => l.emi ? fmtMoney(l.emi, l.currency) : '—' },
                { label: 'Tenure', right: true, render: l => `${l.tenure_months} mo` },
                { label: 'Start → End', render: l => <>{fmtDate(l.start_date)}<div className="sub">{fmtDate(l.maturity_date)}</div></> },
                { label: 'DPD', mono: true, right: true, render: l => <span style={{ color: l.days_past_due > 0 ? 'var(--risk-high)' : undefined }}>{l.days_past_due}</span> },
                { label: 'Status', render: l => <StatusBadge value={l.status} /> }
              ]}
            />
          </div>
          <div className="grid cols-2">
            <div>
              <div className="section-title">Credit Limits</div>
              <div className="card" style={{ padding: '6px 8px' }}>
                <DataTable
                  empty="No credit limits."
                  rows={customer.limits}
                  columns={[
                    { label: 'Limit', render: l => <>{labelize(l.limit_product)}<div className="sub mono">{l.limit_id}</div></> },
                    { label: 'Approved', mono: true, right: true, render: l => fmtMoney(l.approved_limit, l.currency) },
                    { label: 'Utilised', mono: true, right: true, render: l => fmtMoney(l.utilized, l.currency) },
                    { label: 'Available', mono: true, right: true, render: l => fmtMoney(l.available, l.currency) }
                  ]}
                />
              </div>
            </div>
            <div>
              <div className="section-title">Collateral</div>
              <div className="card" style={{ padding: '6px 8px' }}>
                <DataTable
                  empty="No collateral held."
                  rows={customer.collaterals}
                  columns={[
                    { label: 'ID', mono: true, render: c => c.collateral_id },
                    { label: 'Type', render: c => labelize(c.collateral_type) },
                    { label: 'Value', mono: true, right: true, render: c => fmtMoney(c.collateral_value) }
                  ]}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'cards' && (
        <div className="card" style={{ padding: '6px 8px' }}>
          <DataTable
            empty="No cards issued."
            rows={customer.cards}
            columns={[
              { label: 'Card', render: k => <>{labelize(k.card_type)} · {k.variant}<div className="sub">{k.network}</div></> },
              { label: 'Number', mono: true, render: k => k.card_number_masked },
              { label: 'Expiry', mono: true, render: k => k.expiry },
              { label: 'Limit', mono: true, right: true, render: k => k.card_type === 'CREDIT' ? fmtMoney(k.credit_limit) : '—' },
              { label: 'Outstanding', mono: true, right: true, render: k => k.card_type === 'CREDIT' ? fmtMoney(k.outstanding) : '—' },
              { label: 'Min Due / Due Date', render: k => k.card_type === 'CREDIT' ? <><span className="mono">{fmtMoney(k.minimum_due)}</span><div className="sub">{fmtDate(k.due_date)}</div></> : '—' },
              { label: 'Rewards', mono: true, right: true, render: k => k.reward_points ? k.reward_points.toLocaleString('en-IN') : '—' },
              { label: 'Status', render: k => <StatusBadge value={k.status} /> }
            ]}
          />
        </div>
      )}

      {tab === 'insurance' && (
        <div className="card" style={{ padding: '6px 8px' }}>
          <DataTable
            empty="No insurance policies. Consider a protection needs discussion (G2 → Life / Health Insurance)."
            rows={customer.insurance}
            columns={[
              { label: 'Policy', render: i => <>{i.plan_name}<div className="sub mono">{i.policy_id}</div></> },
              { label: 'Type', render: i => labelize(i.policy_type) },
              { label: 'Insurer', render: i => i.insurer },
              { label: 'Sum Assured', mono: true, right: true, render: i => fmtMoney(i.sum_assured) },
              { label: 'Premium', mono: true, right: true, render: i => <>{fmtMoney(i.premium)}<div className="sub">{labelize(i.premium_frequency)}</div></> },
              { label: 'Renewal', render: i => fmtDate(i.renewal_date) },
              { label: 'Nominee', render: i => i.nominee },
              { label: 'Status', render: i => <StatusBadge value={i.status} /> }
            ]}
          />
        </div>
      )}

      {tab === 'investments' && (
        <div className="card" style={{ padding: '6px 8px' }}>
          <DataTable
            empty="No investments with the bank."
            rows={customer.investments}
            columns={[
              { label: 'Scheme', render: v => <>{v.scheme_name}<div className="sub mono">{v.investment_id}</div></> },
              { label: 'Type', render: v => labelize(v.investment_type) },
              { label: 'Since', render: v => fmtDate(v.start_date) },
              { label: 'SIP', mono: true, right: true, render: v => v.sip_amount ? `${fmtMoney(v.sip_amount)}/mo` : '—' },
              { label: 'Invested', mono: true, right: true, render: v => fmtMoney(v.invested_amount) },
              { label: 'Current Value', mono: true, right: true, render: v => <b>{fmtMoney(v.current_value)}</b> },
              {
                label: 'Return', mono: true, right: true, render: v => {
                  const ret = v.invested_amount ? ((v.current_value - v.invested_amount) / v.invested_amount) * 100 : 0;
                  return <span style={{ color: ret < 0 ? 'var(--risk-high)' : 'var(--risk-low)' }}>{ret >= 0 ? '+' : ''}{ret.toFixed(1)}%</span>;
                }
              }
            ]}
          />
        </div>
      )}

      {tab === 'transactions' && (
        <>
          <div className="history-filters">
            <select value={txnFilter} onChange={e => setTxnFilter(e.target.value)}>
              <option value="ALL">All transactions</option>
              <option value="CREDIT">Credits only</option>
              <option value="DEBIT">Debits only</option>
            </select>
          </div>
          <div className="card" style={{ padding: '6px 8px' }}>
            <DataTable
              empty="No transactions in the last 90 days."
              rows={transactions}
              columns={[
                { label: 'Date', mono: true, render: t => t.date },
                { label: 'Description', render: t => <>{t.description}<div className="sub mono">{t.txn_id} · {t.account_id}</div></> },
                { label: 'Channel', render: t => <span className="badge badge-neutral">{t.channel}</span> },
                { label: 'Debit', mono: true, right: true, render: t => t.txn_type === 'DEBIT' ? <span style={{ color: 'var(--risk-high)' }}>{fmtMoney(t.amount)}</span> : '' },
                { label: 'Credit', mono: true, right: true, render: t => t.txn_type === 'CREDIT' ? <span style={{ color: 'var(--risk-low)' }}>{fmtMoney(t.amount)}</span> : '' },
                { label: 'Balance', mono: true, right: true, render: t => fmtMoney(t.balance_after) }
              ]}
            />
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="card" style={{ padding: '6px 8px' }}>
          <DataTable
            empty="No analyses recorded yet for this customer."
            rows={customer.history}
            columns={[
              { label: 'Date', mono: true, render: h => h.date },
              { label: 'Module', render: h => labelize(h.module) },
              { label: 'Summary', render: h => h.result },
              { label: 'Status', render: h => <StatusBadge value={h.status} /> }
            ]}
          />
        </div>
      )}
    </>
  );
}
