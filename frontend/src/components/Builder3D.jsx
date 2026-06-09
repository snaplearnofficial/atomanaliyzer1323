import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generateSimpleCubic, generateBCC, generateFCC, generateGraphene, generateCarbonNanotube, loadPresetMolecule, parseCIF } from '../utils/lattice';
import { Box, Sliders, RefreshCw, Plus, Trash2, Download, Save, Info, RotateCcw, Sparkles } from 'lucide-react';

// Color maps for elements
const ELEMENT_COLORS = {
  C: 0x444444,  // Dark gray
  H: 0xffffff,  // White
  O: 0xff4d4d,  // Red
  N: 0x4facfe,  // Blue
  Au: 0xffd700, // Gold
  Si: 0xff9f43, // Orange
  Fe: 0x5a738e, // Blue-gray
  Generic: 0x888888
};

const ELEMENT_RADII = {
  C: 0.77,
  H: 0.37,
  O: 0.73,
  N: 0.75,
  Au: 1.44,
  Si: 1.11,
  Fe: 1.25,
  };

const ELEMENT_ATOMIC_NUMBERS = {
  C: 6,
  H: 1,
  O: 8,
  N: 7,
  Au: 79,
  Si: 14,
  Fe: 26,
  Generic: 6
};

// Calculate total potential energy of the system
const calculateSystemEnergy = (currentAtoms) => {
  let energy = 0;
  const cutoff = 6.0; // Å
  for (let i = 0; i < currentAtoms.length; i++) {
    const a = currentAtoms[i];
    const rA = ELEMENT_RADII[a.element || 'C'] || ELEMENT_RADII.Generic;
    for (let j = i + 1; j < currentAtoms.length; j++) {
      const b = currentAtoms[j];
      const rB = ELEMENT_RADII[b.element || 'C'] || ELEMENT_RADII.Generic;
      
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (dist > 0.1 && dist < cutoff) {
        const r0 = rA + rB;
        const ratio6 = Math.pow(r0 / dist, 6);
        const ratio12 = ratio6 * ratio6;
        energy += (ratio12 - 2 * ratio6);
      }
    }
  }
  return energy;
};

// Calculate forces on each atom
const calculateForces = (currentAtoms) => {
  const forces = currentAtoms.map(() => ({ x: 0, y: 0, z: 0 }));
  const cutoff = 6.0; // Å
  for (let i = 0; i < currentAtoms.length; i++) {
    const a = currentAtoms[i];
    const rA = ELEMENT_RADII[a.element || 'C'] || ELEMENT_RADII.Generic;
    for (let j = i + 1; j < currentAtoms.length; j++) {
      const b = currentAtoms[j];
      const rB = ELEMENT_RADII[b.element || 'C'] || ELEMENT_RADII.Generic;
      
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (dist > 0.1 && dist < cutoff) {
        const r0 = rA + rB;
        const ratio6 = Math.pow(r0 / dist, 6);
        const ratio12 = ratio6 * ratio6;
        
        const forceMagnitude = (12.0 * (ratio12 - ratio6)) / (dist * dist);
        
        const fx = forceMagnitude * dx;
        const fy = forceMagnitude * dy;
        const fz = forceMagnitude * dz;
        
        forces[i].x += fx;
        forces[i].y += fy;
        forces[i].z += fz;
        
        forces[j].x -= fx;
        forces[j].y -= fy;
        forces[j].z -= fz;
      }
    }
  }
  return forces;
};

// Take a relaxation step
const relaxStep = (currentAtoms) => {
  const forces = calculateForces(currentAtoms);
  const alpha = 0.015; // relaxation rate
  const maxDisplacement = 0.08; // Å, safety cap per step
  
  return currentAtoms.map((atom, idx) => {
    let dx = forces[idx].x * alpha;
    let dy = forces[idx].y * alpha;
    let dz = forces[idx].z * alpha;
    
    const disp = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (disp > maxDisplacement) {
      dx = (dx / disp) * maxDisplacement;
      dy = (dy / disp) * maxDisplacement;
      dz = (dz / disp) * maxDisplacement;
    }
    
    return {
      ...atom,
      x: atom.x + dx,
      y: atom.y + dy,
      z: atom.z + dz
    };
  });
};

// Calculate simulated Powder XRD diffraction pattern (Intensity vs 2theta)
const calculateXRD = (atoms) => {
  const lambda = 1.54056; // Cu Ka in Angstroms
  const data = [];
  if (atoms.length === 0) return data;
  
  const Z = atoms.map(a => ELEMENT_ATOMIC_NUMBERS[a.element || 'C'] || ELEMENT_ATOMIC_NUMBERS.Generic);
  const distances = [];
  for (let i = 0; i < atoms.length; i++) {
    distances[i] = [];
    for (let j = 0; j < atoms.length; j++) {
      if (i === j) {
        distances[i][j] = 0;
      } else {
        const dx = atoms[i].x - atoms[j].x;
        const dy = atoms[i].y - atoms[j].y;
        const dz = atoms[i].z - atoms[j].z;
        distances[i][j] = Math.sqrt(dx*dx + dy*dy + dz*dz);
      }
    }
  }
  
  const startAngle = 5;
  const endAngle = 90;
  const steps = 300;
  
  for (let s = 0; s <= steps; s++) {
    const twoTheta = startAngle + (s / steps) * (endAngle - startAngle);
    const thetaRad = (twoTheta / 2) * (Math.PI / 180);
    const q = (4 * Math.PI * Math.sin(thetaRad)) / lambda;
    
    let intensity = 0;
    
    if (q === 0) {
      for (let i = 0; i < atoms.length; i++) {
        for (let j = 0; j < atoms.length; j++) {
          intensity += Z[i] * Z[j];
        }
      }
    } else {
      for (let i = 0; i < atoms.length; i++) {
        intensity += Z[i] * Z[i];
        
        for (let j = i + 1; j < atoms.length; j++) {
          const r = distances[i][j];
          const qr = q * r;
          if (r > 0.1) {
            intensity += 2 * Z[i] * Z[j] * (Math.sin(qr) / qr);
          } else {
            intensity += 2 * Z[i] * Z[j];
          }
        }
      }
    }
    
    data.push({ twoTheta, intensity });
  }
  
  return data;
};

