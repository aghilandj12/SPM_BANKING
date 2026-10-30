import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { customerRisk, badgeClass } from '../utils';
import { useCustomers } from '../context/CustomersContext';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Users, Activity, AlertTriangle, BellRing } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { customers, loading } = useCustomers();
  const [totalAnalyses, setTotalAnalyses] = useState(null);
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    api.getHistory({ limit: 500 }).then(res => setTotalAnalyses(res.data.data?.length ?? 0)).catch(() => setTotalAnalyses(null));
    api.getPortfolioInsights().then(res => setPortfolio(res.data.data)).catch(() => setPortfolio(null));
  }, []);

  if (loading) return <div>Loading...</div>;
  
  const totalCustomers = customers.length;
  
  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const statusCounts = { Active: 0, Dormant: 0 };
  
  customers.forEach(c => {
    const r = customerRisk(c);
    riskCounts[r.level] = (riskCounts[r.level] || 0) + 1;
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  const highRisk = riskCounts.HIGH;
  const recentCustomers = customers.slice(0, 5);

  const riskData = [
    { name: 'High', value: riskCounts.HIGH, fill: 'var(--risk-high)' },
    { name: 'Medium', value: riskCounts.MEDIUM, fill: 'var(--risk-medium)' },
    { name: 'Low', value: riskCounts.LOW, fill: 'var(--risk-low)' }
  ];

  const bands = portfolio?.healthBands || {};
  const healthData = [
    { band: 'Critical', value: bands.CRITICAL || 0, fill: 'var(--risk-high)' },
    { band: 'Watch', value: bands.WATCH || 0, fill: 'var(--risk-medium)' },
    { band: 'Stable', value: bands.STABLE || 0, fill: 'var(--blue-500)' },
    { band: 'Strong', value: bands.STRONG || 0, fill: 'var(--risk-low)' }
  ];

  return (
    <>
      <div className="grid cols-4" style={{marginBottom: '22px'}}>
        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)', borderColor: '#E0E7FF', boxShadow: '0 10px 30px -10px rgba(79, 70, 229, 0.15)' }}>
          <div className="stat-card-header">
            <div className="stat-label" style={{ color: '#4F46E5', fontWeight: '700' }}>Customers in book</div>
            <div className="stat-icon" style={{ backgroundColor: '#FFFFFF', color: '#4F46E5', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.12)' }}><Users size={16} /></div>
          </div>
          <div className="stat-value" style={{ color: '#312E81' }}>{totalCustomers}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F3E8FF 100%)', borderColor: '#E9D5FF', boxShadow: '0 10px 30px -10px rgba(147, 51, 234, 0.15)' }}>
          <div className="stat-card-header">
            <div className="stat-label" style={{ color: '#9333EA', fontWeight: '700' }}>Analyses run</div>
            <div className="stat-icon" style={{ backgroundColor: '#FFFFFF', color: '#9333EA', boxShadow: '0 4px 10px rgba(147, 51, 234, 0.12)' }}><Activity size={16} /></div>
          </div>
          <div className="stat-value" style={{ color: '#581C87' }}>{totalAnalyses ?? '—'}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #FFE4E6 100%)', borderColor: '#FECDD3', boxShadow: '0 10px 30px -10px rgba(225, 29, 72, 0.15)' }}>
          <div className="stat-card-header">
            <div className="stat-label" style={{ color: '#E11D48', fontWeight: '700' }}>High risk accounts</div>
            <div className="stat-icon" style={{ backgroundColor: '#FFFFFF', color: '#E11D48', boxShadow: '0 4px 10px rgba(225, 29, 72, 0.12)' }}><AlertTriangle size={16} /></div>
          </div>
          <div className="stat-value" style={{ color: '#881337' }}>{highRisk}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #DCFCE7 100%)', borderColor: '#BBF7D0', boxShadow: '0 10px 30px -10px rgba(22, 163, 74, 0.15)' }}>
          <div className="stat-card-header">
            <div className="stat-label" style={{ color: '#16A34A', fontWeight: '700' }}>Urgent alerts</div>
            <div className="stat-icon" style={{ backgroundColor: '#FFFFFF', color: '#16A34A', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.12)' }}><BellRing size={16} /></div>
          </div>
          <div className="stat-value" style={{ color: '#14532D', cursor: 'pointer' }} onClick={() => navigate('/actions')}>{portfolio ? (portfolio.alertsBySeverity.HIGH || 0) : '—'}</div>
        </div>
      </div>

      <div className="section-title">Portfolio Overview</div>
      <div className="grid cols-2" style={{marginBottom: '24px', gap: '20px'}}>
        <div className="card" style={{padding: '24px', height: '300px', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top right, rgba(91, 95, 239, 0.12), transparent 250px), linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)', borderColor: '#E0E7FF', boxShadow: '0 10px 30px -10px rgba(79, 70, 229, 0.15)'}}>
          <h3 style={{margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: 'var(--navy-900)'}}>Risk Distribution</h3>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            <div style={{ flex: 1, height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={riskData} 
                    cx="50%" cy="50%" 
                    innerRadius={65} 
                    outerRadius={95} 
                    paddingAngle={0} 
                    dataKey="value"
                    stroke="none"
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '130px', paddingRight: '20px' }}>
              {riskData.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: item.fill }}></div>
                    <span style={{ fontSize: '14px', color: 'var(--text-600)' }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-900)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="card" style={{padding: '24px', height: '300px', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top right, rgba(91, 95, 239, 0.12), transparent 250px), linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)', borderColor: '#E0E7FF', boxShadow: '0 10px 30px -10px rgba(79, 70, 229, 0.15)'}}>
          <h3 style={{margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: 'var(--navy-900)'}}>Relationship Health</h3>
          {portfolio ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(45, 42, 38, 0.12)" />
                <XAxis dataKey="band" axisLine={false} tickLine={false} tick={{fill: 'var(--text-400)', fontSize: 12}} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: 'var(--text-400)', fontSize: 12}} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} formatter={(value) => [`${value} customers`, 'Customers']} cursor={{ fill: 'var(--gold-100)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {healthData.map((entry) => <Cell key={entry.band} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">Loading health scores…</div>}
        </div>
      </div>

      <div className="section-title">Recent Customer Activity</div>
      <div className="card" style={{padding: '6px 8px'}}>
        <table>
          <thead>
            <tr><th>Customer</th><th>ID</th><th>Risk</th><th>Status</th></tr>
          </thead>
          <tbody>
            {recentCustomers.map(c => {
              const r = customerRisk(c);
              return (
                <tr key={c.id} className="row-link" onClick={() => navigate(`/customer-360/${c.id}`)}>
                  <td>{c.name}</td>
                  <td className="mono">{c.id}</td>
                  <td><span className={`badge ${badgeClass(r.level)}`}>{r.level}</span></td>
                  <td><span className={`status-dot ${c.status === 'Active' ? 'status-active' : 'status-dormant'}`}></span>{c.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
