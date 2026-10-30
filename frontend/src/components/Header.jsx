import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Landmark, BellRing, ShieldAlert, MessageSquare, FileText, TrendingUp, History } from 'lucide-react';

export default function Header({ user, onLogout }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const name = user?.name || 'Ramesh Krishnan';
  const displayTitle = name.charAt(0).toUpperCase() + name.slice(1);
  const initials = name.substring(0, 2).toUpperCase();

  return (
    <header className="header-nav">
      <div className="header-content">
        <div className="header-brand">
        <div className="brand-mark">B</div>
        <div>
          <div className="brand-name">Banking</div>
          <div className="brand-sub">AI</div>
        </div>
      </div>

      <nav className="header-links">
        <NavLink to="/" className={`header-link ${isActive('/') ? 'active' : ''}`}>
          <LayoutDashboard size={16} /> Overview
        </NavLink>
        <NavLink to="/customers" className={`header-link ${isActive('/customers') ? 'active' : ''}`}>
          <Users size={16} /> Customers
        </NavLink>
        <NavLink to="/actions" className={`header-link ${isActive('/actions') ? 'active' : ''}`}>
          <BellRing size={16} /> Action Center
        </NavLink>
        <NavLink to="/products" className={`header-link ${isActive('/products') ? 'active' : ''}`}>
          <Landmark size={16} /> Products
        </NavLink>

        <div className="header-dropdown">
          <span className={`header-link ${(location.pathname.startsWith('/g')) ? 'active' : ''}`}>
            AI Modules <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: '4px'}}><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
          <div className="dropdown-menu">
            <NavLink to="/g1" className={`dropdown-item ${isActive('/g1') ? 'active' : ''}`}>
              <ShieldAlert size={15} className="dd-icon" />
              <div>
                <div className="dd-title">Credit Exposure (G1)</div>
                <div className="dd-sub">AI-powered risk summary</div>
              </div>
            </NavLink>
            <NavLink to="/g2" className={`dropdown-item ${isActive('/g2') ? 'active' : ''}`}>
              <MessageSquare size={15} className="dd-icon" />
              <div>
                <div className="dd-title">Loan Counselling (G2)</div>
                <div className="dd-sub">Pre-meeting talk track</div>
              </div>
            </NavLink>
            <NavLink to="/g3" className={`dropdown-item ${isActive('/g3') ? 'active' : ''}`}>
              <FileText size={15} className="dd-icon" />
              <div>
                <div className="dd-title">Document Intel (G3)</div>
                <div className="dd-sub">Extract facts from artifacts</div>
              </div>
            </NavLink>
            <NavLink to="/g4" className={`dropdown-item ${isActive('/g4') ? 'active' : ''}`}>
              <TrendingUp size={15} className="dd-icon" />
              <div>
                <div className="dd-title">Limit Increase (G4)</div>
                <div className="dd-sub">Deterministic decisions</div>
              </div>
            </NavLink>
          </div>
        </div>

        <NavLink to="/history" className={`header-link ${isActive('/history') ? 'active' : ''}`}>
          <History size={16} /> History
        </NavLink>
      </nav>

      <div className="header-actions">
        <div className="header-rm">
          <div className="rm-avatar">{initials}</div>
          <div className="rm-info">
            <div className="rm-name">{displayTitle}</div>
            <div className="rm-role">Relationship Manager</div>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout}>Sign Out</button>
      </div>
      </div>
    </header>
  );
}
