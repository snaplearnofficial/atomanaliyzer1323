import React, { useState } from 'react';
import { Mail, Lock, ShieldAlert, CheckCircle, Sparkles } from 'lucide-react';

export default function AuthModal({ API_URL, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email) {
      setError('Please fill in your Gmail address.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (data.isNew) {
        setSuccessMsg('Account registered successfully! Logging you in...');
      } else {
        setSuccessMsg('Welcome back! Loading your workspace...');
      }

      // Simulate a brief delay for a polished UX feel
      setTimeout(() => {
        onLoginSuccess(data.user);
        setLoading(false);
      }, 1200);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-backdrop">
      <div className="auth-container">
        {/* Decorative corner indicators for micro-HUD feel */}
        <div className="corner-bracket top-left"></div>
        <div className="corner-bracket top-right"></div>
        <div className="corner-bracket bottom-left"></div>
        <div className="corner-bracket bottom-right"></div>

        <div className="auth-header">
          <div className="auth-logo">
            <Sparkles size={24} style={{ color: 'var(--accent-red)' }} />
            <span>Atom Analyzer Pro</span>
          </div>
          <h3>Initialize Portal Access</h3>
          <p>Please enter your Gmail address to synchronize your project logs.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="auth-email">Gmail Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                id="auth-email"
                type="email"
                placeholder="doctor.doe@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {error && (
            <div className="auth-error-banner">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-success-banner">
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={loading}
            style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}
          >
            {loading ? (
              <span className="auth-spinner"></span>
            ) : (
              <span>Authenticate / Create Account</span>
            )}
          </button>
        </form>

        <div className="auth-footer-note">
          New accounts are registered automatically on your first sign-in.
        </div>
      </div>
    </div>
  );
}
