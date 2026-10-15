// 14-smartphone: exploded axonometric of a pocket computer (2007), with hidden-line removal.
// Plain Node, deterministic. Writes ../14-smartphone.svg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const f = (v) => Math.round(v * 10) / 10;
const deg = Math.PI / 180;

// ---------- projection ----------
const TH = 35 * deg, S = 3.05, K = 0.52;
const NX = 0.58, NY = 0.81; // explode axis on the plate (the phone normal points up-left)
const DSTEP = 140;
// Z[i] is a layer index (0 top .. 5 bottom), optionally minus a height above that layer's base.
const origin = (z) => [500 + (z - 2.5) * DSTEP * NX, 500 + (z - 2.5) * DSTEP * NY];
const proj = (u, v, z) => { const [ox, oy] = origin(z); return [ox + (u * Math.cos(TH) - v * Math.sin(TH)) * S, oy + (u * Math.sin(TH) + v * Math.cos(TH)) * S * K]; };

// ---------- 2D helpers in (u,v) plane ----------
function rrect(u0, v0, w, h, r, n = 7) {
  const pts = [];
  const cs = [[u0 + w - r, v0 + r, -90], [u0 + w - r, v0 + h - r, 0], [u0 + r, v0 + h - r, 90], [u0 + r, v0 + r, 180]];
  for (const [cu, cv, a0] of cs) for (let i = 0; i <= n; i++) { const a = (a0 + (90 * i) / n) * deg; pts.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); }
  return pts;
}
const ell = (cu, cv, r, n = 28) => Array.from({ length: n }, (_, i) => [cu + r * Math.cos((i / n) * 2 * Math.PI), cv + r * Math.sin((i / n) * 2 * Math.PI)]);
const rect = (u0, v0, w, h) => [[u0, v0], [u0 + w, v0], [u0 + w, v0 + h], [u0, v0 + h]];

// ---------- scene ----------
const items = []; // {layer, lvl, pts (screen), closed, self}
const occ = []; // occ[lvl] = [polygons]
const add = (layer, lvl, pts, closed = false, extraOcc = null) => items.push({ layer, lvl, pts, closed, extraOcc });
const P = (uv, zy) => uv.map(([u, v]) => proj(u, v, zy));

function slab(lvl, uv, zy, t, layer = 'main') {
  const top = P(uv, zy);
  const bot = P(uv, zy + t * HU);
  occ[lvl] = occ[lvl] || [];
  for (let k = 0; k <= 4; k++) occ[lvl].push(P(uv, zy + (t * HU * k) / 4));
  add(layer, lvl, top, true);
  if (t > 0) {
    add(layer, lvl, bot, true, [top]);
    let li = 0, ri = 0;
    const q = (p) => p[0] * NY - p[1] * NX;
    top.forEach((p, i) => { if (q(p) < q(top[li])) li = i; if (q(p) > q(top[ri])) ri = i; });
    add(layer, lvl, [top[li], bot[li]]);
    add(layer, lvl, [top[ri], bot[ri]]);
  }
  return top;
}
const Z = [0, 1, 2, 3, 4, 5];
const HU = 1 / DSTEP; // one plate pixel along the explode axis, in layer units
const L_ = { glass: 0, touch: 1, disp: 2, board: 3, batt: 4, shell: 5 };
const W = 62, H = 120;

// 0 cover glass
slab(0, rrect(-31, -60, W, H, 9), Z[0], 7);
add('main', 0, P(ell(0, 51.5, 5.2), Z[0]), true); // home button hole
add('main', 0, P(rrect(-7, -53.5, 14, 2.4, 1.2, 3), Z[0]), true); // earpiece slot
// glare hatching on glass
for (let i = 0; i < 7; i++) { const o = i * 3.2; add('detail', 0, P([[-27 + o, -30 - o * 0.2], [-27 + o + 16, -30 - o * 0.2 - 22]], Z[0])); }
for (let i = 0; i < 4; i++) { const o = i * 3.2; add('detail', 0, P([[10 + o, 40], [10 + o + 12, 40 - 16]], Z[0])); }

// 1 touch grid sheet
slab(1, rrect(-29, -56, 58, 112, 6), Z[1], 3);
const gu0 = -26, gu1 = 26, gv0 = -52, gv1 = 44;
for (let i = 0; i <= 12; i++) { const u = gu0 + ((gu1 - gu0) * i) / 12; add('detail', 1, P([[u, gv0], [u, gv1]], Z[1])); }
for (let j = 0; j <= 20; j++) { const v = gv0 + ((gv1 - gv0) * j) / 20; add('detail', 1, P([[gu0, v], [gu1, v]], Z[1])); }
add('main', 1, P([[-6, 56], [-6, 66], [6, 66], [6, 56]], Z[1])); // flex tail

