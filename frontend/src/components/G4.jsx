import React, { useState } from 'react';
import { api } from '../services/api';
import AiSourceBadge from './AiSourceBadge';
import CustomerSelect from './CustomerSelect';
import { useCustomers } from '../context/CustomersContext';
import { decisionIcon, decisionLabel, fmtINR, fmtPct, fmtX } from '../utils';

export default function G4() {
  const { customers, loading } = useCustomers();
  const [customerId, setCustomerId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);


  React.useEffect(() => {
    if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  // Keep the selection valid (e.g. an unknown id passed in a link)
  React.useEffect(() => {
    if (customers.length > 0 && customerId && !customers.find(c => String(c.id) === String(customerId))) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  const handleRun = async () => {
    if (!customerId) return;
    setError(null);
    setIsProcessing(true);
    setResults(null);

    try {
      const response = await api.runG4(customerId);
      setResults(response.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('An unexpected error occurred during limit decision generation.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field-row" style={{ margin: 0, flex: 2, minWidth: '220px' }}>
            <label htmlFor="g4-customer">Select Customer</label>
            <CustomerSelect id="g4-customer" value={customerId} onChange={setCustomerId} />
          </div>
          <div style={{ margin: 0 }}>
             <button className="btn btn-primary" style={{ padding: '10px 20px' }} onClick={handleRun} disabled={isProcessing || !customerId}>
               {isProcessing ? 'Analyzing...' : 'Analyze Limit Increase'}
             </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--risk-high-bg)', color: 'var(--risk-high)', borderRadius: '8px', border: '1px solid #ef9a9a' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {results && (
        <div id="g4Results" style={{ marginTop: '24px' }}>
          <div className="decision-banner" style={{
            background: results.decision.result === 'ASK' ? 'var(--risk-low-bg)' : results.decision.result === 'ASK_WITH_CONDITIONS' ? 'var(--risk-medium-bg)' : 'var(--risk-high-bg)',
            color: results.decision.result === 'ASK' ? 'var(--risk-low)' : results.decision.result === 'ASK_WITH_CONDITIONS' ? 'var(--risk-medium)' : 'var(--risk-high)'
          }}>
            <div className="decision-icon">{decisionIcon(results.decision.result)}</div>
            <div>
              <div style={{fontWeight: 700, letterSpacing: '.05em', marginBottom: '2px'}}>DETERMINISTIC DECISION</div>
              <div style={{fontSize: '22px', fontWeight: 600, fontFamily: 'IBM Plex Mono'}}>
                {results.decision.result === 'ASK_WITH_CONDITIONS' ? 'ASK WITH CONDITIONS' : results.decision.result.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div className="grid cols-2" style={{marginTop: '24px'}}>
            <div className="card">
              <div className="card-title">Current Exposure</div>
              <div className="metric-grid">
                <div className="metric-box"><div className="label">Credit Limit</div><div className="value">{fmtINR(results.financialFacts.creditLimit)}</div></div>
                <div className="metric-box"><div className="label">Outstanding</div><div className="value">{fmtINR(results.financialFacts.outstanding)}</div></div>
                <div className="metric-box"><div className="label">Utilization</div><div className="value">{fmtPct(results.financialFacts.utilizationPct)}</div></div>
                <div className="metric-box"><div className="label">Available Credit</div><div className="value">{fmtINR(results.financialFacts.availableCredit)}</div></div>
                <div className="metric-box"><div className="label">Collateral</div><div className="value">{fmtINR(results.financialFacts.collateralValue)}</div></div>
                <div className="metric-box"><div className="label">Coverage</div><div className="value">{fmtX(results.financialFacts.collateralCoverage)}</div></div>
                <div className="metric-box"><div className="label">Annual Income</div><div className="value">{fmtINR(results.financialFacts.annualIncome)}</div></div>
                <div className="metric-box"><div className="label">Existing Exposure</div><div className="value">{fmtINR(results.financialFacts.existingLoanExposure)}</div></div>
              </div>
            </div>
            
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div className="card-title" style={{ marginBottom: '8px' }}>Why? (Deterministic Factors)</div>
                <div className="factor-list">
                  {results.decision.factors && results.decision.factors.map((f, i) => (
                    <div className="factor-row" key={i}>
                      <span className="fname">{f.factor}: {f.value}</span>
                      <b style={{ 
                        color: f.impact === 'POSITIVE' ? 'var(--risk-low)' : f.impact === 'CAUTION' ? 'var(--risk-medium)' : 'var(--risk-high)',
                        fontSize: '0.85em'
                      }}>→ {f.impact}</b>
                      <div style={{ width: '100%', fontSize: '0.9em', color: '#666', marginTop: '4px' }}>{f.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card-title">AI Explanation <AiSourceBadge provider={results.aiExplanation?._provider} /></div>
            <AiSourceBadge provider={results.aiExplanation?._provider} block />
            {results.aiErrorMsg ? (
              <div style={{ color: 'var(--risk-high)', padding: '12px', backgroundColor: 'var(--risk-high-bg)', borderRadius: '4px' }}>
                {results.aiErrorMsg}
              </div>
            ) : results.aiExplanation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {results.aiExplanation.summary && (
                  <p style={{ margin: 0, lineHeight: 1.5, fontSize: '1.05em' }}>{results.aiExplanation.summary}</p>
                )}
                
                {results.aiExplanation.reasoning && results.aiExplanation.reasoning.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', color: '#4A443D', marginBottom: '8px' }}>Reasoning</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {results.aiExplanation.reasoning.map((item, i) => <li key={i} style={{marginBottom: '4px'}}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {results.aiExplanation.conditions && results.aiExplanation.conditions.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', color: 'var(--risk-medium)', marginBottom: '8px' }}>Conditions</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {results.aiExplanation.conditions.map((item, i) => <li key={i} style={{marginBottom: '4px'}}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {results.aiExplanation.openQuestions && results.aiExplanation.openQuestions.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', color: '#0277bd', marginBottom: '8px' }}>Open Questions</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {results.aiExplanation.openQuestions.map((item, i) => <li key={i} style={{marginBottom: '4px'}}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {results.aiExplanation.recommendedNextSteps && results.aiExplanation.recommendedNextSteps.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', color: 'var(--risk-low)', marginBottom: '8px' }}>Recommended Next Steps</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {results.aiExplanation.recommendedNextSteps.map((item, i) => <li key={i} style={{marginBottom: '4px'}}>{item}</li>)}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: '16px', fontSize: '0.85em', color: '#757575', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                  Note: This is a decision-support result. The final lending decision remains with the authorized banking process/personnel.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
