import React from 'react';
import { useLocation } from 'react-router-dom';

export default function Topbar() {
  const location = useLocation();
  
  let title = "Overview";
  if (location.pathname === '/customers') {
    title = "Customers";
  } else if (location.pathname.startsWith('/customer-360')) {
    title = "Customer 360";
  } else if (location.pathname === '/actions') {
    title = "RM Action Center";
  } else if (location.pathname === '/products') {
    title = "Bank Products";
  } else if (location.pathname === '/g1') {
    title = "Credit Exposure Brief (G1)";
  } else if (location.pathname === '/g2') {
    title = "Loan Counselling Prep (G2)";
  } else if (location.pathname === '/g3') {
    title = "Document Intelligence (G3)";
  } else if (location.pathname === '/g4') {
    title = "Limit Increase Assistant (G4)";
  } else if (location.pathname === '/history') {
    title = "Analysis History";
  } else if (location.pathname === '/settings') {
    title = "Settings";
  }

  return (
    <div className="topbar">
      <div className="topbar-content">
        <div>
          <h1>{title}</h1>
        </div>
        <div className="breadcrumb"></div>
      </div>
    </div>
  );
}