// 2 display
slab(2, rrect(-28, -54, 56, 108, 3, 3), Z[2], 8);
const AU0 = -24.5, AV0 = -37, AW = 49, AH = 74; // active area 3:2
add('main', 2, P(rect(AU0, AV0, AW, AH), Z[2]), true);
for (let j = 1; j < 10; j++) { const v = AV0 + (AH * j) / 10; add('detail', 2, P([[AU0 + 2, v], [AU0 + AW - 2, v]], Z[2])); }
add('main', 2, P([[-8, 54], [-8, 64], [8, 64], [8, 54]], Z[2])); // flex

// 3 logic board
slab(3, [[-28, -56], [24, -56], [28, -52], [28, 20], [4, 20], [4, 56], [-24, 56], [-28, 52]], Z[3], 5);
const chips = [
  { u: -20, v: -46, w: 12, h: 9 }, // nand
  { u: 12, v: -46, w: 10, h: 12 }, // baseband
  { u: 12, v: -24, w: 12, h: 10 }, // power
  { u: -22, v: 4, w: 14, h: 10 }, // memory
  { u: -20, v: 26, w: 16, h: 9 }, // audio
  { u: 14, v: 2, w: 8, h: 8 },
];
const soc = { u: -10, v: -26, w: 20, h: 20 };
function chip(c, layer, h = 5) {
  const top = P(rect(c.u, c.v, c.w, c.h), Z[3] - h * HU);
  add(layer, 3, top, true);
  // visible side edges: front-left and front-right faces (towards +v, -u in view), bottom corners
  const b = P(rect(c.u, c.v, c.w, c.h), Z[3]);
  add(layer, 3, [top[3], b[3]]); add(layer, 3, [top[2], b[2]]); add(layer, 3, [top[0], b[0]]);
  add(layer, 3, [b[0], b[3], b[2]]);
}
chips.forEach((c) => chip(c, 'main'));
chip(soc, 'acc', 9);
// SoC die mark + pins (detail)
for (let i = 1; i < 8; i++) { const t = soc.u + (soc.w * i) / 8; add('detail', 3, P([[t, soc.v - 2.2], [t, soc.v - 0.4]], Z[3])); add('detail', 3, P([[soc.u - 2.2, soc.v + (soc.h * i) / 8], [soc.u - 0.4, soc.v + (soc.h * i) / 8]], Z[3])); }
add('detail', 3, P(rect(soc.u + 5, soc.v + 5, 10, 10), Z[3] - 9 * HU), true);
// traces from SoC to chips (manhattan routing)
const tr = [
  [[soc.u, soc.v + 4], [-14, soc.v + 4], [-14, -37]],
  [[soc.u, soc.v + 8], [-17, soc.v + 8], [-17, -37]],
  [[soc.u + soc.w, soc.v + 3], [12, soc.v + 3]],
  [[soc.u + soc.w, soc.v + 12], [18, soc.v + 12], [18, -14]],
  [[soc.u + 12, soc.v], [soc.u + 12, -38], [12, -38]],
  [[soc.u + 8, soc.v], [soc.u + 8, -42], [12, -42]],
  [[soc.u + 4, soc.v + soc.h], [soc.u + 4, 4]],
  [[soc.u + 8, soc.v + soc.h], [soc.u + 8, -2], [-6, -2], [-6, 4]],
  [[soc.u + 12, soc.v + soc.h], [soc.u + 12, 6], [14, 6]],
  [[-15, 14], [-15, 26]],
  [[-11, 14], [-11, 20], [-8, 20], [-8, 26]],
  [[18, 10], [18, 16], [0, 16], [0, 40], [-4, 40]],
  [[22, -34], [26, -34], [26, 16]],
  [[-8, 9], [-4, 9], [-4, 30], [-4, 44]],
  [[-8, 11], [-2, 11], [-2, 44]],
  [[-4, 30], [0, 30], [0, 18]],
  [[-26, 18], [-26, 40], [-20, 40], [-20, 44]],
  [[-24, 35], [-24, 48], [-18, 48]],
  [[-4, 26], [2, 26], [2, 16], [14, 16], [14, 10]],
  [[18, 10], [18, 13], [24, 13], [24, 18]],
  [[-12, 35], [-12, 42], [-8, 42], [-8, 44]],
];
tr.forEach((t) => add('detail', 3, P(t, Z[3])));
for (const [u, v] of [[-24, -52], [24, -52], [24, 16], [0, 52], [-20, 52]]) add('detail', 3, P(ell(u, v, 1.6, 12), Z[3]), true);
add('main', 3, P(rect(-18, 44, 16, 6), Z[3] - 4 * HU), true); // dock connector

