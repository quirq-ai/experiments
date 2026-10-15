// 15-deep-learning: convolutional network of 2012 (AlexNet era) as an engraved plate.
// Plain Node, deterministic. Writes ../15-deep-learning.svg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const f = (v) => Math.round(v * 10) / 10;
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
const P = (pts) => 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L');
const path_ = (layer, d) => L[layer].push(`<path d="${d}"/>`);
const line = (layer, a, b) => L[layer].push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`);
const circle = (layer, c, r) => L[layer].push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}"/>`);
const text = (x, y, s, anchor = 'start', size = 20) => L.lbl.push(`<text x="${f(x)}" y="${f(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" fill="currentColor"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${s}</text>`);
const dashed = (a, b, dash = 7, gap = 6) => { const Ln = Math.hypot(b[0] - a[0], b[1] - a[1]), ex = (b[0] - a[0]) / Ln, ey = (b[1] - a[1]) / Ln; let d = ''; for (let t = 0; t < Ln; t += dash + gap) { const e = Math.min(Ln, t + dash); d += `M${f(a[0] + ex * t)} ${f(a[1] + ey * t)} L${f(a[0] + ex * e)} ${f(a[1] + ey * e)} `; } return d.trim(); };

// oblique projection: x along flow, y down, z depth (receding up-right)
const OX = 0.42, OY = -0.36;
const pr = (x, y, z) => [x + z * OX, y + z * OY];

// ---------- slabs ----------
const K = 1.1;
const CY = 330; // vertical centre of the front faces
const spec = [
  { t: 5, s: 224, name: 'in' },
  { t: 30, s: 150, name: 'c1' },
  { t: 44, s: 96, name: 'c2' },
  { t: 56, s: 62, name: 'c3' },
  { t: 56, s: 62, name: 'c4' },
  { t: 44, s: 62, name: 'c5' },
];
const GAP = [0, 44, 40, 40, 30, 30];
let x = 84;
const slabs = spec.map((sp, i) => {
  x += GAP[i] * K;
  const t = sp.t * K, s = sp.s * K;
  const b = { x0: x, x1: x + t, y0: CY - s / 2 + s * 0.2, y1: CY + s / 2 + s * 0.2, d: s, t, s };
  x = x + t + s * OX;
  return b;
});
// box: front face, top face, right face
function box(b, layer) {
  const { x0, x1, y0, y1, d } = b;
  path_(layer, P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) + ' Z');
  path_(layer, P([[x0, y0], pr(x0, y0, d), pr(x1, y0, d), [x1, y0]]));
  path_(layer, P([pr(x1, y0, d), pr(x1, y1, d), [x1, y1]]));
}
slabs.forEach((b) => box(b, 'main'));
// engraved detail: channel divisions on the top face; hatching on front faces; grid on the input
slabs.forEach((b, i) => {
  if (i === 0) {
    // input image: fine grid on the right face
    let d = '';
    for (let k = 1; k < 8; k++) { const z = (b.d * k) / 8; const a = pr(b.x1, b.y0, z), c = pr(b.x1, b.y1, z); d += `M${f(a[0])} ${f(a[1])} L${f(c[0])} ${f(c[1])} `; }
    for (let k = 1; k < 8; k++) { const y = b.y0 + ((b.y1 - b.y0) * k) / 8; const a = pr(b.x1, y, 0), c = pr(b.x1, y, b.d); d += `M${f(a[0])} ${f(a[1])} L${f(c[0])} ${f(c[1])} `; }
    path_('detail', d.trim());
    return;
  }
  let d = '';
  const n = Math.round(b.t / 7);
  for (let k = 1; k < n; k++) { const xx = b.x0 + (b.t * k) / n; const a = [xx, b.y0], c = pr(xx, b.y0, b.d); d += `M${f(a[0])} ${f(a[1])} L${f(c[0])} ${f(c[1])} `; }
  path_('detail', d.trim());
  // front face vertical hatching (shade), sparse to dense
  let h = '';
  for (let k = 1; k < n; k++) { const xx = b.x0 + (b.t * k) / n; h += `M${f(xx)} ${f(b.y0 + 6)} L${f(xx)} ${f(b.y1 - 6)} `; }
  path_('detail', h.trim());
  // right face: a few depth lines
  let r = '';
  for (let k = 1; k < 4; k++) { const y = b.y0 + ((b.y1 - b.y0) * k) / 4; const a = pr(b.x1, y, 0), c = pr(b.x1, y, b.d); r += `M${f(a[0])} ${f(a[1])} L${f(c[0])} ${f(c[1])} `; }
  path_('detail', r.trim());
});

