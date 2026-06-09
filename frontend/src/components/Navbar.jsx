import React from 'react';
import { Activity, Image, Box, History, Sparkles, LogOut, Award } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onSignOut, onUpgradeClick }) {
  const isPremium = user?.isPremium;

  return (
    <nav className={`navbar ${isPremium ? 'navbar-premium' : ''}`} id="app-nav">
      {/* Brand logo changes dynamically when premium */}
      <div className={`logo ${isPremium ? 'logo-premium' : ''}`} id="app-logo">
        {isPremium ? (
          <>
            <Sparkles size={26} className="logo-icon-premium" />
            <span className="logo-text-premium">Atom Analyzer Pro <span className="logo-plus-badge">Plus</span></span>
          </>
        ) : (
          <>
            <Activity size={26} />
            <span>Atom Analyzer Pro</span>
          </>
        )}
      </div>

      {/* Navigation tabs */}
      <div className="nav-links" id="nav-links-container">
        <button
          id="btn-nav-dashboard"
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span>Dashboard</span>
        </button>
        
        <button
          id="btn-nav-analyzer2d"
          className={`nav-btn ${activeTab === 'analyzer2d' ? 'active' : ''}`}
          onClick={() => setActiveTab('analyzer2d')}
        >
          <Image size={18} />
          <span>2D Micrograph Analyzer</span>
        </button>

        <button
          id="btn-nav-builder3d"
          className={`nav-btn ${activeTab === 'builder3d' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder3d')}
        >
          <Box size={18} />
          <span>3D Lattice Builder</span>
        </button>

        <button
          id="btn-nav-history"
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} />
          <span>Project History</span>
        </button>
      </div>

      {/* User Section & Action Buttons */}
      <div className="nav-user-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isPremium ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div className="premium-status-badge" title="You are on the Pro Plus membership tier">
              <Award size={14} style={{ color: 'var(--accent-orange)' }} />
              <span>
                {user?.subscriptionType === 'lab-group' 
                  ? 'Lab Group Owner' 
                  : user?.subscriptionType === 'invited' 
                    ? 'Lab Member' 
                    : 'Pro Plus Active'}
              </span>
            </div>
            {user?.subscriptionType === 'lab-group' && (
              <button 
                id="manage-group-btn"
                className="btn btn-primary"
                onClick={onUpgradeClick}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', background: 'linear-gradient(90deg, #b45309, #d97706)', border: 'none', height: 'fit-content' }}
              >
                Manage Group
              </button>
            )}
          </div>
        ) : (
          <button 
            id="upgrade-trigger-btn"
            className="upgrade-btn-navbar" 
            onClick={onUpgradeClick}
          >
            <Sparkles size={13} />
            <span>Upgrade to Plus</span>
          </button>
        )}

        <div className="user-profile-menu">
          <span className="user-email-tag" title={user?.email}>{user?.email}</span>
          <button 
            id="sign-out-btn"
            className="sign-out-btn" 
            onClick={onSignOut}
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
