import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import CustomerSelect from './CustomerSelect';
import AiSourceBadge from './AiSourceBadge';
import { calcMetrics, riskEngine } from '../utils';
import { useCustomers } from '../context/CustomersContext';

export default function G3() {
  const { loading } = useCustomers();
  const [customerId, setCustomerId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const notFoundSpan = <span style={{color: '#999'}}>Not found in document</span>;
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const formatEvidenceValue = (field, value) => {
    if (value === null || value === undefined || value === '') return 'Not recorded';
    if (field === 'monthly_income' && typeof value === 'number') {
      return `₹${value.toLocaleString('en-IN')}`;
    }
    return String(value);
  };

  const reviewStatusColor = (status) => {
    if (status === 'MATCH' || status === 'NO_MISMATCHES_FOUND') return 'var(--risk-low)';
    if (status === 'MISMATCH' || status === 'MISMATCHES_FOUND') return 'var(--risk-high)';
    return 'var(--risk-medium)';
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      setError('Please select a document to upload.');
      return;
    }
    setError(null);
    setIsProcessing(true);
    setResult(null);

    const formData = new FormData();
    formData.append('document', selectedFile);
    if (customerId) {
      formData.append('customerId', customerId);
    }

    try {
      const response = await api.runG3(formData);
      setResult(response.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('An unexpected error occurred during extraction.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="field-row" style={{ margin: 0 }}>
            <label htmlFor="g3-customer">Compare against customer profile</label>
            <CustomerSelect id="g3-customer" value={customerId} onChange={setCustomerId} emptyLabel="No customer selected" />
            <small style={{ color: 'var(--text-600)' }}>Select a profile to check extracted facts against existing customer data.</small>
          </div>
          
          <div className="field-row" style={{ margin: 0, flex: 1 }}>
            <label style={{ marginBottom: '12px', display: 'block', fontWeight: 600, fontSize: '14px', color: 'var(--text-900)' }}>
              Upload Document for Extraction
            </label>
            <div 
              onClick={handleClickUpload}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                width: '100%',
                border: '2px dashed var(--blue-500)',
                borderRadius: '12px',
                backgroundColor: 'var(--gold-100)',
                padding: '40px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange} 
                accept=".pdf,.docx,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
              />
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--blue-600)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div>
                {selectedFile ? (
                  <div style={{ color: 'var(--navy-800)', fontWeight: 600, fontSize: '15px' }}>
                    <span style={{ marginRight: '8px', color: 'var(--risk-low)' }}>✓</span>
                    {selectedFile.name}
                  </div>
                ) : (
                  <>
                    <div style={{ color: 'var(--navy-800)', fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>Click to upload or drag and drop</div>
                    <div style={{ color: 'var(--text-600)', fontSize: '13px' }}>Supports PDF, DOCX, JPG, PNG (Max 5MB)</div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div style={{ margin: 0, display: 'flex', justifyContent: 'flex-end' }}>
             <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '14px', width: 'auto' }} onClick={handleExtract} disabled={isProcessing || !selectedFile}>
               {isProcessing ? 'Analyzing Document...' : 'Extract Information'}
             </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--risk-high-bg)', color: 'var(--risk-high)', borderRadius: '8px', border: '1px solid #ef9a9a' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="ai-results" style={{ marginTop: '24px' }}>
          
          <div className="result-card" style={{ marginBottom: '24px', padding: '24px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <h3 style={{ marginTop: 0, color: '#4A443D', marginBottom: '16px' }}>Document Processing Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <strong>File Name:</strong> {result.document?.fileName}
              </div>
              <div>
                <strong>File Type:</strong> {result.document?.fileType}
              </div>
              <div>
                <strong>OCR Used:</strong> {result.document?.ocrUsed ? 'Yes' : 'No'}
              </div>
              {result.customerMatch && (
                <div>
                  <strong>Customer Match:</strong> 
                  <span style={{ 
                    marginLeft: '8px',
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.85em',
                    backgroundColor: result.customerMatch.status === 'MATCHED' ? 'var(--risk-low-bg)' : (result.customerMatch.status === 'REVIEW_REQUIRED' ? 'var(--risk-medium-bg)' : 'var(--border)'),
                    color: result.customerMatch.status === 'MATCHED' ? 'var(--risk-low)' : (result.customerMatch.status === 'REVIEW_REQUIRED' ? 'var(--risk-medium)' : '#6B6259')
                  }}>
                    {result.customerMatch.status.replace('_', ' ')}
                  </span>
                  <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>{result.customerMatch.message}</div>
                </div>
              )}
            </div>
          </div>

          {result.evidenceReview && (
            <section className="result-card" aria-labelledby="evidence-review-title" style={{ marginBottom: '24px', padding: '24px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <h3 id="evidence-review-title" style={{ margin: 0, color: '#4A443D' }}>Evidence Review</h3>
                <span style={{ color: reviewStatusColor(result.evidenceReview.status), fontWeight: 700 }}>
                  {result.evidenceReview.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p style={{ color: 'var(--text-600)', marginBottom: '16px' }}>
                Source: {result.evidenceReview.documentSource} · {result.evidenceReview.extractionMethod}
              </p>
              <p style={{ backgroundColor: 'var(--gold-100)', padding: '12px', borderRadius: '8px', lineHeight: 1.5, marginBottom: '20px' }}>
                {result.evidenceReview.evidenceNote}
              </p>

              {result.evidenceReview.comparisons.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {result.evidenceReview.comparisons.map((comparison) => (
                    <div key={comparison.field} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', alignItems: 'start', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <strong>{comparison.label}</strong>
                      <div><small style={{ display: 'block', color: 'var(--text-600)' }}>Uploaded document</small>{formatEvidenceValue(comparison.field, comparison.extractedValue)}</div>
                      <div><small style={{ display: 'block', color: 'var(--text-600)' }}>Customer profile</small>{formatEvidenceValue(comparison.field, comparison.customerRecordValue)}</div>
                      <strong style={{ color: reviewStatusColor(comparison.status) }}>{comparison.status.replace(/_/g, ' ')}</strong>
                    </div>
                  ))}
                </div>
              )}

              <strong style={{ display: 'block', marginBottom: '8px' }}>RM verification suggestions</strong>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {result.evidenceReview.verificationActions.map((action, index) => <li key={index} style={{ marginBottom: '6px' }}>{action}</li>)}
              </ul>
            </section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            
            <div className="result-card" style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e8eaf6', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#4A443D' }}>Extracted Facts</h3>
                {result.extractedData?.document_type && (
                  <span style={{ backgroundColor: '#F4EBE1', color: '#C08552', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                    {result.extractedData.document_type.replace('_', ' ')}
                  </span>
                )}
              </div>
              
              {result.extractedData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Customer Information */}
                  {result.extractedData.customer && Object.keys(result.extractedData.customer).length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: '#4A443D', marginBottom: '8px', fontSize: '14px' }}>Customer Information</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(result.extractedData.customer).map(([key, value]) => (
                          <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
                            <span style={{ color: '#6B6259', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</span> 
                            <span style={{ fontWeight: 500 }}>
                              {typeof value === 'number' && key.includes('income') ? `₹${value.toLocaleString('en-IN')}` : value}
                            </span>
                          </div>
                        ))}
                        {result.extractedData.annual_income && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
                            <span style={{ color: '#6B6259', textTransform: 'capitalize' }}>Annual Income:</span> 
                            <span style={{ fontWeight: 500 }}>₹{result.extractedData.annual_income.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Document-Specific Facts */}
                  {result.extractedData.document_facts && Object.keys(result.extractedData.document_facts).length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: '#4A443D', marginBottom: '8px', fontSize: '14px' }}>Document-Specific Facts</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(result.extractedData.document_facts).map(([key, value]) => (
                          <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
                            <span style={{ color: '#6B6259', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</span> 
                            <span style={{ fontWeight: 500 }}>
                              {typeof value === 'number' && (key.includes('amount') || key.includes('balance') || key.includes('valuation') || key.includes('income') || key.includes('deductions')) 
                                ? `₹${value.toLocaleString('en-IN')}` 
                                : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Important Dates */}
                  {result.extractedData.dates && result.extractedData.dates.length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: '#4A443D', marginBottom: '8px', fontSize: '14px' }}>Important Dates</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {result.extractedData.dates.map((d, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
                            <span style={{ color: '#6B6259' }}>{d.label}:</span> 
                            <span style={{ fontWeight: 500 }}>{formatDate(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Submitted Documents */}
                  {result.extractedData.submitted_documents && result.extractedData.submitted_documents.length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: '#4A443D', marginBottom: '8px', fontSize: '14px' }}>Submitted Documents</strong>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: '#333' }}>
                        {result.extractedData.submitted_documents.map((doc, i) => (
                          <li key={i}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              ) : (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No structured facts could be extracted.</div>
              )}
            </div>

            <div className="result-card" style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <h3 style={{ marginTop: 0, color: '#4A443D', borderBottom: '2px solid #e8eaf6', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>AI Summary <AiSourceBadge provider={result.extractedData?._provider} /></h3>
              <AiSourceBadge provider={result.extractedData?._provider} block />
              {result.extractedData && result.extractedData.summary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                  
                  <div>
                    <strong style={{ display: 'block', color: '#6B6259', marginBottom: '8px' }}>Overview</strong>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>{result.extractedData.summary}</p>
                  </div>
                  
                  {result.extractedData.key_findings && result.extractedData.key_findings.length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: '#C08552', marginBottom: '8px' }}>Key Findings</strong>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {result.extractedData.key_findings.map((item, i) => <li key={i} style={{marginBottom: '4px'}}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {result.extractedData.missing_information && result.extractedData.missing_information.length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: '#e65100', marginBottom: '8px' }}>Missing Information</strong>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {result.extractedData.missing_information.map((item, i) => <li key={i} style={{marginBottom: '4px'}}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {result.extractedData.attention_flags && result.extractedData.attention_flags.length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: 'var(--risk-high)', marginBottom: '8px' }}>Attention Flags</strong>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--risk-high)' }}>
                        {result.extractedData.attention_flags.map((item, i) => <li key={i} style={{marginBottom: '4px'}}><strong>{item}</strong></li>)}
                      </ul>
                    </div>
                  )}
                  
                  {result.extractedData.open_questions && result.extractedData.open_questions.length > 0 && (
                    <div>
                      <strong style={{ display: 'block', color: 'var(--risk-low)', marginBottom: '8px' }}>Open Questions</strong>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {result.extractedData.open_questions.map((item, i) => <li key={i} style={{marginBottom: '4px'}}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                </div>
              ) : (
                <div style={{ color: '#666', fontStyle: 'italic' }}>AI summary generation failed.</div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
