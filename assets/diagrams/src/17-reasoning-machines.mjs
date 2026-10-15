// 17-reasoning-machines: 2026, an armillary / geodesic lattice instrument on a datacenter plinth.
// Plain Node, deterministic. Writes ../17-reasoning-machines.svg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
let seed = 2026;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f = (v) => Math.round(v * 10) / 10;
const deg = Math.PI / 180;
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
const P = (pts) => 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L');
const pth = (layer, d) => L[layer].push(`<path d="${d}"/>`);
const line = (layer, x1, y1, x2, y2) => L[layer].push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`);
const circle = (layer, cx, cy, r) => L[layer].push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`);
const text = (x, y, s, anchor = 'start', size = 20) => L.lbl.push(`<text x="${f(x)}" y="${f(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" fill="currentColor"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${s}</text>`);
const ellipsePts = (cx, cy, rx, ry, rot, a0 = 0, a1 = 360, n = 120) => { const pts = []; for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * deg; const x = rx * Math.cos(a), y = ry * Math.sin(a); pts.push([cx + x * Math.cos(rot * deg) - y * Math.sin(rot * deg), cy + x * Math.sin(rot * deg) + y * Math.cos(rot * deg)]); } return pts; };
const dashedArc = (cx, cy, r, a0, a1, n) => { let d = ''; for (let i = 0; i < n; i++) { const s = (a0 + ((a1 - a0) * i) / n) * deg, e = (a0 + ((a1 - a0) * (i + 0.55)) / n) * deg; d += `M${f(cx + r * Math.cos(s))} ${f(cy + r * Math.sin(s))} A${r} ${r} 0 0 1 ${f(cx + r * Math.cos(e))} ${f(cy + r * Math.sin(e))} `; } return d.trim(); };

const CX = 500, CY = 426, R = 226;

// ---------- geodesic lattice (icosphere, frequency 3) ----------
const t = (1 + Math.sqrt(5)) / 2;
let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
const F0 = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const verts = [], key = new Map();
const vid = (p) => { const n = norm(p); const k = n.map((x) => x.toFixed(5)).join(','); if (!key.has(k)) { key.set(k, verts.length); verts.push(n); } return key.get(k); };
const FREQ = 3;
const edges = new Set();
for (const [a, b, c] of F0) {
  const A = V[a], B = V[b], C = V[c];
  const grid = [];
  for (let i = 0; i <= FREQ; i++) { grid[i] = []; for (let j = 0; j <= FREQ - i; j++) { const k = FREQ - i - j; grid[i][j] = vid([0, 1, 2].map((d) => (A[d] * k + B[d] * i + C[d] * j) / FREQ)); } }
  const e = (p, q) => edges.add(p < q ? `${p}-${q}` : `${q}-${p}`);
  for (let i = 0; i <= FREQ; i++) for (let j = 0; j <= FREQ - i; j++) { if (j + 1 <= FREQ - i) e(grid[i][j], grid[i][j + 1]); if (i + 1 <= FREQ - j) e(grid[i][j], grid[i + 1][j]); if (i + 1 <= FREQ && j - 1 >= 0 && j - 1 <= FREQ - i - 1) e(grid[i][j], grid[i + 1][j - 1]); }
}
// rotate and project
const ry = 18 * deg, rx = -24 * deg;
const RL = R * 0.86;
const PV = verts.map(([x, y, z]) => { const x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry); const y2 = y * Math.cos(rx) - z1 * Math.sin(rx), z2 = y * Math.sin(rx) + z1 * Math.cos(rx); return [CX + x1 * RL, CY - y2 * RL, z2]; });
let backD = '';
const frontEdges = [];
for (const e of edges) {
  const [a, b] = e.split('-').map(Number); const pa = PV[a], pb = PV[b];
  const zm = (pa[2] + pb[2]) / 2;
  if (zm > -0.02) frontEdges.push([pa, pb]); else backD += `M${f(pa[0])} ${f(pa[1])} L${f(pb[0])} ${f(pb[1])} `;
}