// 4 battery
slab(4, rrect(-25, -50, 50, 96, 3, 3), Z[4], 16);
for (let i = 0; i < 22; i++) { const v = -46 + i * 4.2; add('detail', 4, P([[-22, v], [-12, v + 7]], Z[4])); }
add('main', 4, P([[-6, -50], [-6, -56], [6, -56], [6, -50]], Z[4])); // tab

// 5 back shell
slab(5, rrect(-31, -60, W, H, 9), Z[5], 20);
add('main', 5, P(rrect(-28.5, -57.5, 57, 115, 7), Z[5]), true); // inner lip
add('main', 5, P(ell(-21, -50, 3.6), Z[5]), true); // camera aperture
add('detail', 5, P(ell(-21, -50, 2.2, 18), Z[5]), true);
for (let i = 0; i < 8; i++) { const v = 44 - i * 3.5; add('detail', 5, P([[28.5, v], [31, v - 2]], Z[5] + 7 * HU)); } // side hatching hint

// ---------- hidden line removal ----------
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function densify(pts, closed, step = 1.5) {
  const out = [];
  const seq = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < seq.length - 1; i++) {
    const [x0, y0] = seq[i], [x1, y1] = seq[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  out.push(seq[seq.length - 1]);
  return out;
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  let md = 0, mi = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > md) { md = d; mi = i; } }
  if (md > eps) return [...rdp(pts.slice(0, mi + 1), eps).slice(0, -1), ...rdp(pts.slice(mi), eps)];
  return [a, b];
}
const out = { con: [], main: [], detail: [], acc: [] };
for (const it of items) {
  const occs = [];
  for (let l = 0; l < it.lvl; l++) occs.push(...(occ[l] || []));
  if (it.extraOcc) occs.push(...it.extraOcc);
  const dense = densify(it.pts, it.closed);
  const runs = [];
  let cur = [];
  for (const p of dense) {
    const hid = occs.some((o) => inside(p, o));
    if (hid) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(p);
  }
  if (cur.length > 1) runs.push(cur);
  // closed and fully visible: merge wrap
  const allVisible = runs.length === 1 && runs[0].length === dense.length;
  if (it.closed && runs.length > 1) { const first = runs[0], last = runs[runs.length - 1]; if (first[0] === dense[0] && last[last.length - 1] === dense[dense.length - 1]) { runs[0] = [...last, ...first]; runs.pop(); } }
  const parts = [];
  for (const r of runs) {
    const h = r.length >> 1;
    const s = allVisible ? [...rdp(r.slice(0, h + 1), 0.25).slice(0, -1), ...rdp(r.slice(h), 0.25)] : rdp(r, 0.25);
    if (Math.hypot(s[s.length - 1][0] - s[0][0], s[s.length - 1][1] - s[0][1]) < 2 && s.length < 3) continue;
    parts.push('M' + s.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L') + (allVisible && it.closed ? ' Z' : ''));
  }
  if (parts.length) out[it.layer].push(`<path d="${parts.join(' ')}"/>`);
}

// ---------- construction (not occluded; faint) ----------
const dashL = (x0, y0, x1, y1, dash = 7, gap = 6) => { const L = Math.hypot(x1 - x0, y1 - y0), ex = (x1 - x0) / L, ey = (y1 - y0) / L; let d = ''; for (let t = 0; t < L; t += dash + gap) { const e = Math.min(L, t + dash); d += `M${f(x0 + ex * t)} ${f(y0 + ey * t)} L${f(x0 + ex * e)} ${f(y0 + ey * e)} `; } return `<path d="${d.trim()}"/>`; };
const ln = (a, b) => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
for (const [u, v] of [[-28.4, -57.4], [28.4, -57.4], [28.4, 57.4], [-28.4, 57.4]]) { const a = proj(u, v, -0.25), b = proj(u, v, 5.35); out.con.push(dashL(a[0], a[1], b[0], b[1])); }
{ const a = proj(0, 0, -0.45), b = proj(0, 0, 5.5); out.con.push(dashL(a[0], a[1], b[0], b[1], 16, 6)); }
{ out.con.push(ln(proj(0, -74, 0), proj(0, 74, 0)), ln(proj(-44, 0, 0), proj(44, 0, 0))); }
// 3.5 IN diagonal on display with arrowheads
const d0 = proj(AU0, AV0, Z[2]), d1 = proj(AU0 + AW, AV0 + AH, Z[2]);
{
  const ux = (d1[0] - d0[0]), uy = (d1[1] - d0[1]), L = Math.hypot(ux, uy), ex = ux / L, ey = uy / L, nx = -ey, ny = ex;
  out.con.push(ln(d0, d1));
  const ah = (p, s) => `<path d="M${f(p[0] + s * ex * 12 + nx * 5)} ${f(p[1] + s * ey * 12 + ny * 5)} L${f(p[0])} ${f(p[1])} L${f(p[0] + s * ex * 12 - nx * 5)} ${f(p[1] + s * ey * 12 - ny * 5)}"/>`;
  out.con.push(ah(d0, 1), ah(d1, -1));
}
// explode scale: axis parallel to N with a tick per layer, set off to the upper right
{
  const off = [250 * NY, -250 * NX];
  const a = proj(0, 0, 0), b = proj(0, 0, 5);
  out.con.push(ln([a[0] + off[0], a[1] + off[1]], [b[0] + off[0], b[1] + off[1]]));
  let d = '';
  for (let i = 0; i <= 5; i++) { const p = proj(0, 0, i); const x = p[0] + off[0], y = p[1] + off[1]; d += `M${f(x - NY * 7)} ${f(y + NX * 7)} L${f(x + NY * 7)} ${f(y - NX * 7)} `; }
  out.con.push(`<path d="${d.trim()}"/>`);
}
// length dimension of the back shell along its long edge
{
  const a = proj(-31, -60, 5 + 20 * HU), b = proj(-31, 60, 5 + 20 * HU);
  const o = [-38 * NY, 38 * NX];
  const a2 = [a[0] + o[0], a[1] + o[1]], b2 = [b[0] + o[0], b[1] + o[1]];
  out.con.push(ln(a, [a2[0] - 6 * NY, a2[1] + 6 * NX]), ln(b, [b2[0] - 6 * NY, b2[1] + 6 * NX]), ln(a2, b2));
}

// ---------- labels + leaders ----------
const lbl = [];
const text = (x, y, s, anchor = 'start', size = 20) => lbl.push(`<text x="${f(x)}" y="${f(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" fill="currentColor"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${s}</text>`);
const leader = (p, x1, y1, x2) => out.detail.push(`<path d="M${f(p[0])} ${f(p[1])} L${f(x1)} ${f(y1)} L${f(x2)} ${f(y1)}"/>`);
{ const p = proj(-20, -45, 0); leader(p, 170, 118, 92); text(92, 108, 'VITRUM'); }
{ const p = proj(-22, 28, 1); leader(p, 150, 470, 92); text(92, 460, 'TACTUS'); }
{ const p = proj(24, -40, 2); leader(p, 820, 300, 908); text(908, 290, '3.5 IN', 'end'); }
{ const p = proj(soc.u + soc.w, soc.v, 3 - 9 * HU); leader(p, 840, 420, 908); text(908, 410, 'SOC', 'end'); }
{ const p = proj(-20, 40, 4); leader(p, 330, 800, 92); text(92, 790, 'PILA'); }
text(908, 108, 'MMVII', 'end', 22);
text(908, 905, 'FIG. XIV', 'end', 18);

const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">',
  '  <g class="L-con" stroke-width="1.2">', ...out.con.map((s) => '    ' + s), '  </g>',
  '  <g class="L-main" stroke-width="2.6">', ...out.main.map((s) => '    ' + s), '  </g>',
  '  <g class="L-detail" stroke-width="1.3">', ...out.detail.map((s) => '    ' + s), '  </g>',
  '  <g class="L-acc" stroke-width="3.6">', ...out.acc.map((s) => '    ' + s), '  </g>',
  '  <g class="L-lbl">', ...lbl.map((s) => '    ' + s), '  </g>',
  '</svg>', '',
].join('\n');
fs.writeFileSync(path.join(here, '..', '14-smartphone.svg'), svg);
console.log('wrote 14', svg.length);
