// 16-transformer: the Transformer (2017) as an engraved plate: block stack + attention between tokens + attention matrix.
// Plain Node, deterministic. Writes ../16-transformer.svg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
let seed = 2017;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f = (v) => Math.round(v * 10) / 10;
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
const P = (pts) => 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L');
const pth = (layer, d) => L[layer].push(`<path d="${d}"/>`);
const line = (layer, x1, y1, x2, y2) => L[layer].push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`);
const circle = (layer, cx, cy, r) => L[layer].push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`);
const rrect = (layer, x, y, w, h, r) => L[layer].push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}"/>`);
const text = (x, y, s, anchor = 'start', size = 20) => L.lbl.push(`<text x="${f(x)}" y="${f(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" fill="currentColor"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${s}</text>`);
const dashed = (x1, y1, x2, y2, dash = 7, gap = 6) => { const Ln = Math.hypot(x2 - x1, y2 - y1), ex = (x2 - x1) / Ln, ey = (y2 - y1) / Ln; let d = ''; for (let t = 0; t < Ln; t += dash + gap) { const e = Math.min(Ln, t + dash); d += `M${f(x1 + ex * t)} ${f(y1 + ey * t)} L${f(x1 + ex * e)} ${f(y1 + ey * e)} `; } return d.trim(); };
// arrow: polyline with a chevron head at the end, one path
const arrow = (layer, pts) => { const n = pts.length, [x1, y1] = pts[n - 1], [x0, y0] = pts[n - 2]; const Ln = Math.hypot(x1 - x0, y1 - y0), ex = (x1 - x0) / Ln, ey = (y1 - y0) / Ln; const hx = x1 - ex * 10, hy = y1 - ey * 10; pth(layer, P(pts) + ` M${f(hx - ey * 5)} ${f(hy + ex * 5)} L${f(x1)} ${f(y1)} L${f(hx + ey * 5)} ${f(hy - ex * 5)}`); };

// ================= LEFT: the block stack =================
const SX = 285; // stack axis
const BW = 220, BX = SX - BW / 2;
// frame (N x 6)
const FR = { x: 150, y: 318, w: 272, h: 452 };
// boxes, top to bottom
const bx = {
  soft: { y: 196, h: 42 },
  lin: { y: 258, h: 32 },
  an2: { y: 342, h: 30 },
  ff: { y: 394, h: 64 },
  an1: { y: 500, h: 30 },
  mha: { y: 560, h: 82 },
  emb: { y: 836, h: 36 },
};
rrect('main', FR.x, FR.y, FR.w, FR.h, 18);
for (const k of ['soft', 'lin', 'an2', 'ff', 'an1', 'mha', 'emb']) rrect('main', BX, bx[k].y, BW, bx[k].h, 9);
// positional encoding
const PE = { x: SX, y: 800, r: 13 };
circle('main', PE.x, PE.y, PE.r);
pth('main', `M${SX - 7} ${PE.y} L${SX + 7} ${PE.y} M${SX} ${PE.y - 7} L${SX} ${PE.y + 7}`);
// sine glyph beside PE
{ let d = ''; for (let i = 0; i <= 24; i++) { const x = SX - 78 + i * 2.2, y = PE.y + 8 * Math.sin((i / 24) * Math.PI * 2); d += (i ? ' L' : 'M') + f(x) + ' ' + f(y); } pth('main', d); line('main', SX - 24, PE.y, SX - PE.r - 3, PE.y); }
// flow arrows (main)
arrow('main', [[SX, 912], [SX, bx.emb.y + bx.emb.h + 2]]);
arrow('main', [[SX, bx.emb.y - 2], [SX, PE.y + PE.r + 2]]);
arrow('main', [[SX, PE.y - PE.r - 2], [SX, FR.y + FR.h + 2]]);
// inside frame: to QKV split
const split = { x: SX, y: 722 };
line('main', SX, FR.y + FR.h, SX, split.y);
arrow('main', [[split.x, split.y], [SX - 62, split.y - 30], [SX - 62, bx.mha.y + bx.mha.h + 2]]);
arrow('main', [[split.x, split.y], [SX, bx.mha.y + bx.mha.h + 2]]);
arrow('main', [[split.x, split.y], [SX + 62, split.y - 30], [SX + 62, bx.mha.y + bx.mha.h + 2]]);
circle('main', split.x, split.y, 3.5);
arrow('main', [[SX, bx.mha.y - 2], [SX, bx.an1.y + bx.an1.h + 2]]);
arrow('main', [[SX, bx.an1.y - 2], [SX, bx.ff.y + bx.ff.h + 2]]);
arrow('main', [[SX, bx.ff.y - 2], [SX, bx.an2.y + bx.an2.h + 2]]);
arrow('main', [[SX, bx.an2.y - 2], [SX, bx.lin.y + bx.lin.h + 2]]);
arrow('main', [[SX, bx.lin.y - 2], [SX, bx.soft.y + bx.soft.h + 2]]);
arrow('main', [[SX, bx.soft.y - 2], [SX, 150]]);
// residual connections (main): bypass on the left, into Add & Norm
const RXL = FR.x + 10;
arrow('main', [[SX, split.y + 16], [RXL, split.y + 16], [RXL, bx.an1.y + bx.an1.h / 2], [BX - 2, bx.an1.y + bx.an1.h / 2]]);
circle('main', SX, split.y + 16, 3);
arrow('main', [[SX, bx.an1.y - 16], [RXL, bx.an1.y - 16], [RXL, bx.an2.y + bx.an2.h / 2], [BX - 2, bx.an2.y + bx.an2.h / 2]]);
circle('main', SX, bx.an1.y - 16, 3);
// output probabilities: bar glyph on top
const bars = [0.2, 0.35, 0.15, 0.9, 0.3, 0.12, 0.5, 0.22, 0.1];
bars.forEach((v, i) => { const x = SX - 64 + i * 16; line('main', x, 136, x, 136 - v * 46); });
line('detail', SX - 76, 138, SX + 76, 138);

