import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerRisk, badgeClass, healthBadgeClass, fmtINR } from '../utils';
import { useCustomers } from '../context/CustomersContext';

export default function CustomersList() {
  const navigate = useNavigate();
  const { customers, loading, error, reload } = useCustomers();

  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  if (loading) return <div>Loading...</div>;
  if (error) return (
    <div className="card empty-state">
      <div style={{ marginBottom: '12px' }}>{error}</div>
      <button className="btn btn-ghost" onClick={reload}>Retry</button>
    </div>
  );

  const filteredCustomers = customers.filter(c => {
    const r = customerRisk(c);
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = (c.name || '').toLowerCase().includes(term) || String(c.id).includes(term);
    const matchesRisk = riskFilter === 'ALL' || r.level === riskFilter;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    
    return matchesSearch && matchesRisk && matchesStatus;
  });

  return (
    <>
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field-row" style={{ margin: 0, flex: 2, minWidth: '200px' }}>
            <label>Search Name or ID</label>
            <input 
              type="text" 
              placeholder="e.g. Rajesh or 100100" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="field-row" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
            <label>Risk Level</label>
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
              <option value="ALL">All Risks</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>
          <div className="field-row" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
            <label>Account Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Dormant">Dormant</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{padding: '6px 8px'}}>
        <table>
        <thead>
          <tr><th>Customer</th><th>ID</th><th>Credit Limit</th><th>Outstanding</th><th>Risk</th><th>Health</th><th>Alerts</th><th>Status</th></tr>
        </thead>
        <tbody>
          {filteredCustomers.length === 0 ? (
            <tr><td colSpan="8" style={{textAlign: 'center', padding: '30px', color: '#888'}}>No customers match the selected filters.</td></tr>
          ) : (
            filteredCustomers.map(c => {
              const r = customerRisk(c);
            return (
              <tr key={c.id} className="row-link" onClick={() => navigate(`/customer-360/${c.id}`)}>
                <td>{c.name}</td>
                <td className="mono">{c.id}</td>
                <td className="mono">{fmtINR(c.creditLimit)}</td>
                <td className="mono">{fmtINR(c.outstanding)}</td>
                <td><span className={`badge ${badgeClass(r.level)}`}>{r.level}</span></td>
                <td>{c.healthBand ? <span className={`badge ${healthBadgeClass(c.healthBand)}`}>{c.healthScore}</span> : '—'}</td>
                <td>
                  {c.alertCounts?.HIGH > 0 && <span className="badge badge-high" style={{ marginRight: '4px' }}>{c.alertCounts.HIGH}</span>}
                  {c.alertCounts?.MEDIUM > 0 && <span className="badge badge-medium">{c.alertCounts.MEDIUM}</span>}
                  {!c.alertCounts?.HIGH && !c.alertCounts?.MEDIUM && <span style={{ color: 'var(--text-400)' }}>—</span>}
                </td>
                <td><span className={`status-dot ${c.status === 'Active' ? 'status-active' : 'status-dormant'}`}></span>{c.status}</td>
              </tr>
            );
          })
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}
