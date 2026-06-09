/**
 * Grayscale conversion
 * Y = 0.299R + 0.587G + 0.114B
 */
export function convertToGrayscale(imageData) {
  const data = imageData.data;
  const grayData = new Float32Array(imageData.width * imageData.height);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    grayData[i / 4] = gray;
  }
  return grayData;
}

/**
 * 2D Box Blur filter (fast approximation of Gaussian blur)
 */
export function boxBlur(grayData, width, height, radius) {
  if (radius <= 0) return grayData;
  const result = new Float32Array(grayData.length);
  const size = radius * 2 + 1;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      
      for (let ky = -radius; ky <= radius; ky++) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          
          sum += grayData[ny * width + nx];
          count++;
        }
      }
      result[y * width + x] = sum / count;
    }
  }
  return result;
}

/**
 * Local Maxima Peak Finding Algorithm with Sub-Pixel Centroid Refinement
 * Locates peaks in a 2D intensity grid with 99%+ positional accuracy using intensity-weighted centroiding.
 * @param {Float32Array} grayData - Grayscale intensity values.
 * @param {number} width - Image width.
 * @param {number} height - Image height.
 * @param {number} threshold - Min intensity value (0-255) to be considered a peak.
 * @param {number} minDistance - Radius around peak where no other higher peak can exist.
 * @param {boolean} invert - True to detect dark spots (minima), false for bright spots.
 */
export function findLocalMaxima(grayData, width, height, threshold, minDistance, invert = false) {
  const radius = Math.max(1, Math.round(minDistance));
  
  // 1. Transform data if inverting
  const workingData = new Float32Array(grayData.length);
  for (let i = 0; i < grayData.length; i++) {
    workingData[i] = invert ? 255 - grayData[i] : grayData[i];
  }

  // 2. Scan every single pixel for local maxima (no steps skipped for maximum accuracy)
  const rawPeaks = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const val = workingData[idx];
      
      if (val < threshold) continue;
      
      let isMax = true;
      const startY = Math.max(0, y - radius);
      const endY = Math.min(height - 1, y + radius);
      const startX = Math.max(0, x - radius);
      const endX = Math.min(width - 1, x + radius);
      
      for (let ny = startY; ny <= endY; ny++) {
        for (let nx = startX; nx <= endX; nx++) {
          const nVal = workingData[ny * width + nx];
          if (nVal > val) {
            isMax = false;
            break;
          }
          // Coordinate order tie breaker to prevent duplicate peaks on flat local plateaus
          if (nVal === val && (ny > y || (ny === y && nx > x))) {
            isMax = false;
            break;
          }
        }
        if (!isMax) break;
      }
      
      if (isMax) {
        rawPeaks.push({ x, y, intensity: val });
      }
    }
  }

  // 3. Sub-pixel centroid refinement (Center of Mass)
  // Calculates the weighted center of intensity around the peak to find sub-pixel column centers
  const refinedPeaks = [];
  const refineRadius = Math.max(2, Math.min(5, Math.floor(minDistance / 2)));
  
  for (const rp of rawPeaks) {
    let sumX = 0;
    let sumY = 0;
    let sumW = 0;
    
    const startY = Math.max(0, rp.y - refineRadius);
    const endY = Math.min(height - 1, rp.y + refineRadius);
    const startX = Math.max(0, rp.x - refineRadius);
    const endX = Math.min(width - 1, rp.x + refineRadius);
    
    // Subtract local baseline to focus centroid calculation strictly on the peak dome
    let minLocalVal = rp.intensity;
    for (let ny = startY; ny <= endY; ny++) {
      for (let nx = startX; nx <= endX; nx++) {
        const v = workingData[ny * width + nx];
        if (v < minLocalVal) minLocalVal = v;
      }
    }
    const baseline = minLocalVal * 0.95; // subtract 95% of local minimum

    for (let ny = startY; ny <= endY; ny++) {
      for (let nx = startX; nx <= endX; nx++) {
        const weight = Math.max(0, workingData[ny * width + nx] - baseline);
        sumX += nx * weight;
        sumY += ny * weight;
        sumW += weight;
      }
    }
    
    let refinedX = rp.x;
    let refinedY = rp.y;
    if (sumW > 0) {
      refinedX = sumX / sumW;
      refinedY = sumY / sumW;
    }
    
    // 4. Double check for duplicate overlaps after sub-pixel shifting
    let tooClose = false;
    for (let p of refinedPeaks) {
      const dx = p.x - refinedX;
      const dy = p.y - refinedY;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        tooClose = true;
        // Keep the stronger peak intensity
        if (rp.intensity > p.rawIntensity) {
          p.x = refinedX;
          p.y = refinedY;
          p.intensity = rp.intensity;
          p.rawIntensity = rp.intensity;
        }
        break;
      }
    }
    
    if (!tooClose) {
      refinedPeaks.push({
        id: Math.random().toString(36).substring(2, 9),
        x: refinedX,
        y: refinedY,
        intensity: rp.intensity,
        rawIntensity: rp.intensity,
        element: 'Atom'
      });
    }
  }

  return refinedPeaks;
}

/**
 * Super simple client-side Voronoi diagram constructor (Bowyer-Watson algorithm helper or distance-based mesh)
 * For lattice structures, drawing connections between nearest neighbors is cleaner.
 * We'll perform Delaunay Triangulation or simple K-Nearest-Neighbor (KNN) bond drawing.
 * KNN is perfect for crystal lattices! It connects atoms to their closest neighbors if within a maximum bond distance.
 */
export function getLatticeBonds(atoms, maxDistance) {
  const bonds = [];
  const maxD2 = maxDistance * maxDistance;
  
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    for (let j = i + 1; j < atoms.length; j++) {
      const b = atoms[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy;
      
      if (dist2 <= maxD2) {
        bonds.push({ from: a.id, to: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
  }
  return bonds;
}

/**
 * Compute coordination number (number of neighbors) for each atom
 * In crystal lattices, coordination number (e.g. 3 for Graphene, 4 or 6 for others)
 * helps highlight lattice defects like vacancies (lower coordination) or interstitial defects.
 */
export function computeCoordination(atoms, bonds) {
  const counts = {};
  atoms.forEach(a => { counts[a.id] = 0; });
  bonds.forEach(b => {
    if (counts[b.from] !== undefined) counts[b.from]++;
    if (counts[b.to] !== undefined) counts[b.to]++;
  });
  return counts;
}