// details inside boxes
// Add & Norm: plus glyph and fine rule
for (const k of ['an1', 'an2']) { const b = bx[k]; const cy = b.y + b.h / 2; pth('detail', `M${BX + 20} ${f(cy)} L${BX + 32} ${f(cy)} M${BX + 26} ${f(cy - 6)} L${BX + 26} ${f(cy + 6)}`); pth('detail', dashed(BX + 46, cy, BX + BW - 18, cy, 3, 4)); }
// Feed forward: two-layer node glyph
{ const b = bx.ff; const ya = b.y + 18, yb = b.y + b.h - 18; const xa = [BX + 40, BX + 80, BX + 120, BX + 160, BX + 180].slice(0, 4).map((x, i) => BX + 44 + i * 44); const xb = [0, 1, 2, 3, 4, 5].map((i) => BX + 30 + i * 32);
  xa.forEach((x) => circle('detail', x, ya, 4)); xb.forEach((x) => circle('detail', x, yb, 4));
  xa.forEach((x) => pth('detail', xb.map((x2) => `M${f(x)} ${f(ya + 4)} L${f(x2)} ${f(yb - 4)}`).join(' '))); }
// MHA: heads as stacked plates behind the box (engraved offset outlines)
for (let k = 1; k <= 3; k++) pth('detail', P([[BX + 6 * k, bx.mha.y - 5 * k + 5], [BX + 6 * k, bx.mha.y - 5 * k], [BX + BW + 6 * k, bx.mha.y - 5 * k], [BX + BW + 6 * k, bx.mha.y + bx.mha.h - 5 * k], [BX + BW + 6 * k - 5, bx.mha.y + bx.mha.h - 5 * k]]));
// linear: weight ticks
for (let i = 0; i < 12; i++) line('detail', BX + 22 + i * 16, bx.lin.y + 9, BX + 22 + i * 16, bx.lin.y + bx.lin.h - 9);
// embedding: token ticks
for (let i = 0; i < 9; i++) line('detail', BX + 22 + i * 22, bx.emb.y + 10, BX + 22 + i * 22, bx.emb.y + bx.emb.h - 10);
// frame hatching band on its right edge (engraved shadow)
{ let d = ''; for (let y = FR.y + 22; y < FR.y + FR.h - 10; y += 9) d += `M${FR.x + FR.w + 2} ${y} L${FR.x + FR.w + 10} ${y - 8} `; pth('detail', d.trim()); }

