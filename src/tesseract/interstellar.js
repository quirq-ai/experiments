// Interstellar-style tesseract lattice.
// Infinite stacked bedrooms + world-line beams: time as a navigable axis.
// Inspired by Nolan / Double Negative's open lattice (not a literal set recreation).

import * as THREE from 'three';

/** Warm Murph-bedroom bookshelf plate (procedural). */
export function bookshelfTexture() {
  const w = 512, h = 384;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');

  // warm plaster wall
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#2a2218');
  wall.addColorStop(0.55, '#1a1410');
  wall.addColorStop(1, '#0e0b08');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // bookshelf carcass
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(28, 36, w - 56, h - 72);

  const cols = 9;
  const rows = 5;
  const shelfX0 = 40;
  const shelfY0 = 48;
  const shelfW = w - 80;
  const shelfH = h - 96;
  const colW = shelfW / cols;
  const rowH = shelfH / rows;

  const bookColors = [
    '#8b4513', '#a0522d', '#6b3a2a', '#c4a35a', '#5c4033',
    '#7a4e2d', '#9a6b3f', '#4a3020', '#b8956a', '#3d2817',
    '#d4b896', '#2f1f14', '#8c5e3b', '#6e4b32',
  ];

  for (let r = 0; r < rows; r++) {
    // shelf board
    ctx.fillStyle = '#4a3424';
    ctx.fillRect(shelfX0 - 4, shelfY0 + (r + 1) * rowH - 5, shelfW + 8, 6);

    for (let c = 0; c < cols; c++) {
      const nBooks = 2 + ((r * 7 + c * 3) % 4);
      let x = shelfX0 + c * colW + 3;
      for (let b = 0; b < nBooks; b++) {
        const bw = colW / nBooks - 2 + ((r + c + b) % 3) - 1;
        const bh = rowH * (0.55 + ((r * 5 + c * 11 + b * 3) % 40) / 100);
        const y = shelfY0 + (r + 1) * rowH - 6 - bh;
        ctx.fillStyle = bookColors[(r * cols + c * 3 + b) % bookColors.length];
        ctx.fillRect(x, y, Math.max(4, bw), bh);
        // spine highlight
        ctx.fillStyle = 'rgba(255,220,160,0.12)';
        ctx.fillRect(x + 1, y + 2, 1.5, bh - 4);
        x += bw + 1.5;
      }
    }
  }

  // window glow (right side of room feel)
  const win = ctx.createRadialGradient(w * 0.82, h * 0.35, 10, w * 0.82, h * 0.35, 120);
  win.addColorStop(0, 'rgba(255, 210, 140, 0.35)');
  win.addColorStop(0.5, 'rgba(255, 180, 90, 0.12)');
  win.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = win;
  ctx.fillRect(0, 0, w, h);

  // soft dust vignette
  const vig = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Glowing beam texture for world-line extrusions. */
export function worldlineTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 8;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(120,200,255,0)');
  g.addColorStop(0.2, 'rgba(180,230,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,230,180,1)');
  g.addColorStop(0.8, 'rgba(180,230,255,0.85)');
  g.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Build the open lattice of bedroom moments.
 * Returns { root, rooms, worldLines, driftAxis, spacing, extent }
 */
export function buildLattice({
  extent = { x: 5, y: 3, z: 9 },
  spacing = 7.2,
  roomSize = { w: 4.2, h: 3.4, d: 4.2 },
  bookshelfTex,
} = {}) {
  const root = new THREE.Group();
  const rooms = [];

  const frameMat = new THREE.LineBasicMaterial({
    color: 0x9ad4ff,
    transparent: true,
    opacity: 0.55,
  });
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0x1a2838,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const floorMat = new THREE.MeshBasicMaterial({
    color: 0x2a1e14,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shelfMat = new THREE.MeshBasicMaterial({
    map: bookshelfTex,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });

  const { w, h, d } = roomSize;
  const halfW = w / 2, halfH = h / 2, halfD = d / 2;

  // Shared edge geometry for a room frame (box edges)
  const boxGeo = new THREE.BoxGeometry(w, h, d);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  boxGeo.dispose();

  const ex = extent.x | 0, ey = extent.y | 0, ez = extent.z | 0;
  for (let ix = -ex; ix <= ex; ix++) {
    for (let iy = -ey; iy <= ey; iy++) {
      for (let iz = -ez; iz <= ez; iz++) {
        // Keep a hollow-ish corridor density: skip some interior clutter
        const manh = Math.abs(ix) + Math.abs(iy) + Math.abs(iz);
        if (manh === 0) continue; // leave the void Cooper floats in
        // Prefer rooms that form the alternating lattice planes
        const onAxis = (ix === 0) + (iy === 0) + (iz === 0);
        if (onAxis === 0 && (Math.abs(ix) + Math.abs(iy) + Math.abs(iz)) % 2 === 1) continue;

        const g = new THREE.Group();
        g.position.set(ix * spacing, iy * spacing, iz * spacing);

        // Alternating face orientation (Franklin's alternating lattice)
        // Primary face points toward the nearest corridor axis
        let face = 'z';
        if (Math.abs(ix) >= Math.abs(iy) && Math.abs(ix) >= Math.abs(iz)) face = 'x';
        else if (Math.abs(iy) >= Math.abs(iz)) face = 'y';

        const frame = new THREE.LineSegments(edgeGeo.clone(), frameMat.clone());
        frame.material.opacity = 0.35 + 0.25 / (1 + manh * 0.15);
        g.add(frame);

        // Back wall with bookshelf (the "moment" you look into)
        const back = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.92, h * 0.88),
          shelfMat.clone()
        );
        // Dim distant rooms
        back.material.opacity = Math.max(0.25, 0.95 - manh * 0.06);
        if (face === 'z') {
          back.position.z = -halfD + 0.02;
        } else if (face === 'x') {
          back.rotation.y = Math.PI / 2;
          back.position.x = -halfW + 0.02;
        } else {
          back.rotation.x = -Math.PI / 2;
          back.position.y = -halfH + 0.02;
        }
        g.add(back);

        // Floor
        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.9, d * 0.9),
          floorMat.clone()
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -halfH + 0.01;
        floor.material.opacity = 0.35;
        g.add(floor);

        // Ceiling glass
        const ceil = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.9, d * 0.9),
          glassMat.clone()
        );
        ceil.rotation.x = Math.PI / 2;
        ceil.position.y = halfH - 0.01;
        g.add(ceil);

        // Soft room lamp
        const lamp = new THREE.PointLight(0xffc878, 0.55 / (1 + manh * 0.2), spacing * 1.6, 2);
        lamp.position.set(0, halfH * 0.35, 0);
        g.add(lamp);

        g.userData = { ix, iy, iz, manh, face };
        root.add(g);
        rooms.push(g);
      }
    }
  }

  // World-line beams: connect neighboring room centers along each axis
  const linePositions = [];
  const lineColors = [];
  const key = (ix, iy, iz) => `${ix},${iy},${iz}`;
  const roomMap = new Map(rooms.map((r) => [key(r.userData.ix, r.userData.iy, r.userData.iz), r]));

  const pushSeg = (a, b, warm) => {
    linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    if (warm) {
      lineColors.push(1.0, 0.82, 0.45, 1.0, 0.82, 0.45);
    } else {
      lineColors.push(0.55, 0.82, 1.0, 0.55, 0.82, 1.0);
    }
  };

  for (const r of rooms) {
    const { ix, iy, iz } = r.userData;
    const neighbors = [
      [ix + 1, iy, iz, true],
      [ix, iy + 1, iz, false],
      [ix, iy, iz + 1, true],
    ];
    for (const [nx, ny, nz, warm] of neighbors) {
      const other = roomMap.get(key(nx, ny, nz));
      if (!other) continue;
      pushSeg(r.position, other.position, warm);
    }
  }

  // Also draw beams from origin void toward nearest rooms on each axis (the "bulk" threads)
  for (const r of rooms) {
    const { ix, iy, iz, manh } = r.userData;
    if (manh === 1) {
      pushSeg(new THREE.Vector3(0, 0, 0), r.position, iz !== 0 || ix !== 0);
    }
  }

  const wlGeo = new THREE.BufferGeometry();
  wlGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  wlGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  const worldLines = new THREE.LineSegments(
    wlGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  root.add(worldLines);

  // Dust motes in the void
  const dustN = 900;
  const dustPos = new Float32Array(dustN * 3);
  const span = spacing * Math.max(ex, ey, ez);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * span * 2.2;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * span * 2.2;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * span * 2.2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xffe6c0,
      size: 0.06,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  root.add(dust);

  return { root, rooms, worldLines, dust, spacing, extent, roomSize, edgeGeo };
}
