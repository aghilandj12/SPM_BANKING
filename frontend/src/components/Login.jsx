import React, { useState } from 'react';
import { api } from '../services/api';

export default function Login({ onLogin, notice }) {
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notice || '');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (submitting) return;
    setError('');
    if (!userId.trim() || !password) {
      setError('Enter your user ID and password.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.login(userId.trim(), password);
      if (data.success && data.token) {
        onLogin(data.user, data.token);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Left Section - Login Form */}
      <div style={styles.leftSection}>
        <div style={styles.loginWrapper}>
          <div style={styles.brand}>
            <div style={styles.brandMark}>B</div>
            <div>
              <div style={styles.brandName}>Banking</div>
              <div style={styles.brandSub}>AI Platform</div>
            </div>
          </div>
          
          <h1 style={styles.heading}>Welcome Back!</h1>
          <p style={styles.supportText}>Sign in to access your relationship manager portal and customer insights.</p>
          
          <div style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Work Email</label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <input 
                  style={styles.input} 
                  type="text" 
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  autoComplete="username"
                  maxLength={64}
                  placeholder="ID" 
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input 
                  style={styles.input} 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  autoComplete="current-password"
                  maxLength={128}
                  placeholder="***" 
                />
                <button 
                  type="button" 
                  style={styles.visibilityBtn} 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div style={{color: 'red', fontSize: '13px', marginTop: '-10px'}}>{error}</div>}
            <button style={{ ...styles.signInBtn, opacity: submitting ? 0.7 : 1 }} onClick={handleLogin} disabled={submitting}>{submitting ? 'Signing in…' : 'Sign In'}</button>
            <p style={styles.hint}>Please log in with your assigned credentials.</p>
          </div>
        </div>
      </div>

      {/* Right Section - Banking Panel */}
      <div style={styles.rightSection}>
        <div style={styles.panelContent}>
          <h2 style={styles.panelHeadline}>Empowering your financial decisions with AI.</h2>
          
          {/* Mock UI Element - Replaced with Image */}
          <div style={styles.imageContainer}>
            <img src="/hero-image.jpg" alt="Banking Professional" style={styles.heroImage} />
          </div>

          {/* Companies Section */}
          <div style={styles.companiesWrapper}>
            <p style={styles.companiesTitle}>Trusted by industry leaders</p>
            <div style={styles.companyLogos}>
              {/* Logo 1 - Abstract Shape */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.8)" strokeWidth="3" strokeDasharray="5 5" />
                <path d="M12 20l6 6 10-10" stroke="rgba(255,255,255,0.8)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {/* Logo 2 - Abstract Shape */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="8" y="8" width="24" height="24" rx="4" stroke="rgba(255,255,255,0.8)" strokeWidth="3" />
                <circle cx="20" cy="20" r="6" fill="rgba(255,255,255,0.8)" />
              </svg>
              {/* Logo 3 - Abstract Shape */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L34 28H6L20 4Z" stroke="rgba(255,255,255,0.8)" strokeWidth="3" strokeLinejoin="round" />
                <circle cx="20" cy="22" r="4" fill="rgba(255,255,255,0.8)" />
              </svg>
              {/* Logo 4 - Abstract Shape */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M10 20 Q 20 5 30 20 T 10 20" stroke="rgba(255,255,255,0.8)" strokeWidth="3" fill="none" strokeLinecap="round" />
                <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.8)" />
              </svg>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  },
  leftSection: {
    flex: '0 0 45%',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
  },
  loginWrapper: {
    width: '100%',
    maxWidth: '400px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '40px',
  },
  brandMark: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #8B4A3C, #4A443D)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: '20px',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  brandName: {
    fontWeight: '700',
    fontSize: '22px',
    color: '#2D2A26',
    letterSpacing: '-0.02em',
    lineHeight: '1',
  },
  brandSub: {
    fontSize: '11px',
    color: '#A89F95',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    marginTop: '4px',
  },
  heading: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#2D2A26',
    marginBottom: '12px',
    letterSpacing: '-0.02em',
  },
  supportText: {
    fontSize: '15px',
    color: '#6B6259',
    marginBottom: '40px',
    lineHeight: '1.5',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#2D2A26',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: '#A89F95',
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    border: '1px solid #E8E0D5',
    borderRadius: '10px',
    fontSize: '15px',
    background: '#FAF7F2',
    color: '#2D2A26',
    outline: 'none',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  visibilityBtn: {
    position: 'absolute',
    right: '14px',
    background: 'none',
    border: 'none',
    padding: '0',
    color: '#A89F95',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  signInBtn: {
    background: 'linear-gradient(135deg, #C08552, #8B4A3C)',
    color: '#fff',
    border: 'none',
    padding: '16px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'transform 0.1s, filter 0.2s',
  },
  hint: {
    fontSize: '13px',
    color: '#A89F95',
    textAlign: 'center',
    marginTop: '8px',
  },
  rightSection: {
    flex: '1',
    background: 'radial-gradient(circle at 85% 80%, rgba(192,133,82,0.15), transparent 50%), radial-gradient(circle at 15% 20%, rgba(139,74,60,0.25), transparent 45%), #2D2A26',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    position: 'relative',
    overflow: 'hidden',
  },
  panelContent: {
    maxWidth: '600px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
    position: 'relative',
    zIndex: 1,
  },
  panelHeadline: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: '1.2',
    letterSpacing: '-0.02em',
  },
  imageContainer: {
    width: '100%',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  heroImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  companiesWrapper: {
    marginTop: '20px',
  },
  companiesTitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '20px',
  },
  companyLogos: {
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
    opacity: 0.6,
  }
};

