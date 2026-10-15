// 13-world-wide-web: engraved plate of a hypertext page linking outward (1991).
// Plain Node, deterministic. Writes ../13-world-wide-web.svg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
let seed = 1991;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f = (v) => Math.round(v * 10) / 10;
const pl = (pts) => 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L');
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
const line = (layer, x1, y1, x2, y2) => L[layer].push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`);
const pathd = (layer, d) => L[layer].push(`<path d="${d}"/>`);
const circle = (layer, cx, cy, r) => L[layer].push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`);
const text = (x, y, s, size = 20, anchor = 'start') => L.lbl.push(`<text x="${f(x)}" y="${f(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" fill="currentColor"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${s}</text>`);
const dashed = (x1, y1, x2, y2, dash = 8, gap = 6) => { const len = Math.hypot(x2 - x1, y2 - y1); const ux = (x2 - x1) / len, uy = (y2 - y1) / len; let d = ''; for (let s = 0; s < len; s += dash + gap) { const e = Math.min(len, s + dash); d += `M${f(x1 + ux * s)} ${f(y1 + uy * s)} L${f(x1 + ux * e)} ${f(y1 + uy * e)} `; } return d.trim(); };
const dashedCircle = (cx, cy, r, n) => { let d = ''; for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / n) * 0.55; d += `M${f(cx + r * Math.cos(a0))} ${f(cy + r * Math.sin(a0))} A${r} ${r} 0 0 1 ${f(cx + r * Math.cos(a1))} ${f(cy + r * Math.sin(a1))} `; } return d.trim(); };
const deg = Math.PI / 180;

const CX = 500, CY = 480;
// page outline with dog ear
function page(layer, cx, cy, w, h, fold) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  pathd(layer, pl([[x0, y0], [x1 - fold, y0], [x1, y0 + fold], [x1, y1], [x0, y1]]) + ' Z');
  return { x0, x1, y0, y1, fold };
}
function fold(layer, b) { pathd(layer, pl([[b.x1 - b.fold, b.y0], [b.x1 - b.fold, b.y0 + b.fold], [b.x1, b.y0 + b.fold]])); }

// ---------- construction ----------
const R1 = 292, R2 = 394;
pathd('con', dashedCircle(CX, CY, R1, 72));
pathd('con', dashedCircle(CX, CY, R2, 96));
circle('con', CX, CY, 186);
line('con', CX, 70, CX, 930);
line('con', 70, CY, 930, CY);
const satAng = [-67.5, -22.5, 22.5, 67.5, 112.5, 157.5, 202.5, 247.5];
for (const a of satAng) pathd('con', dashed(CX + 190 * Math.cos(a * deg), CY + 190 * Math.sin(a * deg), CX + (R2 + 30) * Math.cos(a * deg), CY + (R2 + 30) * Math.sin(a * deg), 5, 7));
// angle arc 0 -> 22.5 with ticks
pathd('con', `M${f(CX + 150)} ${CY} A150 150 0 0 1 ${f(CX + 150 * Math.cos(22.5 * deg))} ${f(CY + 150 * Math.sin(22.5 * deg))}`);
{ let d = ''; for (let a = -90; a < 270; a += 7.5) { const r0 = R1 - (a % 22.5 === 0 ? 12 : 6); d += `M${f(CX + r0 * Math.cos(a * deg))} ${f(CY + r0 * Math.sin(a * deg))} L${f(CX + R1 * Math.cos(a * deg))} ${f(CY + R1 * Math.sin(a * deg))} `; } pathd('con', d.trim()); }

