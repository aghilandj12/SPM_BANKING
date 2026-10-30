import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Topbar from './components/Topbar';
import Dashboard from './components/Dashboard';
import CustomersList from './components/CustomersList';
import Customer360 from './components/Customer360';
import BankProducts from './components/BankProducts';
import ActionCenter from './components/ActionCenter';
import G1 from './components/G1';
import G2 from './components/G2';
import G3 from './components/G3';
import G4 from './components/G4';
import History from './components/History';
import Settings from './components/Settings';
import Login from './components/Login';
import NotFound from './components/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import { CustomersProvider } from './context/CustomersContext';
import { api, tokenStore } from './services/api';

function AppLayout({ user, onLogout }) {
  const location = useLocation();
  return (
    <div id="appShell" className="active">
      <Header user={user} onLogout={onLogout} />
      <div className="main-col">
        <Topbar />
        <main id="viewRoot">
          <ErrorBoundary key={location.pathname}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<CustomersList />} />
              <Route path="/customer-360/:id" element={<Customer360 />} />
              <Route path="/products" element={<BankProducts />} />
              <Route path="/actions" element={<ActionCenter />} />
              <Route path="/g1" element={<G1 />} />
              <Route path="/g2" element={<G2 />} />
              <Route path="/g3" element={<G3 />} />
              <Route path="/g4" element={<G4 />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(tokenStore.get()));
  const [notice, setNotice] = useState('');

  // Restore the session after a page refresh
  useEffect(() => {
    if (!tokenStore.get()) return;
    api.me()
      .then(res => setUser(res.data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setCheckingSession(false));
  }, []);

  // Any 401 from the API (expired/invalid token) returns to the login screen
  useEffect(() => {
    const onExpired = (e) => {
      setUser(null);
      setNotice(e.detail || 'Your session has expired. Please sign in again.');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const handleLogin = (u, token) => {
    tokenStore.set(token);
    setNotice('');
    setUser(u);
  };

  const handleLogout = () => {
    tokenStore.clear();
    setUser(null);
  };

  if (checkingSession) {
    return <div className="empty-state" style={{ paddingTop: '30vh' }}>Restoring your session…</div>;
  }

  if (!user) {
    return <Login key={notice} onLogin={handleLogin} notice={notice} />;
  }

  return (
    <CustomersProvider>
      <Router>
        <AppLayout user={user} onLogout={handleLogout} />
      </Router>
    </CustomersProvider>
  );
}

export default App;
