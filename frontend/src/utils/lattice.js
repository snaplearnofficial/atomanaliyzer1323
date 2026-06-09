/**
 * Crystal Lattice and Molecular coordinates generators
 * Coordinates are returned in Angstroms (A)
 */

// Generate unique ID
function makeId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * 1. Simple Cubic Lattice
 */
export function generateSimpleCubic(nx = 3, ny = 3, nz = 3, latticeConstant = 3.6) {
  const atoms = [];
  const a = latticeConstant;
  
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        atoms.push({
          id: makeId(),
          element: 'Si', // Silicon or generic element
          x: x * a - ((nx - 1) * a) / 2,
          y: y * a - ((ny - 1) * a) / 2,
          z: z * a - ((nz - 1) * a) / 2
        });
      }
    }
  }
  return atoms;
}

/**
 * 2. Body-Centered Cubic (BCC)
 */
export function generateBCC(nx = 2, ny = 2, nz = 2, latticeConstant = 2.87) { // Fe lattice constant: 2.87 A
  const atoms = [];
  const a = latticeConstant;
  
  // Center shift offsets
  const dx = ((nx - 1) * a) / 2;
  const dy = ((ny - 1) * a) / 2;
  const dz = ((nz - 1) * a) / 2;
  
  for (let x = 0; x <= nx; x++) {
    for (let y = 0; y <= ny; y++) {
      for (let z = 0; z <= nz; z++) {
        // Corner atoms
        atoms.push({
          id: makeId(),
          element: 'Fe',
          x: x * a - dx,
          y: y * a - dy,
          z: z * a - dz
        });
        
        // Body center atoms (inside unit cell)
        if (x < nx && y < ny && z < nz) {
          atoms.push({
            id: makeId(),
            element: 'Fe',
            x: (x + 0.5) * a - dx,
            y: (y + 0.5) * a - dy,
            z: (z + 0.5) * a - dz
          });
        }
      }
    }
  }
  return atoms;
}

/**
 * 3. Face-Centered Cubic (FCC)
 */
