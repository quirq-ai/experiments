// 4D hypercube (tesseract) geometry: vertices, edges, cells, rotations, projection.
// Unit tesseract: vertices of [-1, 1]^4. Schläfli symbol {4,3,3}.
// 16 vertices, 32 edges, 24 square faces, 8 cubic cells.

/** All 16 vertices of the unit tesseract as Float64Array[16*4]. */
export function tesseractVertices() {
  const v = new Float64Array(64);
  let i = 0;
  for (let a = -1; a <= 1; a += 2) {
    for (let b = -1; b <= 1; b += 2) {
      for (let c = -1; c <= 1; c += 2) {
        for (let d = -1; d <= 1; d += 2) {
          v[i++] = a; v[i++] = b; v[i++] = c; v[i++] = d;
        }
      }
    }
  }
  return v;
}

/** Edge list: pairs of vertex indices that differ in exactly one coordinate. */
export function tesseractEdges(verts = tesseractVertices()) {
  const n = verts.length / 4;
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) {
        if (verts[i * 4 + k] !== verts[j * 4 + k]) diff++;
      }
      if (diff === 1) edges.push([i, j]);
    }
  }
  return edges;
}

/**
 * Eight cubic cells. Each cell freezes one coordinate to ±1.
 * Returns [{ axis, sign, verts: number[8], faces: number[][4] }, ...]
 */
export function tesseractCells(verts = tesseractVertices()) {
  const n = verts.length / 4;
  const cells = [];
  const axes = ['x', 'y', 'z', 'w'];
  for (let axis = 0; axis < 4; axis++) {
    for (const sign of [-1, 1]) {
      const idxs = [];
      for (let i = 0; i < n; i++) {
        if (verts[i * 4 + axis] === sign) idxs.push(i);
      }
      // 6 square faces of the cube: pairs of free axes fixed to ±1
      const free = [0, 1, 2, 3].filter((a) => a !== axis);
      const faces = [];
      for (let f = 0; f < 3; f++) {
        const a = free[f];
        const b = free[(f + 1) % 3];
        const c = free[(f + 2) % 3];
        for (const sa of [-1, 1]) {
          const quad = idxs.filter((i) => verts[i * 4 + a] === sa);
          // Order around the face for a non-crossing polygon
          quad.sort((i, j) => {
            const bi = verts[i * 4 + b], bj = verts[j * 4 + b];
            if (bi !== bj) return bi - bj;
            return verts[i * 4 + c] - verts[j * 4 + c];
          });
          // Reorder to cycle: (b-,c-) (b-,c+) (b+,c+) (b+,c-)
          if (quad.length === 4) {
            const ordered = [
              quad.find((i) => verts[i * 4 + b] === -1 && verts[i * 4 + c] === -1),
              quad.find((i) => verts[i * 4 + b] === -1 && verts[i * 4 + c] === 1),
              quad.find((i) => verts[i * 4 + b] === 1 && verts[i * 4 + c] === 1),
              quad.find((i) => verts[i * 4 + b] === 1 && verts[i * 4 + c] === -1),
            ];
            if (ordered.every((x) => x != null)) faces.push(ordered);
          }
        }
      }
      cells.push({
        id: `${axes[axis]}${sign > 0 ? '+' : '-'}`,
        axis: axes[axis],
        sign,
        verts: idxs,
        faces,
      });
    }
  }
  return cells;
}

/** Rotate a 4-vector in-place around the plane of axes (i, j) by angle θ. */
export function rotate4(v, i, j, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const a = v[i], b = v[j];
  v[i] = a * c - b * s;
  v[j] = a * s + b * c;
}

/** Apply sequential plane rotations to a copy of verts. angles: {xy,xz,xw,yz,yw,zw}. */
export function rotateVertices(src, angles) {
  const out = new Float64Array(src.length);
  out.set(src);
  const planes = [
    ['xy', 0, 1], ['xz', 0, 2], ['xw', 0, 3],
    ['yz', 1, 2], ['yw', 1, 3], ['zw', 2, 3],
  ];
  const tmp = [0, 0, 0, 0];
  for (let vi = 0; vi < out.length; vi += 4) {
    tmp[0] = out[vi]; tmp[1] = out[vi + 1]; tmp[2] = out[vi + 2]; tmp[3] = out[vi + 3];
    for (const [key, i, j] of planes) {
      const th = angles[key] || 0;
      if (th) rotate4(tmp, i, j, th);
    }
    out[vi] = tmp[0]; out[vi + 1] = tmp[1]; out[vi + 2] = tmp[2]; out[vi + 3] = tmp[3];
  }
  return out;
}

/**
 * Project 4D → 3D.
 * mode 'perspective': (x,y,z) / (d - w)  with camera at w = d
 * mode 'ortho': drop w, keep (x,y,z)
 * Returns Float32Array of xyz triplets + a parallel depths Float32Array (for sizing).
 */
export function project4to3(verts4, { mode = 'perspective', distance = 3 } = {}) {
  const n = verts4.length / 4;
  const xyz = new Float32Array(n * 3);
  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = verts4[i * 4], y = verts4[i * 4 + 1], z = verts4[i * 4 + 2], w = verts4[i * 4 + 3];
    if (mode === 'ortho') {
      xyz[i * 3] = x;
      xyz[i * 3 + 1] = y;
      xyz[i * 3 + 2] = z;
      depth[i] = w;
    } else {
      const denom = Math.max(distance - w, 0.15);
      const s = distance / denom;
      xyz[i * 3] = x * s;
      xyz[i * 3 + 1] = y * s;
      xyz[i * 3 + 2] = z * s;
      depth[i] = w;
    }
  }
  return { xyz, depth };
}

export const PLANE_KEYS = ['xy', 'xz', 'xw', 'yz', 'yw', 'zw'];

export const HYPERCUBE_FACTS = {
  vertices: 16,
  edges: 32,
  faces: 24,
  cells: 8,
  schlafli: '{4,3,3}',
  dual: '16-cell {3,3,4}',
};
