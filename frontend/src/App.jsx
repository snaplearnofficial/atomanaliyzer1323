import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Analyzer2D from './components/Analyzer2D';
import Builder3D from './components/Builder3D';
import ProjectHistory from './components/ProjectHistory';
import AuthModal from './components/AuthModal';
import UpgradeModal from './components/UpgradeModal';
import './App.css';

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin;

export default function App() {
  const [user, setUser] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loadedProject, setLoadedProject] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  // Load user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('atom_analyzer_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem('atom_analyzer_user');
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('atom_analyzer_user', JSON.stringify(userData));
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('atom_analyzer_user');
    setLoadedProject(null);
    setActiveTab('dashboard');
  };

  const handleUpgradeSuccess = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('atom_analyzer_user', JSON.stringify(updatedUser));
    setShowUpgradeModal(false);
  };

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('atom_analyzer_user', JSON.stringify(updatedUser));
  };

  // Reload history
  const triggerHistoryRefresh = () => {
    setHistoryKey(prev => prev + 1);
  };

  // Preset loading helpers
  const handleLoad2DPreset = (presetType) => {
    const simulatedProject = {
      id: null,
      name: presetType === 'graphene' ? 'Graphene Lattice Simulation' : 'Silicon [110] TEM Simulation',
      type: '2d',
      coordinates: [],
      image: null,
      settings: {
        threshold: presetType === 'graphene' ? 140 : 160,
        minDistance: presetType === 'graphene' ? 18 : 22,
        blurRadius: 2,
        invert: false,
        bondDistance: presetType === 'graphene' ? 30 : 38
      }
    };
    setLoadedProject(simulatedProject);
    setActiveTab('analyzer2d');
  };

  const handleLoad3DPreset = (presetType) => {
    const simulatedProject = {
      id: null,
      name: presetType === 'fcc' ? 'Gold FCC Lattice' : 'Carbon Nanotube (CNT)',
      type: '3d',
      coordinates: [],
      settings: {
        presetType: presetType,
        latticeConstant: presetType === 'fcc' ? 4.08 : 2.8,
        bondDistance: presetType === 'fcc' ? 3.0 : 1.6
      }
    };
    setLoadedProject(simulatedProject);
    setActiveTab('builder3d');
  };

  const handleLoadProject = (project) => {
    setLoadedProject(project);
    if (project.type === '2d') {
      setActiveTab('analyzer2d');
    } else {
      setActiveTab('builder3d');
    }
  };

  // Block rest of UI if not authenticated
  if (!user) {
    return <AuthModal API_URL={API_URL} onLoginSuccess={handleLoginSuccess} />;
  }

  const isPremium = user.isPremium;

  return (
    <div className={`app-container ${isPremium ? 'theme-plus' : ''}`} id="app-root-layout">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onSignOut={handleSignOut} 
        onUpgradeClick={() => setShowUpgradeModal(true)} 
      />
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'dashboard' && (
          <Dashboard 
            user={user}
            API_URL={API_URL}
            onUserUpdate={handleUpdateUser}
            onUpgradeClick={() => setShowUpgradeModal(true)}
            setActiveTab={setActiveTab}
            load2DPreset={handleLoad2DPreset}
            load3DPreset={handleLoad3DPreset}
          />
        )}
        
        {activeTab === 'analyzer2d' && (
          <Analyzer2D 
            API_URL={API_URL} 
            loadedProject={loadedProject}
            onSaveSuccess={triggerHistoryRefresh}
            user={user}
            onUpgradeRequired={() => setShowUpgradeModal(true)}
          />
        )}
        
        {activeTab === 'builder3d' && (
          <Builder3D 
            API_URL={API_URL} 
            loadedProject={loadedProject}
            onSaveSuccess={triggerHistoryRefresh}
            user={user}
          />
        )}
        
        {activeTab === 'history' && (
          <ProjectHistory 
            key={historyKey}
            API_URL={API_URL} 
            onLoadProject={handleLoadProject}
            user={user}
          />
        )}
      </main>

      <footer style={{ 
        padding: '1.5rem 2.5rem', 
        borderTop: '1px solid var(--border-color)', 
        textAlign: 'center', 
        fontSize: '0.78rem', 
        color: 'var(--color-text-muted)',
        background: 'var(--bg-main)'
      }} id="app-footer">
        <div>Copyright © 2026 Atom Analyzer Pro. All rights reserved. Proprietary and Confidential.</div>
      </footer>

      {showUpgradeModal && (
        <UpgradeModal 
          API_URL={API_URL} 
          user={user} 
          onUpgradeSuccess={handleUpgradeSuccess} 
          onClose={() => setShowUpgradeModal(false)} 
          onUserUpdate={handleUpdateUser}
        />
      )}
    </div>
  );
}