// ---------- central page ----------
const PW = 250, PH = 320;
const cp = page('main', CX, CY, PW, PH, 34);
fold('main', cp);
// dimension line under page
const dy = cp.y1 + 26;
line('con', cp.x0, cp.y1 + 6, cp.x0, dy + 8);
line('con', cp.x1, cp.y1 + 6, cp.x1, dy + 8);
line('con', cp.x0, dy, cp.x1, dy);
pathd('con', pl([[cp.x0 + 10, dy - 4], [cp.x0, dy], [cp.x0 + 10, dy + 4]]));
pathd('con', pl([[cp.x1 - 10, dy - 4], [cp.x1, dy], [cp.x1 - 10, dy + 4]]));
// title block
const tx0 = cp.x0 + 22, tx1 = cp.x1 - 22;
pathd('main', pl([[tx0, cp.y0 + 34], [tx0 + 128, cp.y0 + 34]]));
pathd('main', pl([[tx0, cp.y0 + 50], [cp.x1 - 44, cp.y0 + 50]]));
pathd('main', pl([[tx0, cp.y0 + 55], [cp.x1 - 44, cp.y0 + 55]]));
// text rows; spans marked as links
const rows = [];
const rowY0 = cp.y0 + 80, rowStep = 17.5;
const linkRows = { 1: 'R', 3: 'L', 5: 'R', 7: 'L', 9: 'R', 11: 'L', 12: 'R', 13: 'L' };
const spans = [];
for (let r = 0; r < 14; r++) {
  const y = rowY0 + r * rowStep;
  const end = r === 13 ? tx0 + 150 : tx1;
  let x = tx0;
  const segs = [];
  while (x < end - 14) { const w = 14 + rnd() * 42; const e = Math.min(end, x + w); segs.push([x, e]); x = e + 8; }
  segs.forEach(([a, b], i) => {
    const isLink = (linkRows[r] === 'L' && i === 0) || (linkRows[r] === 'R' && i === segs.length - 1);
    if (isLink) spans.push({ side: linkRows[r], x0: a, x1: b, y, row: r });
    line('detail', a, y, b, y);
  });
}
// ---------- satellites ----------
const sats = satAng.map((a) => ({ a, x: CX + R1 * Math.cos(a * deg), y: CY + R1 * Math.sin(a * deg) }));
const SW = 88, SH = 112;
const satBoxes = sats.map((s) => page('main', s.x, s.y, SW, SH, 16));
satBoxes.forEach((b) => fold('main', b));
// satellite text + a link span each
satBoxes.forEach((b, i) => {
  pathd('detail', pl([[b.x0 + 10, b.y0 + 16], [b.x0 + 50, b.y0 + 16]]));
  for (let r = 0; r < 6; r++) {
    const y = b.y0 + 34 + r * 12.5;
    const w = r === 5 ? 34 : 50 + rnd() * 18;
    line('detail', b.x0 + 10, y, b.x0 + 10 + w, y);
  }
});
// tertiary pages
const terts = [];
sats.forEach((s, i) => { for (const da of [-13, 13]) { const a = s.a + da; terts.push({ from: i, a, x: CX + R2 * Math.cos(a * deg), y: CY + R2 * Math.sin(a * deg) }); } });
const tBoxes = terts.map((t) => page('main', t.x, t.y, 34, 44, 8));
tBoxes.forEach((b) => { for (let r = 0; r < 3; r++) line('detail', b.x0 + 6, b.y0 + 16 + r * 8, b.x1 - 8 - (r === 2 ? 8 : 0), b.y0 + 16 + r * 8); });