// ---------- construction ----------
line('con', CX, 70, CX, 930);
line('con', 80, CY, 920, CY);
pth('con', dashedArc(CX, CY, R + 118, -180, 0, 60));
circle('con', CX, CY, R + 22);
pth('con', backD.trim()); // far side of the lattice, faint
// tilt axis of the instrument
{ const a = -23.4 * deg - Math.PI / 2; line('con', CX + (R + 100) * Math.cos(a), CY + (R + 100) * Math.sin(a), CX - (R + 60) * Math.cos(a), CY - (R + 60) * Math.sin(a)); }
// angle arc between vertical and tilt axis
pth('con', `M${CX} ${f(CY - 130)} A130 130 0 0 1 ${f(CX + 130 * Math.sin(23.4 * deg))} ${f(CY - 130 * Math.cos(23.4 * deg))}`);
// dimension across the plinth
line('con', 190, 944, 810, 944); line('con', 190, 936, 190, 952); line('con', 810, 936, 810, 952);
pth('con', P([[200, 940], [190, 944], [200, 948]])); pth('con', P([[800, 940], [810, 944], [800, 948]]));
// plumb lines from sphere to plinth
line('con', CX - R, CY, CX - R, 806); line('con', CX + R, CY, CX + R, 806);

// ---------- main: fixed armature ----------
circle('main', CX, CY, R); // sphere
pth('main', P(ellipsePts(CX, CY, R, R * 0.3, 0))); // equator
pth('main', P(ellipsePts(CX, CY, R * 0.34, R, 0))); // meridian
pth('main', P(ellipsePts(CX, CY, R, R * 0.3, -23.4))); // ecliptic band
// meridian ring (fixed, outside sphere), double line with the cradle
circle('main', CX, CY, R + 12);
// datacenter plinth
const PY = 800;
pth('main', P([[210, PY], [790, PY], [790, PY + 14], [210, PY + 14]]) + ' Z'); // entablature
const RK = { n: 11, w: 44, gap: 6, y: PY + 14, h: 70 };
const rx0 = CX - (RK.n * RK.w + (RK.n - 1) * RK.gap) / 2;
for (let i = 0; i < RK.n; i++) L.main.push(`<rect x="${f(rx0 + i * (RK.w + RK.gap))}" y="${RK.y}" width="${RK.w}" height="${RK.h}"/>`);
pth('main', P([[190, PY + 84], [810, PY + 84], [810, PY + 98], [190, PY + 98]]) + ' Z'); // stylobate
pth('main', P([[170, PY + 98], [830, PY + 98], [830, PY + 110], [170, PY + 110]]) + ' Z');
// cradle: arms from the plinth up to the meridian ring
{
  const a1 = 118 * deg, a2 = 62 * deg; const rr = R + 12;
  const p1 = [CX + rr * Math.cos(a1), CY + rr * Math.sin(a1)], p2 = [CX + rr * Math.cos(a2), CY + rr * Math.sin(a2)];
  pth('main', `M${f(p1[0])} ${f(p1[1])} C${f(p1[0] - 20)} ${f(p1[1] + 50)} ${f(CX - 60)} ${PY - 40} ${f(CX - 70)} ${PY}`);
  pth('main', `M${f(p2[0])} ${f(p2[1])} C${f(p2[0] + 20)} ${f(p2[1] + 50)} ${f(CX + 60)} ${PY - 40} ${f(CX + 70)} ${PY}`);
  pth('main', `M${CX - 18} ${CY + rr} L${CX - 26} ${PY} M${CX + 18} ${CY + rr} L${CX + 26} ${PY}`);
}
// lattice nodes (front hemisphere)
const frontNodes = PV.map((p, i) => ({ p, i })).filter(({ p }) => p[2] > 0.05);
frontNodes.forEach(({ p }) => circle('main', p[0], p[1], 2.6 + 1.6 * p[2]));