// Draw XRD diffraction pattern on canvas
const drawXRD = (ctx, w, h, xrdData) => {
  if (!ctx) return;
  try {
    ctx.fillStyle = '#0f111a';
    ctx.fillRect(0, 0, w, h);

    if (!xrdData || xrdData.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No atoms to plot XRD', w/2, h/2);
      return;
    }

    const maxVal = Math.max(...xrdData.map(d => d.intensity)) || 1;

    // Draw axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    
    // Y Axis
    ctx.beginPath();
    ctx.moveTo(35, 15);
    ctx.lineTo(35, h - 25);
    ctx.stroke();

    // X Axis
    ctx.beginPath();
    ctx.moveTo(35, h - 25);
    ctx.lineTo(w - 15, h - 25);
    ctx.stroke();

    // X Axis Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    
    ctx.fillText('10°', 35 + ((10 - 5) / (90 - 5)) * (w - 50), h - 12);
    ctx.fillText('30°', 35 + ((30 - 5) / (90 - 5)) * (w - 50), h - 12);
    ctx.fillText('50°', 35 + ((50 - 5) / (90 - 5)) * (w - 50), h - 12);
    ctx.fillText('70°', 35 + ((70 - 5) / (90 - 5)) * (w - 50), h - 12);
    ctx.fillText('90°', 35 + ((90 - 5) / (90 - 5)) * (w - 50), h - 12);

    ctx.save();
    ctx.translate(12, h/2 - 5);
    ctx.rotate(-Math.PI/2);
    ctx.fillText('Intensity (a.u.)', 0, 0);
    ctx.restore();

    ctx.fillText('2θ (degrees)', 35 + (w - 50)/2, h - 2);

    const graphWidth = w - 50;
    const graphHeight = h - 45;
    
    // Plot Line
    ctx.beginPath();
    xrdData.forEach((d, idx) => {
      const x = 35 + ((d.twoTheta - 5) / (90 - 5)) * graphWidth;
      const y = h - 25 - (d.intensity / maxVal) * graphHeight;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.strokeStyle = '#06b6d4'; // cyan matching premium look
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Auto-peak labeling
    const labeledPeaks = [];
    for (let i = 2; i < xrdData.length - 2; i++) {
      const prev2 = xrdData[i-2].intensity;
      const prev1 = xrdData[i-1].intensity;
      const curr = xrdData[i].intensity;
      const next1 = xrdData[i+1].intensity;
      const next2 = xrdData[i+2].intensity;
      
      if (curr > prev1 && curr > prev2 && curr > next1 && curr > next2 && curr > maxVal * 0.12) {
        const twoTheta = xrdData[i].twoTheta;
        const lastPeak = labeledPeaks[labeledPeaks.length - 1];
        if (!lastPeak || (twoTheta - lastPeak.twoTheta) > 6.0) {
          labeledPeaks.push(xrdData[i]);
        } else if (curr > lastPeak.intensity) {
          labeledPeaks[labeledPeaks.length - 1] = xrdData[i];
        }
      }
    }

    // Draw peak labels
    labeledPeaks.forEach(peak => {
      const x = 35 + ((peak.twoTheta - 5) / (90 - 5)) * graphWidth;
      const y = h - 25 - (peak.intensity / maxVal) * graphHeight;
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI*2);
      ctx.fill();
      
      ctx.fillStyle = '#06b6d4';
      ctx.font = '8px sans-serif';
      ctx.fillText(`${peak.twoTheta.toFixed(1)}°`, x, y - 6);
    });
  } catch (err) {
    console.error("Error drawing XRD:", err);
  }
};

export default function Builder3D({ API_URL, loadedProject, onSaveSuccess, user }) {
  const [projectName, setProjectName] = useState('New 3D Crystal System');
  const [projectId, setProjectId] = useState(null);
  const rdfCanvasRef = useRef(null);
  const xrdCanvasRef = useRef(null);
  const [isRelaxing, setIsRelaxing] = useState(false);
  const [currentEnergy, setCurrentEnergy] = useState(0);

  // Atoms coordinate state
  const [atoms, setAtoms] = useState([]);
  const [selectedAtomId, setSelectedAtomId] = useState(null);
  
  // Custom manual atom form input
  const [inputElement, setInputElement] = useState('C');
  const [inputX, setInputX] = useState('0.0');
  const [inputY, setInputY] = useState('0.0');
  const [inputZ, setInputZ] = useState('0.0');

  // Parameters
  const [presetType, setPresetType] = useState('fcc');
  const [latticeSize, setLatticeSize] = useState({ x: 2, y: 2, z: 2 });
  const [latticeConstant, setLatticeConstant] = useState(4.08); // Au FCC default
  const [bondDistance, setBondDistance] = useState(3.0); // max bond distance in Angstroms
  
  const [saving, setSaving] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('lattice'); // 'lattice', 'table', 'rdf'
  const [statusMessage, setStatusMessage] = useState('');

  // Three.js refs
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const atomsGroupRef = useRef(null);
  const bondsGroupRef = useRef(null);

  // Check if a project is loaded
  useEffect(() => {
    if (loadedProject && loadedProject.type === '3d') {
      setProjectId(loadedProject.id);
      setProjectName(loadedProject.name);
      
      const newPresetType = loadedProject.settings.presetType || 'custom';
      setPresetType(newPresetType);
      
      const newBondDistance = loadedProject.settings.bondDistance || 3.0;
      setBondDistance(newBondDistance);
      
      const newLatticeConstant = loadedProject.settings.latticeConstant || 4.08;
      setLatticeConstant(newLatticeConstant);

      if (loadedProject.coordinates && loadedProject.coordinates.length > 0) {
        setAtoms(loadedProject.coordinates);
      } else {
        // Automatically build structure using the preset variables for dashboard links
        generateStructure(newPresetType, { x: 2, y: 2, z: 2 }, newLatticeConstant);
      }
    }
  }, [loadedProject]);

  // Initial Three.js setup
  useEffect(() => {
    if (!mountRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaf9f6);
    sceneRef.current = scene;

    // Create camera (using defensive default fallback values if the layout hasn't settled yet)
    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 450;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(12, 12, 18);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight1.position.set(20, 20, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xe5e2db, 0.3);
    dirLight2.position.set(-20, -20, -20);
    scene.add(dirLight2);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Groups for atoms and bonds
    const atomsGroup = new THREE.Group();
    const bondsGroup = new THREE.Group();
    scene.add(atomsGroup);
    scene.add(bondsGroup);
    atomsGroupRef.current = atomsGroup;
    bondsGroupRef.current = bondsGroup;

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x78716c, 0xe5e2db);
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    // Raycasting click selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerStartX = 0;
    let pointerStartY = 0;

    const onPointerDown = (event) => {
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    };

    const onPointerUp = (event) => {
      const dx = event.clientX - pointerStartX;
      const dy = event.clientY - pointerStartY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      // If user dragged more than 3px, assume camera navigation (OrbitControls) and ignore click selection
      if (dist > 3) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(atomsGroup.children);

      if (intersects.length > 0) {
        const clickedAtomId = intersects[0].object.userData.id;
        setSelectedAtomId(clickedAtomId);
      } else {
        // Deselect if clicking on empty space
        setSelectedAtomId(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Render loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth || 800;
      const h = mountRef.current.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Initialize with a default structure
    generateStructure();

    // Force a resize calculation shortly after mounting to capture layout settles
    const timeoutId = setTimeout(() => {
      handleResize();
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener('pointerdown', onPointerDown);
        rendererRef.current.domElement.removeEventListener('pointerup', onPointerUp);
      }
      if (rendererRef.current && rendererRef.current.domElement && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Redraw 3D scene whenever atoms or bonds distance changes
  useEffect(() => {
    if (!sceneRef.current || !atomsGroupRef.current || !bondsGroupRef.current) return;

    // Clear previous elements
    // Atoms
    while(atomsGroupRef.current.children.length > 0) {
      const child = atomsGroupRef.current.children[0];
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
      atomsGroupRef.current.remove(child);
    }
    
    // Bonds
    while(bondsGroupRef.current.children.length > 0) {
      const child = bondsGroupRef.current.children[0];
      child.geometry.dispose();
      child.material.dispose();
      bondsGroupRef.current.remove(child);
    }

    // Geometry templates
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);

    // Render Atoms
    atoms.forEach(atom => {
      const el = atom.element || 'C';
      const isSelected = selectedAtomId === atom.id;
      const color = isSelected ? 0xff3333 : (ELEMENT_COLORS[el] || ELEMENT_COLORS.Generic);
      const radius = (ELEMENT_RADII[el] || ELEMENT_RADII.Generic) * (isSelected ? 0.9 : 0.7);

      const material = new THREE.MeshPhongMaterial({
        color: color,
        shininess: isSelected ? 120 : 80,
        specular: isSelected ? 0xffffff : 0x444444,
        emissive: isSelected ? 0x440000 : 0x000000
      });

      const mesh = new THREE.Mesh(sphereGeometry, material);
      mesh.scale.set(radius, radius, radius);
      mesh.position.set(atom.x, atom.y, atom.z);
      
      // Store atom ID for selection
      mesh.userData = { id: atom.id };
      
      atomsGroupRef.current.add(mesh);
    });

    // Render Bonds
    const R2 = bondDistance * bondDistance;
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      for (let j = i + 1; j < atoms.length; j++) {
        const b = atoms[j];
        
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const d2 = dx*dx + dy*dy + dz*dz;

        // If distance is within bond length, draw cylinder
        if (d2 <= R2 && d2 > 0.1) {
          const dist = Math.sqrt(d2);
          
          const p1 = new THREE.Vector3(a.x, a.y, a.z);
          const p2 = new THREE.Vector3(b.x, b.y, b.z);
          
          const cylinderGeom = new THREE.CylinderGeometry(0.12, 0.12, dist, 8);
          const cylinderMat = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 10 });
          const cylinder = new THREE.Mesh(cylinderGeom, cylinderMat);
          
          // Position at midpoint
          cylinder.position.addVectors(p1, p2).multiplyScalar(0.5);
          
          // Align cylinder axis (0, 1, 0) to direction vector (p2 - p1)
          const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
          const alignAxis = new THREE.Vector3(0, 1, 0);
          cylinder.quaternion.setFromUnitVectors(alignAxis, dir);
          
          bondsGroupRef.current.add(cylinder);
        }
      }
    }
  }, [atoms, bondDistance, selectedAtomId]);

  // Premium Radial Distribution Function G(r) Simulator
  const drawRDF = (ctx, w, h) => {
    if (!ctx) return;
    try {
      ctx.fillStyle = '#0f111a';
      ctx.fillRect(0, 0, w, h);

      if (!atoms || !Array.isArray(atoms) || atoms.length < 2) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Add more atoms to plot RDF', w/2, h/2);
        return;
      }

      const distances = [];
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const dx = atoms[i].x - atoms[j].x;
          const dy = atoms[i].y - atoms[j].y;
          const dz = atoms[i].z - atoms[j].z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          distances.push(dist);
        }
      }

      const maxR = 8.0;
      const binWidth = 0.2;
      const numBins = Math.ceil(maxR / binWidth);
      const bins = new Array(numBins).fill(0);

      distances.forEach(d => {
        if (d < maxR) {
          const binIndex = Math.floor(d / binWidth);
          bins[binIndex]++;
        }
      });

      const normBins = bins.map((count, idx) => {
        const r = (idx + 0.5) * binWidth;
        if (r === 0) return 0;
        const shellVol = 4 * Math.PI * r * r * binWidth;
        return count / shellVol;
      });

      const maxVal = Math.max(...normBins) || 1;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(35, 15);
      ctx.lineTo(35, h - 25);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(35, h - 25);
      ctx.lineTo(w - 15, h - 25);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('0', 35, h - 12);
      ctx.fillText('4Å', 35 + (w - 50) / 2, h - 12);
      ctx.fillText('8Å', w - 20, h - 12);

      ctx.save();
      ctx.translate(12, h/2 - 5);
      ctx.rotate(-Math.PI/2);
      ctx.fillText('G(r)', 0, 0);
      ctx.restore();

      const graphWidth = w - 50;
      const graphHeight = h - 45;
      
      ctx.beginPath();
      normBins.forEach((val, idx) => {
        const r = idx * binWidth;
        const x = 35 + (r / maxR) * graphWidth;
        const y = h - 25 - (val / maxVal) * graphHeight;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.strokeStyle = '#c5a85c';
      ctx.lineWidth = 2;
      ctx.stroke();

      normBins.forEach((val, idx) => {
        const r = idx * binWidth;
        const x = 35 + (r / maxR) * graphWidth;
        const y = h - 25 - (val / maxVal) * graphHeight;
        
        if (idx > 0 && idx < normBins.length - 1 && normBins[idx] > normBins[idx-1] && normBins[idx] > normBins[idx+1] && normBins[idx] > maxVal * 0.15) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = '#c5a85c';
          ctx.font = '8px sans-serif';
          ctx.fillText(`${r.toFixed(1)}Å`, x, y - 6);
        }
      });
    } catch (err) {
      console.error("Error drawing RDF:", err);
    }
  };

  useEffect(() => {
    if (user?.isPremium && rdfCanvasRef.current) {
      const canvas = rdfCanvasRef.current;
      const ctx = canvas.getContext('2d');
      drawRDF(ctx, canvas.width, canvas.height);
    }
  }, [atoms, user?.isPremium, activeSidebarTab]);

  // Update potential energy when coordinates change
  useEffect(() => {
    if (atoms && atoms.length > 0) {
      const energy = calculateSystemEnergy(atoms);
      setCurrentEnergy(energy);
    } else {
      setCurrentEnergy(0);
    }
  }, [atoms]);

  // Real-time Lattice Energy Relaxation loop
  useEffect(() => {
    if (!isRelaxing || atoms.length === 0) return;
    
    let active = true;
    const runRelaxation = () => {
      if (!active) return;
      setAtoms(prevAtoms => {
        const nextAtoms = relaxStep(prevAtoms);
        
        // Convergence check: if net force on all atoms is very small, stop
        const forces = calculateForces(prevAtoms);
        let maxForce = 0;
        forces.forEach(f => {
          const fMag = Math.sqrt(f.x*f.x + f.y*f.y + f.z*f.z);
          if (fMag > maxForce) maxForce = fMag;
        });
        
        if (maxForce < 0.015) {
          setIsRelaxing(false);
          setStatusMessage("Structure relaxation converged: energy minimized.");
          active = false;
        }
        
        return nextAtoms;
      });
      
      if (active) {
        requestAnimationFrame(runRelaxation);
      }
    };
    
    const frameId = requestAnimationFrame(runRelaxation);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [isRelaxing, atoms.length]);

  // Effect to calculate and draw XRD pattern
  useEffect(() => {
    if (user?.isPremium && activeSidebarTab === 'xrd' && xrdCanvasRef.current) {
      const canvas = xrdCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const xrdData = calculateXRD(atoms);
      drawXRD(ctx, canvas.width, canvas.height, xrdData);
    }
  }, [atoms, user?.isPremium, activeSidebarTab]);

  // Generate presets
  const generateStructure = (type = presetType, size = latticeSize, constant = latticeConstant) => {
    let newAtoms = [];
    setSelectedAtomId(null);

    const activeConstant = constant;
    const activeSize = { ...size };

    switch (type) {
      case 'sc':
        newAtoms = generateSimpleCubic(activeSize.x, activeSize.y, activeSize.z, activeConstant);
        setBondDistance(activeConstant * 1.1);
        setProjectName(`Simple Cubic [${activeSize.x}x${activeSize.y}x${activeSize.z}]`);
        break;
      case 'bcc':
        newAtoms = generateBCC(activeSize.x, activeSize.y, activeSize.z, activeConstant);
        setBondDistance(activeConstant * 0.9);
        setProjectName(`BCC Lattice [${activeSize.x}x${activeSize.y}x${activeSize.z}]`);
        break;
      case 'fcc':
        newAtoms = generateFCC(activeSize.x, activeSize.y, activeSize.z, activeConstant);
        setBondDistance(activeConstant * 0.75);
        setProjectName(`FCC Lattice [${activeSize.x}x${activeSize.y}x${activeSize.z}]`);
        break;
      case 'graphene':
        newAtoms = generateGraphene(activeSize.x * 2, activeSize.y * 2, 1.42);
        setBondDistance(1.6);
        setProjectName(`Graphene Layer [${activeSize.x}x${activeSize.y}]`);
        break;
      case 'nanotube':
        newAtoms = generateCarbonNanotube(3.5, activeSize.x * 6, 1.42);
        setBondDistance(1.6);
        setProjectName(`Carbon Nanotube (Radius 3.5A)`);
        break;
      case 'water':
        newAtoms = loadPresetMolecule('water');
        setBondDistance(1.2);
        setProjectName('Water Molecule (H2O)');
        break;
      case 'caffeine':
        newAtoms = loadPresetMolecule('caffeine');
        setBondDistance(1.7);
        setProjectName('Caffeine Molecule');
        break;
      default:
        newAtoms = [];
    }

    setAtoms(newAtoms);
    setProjectId(null); // New structure
    setStatusMessage(`Generated ${newAtoms.length} atoms in structure.`);

    // Recenter camera
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(10, 10, 15);
      controlsRef.current.target.set(0, 0, 0);
    }
  };

  // CIF File Upload handler
  const handleCifUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setProjectName(file.name.replace(/\.[^/.]+$/, ""));
    setProjectId(null);
    setPresetType('custom');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedAtoms = parseCIF(event.target.result);
        if (parsedAtoms && parsedAtoms.length > 0) {
          setAtoms(parsedAtoms);
          setStatusMessage(`Successfully imported ${parsedAtoms.length} atoms from ${file.name}.`);
          
          // Estimate a bond distance based on elements loaded
          let maxD = 2.0;
          if (parsedAtoms.some(a => ['Au', 'Fe'].includes(a.element))) {
            maxD = 3.0;
          } else if (parsedAtoms.some(a => ['Si'].includes(a.element))) {
            maxD = 2.5;
          }
          setBondDistance(maxD);
          
          // Recenter camera based on bounding box
          if (cameraRef.current && controlsRef.current) {
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            parsedAtoms.forEach(a => {
              if (a.x < minX) minX = a.x;
              if (a.x > maxX) maxX = a.x;
              if (a.y < minY) minY = a.y;
              if (a.y > maxY) maxY = a.y;
              if (a.z < minZ) minZ = a.z;
              if (a.z > maxZ) maxZ = a.z;
            });
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const cz = (minZ + maxZ) / 2;
            const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 10;
            cameraRef.current.position.set(cx + size, cy + size, cz + size * 1.5);
            controlsRef.current.target.set(cx, cy, cz);
          }
        } else {
          alert("Could not parse coordinates from this CIF file. Make sure it contains loop_ blocks with _atom_site_fract_x/y/z values.");
        }
      } catch (err) {
        alert("Error parsing CIF: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Add Manual Atom
  const handleAddAtom = (e) => {
    e.preventDefault();
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    const z = parseFloat(inputZ);
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      alert('Invalid coordinates. Please input floating point numbers.');
      return;
    }

    const newAtom = {
      id: Math.random().toString(36).substring(2, 9),
      element: inputElement,
      x: x,
      y: y,
      z: z
    };

    setAtoms([...atoms, newAtom]);
    setSelectedAtomId(newAtom.id);
    setStatusMessage(`Added ${inputElement} atom manually.`);
  };

  // Edit coordinates inside table
  const handleCellEdit = (id, field, value) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return; // ignore invalid inputs in table
    
    setAtoms(atoms.map(a => {
      if (a.id === id) {
        return { ...a, [field]: parsed };
      }
      return a;
    }));
  };

  const handleElementEdit = (id, value) => {
    setAtoms(atoms.map(a => {
      if (a.id === id) {
        return { ...a, element: value };
      }
      return a;
    }));
  };

  // Delete Atom
  const handleDeleteAtom = () => {
    if (!selectedAtomId) return;
    setAtoms(atoms.filter(a => a.id !== selectedAtomId));
    setSelectedAtomId(null);
    setStatusMessage('Atom deleted.');
  };

  // Save project to database
  const saveProject = async () => {
    if (!projectName.trim()) {
      alert('Please enter a project name.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user.email
        },
        body: JSON.stringify({
          id: projectId,
          name: projectName,
          type: '3d',
          atomCount: atoms.length,
          coordinates: atoms,
          settings: { presetType, bondDistance, latticeConstant }
        })
      });
      
      if (!response.ok) throw new Error('Save failed.');
      const data = await response.json();
      setProjectId(data.id);
      setStatusMessage('Project saved successfully.');
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      alert('Error saving project: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export/csv`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user.email
        },
        body: JSON.stringify({
          name: projectName,
          type: '3d',
          coordinates: atoms
        })
      });
      if (!response.ok) throw new Error('Export failed.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_coordinates.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message);
    }
  };

  // Export XYZ
  const handleExportXYZ = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export/xyz`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user.email
        },
        body: JSON.stringify({
          name: projectName,
          coordinates: atoms
        })
      });
      if (!response.ok) throw new Error('Export failed.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.xyz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message);
    }
  };

  // Export VASP POSCAR
  const handleExportPOSCAR = () => {
    if (atoms.length === 0) return;
    
    // Group atoms by element type
    const groups = {};
    atoms.forEach(atom => {
      const el = atom.element || 'C';
      if (!groups[el]) groups[el] = [];
      groups[el].push(atom);
    });
    
    const elements = Object.keys(groups);
    
    // Construct bounding box with vacuum padding (10A)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    atoms.forEach(a => {
      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.y > maxY) maxY = a.y;
      if (a.z < minZ) minZ = a.z;
      if (a.z > maxZ) maxZ = a.z;
    });
    
    const sizeX = maxX - minX + 10;
    const sizeY = maxY - minY + 10;
    const sizeZ = maxZ - minZ + 10;
    
    const shiftX = 5 - minX;
    const shiftY = 5 - minY;
    const shiftZ = 5 - minZ;
    
    let poscar = `${projectName} - VASP POSCAR Export\n`;
    poscar += `1.0\n`;
    poscar += `     ${sizeX.toFixed(8).padStart(14)}   0.00000000   0.00000000\n`;
    poscar += `      0.00000000   ${sizeY.toFixed(8).padStart(14)}   0.00000000\n`;
    poscar += `      0.00000000   0.00000000   ${sizeZ.toFixed(8).padStart(14)}\n`;
    poscar += `   ${elements.map(el => el.padEnd(5)).join('')}\n`;
    poscar += `   ${elements.map(el => groups[el].length.toString().padEnd(5)).join('')}\n`;
    poscar += `Cartesian\n`;
    
    elements.forEach(el => {
      groups[el].forEach(a => {
        const x = (a.x + shiftX).toFixed(6).padStart(12);
        const y = (a.y + shiftY).toFixed(6).padStart(12);
        const z = (a.z + shiftZ).toFixed(6).padStart(12);
        poscar += `${x}${y}${z}\n`;
      });
    });
    
    const blob = new Blob([poscar], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_POSCAR`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMessage('Exported VASP POSCAR file.');
  };

  // Element counters
  const elementCounts = atoms.reduce((acc, atom) => {
    const el = atom.element || 'C';
    acc[el] = (acc[el] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="tab-container" id="builder3d-tab-container">
      <div className="workspace-grid" id="builder3d-grid">
        {/* Main 3D canvas panel */}
        <div className="glass-panel" id="threed-viewer-panel">
          <div className="panel-header widget-header-3d">
            <input 
              id="project-name-3d-input"
              type="text" 
              className="form-input" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={{ fontSize: '1.25rem', fontWeight: '600', width: '60%', background: 'transparent', border: 'none', padding: 0 }}
            />
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span>{atoms.length} Atoms (3D)</span>
            </div>
          </div>

          <div ref={mountRef} className="threed-container" id="canvas-3d-mount">
            <div className="threed-instructions">
              Left Click + Drag: Rotate | Right Click + Drag: Pan | Scroll: Zoom
            </div>
          </div>
          
          {/* Element Stats distribution */}
          <div style={{ marginTop: '1.25rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Element Distribution: </span>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.4rem' }} id="element-dist-badges">
              {Object.keys(elementCounts).length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>None</span>
              ) : (
                Object.entries(elementCounts).map(([el, count]) => (
                  <span key={el} className={`element-badge badge-${el.toLowerCase()}`}>
                    {el}: {count}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar parameters & coordinates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} id="sidebar-controls-3d">
          <div className="sidebar-tabs">
            <button 
              className={`sidebar-tab-btn ${activeSidebarTab === 'lattice' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('lattice')}
            >
              <Box size={12} />
              <span>Lattice Presets</span>
            </button>
            <button 
              className={`sidebar-tab-btn ${activeSidebarTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('table')}
            >
              <span>Coordinates ({atoms.length})</span>
            </button>
            {user?.isPremium && (
              <>
                <button 
                  className={`sidebar-tab-btn premium-tab-btn ${activeSidebarTab === 'rdf' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('rdf')}
                >
                  <span>✦ RDF G(r)</span>
                </button>
                <button 
                  className={`sidebar-tab-btn premium-tab-btn ${activeSidebarTab === 'xrd' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('xrd')}
                >
                  <span>✦ XRD Pattern</span>
                </button>
              </>
            )}
          </div>
          {activeSidebarTab === 'lattice' && (
            <>
              <div className="glass-panel">
                <div className="panel-header">
                  <h3 className="panel-title">
                    <Box size={18} />
                    Lattice Presets
                  </h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Structure Type</label>
                  <select 
                    id="select-3d-preset-type"
                    className="form-select"
                    value={presetType}
                    onChange={(e) => setPresetType(e.target.value)}
                  >
                    <option value="fcc">Gold FCC Lattice</option>
                    <option value="bcc">Iron BCC Lattice</option>
                    <option value="sc">Silicon Simple Cubic Lattice</option>
                    <option value="graphene">Graphene Honeycomb Sheet</option>
                    <option value="nanotube">Carbon Nanotube (CNT)</option>
                    <option value="water">Water Molecule (H2O)</option>
                    <option value="caffeine">Caffeine Molecule</option>
                  </select>
                </div>

                {/* Lattice scaling settings */}
                {['fcc', 'bcc', 'sc', 'graphene'].includes(presetType) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Dim X</label>
                      <input
                        id="param-lattice-x"
                        type="number"
                        min="1"
                        max="8"
                        className="form-input"
                        value={latticeSize.x}
                        onChange={(e) => setLatticeSize({ ...latticeSize, x: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Dim Y</label>
                      <input
                        id="param-lattice-y"
                        type="number"
                        min="1"
                        max="8"
                        className="form-input"
                        value={latticeSize.y}
                        onChange={(e) => setLatticeSize({ ...latticeSize, y: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    {presetType !== 'graphene' && (
                      <div>
                        <label className="form-label">Dim Z</label>
                        <input
                          id="param-lattice-z"
                          type="number"
                          min="1"
                          max="8"
                          className="form-input"
                          value={latticeSize.z}
                          onChange={(e) => setLatticeSize({ ...latticeSize, z: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Lattice constant slider */}
                {['fcc', 'bcc', 'sc'].includes(presetType) && (
                  <div className="slider-group">
                    <div className="slider-header">
                      <span>Lattice Constant (a)</span>
                      <span className="slider-val">{latticeConstant.toFixed(2)} Å</span>
                    </div>
                    <input
                      id="param-lattice-constant"
                      type="range"
                      min="2.0"
                      max="6.0"
                      step="0.05"
                      value={latticeConstant}
                      onChange={(e) => setLatticeConstant(parseFloat(e.target.value))}
                      className="slider-input"
                    />
                  </div>
                )}

                {/* Bond Distance threshold slider */}
                <div className="slider-group">
                  <div className="slider-header">
                    <span>Bond Limit Distance</span>
                    <span className="slider-val">{bondDistance.toFixed(2)} Å</span>
                  </div>
                  <input
                    id="param-bond-limit-3d"
                    type="range"
                    min="1.0"
                    max="6.0"
                    step="0.05"
                    value={bondDistance}
                    onChange={(e) => setBondDistance(parseFloat(e.target.value))}
                    className="slider-input"
                  />
                </div>

                <button 
                  id="btn-rebuild-lattice"
                  className="btn btn-primary" 
                  onClick={generateStructure}
                  style={{ width: '100%', gap: '0.5rem' }}
                >
                  <RotateCcw size={14} />
                  <span>Build Preset Model</span>
                </button>

                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>Crystallographic File Upload:</div>
                  <label 
                    className="btn" 
                    style={{ background: 'var(--bg-input)', borderStyle: 'dashed', cursor: 'pointer', display: 'flex', gap: '0.5rem' }}
                    id="label-cif-upload"
                  >
                    <Download size={14} style={{ transform: 'rotate(180deg)' }} />
                    <span>Upload Crystallographic .CIF</span>
                    <input 
                      type="file" 
                      accept=".cif" 
                      onChange={handleCifUpload} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              </div>

              {/* Add Atom Form Card */}
              <div className="glass-panel" style={{ marginTop: '1rem' }}>
                <div className="panel-header">
                  <h3 className="panel-title">Add Atom Manually</h3>
                </div>

                <form onSubmit={handleAddAtom}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Elem</label>
                      <select
                        id="select-add-atom-el"
                        className="form-select"
                        value={inputElement}
                        onChange={(e) => setInputElement(e.target.value)}
                        style={{ padding: '0.5rem 0.25rem' }}
                      >
                        <option value="C">C (Carbon)</option>
                        <option value="H">H (Hydrogen)</option>
                        <option value="O">O (Oxygen)</option>
                        <option value="N">N (Nitrogen)</option>
                        <option value="Au">Au (Gold)</option>
                        <option value="Si">Si (Silicon)</option>
                        <option value="Fe">Fe (Iron)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">X (A)</label>
                      <input
                        id="input-atom-x"
                        type="text"
                        className="form-input"
                        value={inputX}
                        onChange={(e) => setInputX(e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Y (A)</label>
                      <input
                        id="input-atom-y"
                        type="text"
                        className="form-input"
                        value={inputY}
                        onChange={(e) => setInputY(e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Z (A)</label>
                      <input
                        id="input-atom-z"
                        type="text"
                        className="form-input"
                        value={inputZ}
                        onChange={(e) => setInputZ(e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                    </div>
                  </div>

                  <button 
                    id="btn-add-atom-3d"
                    type="submit" 
                    className="btn btn-success" 
                    style={{ width: '100%', padding: '0.5rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Atom</span>
                  </button>
                </form>
              </div>

              {/* Lattice Energy Minimizer Card */}
              <div className="glass-panel" style={{ marginTop: '1rem' }} id="energy-minimizer-panel">
                <div className="panel-header">
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sliders size={16} />
                    Lattice Energy Minimizer
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Potential Energy:</span>
                    <span style={{ fontSize: '0.88rem', fontFamily: 'var(--font-mono)', fontWeight: '700', color: currentEnergy > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {currentEnergy.toFixed(4)} eV
                    </span>
                  </div>
                  <button
                    id="btn-relax-structure"
                    className={`btn ${isRelaxing ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => setIsRelaxing(!isRelaxing)}
                    style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center', transition: 'all 0.2s' }}
                    disabled={atoms.length === 0}
                  >
                    <RefreshCw size={14} style={{ animation: isRelaxing ? 'spin 1.5s linear infinite' : 'none' }} />
                    <span>{isRelaxing ? 'Stop Relaxation' : 'Relax Lattice Structure'}</span>
                  </button>
                  <details className="theory-details">
                    <summary className="theory-summary">Theory & Equations</summary>
                    <div className="theory-content">
                      <p style={{ marginBottom: '0.4rem' }}>
                        The minimizer relaxes the lattice by computing interatomic contact forces.
                      </p>
                      <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', margin: '0.3rem 0', textAlign: 'center' }}>
                        V(r) = ε [ (r₀/r)¹² - 2(r₀/r)⁶ ]
                      </p>
                      <ul style={{ paddingLeft: '1rem', marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <li><strong>r₀ = Rᵢ + Rⱼ</strong>: Contact spacing (sum of covalent radii).</li>
                        <li><strong>r⁻¹²</strong>: Short-range repulsion (prevents overlap).</li>
                        <li><strong>r⁻⁶</strong>: Long-range dispersive attraction.</li>
                        <li><strong>r ← r + α·F</strong>: Real-time gradient descent optimization.</li>
                      </ul>
                    </div>
                  </details>
                </div>
              </div>
            </>
          )}

          {/* Premium RDF Panel */}
          {user?.isPremium && activeSidebarTab === 'rdf' && (
            <div className="glass-panel rdf-panel" id="rdf-analysis-panel">
              <div className="panel-header widget-header-rdf" style={{ background: 'linear-gradient(90deg, #b45309, #d97706)', color: 'white', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', padding: '0.75rem 1rem' }}>
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontSize: '0.94rem' }}>
                  <Sparkles size={16} />
                  Radial Distribution Function, G(r)
                </h3>
              </div>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                  Probability curve of finding atomic neighbors at distance r (Å). Shows core coordinate shells.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', background: '#0f111a', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <canvas 
                    ref={rdfCanvasRef} 
                    width="170" 
                    height="130" 
                    style={{ borderRadius: '4px', background: '#0f111a' }}
                  />
                </div>
                <details className="theory-details">
                  <summary className="theory-summary">Theory & Equations</summary>
                  <div className="theory-content">
                    <p style={{ marginBottom: '0.4rem' }}>
                      The Radial Distribution Function G(r) represents the probability of finding an atom at a distance <code>r</code> from a reference atom.
                    </p>
                    <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', margin: '0.3rem 0', textAlign: 'center' }}>
                      G(r) = dN(r) / [ 4π r² ρ₀ dr ]
                    </p>
                    <p style={{ marginTop: '0.3rem' }}>
                      Sharp peaks correspond to specific shell distances (bond lengths) within the lattice structure.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Premium XRD Panel */}
          {user?.isPremium && activeSidebarTab === 'xrd' && (
            <div className="glass-panel rdf-panel" id="xrd-analysis-panel">
              <div className="panel-header widget-header-rdf" style={{ background: 'linear-gradient(90deg, #0e7490, #0891b2)', color: 'white', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', padding: '0.75rem 1rem' }}>
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontSize: '0.94rem' }}>
                  <Sparkles size={16} />
                  Powder XRD Simulation
                </h3>
              </div>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                  Simulated Powder X-Ray Diffraction pattern (Cu Kα, λ = 1.54056 Å). Real-time Debye scattering solver.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', background: '#0f111a', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <canvas 
                    ref={xrdCanvasRef} 
                    width="220" 
                    height="150" 
                    style={{ borderRadius: '4px', background: '#0f111a' }}
                  />
                </div>
                <details className="theory-details">
                  <summary className="theory-summary">Theory & Equations</summary>
                  <div className="theory-content">
                    <p style={{ marginBottom: '0.4rem' }}>
                      Simulates Powder X-Ray Diffraction using the client-side <strong>Debye Scattering Equation</strong>:
                    </p>
                    <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', margin: '0.3rem 0', textAlign: 'center' }}>
                      I(q) = Σ Zᵢ² + 2 Σ Zᵢ Zⱼ [ sin(q rᵢⱼ) / (q rᵢⱼ) ]
                    </p>
                    <ul style={{ paddingLeft: '1rem', marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <li><strong>q = 4π sin(θ) / λ</strong>: Momentum transfer.</li>
                      <li><strong>λ = 1.54056 Å</strong>: Copper Kα source.</li>
                      <li><strong>Zᵢ</strong>: Atomic number (gives realistic intensities).</li>
                      <li><strong>rᵢⱼ</strong>: Distance between atoms.</li>
                    </ul>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Coordinate Tables */}
          {activeSidebarTab === 'table' && (
            <div className="glass-panel" style={{ flex: 1 }} id="atoms-3d-table-panel">
              <div className="panel-header">
                <h3 className="panel-title">3D Lattice Coordinates</h3>
                {selectedAtomId && (
                  <button 
                    id="btn-delete-atom-3d"
                    className="btn btn-danger" 
                    onClick={handleDeleteAtom} 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    <Trash2 size={12} />
                    <span>Delete Selected</span>
                  </button>
                )}
              </div>

              {atoms.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--color-text-muted)' }}>
                  <Info size={20} style={{ marginBottom: '0.5rem' }} />
                  <span>Empty system.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
                  <div className="table-wrapper">
                    <table className="data-table" id="atoms-coordinates-3d-table">
                      <thead>
                        <tr>
                          <th>Elem</th>
                          <th>X (A)</th>
                          <th>Y (A)</th>
                          <th>Z (A)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atoms.map(atom => (
                          <tr 
                            key={atom.id}
                            className={selectedAtomId === atom.id ? 'selected' : ''}
                            onClick={() => setSelectedAtomId(atom.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <select
                                value={atom.element}
                                onChange={(e) => handleElementEdit(atom.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ background: 'transparent', color: 'var(--color-text-main)', border: 'none', fontFamily: 'inherit', fontWeight: 'bold' }}
                              >
                                <option value="C">C</option>
                                <option value="H">H</option>
                                <option value="O">O</option>
                                <option value="N">N</option>
                                <option value="Au">Au</option>
                                <option value="Si">Si</option>
                                <option value="Fe">Fe</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={atom.x}
                                onChange={(e) => handleCellEdit(atom.id, 'x', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ background: 'transparent', color: 'var(--color-text-main)', border: 'none', width: '60px', fontFamily: 'inherit' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={atom.y}
                                onChange={(e) => handleCellEdit(atom.id, 'y', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ background: 'transparent', color: 'var(--color-text-main)', border: 'none', width: '60px', fontFamily: 'inherit' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={atom.z}
                                onChange={(e) => handleCellEdit(atom.id, 'z', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ background: 'transparent', color: 'var(--color-text-main)', border: 'none', width: '60px', fontFamily: 'inherit' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                    <button 
                      id="btn-save-project-3d"
                      className="btn btn-success" 
                      onClick={saveProject} 
                      disabled={saving}
                      style={{ flex: 1, minWidth: '45%', padding: '0.5rem', fontSize: '0.85rem' }}
                    >
                      <Save size={14} />
                      <span>Save</span>
                    </button>
                    <button 
                      id="btn-export-csv-3d"
                      className="btn" 
                      onClick={handleExportCSV} 
                      style={{ flex: 1, minWidth: '45%', padding: '0.5rem', fontSize: '0.85rem' }}
                    >
                      <Download size={14} />
                      <span>CSV</span>
                    </button>
                    <button 
                      id="btn-export-xyz-3d"
                      className="btn" 
                      onClick={handleExportXYZ} 
                      style={{ flex: 1, minWidth: '45%', padding: '0.5rem', fontSize: '0.85rem' }}
                    >
                      <Download size={14} />
                      <span>XYZ</span>
                    </button>
                    <button 
                      id="btn-export-poscar-3d"
                      className="btn btn-primary" 
                      onClick={handleExportPOSCAR} 
                      style={{ flex: 1, minWidth: '45%', padding: '0.5rem', fontSize: '0.85rem', background: 'linear-gradient(to right, #0d9488, #0f766e)', border: 'none', color: 'white' }}
                    >
                      <Download size={14} />
                      <span>POSCAR</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
