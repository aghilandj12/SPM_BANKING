import React from 'react';

export default function Gauge({ score, level }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = level === 'LOW' ? 'var(--risk-low)' : level === 'MEDIUM' ? 'var(--risk-medium)' : 'var(--risk-high)';
  const circumference = Math.PI * 80;
  const filled = (clamped / 100) * circumference;
  const angleDeg = 180 - (clamped / 100 * 180);
  const rad = angleDeg * Math.PI / 180;
  const x = 100 + 80 * Math.cos(rad);
  const y = 100 - 80 * Math.sin(rad);

  return (
    <svg viewBox="0 0 200 118" className="gauge">
      <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="#E1E7ED" strokeWidth="14" strokeLinecap="round"/>
      <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${filled.toFixed(1)} ${circumference.toFixed(1)}`}/>
      <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="6.5" fill={color} stroke="#fff" strokeWidth="2"/>
      <text x="100" y="88" textAnchor="middle" className="gauge-score">{clamped}</text>
      <text x="100" y="106" textAnchor="middle" className="gauge-label" fill={color}>{level} RISK</text>
    </svg>
  );
}
