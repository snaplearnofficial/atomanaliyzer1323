import React, { useState } from 'react';
import { Image, Box, Sparkles, Cpu, ChevronRight, Users, Plus, Trash2 } from 'lucide-react';

export default function Dashboard({ 
  user, 
  API_URL, 
  onUserUpdate, 
  onUpgradeClick, 
  setActiveTab, 
  load2DPreset, 
  load3DPreset 
}) {
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail) return;
    setError('');
    setSuccess('');
    setLoading(true);

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
        throw new Error(data.error || 'Failed to invite member.');
      }

      setSuccess(`Invited ${newMemberEmail} successfully!`);
      setNewMemberEmail('');
      if (onUserUpdate) {
        onUserUpdate(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberEmail) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from your Lab Group?`)) return;
    setError('');
    setSuccess('');
    setLoading(true);

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

      setSuccess(`Removed ${memberEmail} successfully.`);
      if (onUserUpdate) {
        onUserUpdate(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isGroupOwner = user?.subscriptionType === 'lab-group';

  return (
    <div className="dashboard-grid" id="dashboard-container">
      {/* Editorial Welcome Banner */}
      <div className="welcome-banner" style={{ gridColumn: '1 / -1' }} id="dashboard-welcome-banner">
        <h2 style={{ fontSize: '1.65rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Sparkles size={22} style={{ color: 'var(--accent-orange)' }} />
          Welcome to Atom Analyzer Pro
        </h2>
        <p style={{ fontSize: '0.94rem', opacity: '0.9', lineHeight: '1.6' }}>
          Thank you for visiting this application. Atom Analyzer Pro is designed for automated atomic counting, coordinate mapping, and structural crystallography. Select one of the cards below to open the dedicated full-screen workspaces.
        </p>
      </div>

      {/* 2D Micrograph Feature Panel */}
      <div className="glass-panel" id="dash-2d-features">
        <div className="panel-header widget-header-2d">
          <h3 className="panel-title" style={{ fontSize: '1.05rem', fontWeight: '700' }}>
            <Image size={18} style={{ marginRight: '0.2rem' }} />
            2D Micrograph Analyzer
          </h3>
        </div>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          Upload TEM, STEM, or STM micrographs to count atoms and extract their 2D coordinates. Adjust intensity filters in real-time, modify coordinate positions manually, and overlay Voronoi bond networks to isolate vacancies or grain defects.
        </p>
        
        <h4 style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>
          Try with Sample Micrographs:
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            id="preset-graphene-2d"
            className="btn" 
            style={{ justifyContent: 'flex-start', textAlign: 'left', background: '#ffffff' }}
            onClick={() => load2DPreset('graphene')}
          >
            <Cpu size={16} style={{ color: 'var(--accent-green)' }} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>Graphene Honeycomb (STEM)</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>High-contrast hexagonal lattice of Carbon atoms</div>
            </div>
          </button>
          <button 
            id="preset-silicon-2d"
            className="btn" 
            style={{ justifyContent: 'flex-start', textAlign: 'left', background: '#ffffff' }}
            onClick={() => load2DPreset('silicon')}
          >
            <Cpu size={16} style={{ color: 'var(--accent-orange)' }} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>Silicon [110] Projection (HRTEM)</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Silicon dumbbells aligned along the [110] crystal direction</div>
            </div>
          </button>
        </div>

        <button 
          id="dash-link-2d"
          className="btn btn-primary"
          onClick={() => setActiveTab('analyzer2d')}
          style={{ marginTop: '2rem' }}
        >
          <span>Open Full 2D Workspace</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 3D Crystal Builder Feature Panel */}
      <div className="glass-panel" id="dash-3d-features">
        <div className="panel-header widget-header-3d">
          <h3 className="panel-title" style={{ fontSize: '1.05rem', fontWeight: '700' }}>
            <Box size={18} style={{ marginRight: '0.2rem' }} />
            3D Crystal & Molecule Sandbox
          </h3>
        </div>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          Construct crystal lattices (BCC, FCC, Simple Cubic) or load preset molecule geometries in 3D. Highlight coordinate values inside a live spreadsheet, add atoms manually, and export structures to standard molecular formats (.xyz, .csv).
        </p>

        <h4 style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>
          Try with 3D Presets:
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            id="preset-gold-3d"
            className="btn" 
            style={{ justifyContent: 'flex-start', textAlign: 'left', background: '#ffffff' }}
            onClick={() => load3DPreset('fcc')}
          >
            <Box size={16} style={{ color: 'var(--accent-orange)' }} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>Gold Nanostructure (FCC Lattice)</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Face-Centered Cubic cell system (Gold, Au)</div>
            </div>
          </button>
          <button 
            id="preset-nanotube-3d"
            className="btn" 
            style={{ justifyContent: 'flex-start', textAlign: 'left', background: '#ffffff' }}
            onClick={() => load3DPreset('nanotube')}
          >
            <Box size={16} style={{ color: 'var(--accent-blue)' }} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>Carbon Nanotube (Armchair)</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Rolled cylindrical graphene monolayer (Carbon, C)</div>
            </div>
          </button>
        </div>

        <button 
          id="dash-link-3d"
          className="btn btn-primary"
          onClick={() => setActiveTab('builder3d')}
          style={{ marginTop: '2rem' }}
        >
          <span>Open Full 3D Workspace</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Lab Group Section at the bottom */}
      {isGroupOwner ? (
        <div className="glass-panel" style={{ gridColumn: '1 / -1', border: '1px solid rgba(197, 168, 92, 0.3)', background: 'linear-gradient(180deg, rgba(197, 168, 92, 0.02) 0%, rgba(0,0,0,0) 100%)' }} id="dash-group-manager">
          <div className="panel-header" style={{ background: 'linear-gradient(90deg, #b45309, #d97706)', color: 'white', padding: '0.8rem 1.25rem', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
            <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffffff', fontSize: '1rem' }}>
              <Users size={18} />
              Lab Group Subscription Manager (₹3,276 / Month)
            </h3>
          </div>
          
          <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem' }} id="dash-group-grid">
            {/* Invite Form */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-main)' }}>Invite Collaborators</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
                Type your team members' Gmail addresses below to instantly grant them full Pro Plus premium access. They can log in with their own passwords.
              </p>
              <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="email" 
                  className="form-input"
                  placeholder="e.g. researcher@gmail.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                  disabled={loading}
                  required
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(90deg, #b45309, #d97706)', border: 'none', padding: '0 1.25rem' }}
                  disabled={loading || (user.invitedMembers && user.invitedMembers.length >= 5)}
                >
                  <Plus size={16} />
                  <span>Invite</span>
                </button>
              </form>
              
              {error && <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</div>}
              {success && <div style={{ color: 'var(--accent-green)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{success}</div>}
            </div>

            {/* Members List */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--color-text-main)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Collaborators</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{(user.invitedMembers ? user.invitedMembers.length : 0)} / 5 Invited Seats Used</span>
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Owner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(197, 168, 92, 0.05)', border: '1px solid rgba(197, 168, 92, 0.2)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{user.email}</span>
                  <span style={{ fontSize: '0.7rem', color: '#c5a85c', fontWeight: 'bold', textTransform: 'uppercase' }}>Owner</span>
                </div>
                
                {/* Invited Members */}
                {user.invitedMembers && user.invitedMembers.map(email => (
                  <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.85rem' }}>{email}</span>
                    <button 
                      type="button" 
                      className="btn btn-danger"
                      onClick={() => handleRemoveMember(email)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      disabled={loading}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                ))}
                
                {(!user.invitedMembers || user.invitedMembers.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                    No other collaborators added yet. Invite your team above!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ gridColumn: '1 / -1', border: '1px solid var(--border-color)', background: 'linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(0,0,0,0) 100%)' }} id="dash-group-promo">
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Users size={20} style={{ color: 'var(--accent-orange)' }} />
                Need Access for Your Entire Research Group?
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                Upgrade to the **Lab Group License** for **₹3,276 / Month ($39)**. Connect up to 5 members (owner + 4 collaborators) under one simple subscription to share database history and collaborate on crystallographic mapping projects.
              </p>
            </div>
            <button 
              id="dash-upgrade-group-btn"
              className="btn btn-primary"
              onClick={onUpgradeClick}
              style={{ background: 'linear-gradient(90deg, #b45309, #d97706)', border: 'none', padding: '0.75rem 1.5rem', fontWeight: 'bold' }}
            >
              <Sparkles size={16} style={{ marginRight: '0.25rem' }} />
              <span>Get Lab Group License</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