export function generateFCC(nx = 2, ny = 2, nz = 2, latticeConstant = 4.08) { // Gold lattice constant: 4.08 A
  const atoms = [];
  const a = latticeConstant;
  
  const dx = ((nx - 1) * a) / 2;
  const dy = ((ny - 1) * a) / 2;
  const dz = ((nz - 1) * a) / 2;
  
  for (let x = 0; x <= nx; x++) {
    for (let y = 0; y <= ny; y++) {
      for (let z = 0; z <= nz; z++) {
        // Corner atom
        atoms.push({
          id: makeId(),
          element: 'Au',
          x: x * a - dx,
          y: y * a - dy,
          z: z * a - dz
        });
        
        // Face centers
        if (x < nx && y < ny) { // XY Face
          atoms.push({
            id: makeId(),
            element: 'Au',
            x: (x + 0.5) * a - dx,
            y: (y + 0.5) * a - dy,
            z: z * a - dz
          });
        }
        if (y < ny && z < nz) { // YZ Face
          atoms.push({
            id: makeId(),
            element: 'Au',
            x: x * a - dx,
            y: (y + 0.5) * a - dy,
            z: (z + 0.5) * a - dz
          });
        }
        if (x < nx && z < nz) { // XZ Face
          atoms.push({
            id: makeId(),
            element: 'Au',
            x: (x + 0.5) * a - dx,
            y: y * a - dy,
            z: (z + 0.5) * a - dz
          });
        }
      }
    }
  }
  
  // Filter out any duplicates (corners and shared faces)
  const seen = new Set();
  const uniqueAtoms = [];
  atoms.forEach(atom => {
    const key = `${atom.x.toFixed(4)},${atom.y.toFixed(4)},${atom.z.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAtoms.push(atom);
    }
  });
  
  return uniqueAtoms;
}

/**
 * 4. Graphene sheet (Hexagonal honeycomb lattice)
 */
export function generateGraphene(width = 4, height = 4, ccDistance = 1.42) {
  const atoms = [];
  const a = ccDistance * Math.sqrt(3); // Lattice parameter
  
  const dx = (width * a) / 2;
  const dy = (height * ccDistance * 3) / 4;
  
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      // Sublattice A
      let xA = i * a;
      let yA = j * ccDistance * 1.5;
      if (j % 2 !== 0) {
        xA += a / 2;
      }
      
      // Sublattice B
      let xB = xA;
      let yB = yA + ccDistance;
      
      atoms.push({
        id: makeId(),
        element: 'C',
        x: xA - dx,
        y: yA - dy,
        z: 0
      });
      
      atoms.push({
        id: makeId(),
        element: 'C',
        x: xB - dx,
        y: yB - dy,
        z: 0
      });
    }
  }
  return atoms;
}

/**
 * 5. Carbon Nanotube (CNT) - Armchair structure simplified
 */
export function generateCarbonNanotube(radius = 3.5, length = 15, ccDistance = 1.42) {
  const atoms = [];
  const circumference = 2 * Math.PI * radius;
  const nSegments = Math.round(circumference / (ccDistance * Math.sqrt(3)));
  const actualRadius = (nSegments * ccDistance * Math.sqrt(3)) / (2 * Math.PI);
  
  const zStep = ccDistance * 1.5;
  const zMax = Math.round(length / zStep);
  
  for (let z = 0; z < zMax; z++) {
    const zPos = z * zStep - length / 2;
    for (let i = 0; i < nSegments; i++) {
      const angle1 = (i * 2 * Math.PI) / nSegments;
      const angle2 = ((i + 0.5) * 2 * Math.PI) / nSegments;
      
      // Alternating atoms along the tube perimeter
      if (z % 2 === 0) {
        atoms.push({
          id: makeId(),
          element: 'C',
          x: actualRadius * Math.cos(angle1),
          y: actualRadius * Math.sin(angle1),
          z: zPos
        });
        
        atoms.push({
          id: makeId(),
          element: 'C',
          x: actualRadius * Math.cos(angle2),
          y: actualRadius * Math.sin(angle2),
          z: zPos + ccDistance / 2
        });
      } else {
        atoms.push({
          id: makeId(),
          element: 'C',
          x: actualRadius * Math.cos(angle2),
          y: actualRadius * Math.sin(angle2),
          z: zPos
        });
        
        atoms.push({
          id: makeId(),
          element: 'C',
          x: actualRadius * Math.cos(angle1),
          y: actualRadius * Math.sin(angle1),
          z: zPos + ccDistance / 2
        });
      }
    }
  }
  return atoms;
}

/**
 * 6. Preloaded Molecules: Water (H2O), Caffeine (C8H10N4O2), Graphene, Gold Nanoparticle
 */
export function loadPresetMolecule(presetName) {
  if (presetName === 'water') {
    return [
      { id: makeId(), element: 'O', x: 0.0000, y: 0.0000, z: 0.1197 },
      { id: makeId(), element: 'H', x: 0.0000, y: 0.7615, z: -0.4788 },
      { id: makeId(), element: 'H', x: 0.0000, y: -0.7615, z: -0.4788 }
    ];
  }
  
  if (presetName === 'caffeine') {
    // Approximate coordinates for Caffeine
    return [
      // Imidazole ring
      { id: makeId(), element: 'N', x: -1.054, y: 1.748, z: -0.002 },
      { id: makeId(), element: 'C', x: -1.979, y: 0.772, z: 0.002 },
      { id: makeId(), element: 'N', x: -1.332, y: -0.400, z: 0.005 },
      { id: makeId(), element: 'C', x: 0.001, y: -0.112, z: 0.002 },
      { id: makeId(), element: 'C', x: 0.179, y: 1.258, z: -0.002 },
      // Six membered ring
      { id: makeId(), element: 'C', x: 1.096, y: -1.085, z: 0.004 },
      { id: makeId(), element: 'O', x: 0.902, y: -2.289, z: 0.008 },
      { id: makeId(), element: 'N', x: 2.392, y: -0.584, z: 0.001 },
      { id: makeId(), element: 'C', x: 2.593, y: 0.781, z: -0.003 },
      { id: makeId(), element: 'O', x: 3.684, y: 1.309, z: -0.006 },
      { id: makeId(), element: 'N', x: 1.488, y: 1.637, z: -0.005 },
      // Methyls
      { id: makeId(), element: 'C', x: -1.455, y: 3.141, z: -0.006 }, // C on N9
      { id: makeId(), element: 'C', x: 3.567, y: -1.442, z: 0.003 }, // C on N3
      { id: makeId(), element: 'C', x: 1.701, y: 3.080, z: -0.009 }, // C on N1
      // CH on imidazole
      { id: makeId(), element: 'H', x: -3.047, y: 0.908, z: 0.003 },
      // Hydrogens (simplified placements for speed)
      { id: makeId(), element: 'H', x: -2.534, y: 3.250, z: -0.009 },
      { id: makeId(), element: 'H', x: -1.026, y: 3.633, z: 0.884 },
      { id: makeId(), element: 'H', x: -1.031, y: 3.627, z: -0.899 },
      { id: makeId(), element: 'H', x: 4.472, y: -0.840, z: 0.005 },
      { id: makeId(), element: 'H', x: 3.551, y: -2.074, z: 0.887 },
      { id: makeId(), element: 'H', x: 3.554, y: -2.070, z: -0.884 },
      { id: makeId(), element: 'H', x: 1.229, y: 3.541, z: -0.879 },
      { id: makeId(), element: 'H', x: 1.237, y: 3.546, z: 0.862 },
      { id: makeId(), element: 'H', x: 2.766, y: 3.267, z: -0.013 }
    ];
  }

  return []; // Empty default
}

/**
 * 8. CIF (Crystallographic Information File) Parser
 * Parses cell parameters (lengths, angles) and fractional atom coordinates.
 * Orthogonalizes them into Cartesian XYZ coordinates in Angstroms.
 */
export function parseCIF(text) {
  const lines = text.split('\n');
  let a = 1.0, b = 1.0, c = 1.0;
  let alpha = 90.0, beta = 90.0, gamma = 90.0;
  
  let loopFields = [];
  let loopDataLines = [];
  let inLoop = false;
  let atomSiteLoop = false;
  
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#') || line === '') continue;
    
    // Parse cell parameters
    if (line.startsWith('_cell_length_a')) a = parseFloat(line.split(/\s+/)[1]);
    if (line.startsWith('_cell_length_b')) b = parseFloat(line.split(/\s+/)[1]);
    if (line.startsWith('_cell_length_c')) c = parseFloat(line.split(/\s+/)[1]);
    if (line.startsWith('_cell_angle_alpha')) alpha = parseFloat(line.split(/\s+/)[1]);
    if (line.startsWith('_cell_angle_beta')) beta = parseFloat(line.split(/\s+/)[1]);
    if (line.startsWith('_cell_angle_gamma')) gamma = parseFloat(line.split(/\s+/)[1]);
    
    if (line.startsWith('loop_')) {
      inLoop = true;
      loopFields = [];
      loopDataLines = [];
      atomSiteLoop = false;
      continue;
    }
    
    if (inLoop) {
      if (line.startsWith('_')) {
        loopFields.push(line);
        if (line.includes('_atom_site_')) {
          atomSiteLoop = true;
        }
      } else {
        // Data line
        if (atomSiteLoop) {
          loopDataLines.push(line);
        } else {
          inLoop = false;
        }
      }
    }
  }
  
  if (loopDataLines.length === 0) return [];
  
  // Find indices of fields
  const fractXIdx = loopFields.findIndex(f => f.includes('fract_x'));
  const fractYIdx = loopFields.findIndex(f => f.includes('fract_y'));
  const fractZIdx = loopFields.findIndex(f => f.includes('fract_z'));
  const elementIdx = loopFields.findIndex(f => f.includes('type_symbol') || f.includes('label'));
  
  if (fractXIdx === -1 || fractYIdx === -1 || fractZIdx === -1) {
    return []; // Invalid CIF
  }
  
  // Convert angles to radians
  const d2r = Math.PI / 180.0;
  const radAlpha = alpha * d2r;
  const radBeta = beta * d2r;
  const radGamma = gamma * d2r;
  
  const cosAlpha = Math.cos(radAlpha);
  const cosBeta = Math.cos(radBeta);
  const cosGamma = Math.cos(radGamma);
  const sinGamma = Math.sin(radGamma);
  
  // Volume fraction factor (triclinic/monoclinic cells)
  const vFract = Math.sqrt(
    1.0 - cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma + 2.0 * cosAlpha * cosBeta * cosGamma
  ) / sinGamma;
  
  const atoms = [];
  loopDataLines.forEach(line => {
    const tokens = line.split(/\s+/);
    if (tokens.length < loopFields.length) return;
    
    let el = 'C';
    if (elementIdx !== -1) {
      // Strip numbers from label, e.g. "Si1" -> "Si"
      el = tokens[elementIdx].replace(/[0-9]/g, '');
      if (el.length > 0) {
        el = el.charAt(0).toUpperCase() + el.slice(1).toLowerCase();
      }
    }
    
    // Clean coordinates (remove uncertainties in parentheses)
    const cleanNum = (str) => parseFloat(str.replace(/\(\d+\)/g, ''));
    
    const fx = cleanNum(tokens[fractXIdx]);
    const fy = cleanNum(tokens[fractYIdx]);
    const fz = cleanNum(tokens[fractZIdx]);
    
    if (isNaN(fx) || isNaN(fy) || isNaN(fz)) return;
    
    // Fractional to Cartesian transformation (Busing-Levy orthogonalization)
    const x = a * fx + b * cosGamma * fy + c * cosBeta * fz;
    const y = b * sinGamma * fy + c * ((cosAlpha - cosBeta * cosGamma) / sinGamma) * fz;
    const z = c * vFract * fz;
    
    atoms.push({
      id: Math.random().toString(36).substring(2, 9),
      element: el,
      x: parseFloat(x.toFixed(4)),
      y: parseFloat(y.toFixed(4)),
      z: parseFloat(z.toFixed(4))
    });
  });
  
  return atoms;
}
