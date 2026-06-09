import React, { useState } from 'react';
import { QrCode, Smartphone, X, Sparkles, Check, HelpCircle, ShieldCheck } from 'lucide-react';

export default function UpgradeModal({ API_URL, user, onUpgradeSuccess, onClose, onUserUpdate }) {
  const [selectedPlan, setSelectedPlan] = useState('monthly'); // 'monthly', 'yearly', 'group'
  const [activeTab, setActiveTab] = useState('upi-id'); // 'upi-id' or 'qr-code'
  const [upiId, setUpiId] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle', 'pending', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  // Lab Group member management state
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');

  const handleUpiPay = async (e) => {
    e.preventDefault();
    if (!upiId) {
      setErrorMessage('Please enter your UPI ID.');
      return;
    }
    if (!upiId.includes('@')) {
      setErrorMessage('Invalid UPI ID. Must contain "@".');
      return;
    }

    setErrorMessage('');
    setStatus('pending');

    // Simulate sending payment request and waiting for mobile app approval
    setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': user.email
          },
          body: JSON.stringify({ email: user.email, plan: selectedPlan })
        });

        if (!response.ok) {
          throw new Error('Failed to update subscription on server.');
        }

        const data = await response.json();
        setStatus('success');
        
        setTimeout(() => {
          onUpgradeSuccess(data.user);
        }, 1500);

      } catch (err) {
        setErrorMessage(err.message);
        setStatus('error');
      }
    }, 2500);
  };

  const handleQrPay = async () => {
    setErrorMessage('');
    setStatus('pending');

    // Simulate scanning and verification
    setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': user.email
          },
          body: JSON.stringify({ email: user.email, plan: selectedPlan })
        });

        if (!response.ok) {
          throw new Error('Failed to update subscription on server.');
        }

        const data = await response.json();
        setStatus('success');
        
        setTimeout(() => {
          onUpgradeSuccess(data.user);
        }, 1500);

      } catch (err) {
        setErrorMessage(err.message);
        setStatus('error');
      }
    }, 2500);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail) return;
    
    setMemberError('');
    setMemberSuccess('');
    setMemberActionLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/subscription/add-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email
        },
        body: JSON.stringify({ email: newMemberEmail })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member.');
      }
      
      setMemberSuccess(`Successfully invited ${newMemberEmail}!`);
      setNewMemberEmail('');
      if (onUserUpdate) {
        onUserUpdate(data.user);
      }
    } catch (err) {
      setMemberError(err.message);
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberEmail) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from your Lab Group?`)) return;
    
    setMemberError('');
    setMemberSuccess('');
    setMemberActionLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/subscription/remove-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email
        },
        body: JSON.stringify({ email: memberEmail })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member.');
      }
      
      setMemberSuccess(`Successfully removed ${memberEmail}.`);
      if (onUserUpdate) {
        onUserUpdate(data.user);
      }
    } catch (err) {
      setMemberError(err.message);
    } finally {
      setMemberActionLoading(false);
    }
  };

  const isGroupOwner = user?.subscriptionType === 'lab-group';

  if (isGroupOwner) {
    return (
      <div className="modal-backdrop">
        <div className="upgrade-container" style={{ maxWidth: '500px' }}>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
          
          <div className="corner-bracket top-left"></div>
          <div className="corner-bracket top-right"></div>
          <div className="corner-bracket bottom-left"></div>
          <div className="corner-bracket bottom-right"></div>
          
          <div className="upgrade-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div className="upgrade-logo-wrapper">
              <Sparkles size={20} className="logo-sparkle" />
              <span className="logo-text">MANAGE LAB GROUP</span>
            </div>
            <h2>Active Lab Plan (₹3,276 / Month)</h2>
            <p>Your subscription includes access for up to 6 members (1 owner + 5 invited collaborators).</p>
          </div>
          
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Invite Form */}
            <div>
              <h4 style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                Invite Collaborators
              </h4>
              <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="email" 
                  placeholder="Enter member's Gmail..."
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  style={{ 
                    flex: 1, 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px', 
                    padding: '0.6rem 0.8rem',
                    color: 'var(--color-text-main)',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem'
                  }}
                  disabled={memberActionLoading}
                  required
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                  disabled={memberActionLoading || (user.invitedMembers && user.invitedMembers.length >= 5)}
                >
                  {memberActionLoading ? 'Inviting...' : 'Invite Member'}
                </button>
              </form>
            </div>
            
            {memberError && (
              <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255, 77, 77, 0.1)', borderRadius: '4px', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                {memberError}
              </div>
            )}
            
            {memberSuccess && (
              <div style={{ color: 'var(--accent-green)', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(57, 255, 20, 0.1)', borderRadius: '4px', border: '1px solid rgba(57, 255, 20, 0.2)' }}>
                {memberSuccess}
              </div>
            )}
            
            {/* Member List */}
            <div style={{ marginTop: '0.5rem' }}>
              <h4 style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                Collaborators ({(user.invitedMembers ? user.invitedMembers.length : 0)} / 5 Invited Seats Used)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Owner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(197, 168, 92, 0.05)', border: '1px solid rgba(197, 168, 92, 0.2)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{user.email} <span style={{ color: '#c5a85c', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(Owner)</span></span>
                </div>
                
                {/* Invited Members */}
                {user.invitedMembers && user.invitedMembers.map(memberEmail => (
                  <div key={memberEmail} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.9rem' }}>{memberEmail}</span>
                    <button 
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleRemoveMember(memberEmail)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      disabled={memberActionLoading}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                
                {(!user.invitedMembers || user.invitedMembers.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    No other members added yet. Type an email above to grant them full access.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="upgrade-container">
        <button className="modal-close-btn" onClick={onClose} disabled={status === 'pending'}>
          <X size={18} />
        </button>

        {/* HUD Corners */}
        <div className="corner-bracket top-left"></div>
        <div className="corner-bracket top-right"></div>
        <div className="corner-bracket bottom-left"></div>
        <div className="corner-bracket bottom-right"></div>

        {status === 'success' ? (
          <div className="upgrade-success-view">
            <div className="success-badge-wrapper">
              <Check size={48} className="success-check-icon" />
            </div>
            <h2>Subscription Activated!</h2>
            <p>Welcome to <strong>Atom Analyzer Pro Plus</strong>.</p>
            <p className="success-subtext">The premium theme and advanced analytics features have been unlocked for <strong>{user.email}</strong>.</p>
          </div>
        ) : (
          <>
            <div className="upgrade-header">
              <div className="upgrade-logo-wrapper">
                <Sparkles size={20} className="logo-sparkle" />
                <span className="logo-text">PRO PLUS UPGRADE</span>
              </div>
              <h2>Select Subscription Plan</h2>
              <p>Unlock high-res uploads and custom lattice simulation modules.</p>
            </div>

            {/* Plan Selector */}
            <div className="plan-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem', padding: '0 1rem' }}>
              <div 
                className={`plan-card ${selectedPlan === 'monthly' ? 'selected' : ''}`}
                onClick={() => setSelectedPlan('monthly')}
                style={{ 
                  padding: '0.75rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  textAlign: 'center', 
                  background: selectedPlan === 'monthly' ? 'rgba(197, 168, 92, 0.1)' : 'transparent', 
                  borderColor: selectedPlan === 'monthly' ? '#c5a85c' : 'var(--border-color)',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Individual Monthly</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#c5a85c', margin: '0.25rem 0' }}>₹840</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>$10 / Month</div>
              </div>
              
              <div 
                className={`plan-card ${selectedPlan === 'yearly' ? 'selected' : ''}`}
                onClick={() => setSelectedPlan('yearly')}
                style={{ 
                  padding: '0.75rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  textAlign: 'center', 
                  background: selectedPlan === 'yearly' ? 'rgba(197, 168, 92, 0.1)' : 'transparent', 
                  borderColor: selectedPlan === 'yearly' ? '#c5a85c' : 'var(--border-color)',
                  position: 'relative',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#d97706', color: 'white', fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>Save 25%</span>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Individual Annual</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#c5a85c', margin: '0.25rem 0' }}>₹7,560</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>$90 / Year</div>
              </div>

              <div 
                className={`plan-card ${selectedPlan === 'group' ? 'selected' : ''}`}
                onClick={() => setSelectedPlan('group')}
                style={{ 
                  padding: '0.75rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  textAlign: 'center', 
                  background: selectedPlan === 'group' ? 'rgba(197, 168, 92, 0.1)' : 'transparent', 
                  borderColor: selectedPlan === 'group' ? '#c5a85c' : 'var(--border-color)',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Lab Group Plan</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#c5a85c', margin: '0.25rem 0' }}>₹3,276</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>$39 / Month (5 Users)</div>
              </div>
            </div>

            <div className="upgrade-body">
              {/* Left Column: Benefits */}
              <div className="upgrade-benefits">
                <h4>PRO PLUS BENEFITS</h4>
                <ul>
                  <li>
                    <span className="benefit-bullet">✦</span>
                    <div>
                      <strong>Unlimited File Uploads</strong>
                      <p>Analyze micrographs larger than 1 MB (TEM, STEM, STM).</p>
                    </div>
                  </li>
                  <li>
                    <span className="benefit-bullet">✦</span>
                    <div>
                      <strong>Fast Fourier Transform (FFT)</strong>
                      <p>View crystallographic diffraction power spectrum maps.</p>
                    </div>
                  </li>
                  <li>
                    <span className="benefit-bullet">✦</span>
                    <div>
                      <strong>Radial Distribution Function, G(r)</strong>
                      <p>Simulate coordinate shell densities in the 3D builder.</p>
                    </div>
                  </li>
                  <li>
                    <span className="benefit-bullet">✦</span>
                    <div>
                      <strong>Premium Golden Interface</strong>
                      <p>Elevated aesthetics tailored for advanced research.</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Right Column: Checkout */}
              <div className="upgrade-checkout">
                {status === 'pending' ? (
                  <div className="checkout-processing">
                    <span className="checkout-spinner"></span>
                    {activeTab === 'upi-id' ? (
                      <>
                        <h5>Verifying UPI Request...</h5>
                        <p>We've sent a payment request to <strong>{upiId}</strong>. Please check your UPI app (GPay, PhonePe, Paytm) and approve it.</p>
                      </>
                    ) : (
                      <>
                        <h5>Processing QR Payment...</h5>
                        <p>Waiting for transaction confirmation from bank node...</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="payment-tabs">
                      <button 
                        className={`payment-tab ${activeTab === 'upi-id' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('upi-id'); setErrorMessage(''); }}
                      >
                        <Smartphone size={16} />
                        <span>UPI ID / VPA</span>
                      </button>
                      <button 
                        className={`payment-tab ${activeTab === 'qr-code' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('qr-code'); setErrorMessage(''); }}
                      >
                        <QrCode size={16} />
                        <span>Scan QR Code</span>
                      </button>
                    </div>

                    {errorMessage && (
                      <div className="checkout-error">
                        {errorMessage}
                      </div>
                    )}

                    {activeTab === 'upi-id' ? (
                      <form onSubmit={handleUpiPay} className="upi-form">
                        <div className="form-group">
                          <label htmlFor="upi-vpa-input">Enter UPI ID</label>
                          <input 
                            id="upi-vpa-input"
                            type="text" 
                            placeholder="e.g. scientist@okaxis" 
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                          />
                        </div>
                        <div className="checkout-summary">
                          <div className="price-row">
                            <span>Plan Billing</span>
                            <span className="price-bold">
                              {selectedPlan === 'monthly' ? '₹840.00' : selectedPlan === 'yearly' ? '₹7,560.00' : '₹3,276.00'}
                            </span>
                          </div>
                          <div className="price-row gst-row">
                            <span>GST (Integrated)</span>
                            <span>Included</span>
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary pay-btn">
                          Pay {selectedPlan === 'monthly' ? '₹840' : selectedPlan === 'yearly' ? '₹7,560' : '₹3,276'} {selectedPlan === 'yearly' ? '/ Year' : '/ Month'} via UPI
                        </button>
                      </form>
                    ) : (
                      <div className="qr-checkout-view">
                        <div className="qr-code-frame">
                          {/* CSS Generated Mock QR Code */}
                          <svg width="130" height="130" viewBox="0 0 100 100" className="qr-svg">
                            <rect width="100" height="100" fill="white" />
                            {/* Outer Corners */}
                            <path d="M5,5 h20 v20 h-20 z M5,11 h14 v14 h-14 z M10,10 h4 v4 h-4 z" fill="black" />
                            <path d="M75,5 h20 v20 h-20 z M75,11 h14 v14 h-14 z M80,10 h4 v4 h-4 z" fill="black" />
                            <path d="M5,75 h20 v20 h-20 z M5,81 h14 v14 h-14 z M10,80 h4 v4 h-4 z" fill="black" />
                            {/* Inner Random Squares simulating QR details */}
                            <rect x="35" y="10" width="10" height="15" fill="black" />
                            <rect x="50" y="5" width="15" height="10" fill="black" />
                            <rect x="40" y="25" width="20" height="15" fill="black" />
                            <rect x="10" y="35" width="15" height="20" fill="black" />
                            <rect x="80" y="35" width="15" height="15" fill="black" />
                            <rect x="70" y="60" width="15" height="25" fill="black" />
                            <rect x="35" y="50" width="25" height="10" fill="black" />
                            <rect x="30" y="70" width="20" height="20" fill="black" />
                            <rect x="60" y="75" width="10" height="15" fill="black" />
                            <rect x="85" y="80" width="10" height="10" fill="black" />
                          </svg>
                          <div className="qr-center-logo">⚛️</div>
                        </div>
                        <div className="qr-info">
                          <p className="qr-instructions">Scan using GPay, PhonePe, Paytm or any UPI app</p>
                          <p className="qr-amount">Amount: <strong>{selectedPlan === 'monthly' ? '₹840.00' : selectedPlan === 'yearly' ? '₹7,560.00' : '₹3,276.00'}</strong></p>
                        </div>
                        <button className="btn btn-primary pay-btn" onClick={handleQrPay}>
                          Verify Mock QR Payment
                        </button>
                      </div>
                    )}
                  </>
                )}

                <div className="secure-badge">
                  <ShieldCheck size={14} />
                  <span>Secure bank-to-bank UPI routing via NPCI standards.</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