// ---------- spin groups (outer rings) ----------
// Ring A: toothed degree ring, rotates +40
const RA = R + 62;
{
  let teeth = '';
  const N = 144;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * 360, a1 = ((i + 0.5) / N) * 360;
    const pts = [[RA + 6, a0], [RA + 12, a0 + 0.35], [RA + 12, a1 - 0.35], [RA + 6, a1]];
    teeth += (i ? ' L' : 'M') + pts.map(([r, a]) => `${f(CX + r * Math.cos(a * deg))} ${f(CY + r * Math.sin(a * deg))}`).join(' L');
  }
  teeth += ' Z';
  const mainA = [`<circle cx="${CX}" cy="${CY}" r="${RA - 10}"/>`, `<circle cx="${CX}" cy="${CY}" r="${RA + 6}"/>`, `<path d="${teeth}"/>`];
  // planetary markers riding ring A
  for (const a of [-60, 50, 170]) { const x = CX + (RA - 2) * Math.cos(a * deg), y = CY + (RA - 2) * Math.sin(a * deg); mainA.push(`<circle cx="${f(x)}" cy="${f(y)}" r="7"/>`); }
  L.main.push(`<g class="spin" data-cx="${CX}" data-cy="${CY}" data-deg="40">`, ...mainA.map((s) => '  ' + s), '</g>');
  let ticks = '';
  for (let a = 0; a < 360; a += 5) { const r0 = a % 30 === 0 ? RA - 22 : a % 10 === 0 ? RA - 17 : RA - 14; ticks += `M${f(CX + r0 * Math.cos(a * deg))} ${f(CY + r0 * Math.sin(a * deg))} L${f(CX + (RA - 10) * Math.cos(a * deg))} ${f(CY + (RA - 10) * Math.sin(a * deg))} `; }
  L.detail.push(`<g class="spin" data-cx="${CX}" data-cy="${CY}" data-deg="40">`, `  <path d="${ticks.trim()}"/>`, '</g>');
}
// Ring B: tilted orbital ellipse, counter-rotates -30
{
  const rB = R + 118, eB = 0.3, rot = -16;
  const mainB = [`<path d="${P(ellipsePts(CX, CY, rB, rB * eB, rot, 0, 360, 160))} Z"/>`, `<path d="${P(ellipsePts(CX, CY, rB - 9, (rB - 9) * eB, rot, 0, 360, 160))} Z"/>`];
  for (const a of [20, 200]) { const p = ellipsePts(CX, CY, rB - 4.5, (rB - 4.5) * eB, rot, a, a, 1)[0]; mainB.push(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="9"/>`); }
  L.main.push(`<g class="spin" data-cx="${CX}" data-cy="${CY}" data-deg="-30">`, ...mainB.map((s) => '  ' + s), '</g>');
  let tk = '';
  for (let a = 0; a < 360; a += 6) { const p = ellipsePts(CX, CY, rB, rB * eB, rot, a, a, 1)[0], q = ellipsePts(CX, CY, rB - 9, (rB - 9) * eB, rot, a, a, 1)[0]; tk += `M${f(p[0])} ${f(p[1])} L${f(q[0])} ${f(q[1])} `; }
  L.detail.push(`<g class="spin" data-cx="${CX}" data-cy="${CY}" data-deg="-30">`, `  <path d="${tk.trim()}"/>`, '</g>');
}

// ---------- detail ----------
frontEdges.forEach(([a, b]) => line('detail', a[0], a[1], b[0], b[1]));
// neural spokes: core to every front node, one path
pth('detail', frontNodes.map(({ p }) => `M${CX} ${CY} L${f(p[0])} ${f(p[1])}`).join(' '));
// radiating rays outside ring A (upper sectors only)
{ let d = ''; for (let a = -170; a <= -10; a += 5) { if (a % 15 === 0) continue; const r0 = RA + 24, r1 = RA + (a % 10 === 0 ? 56 : 44); d += `M${f(CX + r0 * Math.cos(a * deg))} ${f(CY + r0 * Math.sin(a * deg))} L${f(CX + r1 * Math.cos(a * deg))} ${f(CY + r1 * Math.sin(a * deg))} `; } pth('detail', d.trim()); }
// engraved shading: crescent hatching on the lower right limb of the sphere
{ let d = ''; for (let a = 10; a <= 120; a += 3) { const r0 = R - 4, r1 = R - 4 - 18 * Math.sin(((a - 10) / 110) * Math.PI); if (r0 - r1 < 2) continue; d += `M${f(CX + r0 * Math.cos(a * deg))} ${f(CY + r0 * Math.sin(a * deg))} L${f(CX + r1 * Math.cos(a * deg))} ${f(CY + r1 * Math.sin(a * deg))} `; } pth('detail', d.trim()); }
// server rack slots and status lights
for (let i = 0; i < RK.n; i++) {
  const x0 = rx0 + i * (RK.w + RK.gap);
  let d = '';
  for (let s = 0; s < 7; s++) { const y = RK.y + 9 + s * 8.4; d += `M${f(x0 + 6)} ${f(y)} L${f(x0 + RK.w - 12)} ${f(y)} `; }
  pth('detail', d.trim());
  circle('detail', x0 + RK.w - 6, RK.y + 9 + Math.floor(rnd() * 7) * 8.4, 1.8);
}
// entablature and stylobate hatching
{ let d = ''; for (let x = 216; x < 786; x += 8) d += `M${x} ${PY + 12} L${x + 8} ${PY + 2} `; pth('detail', d.trim()); }
{ let d = ''; for (let x = 176; x < 826; x += 8) d += `M${x} ${PY + 108} L${x + 8} ${PY + 100} `; pth('detail', d.trim()); }
// leader lines
line('detail', 690, 196, 780, 130);
line('detail', 862, 512, 792, 532);
line('detail', 300, 856, 200, 872);

// ---------- accent: the core and a few bright connections ----------
circle('acc', CX, CY, 14);
circle('acc', CX, CY, 26);
{
  const picks = [...frontNodes].sort((a, b) => b.p[2] - a.p[2]);
  const chosen = [picks[3], picks[9], picks[16], picks[24]].filter(Boolean);
  const d = chosen.map(({ p }) => { const dx = p[0] - CX, dy = p[1] - CY, l = Math.hypot(dx, dy); return `M${f(CX + (dx / l) * 26)} ${f(CY + (dy / l) * 26)} L${f(p[0])} ${f(p[1])}`; });
  d.forEach((s) => pth('acc', s));
}

// ---------- labels ----------
text(916, 96, 'MMXXVI', 'end', 22);
text(84, 96, 'FIG. XVII', 'start', 18);
text(784, 124, 'RATIO', 'start', 20);
text(196, 880, 'MACHINA', 'end', 18);
text(916, 520, '360', 'end', 18);

const ind = (arr) => arr.map((s) => '    ' + s);
const out = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">',
  '  <g class="L-con" stroke-width="1.2">', ...ind(L.con), '  </g>',
  '  <g class="L-main" stroke-width="2.6">', ...ind(L.main), '  </g>',
  '  <g class="L-detail" stroke-width="1.3">', ...ind(L.detail), '  </g>',
  '  <g class="L-acc" stroke-width="3.6">', ...ind(L.acc), '  </g>',
  '  <g class="L-lbl">', ...ind(L.lbl), '  </g>',
  '</svg>', '',
].join('\n');
fs.writeFileSync(path.join(here, '..', '17-reasoning-machines.svg'), out);
console.log('wrote 17', out.length, 'verts', verts.length, 'edges', edges.size, 'front edges', frontEdges.length, 'front nodes', frontNodes.length);