// ---------- kernel pyramids ----------
// patch on the right face of slab i (fractions along z and y), apex on the front face of slab i+1
const kp = [
  { zf: 0.42, yf: 0.34, kz: 0.2, ky: 0.2, af: [0.5, 0.45] },
  { zf: 0.5, yf: 0.5, kz: 0.22, ky: 0.22, af: [0.5, 0.55] },
  { zf: 0.4, yf: 0.3, kz: 0.25, ky: 0.25, af: [0.5, 0.4] },
  { zf: 0.45, yf: 0.55, kz: 0.28, ky: 0.28, af: [0.5, 0.6] },
  { zf: 0.35, yf: 0.35, kz: 0.28, ky: 0.28, af: [0.5, 0.45] },
];
kp.forEach((k, i) => {
  const a = slabs[i], b = slabs[i + 1];
  const layer = i === 0 ? 'acc' : 'detail';
  const z0 = a.d * k.zf, z1 = z0 + a.d * k.kz, yy0 = a.y0 + (a.y1 - a.y0) * k.yf, yy1 = yy0 + (a.y1 - a.y0) * k.ky;
  const c = [pr(a.x1, yy0, z0), pr(a.x1, yy0, z1), pr(a.x1, yy1, z1), pr(a.x1, yy1, z0)];
  const apex = [b.x0 + b.t * 0.0, b.y0 + (b.y1 - b.y0) * k.af[1]];
  const apexP = pr(apex[0], apex[1], b.d * k.af[0]);
  path_(layer, P(c) + ' Z');
  if (i === 0) c.forEach((p) => line('acc', p, apexP));
  else path_('detail', c.map((p) => `M${f(p[0])} ${f(p[1])} L${f(apexP[0])} ${f(apexP[1])}`).join(' '));
  if (i === 0) circle('acc', apexP, 3.2); else circle('detail', apexP, 2.4);
});

// ---------- fully connected rows (below, flowing downward) ----------
const rows = [
  { y: 640, n: 11, sp: 58 },
  { y: 752, n: 11, sp: 58 },
  { y: 860, n: 7, sp: 58 },
];
const RX = 470;
const nodes = rows.map((r) => Array.from({ length: r.n }, (_, i) => [RX + (i - (r.n - 1) / 2) * r.sp, r.y]));
const NR = 10;
nodes.forEach((row) => row.forEach((c) => circle('main', c, NR)));
// flatten: from conv5 bottom edge down into FC1
const c5 = slabs[5];
const src = [];
for (let k = 0; k <= 4; k++) src.push(pr(c5.x0 + (c5.t * k) / 4, c5.y1, 0));
nodes[0].forEach((n, i) => {
  const s = src[Math.round((i / (nodes[0].length - 1)) * 4)];
  path_('detail', `M${f(s[0])} ${f(s[1])} L${f(n[0])} ${f(n[1] - NR)}`);
});
// dense fans between FC rows: one path per source node
for (let r = 0; r < 2; r++) {
  nodes[r].forEach((a) => {
    const d = nodes[r + 1].map((b) => `M${f(a[0])} ${f(a[1] + NR)} L${f(b[0])} ${f(b[1] - NR)}`).join(' ');
    path_('detail', d);
  });
}
// inner ring on output nodes (engraved)
nodes[2].forEach((c) => circle('detail', c, 4));