// ================= RIGHT: attention between tokens =================
const TN = 8, TW = 42, TH = 30, TX0 = 488, TSP = 54;
const TOPY = 150, BOTY = 452;
const tx = (i) => TX0 + i * TSP;
for (let i = 0; i < TN; i++) { rrect('main', tx(i), TOPY, TW, TH, 5); rrect('main', tx(i), BOTY, TW, TH, 5); }
// words inside tokens
for (let i = 0; i < TN; i++) { const w = 14 + rnd() * 16; line('detail', tx(i) + (TW - w) / 2, TOPY + TH / 2, tx(i) + (TW + w) / 2, TOPY + TH / 2); line('detail', tx(i) + (TW - w) / 2, BOTY + TH / 2, tx(i) + (TW + w) / 2, BOTY + TH / 2); }
// attention weights: softmax over random logits, with strong chosen pairs
const strong = [[1, 4], [4, 6], [6, 1], [3, 3]];
const A = [];
for (let i = 0; i < TN; i++) {
  const logits = Array.from({ length: TN }, (_, j) => rnd() * 1.6 + (i === j ? 0.8 : 0) - Math.abs(i - j) * 0.15);
  strong.forEach(([q, k]) => { if (q === i) logits[k] += 3.2; });
  const m = Math.max(...logits), e = logits.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  A.push(e.map((v) => v / s));
}
const curve = (i, j) => { const x0 = tx(i) + TW / 2, y0 = BOTY - 2, x1 = tx(j) + TW / 2, y1 = TOPY + TH + 2; const my = (y0 + y1) / 2; return `M${f(x0)} ${f(y0)} C${f(x0)} ${f(my)} ${f(x1)} ${f(my)} ${f(x1)} ${f(y1)}`; };
for (let i = 0; i < TN; i++) {
  const d = [];
  for (let j = 0; j < TN; j++) if (!strong.some(([q, k]) => q === i && k === j) && A[i][j] > 0.03) d.push(curve(i, j));
  if (d.length) pth('detail', d.join(' '));
}
strong.slice(0, 3).forEach(([i, j]) => pth('acc', curve(i, j)));
// self-attention loops above the top row (thin arcs), key to key
for (let j = 0; j < TN - 1; j++) { const x0 = tx(j) + TW / 2, x1 = tx(j + 1) + TW / 2; pth('detail', `M${f(x0)} ${TOPY - 2} Q${f((x0 + x1) / 2)} ${TOPY - 34} ${f(x1)} ${TOPY - 2}`); }
{ const x0 = tx(1) + TW / 2, x1 = tx(4) + TW / 2; pth('main', `M${f(x0)} ${TOPY - 2} Q${f((x0 + x1) / 2)} ${TOPY - 70} ${f(x1)} ${TOPY - 2}`); }

// ================= RIGHT LOWER: attention matrix =================
const MX = 540, MY = 574, MC = 42, MN = TN;
L.main.push(`<rect x="${MX}" y="${MY}" width="${MC * MN}" height="${MC * MN}"/>`);
for (let k = 1; k < MN; k++) { line('detail', MX + k * MC, MY, MX + k * MC, MY + MC * MN); line('detail', MX, MY + k * MC, MX + MC * MN, MY + k * MC); }
// hatch density by weight (engraving shading)
for (let i = 0; i < MN; i++) for (let j = 0; j < MN; j++) {
  const w = A[i][j]; if (w < 0.07) continue; const n = Math.max(2, Math.min(9, Math.round(w * 22)));
  const x0 = MX + j * MC, y0 = MY + i * MC; let d = '';
  for (let k = 1; k <= n; k++) { const o = (k * MC * 2) / (n + 1); const a = [x0 + Math.max(0, o - MC), y0 + Math.min(MC, o)], b = [x0 + Math.min(MC, o), y0 + Math.max(0, o - MC)]; d += `M${f(a[0] + 1)} ${f(a[1] - 1)} L${f(b[0] - 1)} ${f(b[1] + 1)} `; }
  pth('detail', d.trim());
}
strong.forEach(([i, j]) => L.main.push(`<rect x="${MX + j * MC + 5}" y="${MY + i * MC + 5}" width="${MC - 10}" height="${MC - 10}"/>`));
// token ticks along matrix edges
{ let d = ''; for (let k = 0; k < MN; k++) { const c = MX + k * MC + MC / 2; d += `M${c} ${MY - 4} L${c} ${MY - 12} `; const r = MY + k * MC + MC / 2; d += `M${MX - 4} ${r} L${MX - 12} ${r} `; } pth('detail', d.trim()); }

