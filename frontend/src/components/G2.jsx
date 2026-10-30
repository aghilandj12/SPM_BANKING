import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import CustomerSelect from './CustomerSelect';
import AiSourceBadge from './AiSourceBadge';
import { useCustomers } from '../context/CustomersContext';

export default function G2() {
  const { customers, loading } = useCustomers();
  // Pre-fill from links such as "Prepare pitch" in the Action Center
  const [searchParams] = useSearchParams();
  const initialAmount = Number(searchParams.get('amount'));
  const [customerId, setCustomerId] = useState(searchParams.get('customer') || '');
  const [loanType, setLoanType] = useState(searchParams.get('product') || 'Home Loan');
  const [amount, setAmount] = useState(Number.isFinite(initialAmount) && initialAmount > 0 ? initialAmount : 2500000);
  
  const [results, setResults] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState(null);


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
    if (!Number.isFinite(amount) || amount <= 0) {
      setAiError('Enter an amount greater than zero.');
      return;
    }
    
    setResults(null);
    setAiError(null);
    setIsGeneratingAI(true);
    
    try {
      const response = await api.runG2(customerId, {
        productType: loanType,
        requestedAmount: amount
      });
      
      if (response.data.success) {
        setResults(response.data.data);
      } else {
        setAiError(response.data.message || 'Unable to connect to counselling AI service.');
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setAiError(err.response.data.message);
      } else {
        setAiError('Unable to connect to counselling AI service. Please try again.');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field-row" style={{ margin: 0, flex: 2, minWidth: '220px' }}>
            <label htmlFor="g2-customer">Select Customer</label>
            <CustomerSelect id="g2-customer" value={customerId} onChange={setCustomerId} />
          </div>
          
          <div className="field-row" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
            <label>Product</label>
            <select value={loanType} onChange={e => setLoanType(e.target.value)}>
              <optgroup label="Loans">
                <option>Home Loan</option><option>Personal Loan</option><option>Education Loan</option>
                <option>Business Loan</option><option>Vehicle Loan</option><option>Gold Loan</option>
              </optgroup>
              <optgroup label="Accounts & Deposits">
                <option>Savings Account</option><option>Current Account</option>
                <option>Fixed Deposit</option><option>Recurring Deposit</option>
              </optgroup>
              <optgroup label="Cards">
                <option>Credit Card</option>
              </optgroup>
              <optgroup label="Insurance & Investments">
                <option>Life Insurance</option><option>Health Insurance</option><option>Home Insurance</option><option>Mutual Fund / SIP</option>
              </optgroup>
            </select>
          </div>
          <div className="field-row" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
            <label>Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} step="10000" min="1" />
          </div>
          
          <div style={{ margin: 0, width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
             <button className="btn btn-primary" style={{ padding: '10px 24px', width: 'auto' }} onClick={handleRun} disabled={isGeneratingAI || !customerId}>
               {isGeneratingAI ? 'Preparing...' : 'Prepare Counselling'}
             </button>
          </div>
        </div>
      </div>

      {isGeneratingAI && (
        <div className="ai-panel">
          <div className="loading-line">
            <span className="spinner"></span> Preparing Counselling Brief...
          </div>
        </div>
      )}

      {aiError && (
        <div className="card" style={{borderColor: 'var(--risk-high)', marginBottom: '16px'}}>
          <div style={{color: 'var(--risk-high)', fontWeight: 'bold'}}>Error</div>
          <div>{aiError}</div>
        </div>
      )}

      {results && (
        <div id="g2Results">
          <div style={{ marginBottom: '12px' }}><AiSourceBadge provider={results._provider} /></div>
          <AiSourceBadge provider={results._provider} block />
          <div className="grid cols-2" style={{alignItems: 'start', marginBottom: '16px'}}>
            <div className="card">
              <div className="card-title">Customer Snapshot</div>
              <ul className="checklist">
                {results.customerSnapshot.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
            <div className="card">
              <div className="card-title">Product Considerations <span className="badge badge-neutral">RAG context</span></div>
              <ul className="checklist">
                {results.productConsiderations.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          </div>
          
          <div className="grid cols-2" style={{alignItems: 'start', marginBottom: '16px'}}>
            <div className="card">
              <div className="card-title">Talking Points</div>
              <ul className="findings-list">
                {results.talkingPoints.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
            <div className="card">
              <div className="card-title">Questions to Ask</div>
              <ul className="qa-list">
                {results.questionsToAsk.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          </div>
          
          <div className="grid cols-2" style={{alignItems: 'start'}}>
            <div className="card">
              <div className="card-title">Document Checklist</div>
              <ul className="checklist">
                {results.documentChecklist.map((item, i) => (
                  <li key={i}><span className="check-yes">✓</span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="card-title">Potential Concerns</div>
              <ul className="findings-list">
                {results.potentialConcerns.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
