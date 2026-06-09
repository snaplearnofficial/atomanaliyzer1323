import React, { useState, useEffect } from 'react';
import { Trash2, ExternalLink, Calendar, Database, RefreshCw } from 'lucide-react';

export default function ProjectHistory({ API_URL, onLoadProject, user }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        headers: {
          'x-user-email': user.email
        }
      });
      if (!response.ok) throw new Error('Failed to retrieve project database.');
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [API_URL, user]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user.email
        }
      });
      if (!response.ok) throw new Error('Failed to delete project.');
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLoad = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${id}`, {
        headers: {
          'x-user-email': user.email
        }
      });
      if (!response.ok) throw new Error('Failed to load project details.');
      const project = await response.json();
      onLoadProject(project);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="tab-container" id="history-tab-container">
      <div className="glass-panel" id="history-panel">
        <div className="panel-header widget-header-2d">
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={20} />
            Saved Analysis & Modeling Projects
          </h2>
          <button 
            id="btn-refresh-history"
            className="btn" 
            onClick={fetchProjects} 
            disabled={loading}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
            Loading database files...
          </div>
        ) : error ? (
          <div style={{ color: 'var(--accent-red)', padding: '2rem', textAlign: 'center' }}>
            <p>Could not connect to the backend server.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Error: {error}</p>
            <button className="btn btn-primary" onClick={fetchProjects} style={{ marginTop: '1rem' }}>
              Retry Connection
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            No saved projects found for {user.email}.
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Create an analysis in 2D or 3D, and save it to see it here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {projects.map(p => (
              <div key={p.id} className="project-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <span 
                      className="element-badge" 
                      style={{ 
                        background: p.type === '2d' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(79, 172, 254, 0.1)',
                        color: p.type === '2d' ? 'var(--accent-green)' : 'var(--accent-blue)',
                        border: p.type === '2d' ? '1px solid rgba(57, 255, 20, 0.3)' : '1px solid rgba(79, 172, 254, 0.3)',
                        marginBottom: '0.5rem'
                      }}
                    >
                      {p.type === '2d' ? '2D Micrograph' : '3D Crystal'}
                    </span>
                    <h4 style={{ margin: 0, fontWeight: '600' }}>{p.name}</h4>
                    {p.creator && p.creator !== user.email && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--accent-orange)', fontWeight: 'bold', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>👤 Member:</span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: '500' }}>{p.creator}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="project-meta" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Database size={12} />
                    <span>Atom Count: <strong style={{ color: 'var(--color-text-main)' }}>{p.atomCount}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={12} />
                    <span>Saved: {new Date(p.updatedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleLoad(p.id)}
                    style={{ flex: 1, padding: '0.5rem' }}
                  >
                    <ExternalLink size={14} />
                    <span>Load Project</span>
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={(e) => handleDelete(p.id, e)}
                    style={{ padding: '0.5rem' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
