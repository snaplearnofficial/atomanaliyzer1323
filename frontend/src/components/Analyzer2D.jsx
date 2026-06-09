import React, { useState, useEffect, useRef, useMemo } from 'react';
import { convertToGrayscale, boxBlur, findLocalMaxima, getLatticeBonds, computeCoordination } from '../utils/cv';
import { Upload, Sliders, Play, Plus, Trash2, Download, Save, Eye, EyeOff, Info, Sparkles, FileText } from 'lucide-react';

export default function Analyzer2D({ API_URL, loadedProject, onSaveSuccess, user, onUpgradeRequired }) {
  const [projectName, setProjectName] = useState('New Micrograph Scan');
  const [projectId, setProjectId] = useState(null);
  const fftCanvasRef = useRef(null);
  
  // CV Parameters
  const [threshold, setThreshold] = useState(120);
  const [minDistance, setMinDistance] = useState(20);
  const [blurRadius, setBlurRadius] = useState(2);
  const [invert, setInvert] = useState(false);
  const [bondDistance, setBondDistance] = useState(35);
  
  // UI Display Toggles
  const [showBonds, setShowBonds] = useState(true);
  const [showCoordination, setShowCoordination] = useState(true);
  const [selectedAtomId, setSelectedAtomId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('params'); // 'params', 'table', 'fft'
  
  // Image & Canvas state
  const [imageSrc, setImageSrc] = useState(null); // Data URL
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [coordinations, setCoordinations] = useState({});
  const [draggedAtomId, setDraggedAtomId] = useState(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 500, height: 400 });
  const [statusMessage, setStatusMessage] = useState('');

  // Scale Calibration States
  const [isCalibratingScale, setIsCalibratingScale] = useState(false);
  const [scaleStart, setScaleStart] = useState(null);
  const [scaleEnd, setScaleEnd] = useState(null);
  const [scaleDrawing, setScaleDrawing] = useState(false);
  const [pixelToPhysicalRatio, setPixelToPhysicalRatio] = useState(null);
  const [scalePhysicalValue, setScalePhysicalValue] = useState('1.42');
  const [scalePhysicalUnit, setScalePhysicalUnit] = useState('Å');
  const [showScalePopup, setShowScalePopup] = useState(false);

  // Helper to convert client coordinates to SVG viewport coordinates
  const getCanvasCoordinates = (e, svgElement) => {
    const rect = svgElement.getBoundingClientRect();
    const scaleX = canvasDimensions.width / rect.width;
    const scaleY = canvasDimensions.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Calculate Average Lattice Spacing
  const averageSpacing = useMemo(() => {
    if (bonds.length === 0) return '0 px';
    const totalDist = bonds.reduce((acc, b) => {
      return acc + Math.sqrt(Math.pow(b.x2 - b.x1, 2) + Math.pow(b.y2 - b.y1, 2));
    }, 0);
    const avgPx = totalDist / bonds.length;
    
    if (pixelToPhysicalRatio) {
      return (avgPx * pixelToPhysicalRatio).toFixed(3) + ' ' + scalePhysicalUnit;
    }
    return avgPx.toFixed(2) + ' px';
  }, [bonds, pixelToPhysicalRatio, scalePhysicalUnit]);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // If a project is loaded from backend or dashboard preset
  useEffect(() => {
    if (loadedProject && loadedProject.type === '2d') {
      setProjectId(loadedProject.id);
      setProjectName(loadedProject.name);
      setAtoms(loadedProject.coordinates || []);
      setThreshold(loadedProject.settings.threshold || 120);
      setMinDistance(loadedProject.settings.minDistance || 20);
      setBlurRadius(loadedProject.settings.blurRadius || 2);
      setInvert(loadedProject.settings.invert || false);
      setBondDistance(loadedProject.settings.bondDistance || 35);
      
      if (loadedProject.image) {
        setImageSrc(loadedProject.image);
      } else {
        // Automatically generate simulated lattice for presets from dashboard
        const type = loadedProject.name.toLowerCase().includes('graphene') ? 'graphene' : 'silicon';
        generateSimulatedLattice(type);
      }
    }
  }, [loadedProject]);

  // Compute bonds and coordination whenever atoms list or bond distance changes
  useEffect(() => {
    const computedBonds = getLatticeBonds(atoms, bondDistance);
    setBonds(computedBonds);
    const computedCoord = computeCoordination(atoms, computedBonds);
    setCoordinations(computedCoord);
  }, [atoms, bondDistance]);

  // Redraw image/run CV when image or CV parameters change
  useEffect(() => {
    if (imageSrc) {
      runDetection();
    }
  }, [imageSrc, threshold, minDistance, blurRadius, invert]);

  // Handle local image file upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const MAX_FREE_SIZE = 1 * 1024 * 1024; // 1 MB
    if (file.size > MAX_FREE_SIZE && !user?.isPremium) {
      e.target.value = ''; // Reset input
      setStatusMessage('Upload blocked: Micrographs larger than 1 MB require an Atom Analyzer Pro Plus subscription.');
      if (onUpgradeRequired) {
        onUpgradeRequired();
      }
      return;
    }
    
    setProjectName(file.name.replace(/\.[^/.]+$/, ""));
    setProjectId(null); // New project
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
      setStatusMessage(`Successfully loaded ${file.name} (${(file.size / 1024).toFixed(0)} KB).`);
    };
    reader.readAsDataURL(file);
  };

  // Premium Fast Fourier Transform (FFT) Reciprocal Lattice Simulator
  const drawFFT = (ctx, w, h) => {
    if (!ctx) return;
    try {
      ctx.fillStyle = '#0b0c10';
      ctx.fillRect(0, 0, w, h);
      
      const cx = w / 2;
      const cy = h / 2;
      
      // Central primary electron beam (000 reflection)
      const centerGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 12);
      centerGrad.addColorStop(0, '#ffffff');
      centerGrad.addColorStop(0.3, 'rgba(197, 168, 92, 0.9)'); // golden glow
      centerGrad.addColorStop(1, 'rgba(197, 168, 92, 0)');
      ctx.fillStyle = centerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();

      // Concentric Reciprocal Shell rings
      ctx.strokeStyle = 'rgba(197, 168, 92, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      if (atoms && Array.isArray(atoms) && atoms.length > 2) {
        // Hexagonal vs Cubic periodicity
        const isHexagonal = projectName.toLowerCase().includes('graphene') || atoms.length > 18;
        const numSpots = isHexagonal ? 6 : 4;
        const r = isHexagonal ? 30 : 45;
        
        // Draw spots
        for (let i = 0; i < numSpots; i++) {
          const angle = (i * Math.PI * 2) / numSpots + (isHexagonal ? Math.PI / 6 : 0);
          const sx = cx + Math.cos(angle) * r;
          const sy = cy + Math.sin(angle) * r;
          
          // 1st order diffraction spots
          const spotGrad = ctx.createRadialGradient(sx, sy, 1, sx, sy, 6);
          spotGrad.addColorStop(0, '#ffffff');
          spotGrad.addColorStop(0.5, '#c5a85c'); // Premium gold accent
          spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = spotGrad;
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();

          // 2nd order outer diffraction spots
          const sx2 = cx + Math.cos(angle) * r * 1.8;
          const sy2 = cy + Math.sin(angle) * r * 1.8;
          const spotGrad2 = ctx.createRadialGradient(sx2, sy2, 1, sx2, sy2, 4);
          spotGrad2.addColorStop(0, '#ffffff');
          spotGrad2.addColorStop(0.5, 'rgba(197, 168, 92, 0.4)');
          spotGrad2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = spotGrad2;
          ctx.beginPath();
          ctx.arc(sx2, sy2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } catch (err) {
      console.error("Error drawing FFT:", err);
    }
  };

  useEffect(() => {
    if (user?.isPremium && fftCanvasRef.current) {
      const canvas = fftCanvasRef.current;
      const ctx = canvas.getContext('2d');
      drawFFT(ctx, canvas.width, canvas.height);
    }
  }, [atoms, user?.isPremium, projectName, activeSidebarTab]);

  // Generate microscopy simulation image
  const generateSimulatedLattice = (type) => {
    setProjectId(null); // Reset
    setProjectName(type === 'graphene' ? 'Graphene Lattice Simulation' : 'Silicon [110] TEM Simulation');
    
    const canvas = document.createElement('canvas');
    const w = 600;
    const h = 450;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    
    // Background gradient (simulating dark field illumination or camera lighting variance)
    const bgGrad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, 400);
    if (type === 'graphene') {
      bgGrad.addColorStop(0, '#0c0d13');
      bgGrad.addColorStop(1, '#020305');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);
      
      // Draw Graphene hexagonal atoms (STEM mode: white atoms on dark background)
      const cc = 24; // C-C bond length in px
      const a = cc * Math.sqrt(3);
      ctx.fillStyle = '#ffffff';
      
      for (let i = -1; i < w/a + 1; i++) {
        for (let j = -1; j < h/(cc*1.5) + 1; j++) {
          // Sublattice A
          let xA = i * a;
          let yA = j * cc * 1.5;
          if (j % 2 !== 0) xA += a / 2;
          
          // Sublattice B
          let xB = xA;
          let yB = yA + cc;
          
          // Draw Gaussian-like glowing spots for atoms
          drawGlowingAtom(ctx, xA, yA, 14, 180);
          drawGlowingAtom(ctx, xB, yB, 14, 180);
        }
      }
    } else {
      // Silicon dumbbell TEM simulation (Bright-field simulation: bright spots, local dumbbells)
      bgGrad.addColorStop(0, '#121622');
      bgGrad.addColorStop(1, '#06080d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);
      
      const stepX = 70;
      const stepY = 70;
      const dbDistance = 15; // Dumbbell separation px
      
      for (let x = 40; x < w; x += stepX) {
        for (let y = 40; y < h; y += stepY) {
          // Dumbbell atom 1
          drawGlowingAtom(ctx, x - dbDistance/2, y, 16, 210);
          // Dumbbell atom 2
          drawGlowingAtom(ctx, x + dbDistance/2, y, 16, 210);
          
          // Add some interstitial atom defects (vacancy or interstitial)
          if (x === 180 && y === 180) {
            // Vacancy: don't draw or draw faint
          }
        }
      }
    }
    
    // Add noise & sensor blur
    addSensorNoise(ctx, w, h);
    
    // Convert to Image source
    setImageSrc(canvas.toDataURL());
  };

  // Helper to draw a glowing atom (mimicking TEM point spread function)
  const drawGlowingAtom = (ctx, x, y, radius, maxVal) => {
    const radialGlow = ctx.createRadialGradient(x, y, 1, x, y, radius);
    radialGlow.addColorStop(0, `rgba(${maxVal}, ${maxVal}, ${maxVal}, 1)`);
    radialGlow.addColorStop(0.3, `rgba(${maxVal*0.75}, ${maxVal*0.75}, ${maxVal*0.75}, 0.6)`);
    radialGlow.addColorStop(0.7, `rgba(${maxVal*0.2}, ${maxVal*0.2}, ${maxVal*0.2}, 0.15)`);
    radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGlow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  // Helper to add white noise and sensor grain
  const addSensorNoise = (ctx, w, h) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12; // +/- 6 grey levels
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
      data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Run computer vision detection pipeline
  const runDetection = () => {
    if (!canvasRef.current) return;
    
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setCanvasDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // 1. Grayscale
      let grayData = convertToGrayscale(imgData);
      
      // 2. Blur to eliminate speckle noise
      grayData = boxBlur(grayData, canvas.width, canvas.height, blurRadius);
      
      // 3. Peak Finding (Local Maxima)
      const detectedPeaks = findLocalMaxima(grayData, canvas.width, canvas.height, threshold, minDistance, invert);
      setAtoms(detectedPeaks);
      setStatusMessage(`Found ${detectedPeaks.length} atoms successfully.`);
    };
  };

  // SVG Mouse Interaction: Manual atom adjustments and scale calibration
  const handleSvgClick = (e) => {
    if (isCalibratingScale) return;
    
    // If they clicked on background, add atom
    if (e.target.tagName !== 'svg') return;
    
    const coords = getCanvasCoordinates(e, e.currentTarget);
    
    // Add new atom
    const newAtom = {
      id: Math.random().toString(36).substring(2, 9),
      x: coords.x,
      y: coords.y,
      intensity: 200, // Arbitrary
      element: 'Atom'
    };
    
    setAtoms([...atoms, newAtom]);
    setSelectedAtomId(newAtom.id);
  };

  const handleSvgMouseDown = (e) => {
    if (!isCalibratingScale) return;
    const coords = getCanvasCoordinates(e, e.currentTarget);
    setScaleStart(coords);
    setScaleEnd(coords);
    setScaleDrawing(true);
    setShowScalePopup(false);
  };

  // Dragging handlers
  const handleAtomMouseDown = (id, e) => {
    if (isCalibratingScale) return;
    e.stopPropagation();
    setDraggedAtomId(id);
    setSelectedAtomId(id);
  };

  const handleSvgMouseMove = (e) => {
    if (isCalibratingScale && scaleDrawing) {
      const coords = getCanvasCoordinates(e, e.currentTarget);
      setScaleEnd(coords);
    } else if (draggedAtomId) {
      const coords = getCanvasCoordinates(e, e.currentTarget);
      setAtoms(atoms.map(a => {
        if (a.id === draggedAtomId) {
          return { ...a, x: Math.max(0, Math.min(canvasDimensions.width, coords.x)), y: Math.max(0, Math.min(canvasDimensions.height, coords.y)) };
        }
        return a;
      }));
    }
  };

  const handleSvgMouseUp = () => {
    if (isCalibratingScale && scaleDrawing) {
      setScaleDrawing(false);
      setShowScalePopup(true);
    } else {
      setDraggedAtomId(null);
    }
  };

  // Keyboard/button deletion
  const deleteSelectedAtom = () => {
    if (!selectedAtomId) return;
    setAtoms(atoms.filter(a => a.id !== selectedAtomId));
    setSelectedAtomId(null);
  };

  // Keyboard shortcut listener for atom deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedAtomId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
          return;
        }
        deleteSelectedAtom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAtomId, atoms]);

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
          type: '2d',
          atomCount: atoms.length,
          coordinates: atoms,
          settings: { threshold, minDistance, blurRadius, invert, bondDistance },
          image: imageSrc
        })
      });
      
      if (!response.ok) throw new Error('Save failed.');
      const data = await response.json();
      setProjectId(data.id);
      setStatusMessage('Project saved to database.');
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
          type: '2d',
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
      alert('Export failed: ' + err.message);
    }
  };

  // Export PDF Report
  const handleExportPDF = () => {
    if (!imageSrc) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to generate the PDF report.");
      return;
    }
    
    // Generate overlay SVG for the print report
    const bondsSvg = showBonds ? bonds.map(bond => `
      <line
        x1="${bond.x1}"
        y1="${bond.y1}"
        x2="${bond.x2}"
        y2="${bond.y2}"
        style="stroke: rgba(255, 255, 255, 0.5); stroke-width: 1.5px;"
      />
    `).join('') : '';

    const atomsSvg = atoms.map(atom => {
      const coordNum = coordinations[atom.id] || 0;
      const ringColor = showCoordination ? getCoordinationColor(coordNum) : 'rgba(57, 255, 20, 0.7)';
      const fillColor = ringColor.replace('0.7', '0.2').replace('0.8', '0.2');
      return `
        <circle
          cx="${atom.x}"
          cy="${atom.y}"
          r="6"
          style="stroke: ${ringColor}; stroke-width: 1.5px; fill: ${fillColor};"
        />
      `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>${projectName} - Analysis Report</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #111; max-width: 800px; margin: 0 auto; padding: 40px; }
            h1 { color: #222; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .meta { color: #555; margin-bottom: 30px; }
            .metrics { display: flex; gap: 20px; margin-bottom: 30px; }
            .metric-box { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 8px; flex: 1; text-align: center; }
            .metric-box strong { display: block; font-size: 24px; color: #0d6efd; margin-top: 5px; }
            img { max-width: 100%; display: block; height: auto; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .overlay-container { position: relative; display: inline-block; max-width: 100%; border: 1px solid #ccc; margin-bottom: 30px; background: #000; }
          </style>
        </head>
        <body>
          <h1>Atom Analyzer Pro Report</h1>
          <div class="meta">
            <p><strong>Project:</strong> ${projectName}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="metrics">
            <div class="metric-box">
              Total Atoms Detected
              <strong>${atoms.length}</strong>
            </div>
            <div class="metric-box">
              Average Lattice Spacing
              <strong>${averageSpacing} px</strong>
            </div>
          </div>
          
          <h2>Analyzed Micrograph</h2>
          <div class="overlay-container">
            <img src="${imageSrc}" alt="Micrograph" />
            <svg viewBox="0 0 ${canvasDimensions.width} ${canvasDimensions.height}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
              ${bondsSvg}
              ${atomsSvg}
            </svg>
          </div>
          
          <h2>Coordinate Data</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>X ${pixelToPhysicalRatio ? `(${scalePhysicalUnit})` : '(px)'}</th>
                <th>Y ${pixelToPhysicalRatio ? `(${scalePhysicalUnit})` : '(px)'}</th>
                <th>Neighbors</th>
              </tr>
            </thead>
            <tbody>
              ${atoms.map(a => {
                const displayX = pixelToPhysicalRatio ? (a.x * pixelToPhysicalRatio).toFixed(2) : a.x.toFixed(1);
                const displayY = pixelToPhysicalRatio ? (a.y * pixelToPhysicalRatio).toFixed(2) : a.y.toFixed(1);
                return `<tr><td>${a.id}</td><td>${displayX}</td><td>${displayY}</td><td>${coordinations[a.id] || 0}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Coordination status color helper
  const getCoordinationColor = (count) => {
    // Undercoordinated or overcoordinated carbon relative to graphene (3-coordinated)
    if (count === 3) return 'rgba(57, 255, 20, 0.7)'; // Stable graphene C
    if (count === 2) return 'rgba(0, 242, 254, 0.8)'; // Edge or vacancy boundary
    if (count === 1) return 'rgba(79, 172, 254, 0.8)'; // Dangling atom
    return 'rgba(255, 77, 77, 0.8)'; // Defect or interstitial
  };

  return (
    <div className="tab-container" id="analyzer2d-tab-container">
      <div className="workspace-grid" id="analyzer2d-grid">
        {/* Main interactive canvas column */}
        <div className="glass-panel" id="canvas-main-panel">
          <div className="panel-header widget-header-2d">
            <input 
              id="project-name-2d-input"
              type="text" 
              className="form-input" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={{ fontSize: '1.25rem', fontWeight: '600', width: '60%', background: 'transparent', border: 'none', padding: 0 }}
            />
            <div className="status-indicator" style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className={saving ? 'status-dot saving' : 'status-dot'}></span>
                <span>{atoms.length} Atoms</span>
              </div>
              {bonds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
                  <span>Avg Spacing: {averageSpacing}</span>
                </div>
              )}
            </div>
          </div>

          {!imageSrc ? (
            <div className="upload-zone" id="upload-zone-box" onClick={() => document.getElementById('file-upload-2d').click()}>
              <Upload size={48} className="upload-icon" />
              <h3>Upload Micrograph Image</h3>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>Drag and drop or browse local system (PNG, JPG, TIFF)</p>
              <input 
                id="file-upload-2d" 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                style={{ display: 'none' }} 
              />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
                <button 
                  id="sim-graphene-btn"
                  className="btn" 
                  onClick={(e) => { e.stopPropagation(); generateSimulatedLattice('graphene'); }}
                >
                  Load Graphene STEM Simulation
                </button>
                <button 
                  id="sim-silicon-btn"
                  className="btn" 
                  onClick={(e) => { e.stopPropagation(); generateSimulatedLattice('silicon'); }}
                >
                  Load Silicon HRTEM Simulation
                </button>
              </div>
            </div>
          ) : (
            <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="canvas-wrapper" id="canvas-view-wrapper">
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <img 
                  src={imageSrc} 
                  className="micrograph-image" 
                  alt="Micrograph" 
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                />
                
                {/* SVG Overlay for drawing atoms and bonds */}
                <svg
                  className="canvas-overlay"
                  viewBox={`0 0 ${canvasDimensions.width} ${canvasDimensions.height}`}
                  onClick={handleSvgClick}
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={handleSvgMouseUp}
                  id="canvas-overlay-svg"
                >
                  {/* Draw Bonds */}
                  {showBonds && bonds.map((bond, idx) => (
                    <line
                      key={`bond-${idx}`}
                      x1={bond.x1}
                      y1={bond.y1}
                      x2={bond.x2}
                      y2={bond.y2}
                      className="lattice-bond"
                    />
                  ))}
                  
                  {/* Scale Calibration Line */}
                  {scaleStart && scaleEnd && (
                    <g>
                      <line
                        x1={scaleStart.x}
                        y1={scaleStart.y}
                        x2={scaleEnd.x}
                        y2={scaleEnd.y}
                        stroke="var(--accent-orange)"
                        strokeWidth="3"
                        strokeDasharray="4,4"
                      />
                      <circle cx={scaleStart.x} cy={scaleStart.y} r="5" fill="var(--accent-orange)" />
                      <circle cx={scaleEnd.x} cy={scaleEnd.y} r="5" fill="var(--accent-orange)" />
                    </g>
                  )}
                  
                  {/* Draw Atom Markers */}
                  {atoms.map(atom => {
                    const coordNum = coordinations[atom.id] || 0;
                    const ringColor = showCoordination ? getCoordinationColor(coordNum) : 'var(--accent-green)';
                    return (
                      <circle
                        key={atom.id}
                        cx={atom.x}
                        cy={atom.y}
                        r={draggedAtomId === atom.id ? 8 : 6}
                        className={`atom-marker ${selectedAtomId === atom.id ? 'selected' : ''}`}
                        style={{
                          stroke: ringColor,
                          fill: selectedAtomId === atom.id ? 'rgba(255, 77, 77, 0.4)' : `${ringColor.replace('0.7', '0.2').replace('0.8', '0.2')}`
                        }}
                        onMouseDown={(e) => handleAtomMouseDown(atom.id, e)}
                      />
                    );
                  })}
                </svg>
              </div>
              
              {showScalePopup && scaleStart && scaleEnd && (
                <div className="glass-panel glow-orange" style={{ padding: '1.25rem', border: '1px solid var(--accent-orange)', background: 'rgba(28, 25, 23, 0.95)', position: 'relative', zIndex: 10, marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent-orange)', marginBottom: '0.5rem' }}>Calibrate Scale Bar</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                    Drawn Distance: <strong>{Math.sqrt(Math.pow(scaleEnd.x - scaleStart.x, 2) + Math.pow(scaleEnd.y - scaleStart.y, 2)).toFixed(1)} px</strong>. 
                    Enter the known physical length of this line:
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      value={scalePhysicalValue}
                      onChange={(e) => setScalePhysicalValue(e.target.value)}
                      style={{ width: '100px', padding: '0.4rem' }}
                      placeholder="e.g. 1.42"
                    />
                    <select 
                      className="form-select"
                      value={scalePhysicalUnit}
                      onChange={(e) => setScalePhysicalUnit(e.target.value)}
                      style={{ width: '80px', padding: '0.4rem' }}
                    >
                      <option value="Å">Å</option>
                      <option value="nm">nm</option>
                      <option value="pm">pm</option>
                    </select>
                    <button 
                      className="btn btn-success"
                      onClick={() => {
                        const pxDist = Math.sqrt(Math.pow(scaleEnd.x - scaleStart.x, 2) + Math.pow(scaleEnd.y - scaleStart.y, 2));
                        const val = parseFloat(scalePhysicalValue);
                        if (pxDist > 2 && !isNaN(val) && val > 0) {
                          setPixelToPhysicalRatio(val / pxDist);
                          setIsCalibratingScale(false);
                          setShowScalePopup(false);
                          setStatusMessage(`Scale calibrated: 1 pixel = ${(val / pxDist).toFixed(5)} ${scalePhysicalUnit}.`);
                        } else {
                          alert('Invalid calibration line or value.');
                        }
                      }}
                      style={{ padding: '0.45rem 1rem' }}
                    >
                      Apply
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => {
                        setScaleStart(null);
                        setScaleEnd(null);
                        setShowScalePopup(false);
                      }}
                      style={{ padding: '0.45rem 1rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {statusMessage || 'Click on micrograph to add atoms. Drag to adjust position.'}
                </span>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    id="btn-calibrate-scale"
                    className={`btn ${isCalibratingScale ? 'btn-primary' : ''}`}
                    onClick={() => {
                      setIsCalibratingScale(!isCalibratingScale);
                      setScaleStart(null);
                      setScaleEnd(null);
                      setShowScalePopup(false);
                      setStatusMessage(isCalibratingScale ? '' : 'Scale Calibration: Click and drag a line over a known scale bar or spacing on the image.');
                    }}
                    style={{ padding: '0.4rem 0.8rem', borderColor: isCalibratingScale ? 'var(--accent-orange)' : 'var(--border-color)', color: isCalibratingScale ? '#ffffff' : 'inherit' }}
                  >
                    {isCalibratingScale ? 'Exit Calibration' : 'Calibrate Scale Bar'}
                  </button>
                  <button 
                    id="btn-clear-image"
                    className="btn btn-danger" 
                    onClick={() => { setImageSrc(null); setAtoms([]); setBonds([]); setProjectId(null); setPixelToPhysicalRatio(null); setScaleStart(null); setScaleEnd(null); }}
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    Clear Micrograph
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Parameters Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} id="sidebar-controls-column">
          <div className="sidebar-tabs">
            <button 
              className={`sidebar-tab-btn ${activeSidebarTab === 'params' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('params')}
            >
              <Sliders size={12} />
              <span>Parameters</span>
            </button>
            <button 
              className={`sidebar-tab-btn ${activeSidebarTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('table')}
            >
              <span>Atoms ({atoms.length})</span>
            </button>
            {user?.isPremium && (
              <button 
                className={`sidebar-tab-btn premium-tab-btn ${activeSidebarTab === 'fft' ? 'active' : ''}`}
                onClick={() => setActiveSidebarTab('fft')}
              >
                <span>✦ FFT Diffraction</span>
              </button>
            )}
          </div>

          {/* CV Controls */}
          {activeSidebarTab === 'params' && (
            <div className="glass-panel glow-cyan" id="cv-parameters-panel">
              <div className="panel-header">
                <h3 className="panel-title">
                  <Sliders size={18} />
                  Detection Parameters
                </h3>
              </div>
              
              <div className="slider-group">
                <div className="slider-header">
                  <span>Peak Intensity Threshold</span>
                  <span className="slider-val">{threshold}</span>
                </div>
                <input
                  id="param-threshold"
                  type="range"
                  min="10"
                  max="245"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="slider-input"
                  disabled={!imageSrc}
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span>Minimum Atom Distance (Radius)</span>
                  <span className="slider-val">{minDistance} px</span>
                </div>
                <input
                  id="param-radius"
                  type="range"
                  min="5"
                  max="60"
                  value={minDistance}
                  onChange={(e) => setMinDistance(parseInt(e.target.value))}
                  className="slider-input"
                  disabled={!imageSrc}
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span>Gaussian Smoothing Radius</span>
                  <span className="slider-val">{blurRadius} px</span>
                </div>
                <input
                  id="param-blur"
                  type="range"
                  min="0"
                  max="6"
                  value={blurRadius}
                  onChange={(e) => setBlurRadius(parseInt(e.target.value))}
                  className="slider-input"
                  disabled={!imageSrc}
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span>Max Lattice Bond Distance</span>
                  <span className="slider-val">{bondDistance} px</span>
                </div>
                <input
                  id="param-bond"
                  type="range"
                  min="10"
                  max="100"
                  value={bondDistance}
                  onChange={(e) => setBondDistance(parseInt(e.target.value))}
                  className="slider-input"
                  disabled={!imageSrc}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    id="param-invert"
                    type="checkbox"
                    checked={invert}
                    onChange={(e) => setInvert(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                    disabled={!imageSrc}
                  />
                  <span>Invert Image (Detect Dark Atoms)</span>
                </label>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    id="toggle-bonds"
                    className={`btn ${showBonds ? 'active' : ''}`}
                    onClick={() => setShowBonds(!showBonds)}
                    style={{ flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.8rem' }}
                    disabled={!imageSrc}
                  >
                    {showBonds ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>Bonds</span>
                  </button>
                  <button
                    id="toggle-coordination"
                    className={`btn ${showCoordination ? 'active' : ''}`}
                    onClick={() => setShowCoordination(!showCoordination)}
                    style={{ flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.8rem' }}
                    disabled={!imageSrc}
                  >
                    {showCoordination ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>Defect Analysis</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Premium FFT Power Spectrum Panel */}
          {user?.isPremium && activeSidebarTab === 'fft' && (
            <div className="glass-panel fft-panel" id="fft-diffraction-panel">
              <div className="panel-header widget-header-fft" style={{ background: 'linear-gradient(90deg, #b45309, #d97706)', color: 'white', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', padding: '0.75rem 1rem' }}>
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontSize: '0.94rem' }}>
                  <Sparkles size={16} />
                  Crystallographic FFT Diffraction
                </h3>
              </div>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                  Live reciprocal space map representing the structural periodicity of mapped atoms.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', background: '#0a0d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <canvas 
                    ref={fftCanvasRef} 
                    width="160" 
                    height="160" 
                    style={{ borderRadius: '4px', background: '#0b0c10' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Atom Coordinates Table / Manual Controls */}
          {activeSidebarTab === 'table' && (
            <div className="glass-panel" style={{ flex: 1 }} id="coordinate-table-panel">
              <div className="panel-header">
                <h3 className="panel-title">Atom Mapping Table</h3>
                {selectedAtomId && (
                  <button 
                    id="btn-delete-selected-atom"
                    className="btn btn-danger" 
                    onClick={deleteSelectedAtom} 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    <Trash2 size={12} />
                    <span>Delete Selected</span>
                  </button>
                )}
              </div>

              {atoms.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--color-text-muted)' }}>
                  <Info size={24} style={{ marginBottom: '0.5rem' }} />
                  <span>No atoms mapped yet.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
                  
                  {/* Coordination Statistics */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ width: '100%', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Defect Statistics:</div>
                    {[0, 1, 2, 3, 4, 5, 6].map(n => {
                      const count = atoms.filter(a => (coordinations[a.id] || 0) === n).length;
                      if (count === 0) return null;
                      return (
                        <div key={n} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          <span style={{ color: getCoordinationColor(n) }}>●</span> {n} bonds: <strong>{count}</strong>
                        </div>
                      );
                    })}
                  </div>

                  <div className="table-wrapper">
                    <table className="data-table" id="atoms-coordinates-2d-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>X {pixelToPhysicalRatio ? `(${scalePhysicalUnit})` : '(px)'}</th>
                          <th>Y {pixelToPhysicalRatio ? `(${scalePhysicalUnit})` : '(px)'}</th>
                          <th>Coord</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atoms.map(atom => {
                          const coord = coordinations[atom.id] || 0;
                          const displayX = pixelToPhysicalRatio ? (atom.x * pixelToPhysicalRatio).toFixed(2) : atom.x.toFixed(1);
                          const displayY = pixelToPhysicalRatio ? (atom.y * pixelToPhysicalRatio).toFixed(2) : atom.y.toFixed(1);
                          return (
                            <tr 
                              key={atom.id}
                              className={selectedAtomId === atom.id ? 'selected' : ''}
                              onClick={() => setSelectedAtomId(atom.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>{atom.id}</td>
                              <td>{displayX}</td>
                              <td>{displayY}</td>
                              <td>
                                <span 
                                  className="element-badge"
                                  style={{ 
                                    background: showCoordination ? getCoordinationColor(coord).replace('0.7', '0.1').replace('0.8', '0.1') : 'rgba(255,255,255,0.05)',
                                    color: showCoordination ? getCoordinationColor(coord) : 'var(--color-text-main)',
                                    borderColor: showCoordination ? getCoordinationColor(coord) : 'var(--border-color)'
                                  }}
                                >
                                  {coord} Neighbors
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                    <button 
                      id="btn-save-project-2d"
                      className="btn btn-success" 
                      onClick={saveProject} 
                      disabled={saving || !imageSrc}
                      style={{ flex: 1, minWidth: '45%' }}
                    >
                      <Save size={14} />
                      <span>Save Analysis</span>
                    </button>
                    <button 
                      id="btn-export-csv-2d"
                      className="btn" 
                      onClick={handleExportCSV} 
                      disabled={atoms.length === 0}
                      style={{ flex: 1, minWidth: '45%' }}
                    >
                      <Download size={14} />
                      <span>Export CSV</span>
                    </button>
                    <button 
                      id="btn-export-pdf-2d"
                      className="btn" 
                      onClick={handleExportPDF} 
                      disabled={atoms.length === 0}
                      style={{ flex: 1, minWidth: '100%', background: 'linear-gradient(to right, #dc2626, #991b1b)', color: 'white', border: 'none' }}
                    >
                      <FileText size={14} />
                      <span>Export PDF Report</span>
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
