import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="card empty-state">
      <div className="glyph">◌</div>
      <div style={{ fontWeight: 600, color: 'var(--text-900)', marginBottom: '14px' }}>This page doesn't exist.</div>
      <button className="btn btn-ghost" onClick={() => navigate('/')}>Back to overview</button>
    </div>
  );
}
