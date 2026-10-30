import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  
  const [typeFilter, setTypeFilter] = useState('All');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await api.getHistory({ analysisType: typeFilter });
      setHistory(response.data.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [typeFilter]);

  const fetchDetail = async (id) => {
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedDetail(null);
      return;
    }
    
    setSelectedId(id);
    setLoadingDetail(true);
    setSelectedDetail(null);
    try {
      const response = await api.getHistoryDetail(id);
      setSelectedDetail(response.data.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load analysis detail.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatType = (type) => {
    const map = {
      'G1_CREDIT_EXPOSURE': 'Credit Exposure',
      'G2_LOAN_COUNSELLING': 'Counselling',
      'G3_DOCUMENT_SUMMARY': 'Document Summary',
      'G4_LIMIT_INCREASE': 'Limit Increase'
    };
    return map[type] || type;
  };

  const renderSnapshotData = (key, value) => {
    const formatKey = (k) => {
      if (!k) return '';
      return k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, str => str.toUpperCase());
    };
    
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={key || 'root'} style={{ marginBottom: key ? '16px' : '0', padding: key ? '16px' : '0', backgroundColor: key ? 'var(--bg)' : 'transparent', borderRadius: '8px', border: key ? '1px solid var(--border)' : 'none' }}>
          {key && <h4 style={{ margin: '0 0 16px 0', color: 'var(--navy-900)', fontSize: '16px' }}>{formatKey(key)}</h4>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {Object.entries(value).map(([k, v]) => {
               if (typeof v === 'object') {
                 return <div key={k} style={{ gridColumn: '1 / -1' }}>{renderSnapshotData(k, v)}</div>;
               }
               return renderSnapshotData(k, v);
            })}
          </div>
        </div>
      );
    }
    
    if (Array.isArray(value)) {
      return (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{formatKey(key)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {value.map((item, idx) => {
              if (typeof item === 'object' && item !== null) {
                return (
                  <div key={idx} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    {Object.entries(item).map(([k, v]) => {
                      // Add specific coloring for 'impact' to make it pop
                      let valColor = 'var(--text-900)';
                      if (k.toLowerCase() === 'impact') {
                         if (v === 'POSITIVE') valColor = 'var(--risk-low)';
                         if (v === 'CAUTION') valColor = 'var(--risk-medium)';
                         if (v === 'NEGATIVE') valColor = 'var(--risk-high)';
                      }
                      
                      return (
                        <div key={k}>
                          <span style={{ fontSize: '11px', color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>{formatKey(k)}</span>
                          <span style={{ fontSize: '14px', color: valColor, fontWeight: k.toLowerCase() === 'impact' ? '700' : '500' }}>
                            {String(v)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                );
              }
              return (
                <div key={idx} style={{ fontSize: '15px', color: 'var(--text-900)' }}>
                  • {String(item)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div key={key} style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{formatKey(key)}</span>
        <span style={{ fontSize: '15px', color: 'var(--text-900)', fontWeight: '600' }}>
          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
        </span>
      </div>
    );
  };

  if (loading && history.length === 0) return <div>Loading history...</div>;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Filters */}
      <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px 20px' }}>
        <strong style={{ color: 'var(--navy-900)' }}>Filter by Type:</strong>
        <select 
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '15px', color: 'var(--text-900)', outline: 'none', backgroundColor: 'var(--bg)' }}
        >
          <option value="All">All</option>
          <option value="G1_CREDIT_EXPOSURE">G1 Credit Exposure</option>
          <option value="G2_LOAN_COUNSELLING">G2 Counselling</option>
          <option value="G3_DOCUMENT_SUMMARY">G3 Document Summary</option>
          <option value="G4_LIMIT_INCREASE">G4 Limit Increase</option>
        </select>
      </div>

      {error && <div style={{ color: 'var(--risk-high)', padding: '12px', backgroundColor: 'var(--risk-high-bg)', borderRadius: '4px' }}>{error}</div>}

      <div className="card" style={{padding: '6px 8px'}}>
        {history.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '16px 12px', color: 'var(--text-600)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                <th style={{ padding: '16px 12px', color: 'var(--text-600)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                <th style={{ padding: '16px 12px', color: 'var(--text-600)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                <th style={{ padding: '16px 12px', color: 'var(--text-600)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '16px 12px', color: 'var(--text-600)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <React.Fragment key={h._id}>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: selectedId === h._id ? 'var(--bg)' : 'transparent', transition: 'background-color 0.2s' }}>
                    <td className="mono" style={{ padding: '16px 12px', fontSize: '14px', color: 'var(--text-900)' }}>{formatDate(h.createdAt)}</td>
                    <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--blue-600)' }}>{formatType(h.analysisType)}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-900)', fontWeight: 500 }}>
                      {h.customerName} <span style={{ fontSize: '0.85em', color: 'var(--text-400)', marginLeft: '4px' }}>({h.customerId})</span>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span style={{ 
                        padding: '6px 12px', 
                        borderRadius: '100px', 
                        fontSize: '13px',
                        fontWeight: '600',
                        backgroundColor: h.status === 'COMPLETED' ? 'var(--risk-low-bg)' : 'var(--risk-high-bg)',
                        color: h.status === 'COMPLETED' ? 'var(--risk-low)' : 'var(--risk-high)'
                      }}>
                        {h.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <button 
                        onClick={() => fetchDetail(h._id)}
                        style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: selectedId === h._id ? 'var(--navy-900)' : 'var(--blue-600)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', transition: 'background-color 0.2s' }}
                      >
                        {selectedId === h._id ? 'Close' : 'View Snapshot'}
                      </button>
                    </td>
                  </tr>
                  
                  {selectedId === h._id && (
                    <tr>
                      <td colSpan="5" style={{ padding: 0, borderBottom: '2px solid var(--border)' }}>
                        <div style={{ backgroundColor: 'var(--surface)', padding: '32px', boxShadow: 'inset 0 4px 6px -4px rgba(0,0,0,0.05)' }}>
                          {loadingDetail ? (
                            <div style={{ color: 'var(--text-600)' }}>Loading detail snapshot...</div>
                          ) : selectedDetail ? (
                            <div>
                              <h3 style={{ marginTop: 0, color: 'var(--navy-900)', fontSize: '20px', marginBottom: '8px' }}>Analysis Snapshot</h3>
                              <p style={{ color: 'var(--text-600)', fontSize: '15px', marginBottom: '32px', maxWidth: '800px', lineHeight: '1.5' }}>
                                {selectedDetail.summary}
                              </p>
                              
                              <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                {renderSnapshotData(null, selectedDetail.result)}
                              </div>

                              <div style={{ marginTop: '12px', fontSize: '0.8em', color: '#999' }}>
                                Note: This is an immutable historical snapshot. It does not reflect current Customer 360 data.
                              </div>
                            </div>
                          ) : (
                            <div>Detail unavailable.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <div className="glyph" style={{ fontSize: '2em', marginBottom: '10px' }}>◌</div>
            <div>No analyses recorded yet. Run G1-G4 to populate history.</div>
          </div>
        )}
      </div>
    </div>
  );
}