// ================= construction =================
line('con', SX, 96, SX, 930);
pth('con', dashed(460, 90, 460, 910, 10, 6));
line('con', TX0 - 20, TOPY + TH / 2, TX0 + TN * TSP + 6, TOPY + TH / 2);
line('con', TX0 - 20, BOTY + TH / 2, TX0 + TN * TSP + 6, BOTY + TH / 2);
pth('con', dashed(MX, MY, MX + MC * MN, MY + MC * MN, 6, 6));
// matrix width dimension
{ const y = MY + MC * MN + 24; line('con', MX, y, MX + MC * MN, y); line('con', MX, y - 7, MX, y + 7); line('con', MX + MC * MN, y - 7, MX + MC * MN, y + 7); pth('con', P([[MX + 10, y - 4], [MX, y], [MX + 10, y + 4]])); pth('con', P([[MX + MC * MN - 10, y - 4], [MX + MC * MN, y], [MX + MC * MN - 10, y + 4]])); }
// frame height dimension (left)
{ const x = FR.x - 22; line('con', x, FR.y, x, FR.y + FR.h); line('con', x - 7, FR.y, FR.x - 4, FR.y); line('con', x - 7, FR.y + FR.h, FR.x - 4, FR.y + FR.h); pth('con', P([[x - 4, FR.y + 10], [x, FR.y], [x + 4, FR.y + 10]])); pth('con', P([[x - 4, FR.y + FR.h - 10], [x, FR.y + FR.h], [x + 4, FR.y + FR.h - 10]])); }
// projection guides from token columns down to matrix columns
for (const j of [0, MN - 1]) pth('con', dashed(tx(j) + TW / 2, BOTY + TH + 4, MX + j * MC + MC / 2, MY - 16, 4, 6));
circle('con', SX, bx.mha.y + bx.mha.h / 2, 150);

// ================= labels =================
text(SX, bx.mha.y + bx.mha.h / 2 + 7, 'ATTENTIO', 'middle', 20);
text(SX, bx.soft.y + bx.soft.h / 2 + 7, 'SOFTMAX', 'middle', 20);
text(FR.x - 34, FR.y + FR.h / 2 - 4, 'N X 6', 'end', 18);
text(FR.x + 16, split.y + 44, 'Q K V', 'start', 16);
text(916, 96, 'MMXVII', 'end', 22);
text(84, 96, 'FIG. XVI', 'start', 18);

const out = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">',
  '  <g class="L-con" stroke-width="1.2">', ...L.con.map((s) => '    ' + s), '  </g>',
  '  <g class="L-main" stroke-width="2.6">', ...L.main.map((s) => '    ' + s), '  </g>',
  '  <g class="L-detail" stroke-width="1.3">', ...L.detail.map((s) => '    ' + s), '  </g>',
  '  <g class="L-acc" stroke-width="3.6">', ...L.acc.map((s) => '    ' + s), '  </g>',
  '  <g class="L-lbl">', ...L.lbl.map((s) => '    ' + s), '  </g>',
  '</svg>', '',
].join('\n');
fs.writeFileSync(path.join(here, '..', '16-transformer.svg'), out);
console.log('wrote 16', out.length);