// ---------- links from central spans to satellites ----------
// right satellites: indices 0..3 (angles -67.5..67.5); left: 4..7
const rightSpans = spans.filter((s) => s.side === 'R');
const leftSpans = spans.filter((s) => s.side === 'L');
const rightSats = [0, 1, 2, 3], leftSats = [7, 6, 5, 4];
function nearestEdge(b, px, py) { return [Math.max(b.x0, Math.min(b.x1, px)), Math.max(b.y0, Math.min(b.y1, py))]; }
const ACC = 1; // right sat at -22.5
function linkPath(sp, si) {
  const sx = sp.side === 'R' ? sp.x1 : sp.x0, sy = sp.y + 3;
  const b = satBoxes[si], sa = sats[si].a * deg;
  const sg = sp.side === 'R' ? 1 : -1;
  let tx, ty, c2x, c2y;
  if (Math.abs(Math.sin(sa)) > 0.9) { tx = sg > 0 ? b.x1 - (Math.sin(sa) > 0 ? 26 : 12) : b.x0 + 12; ty = Math.sin(sa) < 0 ? b.y1 : b.y0; c2x = tx; c2y = ty - Math.sign(Math.sin(sa)) * 60; }
  else { tx = sg > 0 ? b.x0 : b.x1; ty = sats[si].y; c2x = tx - sg * 50; c2y = ty; }
  const edge = sg > 0 ? cp.x1 : cp.x0;
  const c1x = edge + sg * 55, c1y = sy;
  return { d: `M${f(sx)} ${f(sy)} C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(tx)} ${f(ty)}`, tx, ty };
}
rightSpans.forEach((sp, k) => {
  const si = rightSats[k];
  const lp = linkPath(sp, si);
  const layer = si === ACC ? 'acc' : 'main';
  line(layer, sp.x0, sp.y + 3, sp.x1, sp.y + 3); // underline
  pathd(layer, lp.d);
  if (si === ACC) circle('acc', lp.tx, lp.ty, 4.5); else circle('main', lp.tx, lp.ty, 3);
});
leftSpans.forEach((sp, k) => {
  const si = leftSats[k];
  const lp = linkPath(sp, si);
  line('main', sp.x0, sp.y + 3, sp.x1, sp.y + 3);
  pathd('main', lp.d);
  circle('main', lp.tx, lp.ty, 3);
});
// ---------- secondary links (detail): sat -> tertiary, sat -> sat, tertiary -> tertiary ----------
terts.forEach((t, j) => {
  const s = sats[t.from], b = satBoxes[t.from], tb = tBoxes[j];
  const sx = s.x + (SW / 2) * Math.cos(s.a * deg) * 0.9, sy = s.y + (SH / 2) * Math.sin(s.a * deg) * 0.9;
  const ex = t.x - 20 * Math.cos(t.a * deg), ey = t.y - 24 * Math.sin(t.a * deg);
  const mx = (sx + ex) / 2 + (t.a > s.a ? 1 : -1) * 18 * -Math.sin(s.a * deg), my = (sy + ey) / 2 + (t.a > s.a ? 1 : -1) * 18 * Math.cos(s.a * deg);
  pathd('detail', `M${f(sx)} ${f(sy)} Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`);
});
// arcs between neighbouring satellites, bowing outward
for (let i = 0; i < 8; i++) {
  if (i % 2) continue;
  const a = sats[i], b = sats[(i + 1) % 8];
  const ma = ((a.a + b.a) / 2) * deg;
  const k = 1;
  const mx = CX + (R1 + 70) * Math.cos(ma) * k, my = CY + (R1 + 70) * Math.sin(ma) * k;
  pathd('detail', `M${f(a.x + 30 * Math.cos(ma))} ${f(a.y + 30 * Math.sin(ma))} Q${f(mx)} ${f(my)} ${f(b.x + 30 * Math.cos(ma))} ${f(b.y + 30 * Math.sin(ma))}`);
}
// tertiary to tertiary across neighbours (the web grows)
for (let j = 1; j < terts.length; j += 2) {
  const a = terts[j], b = terts[(j + 1) % terts.length];
  const ma = ((a.a + b.a + (j === terts.length - 1 ? 360 : 0)) / 2) * deg;
  const mx = CX + (R2 + 55) * Math.cos(ma), my = CY + (R2 + 55) * Math.sin(ma);
  pathd('detail', `M${f(a.x)} ${f(a.y - 22)} Q${f(mx)} ${f(my)} ${f(b.x)} ${f(b.y - 22)}`);
}
// engraved hatching: shadow band right + bottom of central page
{ let d = ''; for (let k = 0; k < 30; k++) { const y = cp.y0 + cp.fold + 8 + k * 9; if (y > cp.y1 + 8) break; d += `M${f(cp.x1 + 2)} ${f(y)} L${f(cp.x1 + 10)} ${f(y - 8)} `; } pathd('detail', d.trim()); }
{ let d = ''; for (let k = 0; k < 30; k++) { const x = cp.x0 + 10 + k * 9; if (x > cp.x1 + 8) break; d += `M${f(x)} ${f(cp.y1 + 10)} L${f(x + 8)} ${f(cp.y1 + 2)} `; } pathd('detail', d.trim()); }
// ---------- labels ----------
text(92, 116, 'CERN 1991', 22);
line('detail', 92, 124, 250, 124);
text(908, 116, 'FIG. XIII', 18, 'end');
text(CX, cp.y1 + 52, 'HTML', 20, 'middle');
// HTTP near the accent arc
text(912, 356, 'HTTP', 20, 'end');
line('detail', 850, 362, 826, 372);
text(92, 905, 'URL', 20);
line('detail', 140, 890, 250, 828);
text(908, 905, 'HYPERTEXT', 18, 'end');

const out = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">',
  `  <g class="L-con" stroke-width="1.2">`, ...L.con.map((s) => '    ' + s), '  </g>',
  `  <g class="L-main" stroke-width="2.6">`, ...L.main.map((s) => '    ' + s), '  </g>',
  `  <g class="L-detail" stroke-width="1.3">`, ...L.detail.map((s) => '    ' + s), '  </g>',
  `  <g class="L-acc" stroke-width="3.6">`, ...L.acc.map((s) => '    ' + s), '  </g>',
  `  <g class="L-lbl">`, ...L.lbl.map((s) => '    ' + s), '  </g>',
  '</svg>', ''
].join('\n');
fs.writeFileSync(path.join(here, '..', '13-world-wide-web.svg'), out);
console.log('wrote 13', out.length);