// ---------- construction ----------
const baseY = Math.max(...slabs.map((b) => b.y1)) + 26;
path_('con', dashed([70, CY], [930, CY], 12, 6));
line('con', [70, baseY], [c5.x1 + 40, baseY]);
// receding guides through the input slab top corners
line('con', [slabs[0].x0 - 20, slabs[0].y0 + 20 * 0.8], pr(slabs[0].x0, slabs[0].y0, slabs[0].d + 40));
line('con', [slabs[0].x1 - 10, slabs[0].y1 + 8], pr(slabs[0].x1, slabs[0].y1, slabs[0].d + 40));
// dimension of the input height
{ const b = slabs[0]; const xx = b.x0 - 16; line('con', [xx, b.y0], [xx, b.y1]); line('con', [xx - 6, b.y0], [b.x0 - 4, b.y0]); line('con', [xx - 6, b.y1], [b.x0 - 4, b.y1]); path_('con', P([[xx - 4, b.y0 + 10], [xx, b.y0], [xx + 4, b.y0 + 10]])); path_('con', P([[xx - 4, b.y1 - 10], [xx, b.y1], [xx + 4, b.y1 - 10]])); }
// row guides for FC
rows.forEach((r) => path_('con', dashed([90, r.y], [910, r.y], 4, 7)));
line('con', [RX, 590], [RX, 915]);
// pitch dimension between two nodes of the last row
{ const a = nodes[2][5], b = nodes[2][6]; const yy = a[1] + 30; line('con', [a[0], a[1] + NR + 4], [a[0], yy + 6]); line('con', [b[0], b[1] + NR + 4], [b[0], yy + 6]); line('con', [a[0], yy], [b[0], yy]); }
// ticks on base line under each slab
{ let d = ''; slabs.forEach((b) => { d += `M${f(b.x0)} ${f(baseY - 5)} L${f(b.x0)} ${f(baseY + 5)} M${f(b.x1)} ${f(baseY - 5)} L${f(b.x1)} ${f(baseY + 5)} `; }); path_('con', d.trim()); }

// ---------- labels ----------
const lead = (a, b, c) => path_('detail', P([a, b, c]));
{ const a = slabs[0], k = kp[0]; const top = pr(a.x1, a.y0 + (a.y1 - a.y0) * k.yf, a.d * (k.zf + k.kz / 2)); lead([84, 104], [top[0] + 60, 104], [top[0], top[1] - 6]); text(84, 96, 'CONV 11X11'); }
{ const a = slabs[1], b = slabs[2]; const m = [(a.x1 + b.x0) / 2 + 30, baseY]; text(m[0], baseY + 30, 'POOL', 'middle'); }
text(nodes[0][0][0] - 22, 612, 'FC 4096');
text(nodes[2][nodes[2].length - 1][0] + 26, 866, '1000');
text(916, 96, 'MMXII', 'end', 22);
text(86, 866, 'FIG. XV', 'start', 18);

const out = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">',
  '  <g class="L-con" stroke-width="1.2">', ...L.con.map((s) => '    ' + s), '  </g>',
  '  <g class="L-main" stroke-width="2.6">', ...L.main.map((s) => '    ' + s), '  </g>',
  '  <g class="L-detail" stroke-width="1.3">', ...L.detail.map((s) => '    ' + s), '  </g>',
  '  <g class="L-acc" stroke-width="3.6">', ...L.acc.map((s) => '    ' + s), '  </g>',
  '  <g class="L-lbl">', ...L.lbl.map((s) => '    ' + s), '  </g>',
  '</svg>', '',
].join('\n');
fs.writeFileSync(path.join(here, '..', '15-deep-learning.svg'), out);
console.log('wrote 15', out.length, 'slab end x', f(x));
