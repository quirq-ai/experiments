// ---- shared plate helpers (inlined per diagram so each script is standalone) ----
import fs from 'node:fs';
const R = n => Math.round(n * 10) / 10;
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
const P = pts => pts.map(p => `${R(p[0])},${R(p[1])}`).join(' ');
const line = (l, x1, y1, x2, y2) => L[l].push(`<line x1="${R(x1)}" y1="${R(y1)}" x2="${R(x2)}" y2="${R(y2)}"/>`);
const path = (l, d) => L[l].push(`<path d="${d.replace(/-?\d+\.?\d*/g, m => String(R(+m)))}"/>`);
const circle = (l, cx, cy, r) => L[l].push(`<circle cx="${R(cx)}" cy="${R(cy)}" r="${R(r)}"/>`);
const ellipse = (l, cx, cy, rx, ry) => L[l].push(`<ellipse cx="${R(cx)}" cy="${R(cy)}" rx="${R(rx)}" ry="${R(ry)}"/>`);
const rect = (l, x, y, w, h, rx = 0) => L[l].push(`<rect x="${R(x)}" y="${R(y)}" width="${R(w)}" height="${R(h)}"${rx ? ` rx="${R(rx)}"` : ''}/>`);
const pline = (l, pts) => L[l].push(`<polyline points="${P(pts)}"/>`);
const pgon = (l, pts) => L[l].push(`<polygon points="${P(pts)}"/>`);
const text = (x, y, s, size = 18, anchor = 'start') => L.lbl.push(`<text x="${R(x)}" y="${R(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" fill="currentColor"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${s}</text>`);
// arrowhead: tip at (x,y), pointing along angle a (radians)
const arrow = (l, x, y, a, s = 9) => pline(l, [[x - s * Math.cos(a - 0.4), y - s * Math.sin(a - 0.4)], [x, y], [x - s * Math.cos(a + 0.4), y - s * Math.sin(a + 0.4)]]);
const dim = (l, x1, y1, x2, y2, s = 9) => { line(l, x1, y1, x2, y2); const a = Math.atan2(y2 - y1, x2 - x1); arrow(l, x2, y2, a, s); arrow(l, x1, y1, a + Math.PI, s); };
const arcPts = (cx, cy, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
// parallel hatch lines clipped to a polygon (even-odd), angle in degrees
function hatch(l, poly, deg, sp, off = 0, minLen = 3) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const pr = poly.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
  const vs = pr.map(p => p[1]); const v0 = Math.min(...vs), v1 = Math.max(...vs);
  for (let v = Math.ceil((v0 - off) / sp) * sp + off + 0.001; v < v1; v += sp) {
    const xs = [];
    for (let i = 0; i < pr.length; i++) {
      const [ua, va] = pr[i], [ub, vb] = pr[(i + 1) % pr.length];
      if ((va <= v && vb > v) || (vb <= v && va > v)) xs.push(ua + (v - va) / (vb - va) * (ub - ua));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1] - xs[k] < minLen) continue;
      const u1 = xs[k], u2 = xs[k + 1];
      line(l, u1 * c - v * s, u1 * s + v * c, u2 * c - v * s, u2 * s + v * c);
    }
  }
}
const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function out(name) {
  const W = { con: 1.2, main: 2.6, detail: 1.3, acc: 3.6 };
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">\n';
  for (const k of ['con', 'main', 'detail', 'acc']) s += `<g class="L-${k}" stroke-width="${W[k]}">\n${L[k].join('\n')}\n</g>\n`;
  s += `<g class="L-lbl">\n${L.lbl.join('\n')}\n</g>\n</svg>\n`;
  fs.writeFileSync(new URL(`../${name}.svg`, import.meta.url), s);
  console.log(name, Object.entries(L).map(([k, v]) => `${k}:${v.length}`).join(' '), (s.length / 1024).toFixed(1) + 'KB');
}
// ---- end helpers ----

// FIG. IX : Bell Labs point-contact transistor, 1947 (Bardeen, Brattain)
const CX = 370, TIP = 655;
const WL = [255, 372], WR = [485, 372], WT = [CX, TIP];

// ---------- L-con : construction ----------
line('con', CX, 88, CX, 885);                       // vertical axis
line('con', 200, TIP, 540, TIP);                     // contact plane
circle('con', CX, TIP, 34);                          // guide circle on contact
{ const aL = Math.atan2(WL[1] - TIP, WL[0] - CX), aR = Math.atan2(WR[1] - TIP, WR[0] - CX);
  pline('con', arcPts(CX, TIP, 118, aL, aR, 20)); }  // wedge angle arc
line('con', 255, 372, 205, 250); line('con', 485, 372, 535, 250); // face extensions
line('con', 90, 860, 90, 892); line('con', 650, 860, 650, 892);
dim('con', 90, 882, 650, 882);                       // bench width
line('con', 285, 700, 285, 725); line('con', 455, 700, 455, 725);
line('con', 90, 105, 90, 150); line('con', 650, 105, 650, 150);
dim('con', 90, 135, 650, 135);
// schematic guides
line('con', 705, 235, 915, 235); line('con', 810, 140, 810, 330);
// inset guides
line('con', 710, 500, 910, 500); line('con', 810, 400, 810, 600);
// I/V grid
for (let i = 1; i <= 4; i++) { line('con', 725 + i * 45, 700, 725 + i * 45, 875); line('con', 725, 875 - i * 42, 915, 875 - i * 42); }

// ---------- L-main : primary outlines ----------
rect('main', 90, 790, 560, 50);                      // bench plate
rect('main', 120, 200, 25, 590);                     // left post
rect('main', 595, 200, 25, 590);                     // right post
rect('main', 100, 170, 540, 30);                     // crossbar
rect('main', 100, 840, 44, 14); rect('main', 596, 840, 44, 14);      // feet
rect('main', 114, 160, 37, 10); rect('main', 589, 160, 37, 10);      // top nuts
rect('main', 114, 778, 37, 12); rect('main', 589, 778, 37, 12);      // bottom nuts
rect('main', 230, 700, 280, 90);                     // metal base electrode
rect('main', 285, 655, 170, 45);                     // germanium slab
pgon('main', [WL, WR, WT]);                          // insulating wedge
rect('main', 270, 318, 200, 54);                     // wedge holder
rect('main', 340, 104, 60, 18, 3);                   // adjusting screw head
rect('main', 358, 122, 24, 102);                     // screw shaft through crossbar
rect('main', 325, 224, 90, 13);                      // spring cap
{ // helical spring, one continuous path
  let d = 'M345,237'; const n = 6, h = (318 - 237) / n;
  for (let i = 0; i < n; i++) { const y = 237 + i * h; d += ` C325,${y + h * 0.15} 325,${y + h * 0.6} 370,${y + h * 0.55} C415,${y + h * 0.5} 415,${y + h} 395,${y + h}`; if (i < n - 1) d += ` L345,${y + h}`; }
  path('main', d);
}
// gold foil on both faces (drawn as outer band), cut at the tip by the slit
{ const band = (A, B, sgn) => { const dx = B[0] - A[0], dy = B[1] - A[1], m = Math.hypot(dx, dy); const o = [sgn * dy / m * 6, -sgn * dx / m * 6];
    const Q = [A[0] + dx * 0.985, A[1] + dy * 0.985]; const A2 = [A[0] + dx * 0.05, A[1] + dy * 0.05];
    pline('main', [A2, [A2[0] + o[0], A2[1] + o[1]], [Q[0] + o[0], Q[1] + o[1]], Q]); };
  band(WL, WT, 1); band(WR, WT, -1); }
line('main', CX, TIP - 2, CX, TIP - 48);              // slit
// leads to binding posts
const E = [WL[0] + 0.32 * (CX - WL[0]), WL[1] + 0.32 * (TIP - WL[1])];
const C = [WR[0] + 0.32 * (CX - WR[0]), WR[1] + 0.32 * (TIP - WR[1])];
path('main', `M${E[0]},${E[1]} C${E[0] - 50},${E[1] - 40} 200,470 145,470`);
path('main', `M${C[0]},${C[1]} C${C[0] + 50},${C[1] - 40} 540,470 595,470`);
path('main', `M510,745 C540,745 560,745 595,745`);
for (const [x, y] of [[132, 470], [607, 470], [607, 745]]) circle('main', x, y, 11);

// schematic symbol (PNP, arrow into base)
circle('main', 810, 235, 62);
// magnified inset ring
circle('main', 810, 500, 90);
// I/V axes
pline('main', [[725, 690], [725, 875], [915, 875]]);

// ---------- L-detail ----------
hatch('detail', box(285, 655, 170, 45), 45, 11);                 // germanium
hatch('detail', box(285, 655, 170, 45), -45, 22, 5);
for (let y = 712; y < 790; y += 10) line('detail', 242, y, 498 - (y - 712) * 0.4, y); // metal base
hatch('detail', box(90, 790, 560, 50), 60, 16);                  // bench plate
line('detail', 90, 800, 650, 800);
for (const x of [132, 607]) { line('detail', x - 5, 205, x - 5, 785); }
hatch('detail', box(100, 170, 540, 30), -60, 18);                // crossbar
hatch('detail', box(270, 318, 200, 54), 35, 12);                 // holder
// wedge shading: horizontal engraving along left face
for (let y = 386; y < 640; y += 11) { const t = (y - 372) / (TIP - 372); const xl = WL[0] + t * (CX - WL[0]) + 16; const w = (1 - t) * 70; if (w > 6) line('detail', xl, y, xl + w, y); }
for (let y = 386; y < 600; y += 11) { const t = (y - 372) / (TIP - 372); const xr = WR[0] + t * (CX - WR[0]) - 14; line('detail', xr - (1 - t) * 20, y, xr, y); }
// screw threads & slot
for (let y = 128; y < 222; y += 8) line('detail', 358, y, 382, y + 5);
line('detail', 352, 113, 388, 113);
// bench screws
for (const x of [112, 628]) { circle('detail', x, 815, 8); line('detail', x - 6, 815, x + 6, 815); }
// binding post knurling
for (const [x, y] of [[132, 470], [607, 470], [607, 745]]) { circle('detail', x, y, 5); line('detail', x - 11, y + 16, x + 11, y + 16); }
// solder dots where leads meet foil
circle('detail', E[0], E[1], 4); circle('detail', C[0], C[1], 4);

// schematic lines
line('main', 792, 200, 792, 270);          // base bar
line('main', 720, 235, 792, 235);          // base lead
pline('main', [[792, 215], [838, 186], [838, 140]]); // collector
pline('main', [[792, 255], [838, 284], [838, 330]]); // emitter
{ const a = Math.atan2(255 - 284, 792 - 838); arrow('main', 812, 267, a, 13); }

// inset: magnified tip
{ const cy = 500, gy = 562;
  line('main', 748, 430, 802, gy); line('main', 872, 430, 818, gy);   // wedge faces
  line('detail', 760, 430, 806, 548); line('detail', 860, 430, 814, 548); // foil inner edge
  line('detail', 806, 548, 802, gy); line('detail', 814, 548, 818, gy);
  line('main', 810, 470, 810, gy - 4);                                  // slit
  line('main', 745, gy, 875, gy);                                       // Ge surface
  const seg = arcPts(810, cy, 88, Math.asin((gy - cy) / 88), Math.PI - Math.asin((gy - cy) / 88), 16);
  hatch('detail', [[745, gy + 4], [875, gy + 4], ...seg], 45, 10);
  dim('detail', 802, 582, 818, 582, 5);
}
// I/V curve family
for (let k = 1; k <= 5; k++) { const ys = 875 - k * 30; path('detail', `M725,875 C733,${ys + 12} 745,${ys} 772,${ys} L910,${ys - 10}`); }
arrow('detail', 725, 688, -Math.PI / 2, 9); arrow('detail', 917, 875, 0, 9);

// ---------- L-acc : the two point contacts ----------
circle('acc', CX - 5, TIP, 3.5);
circle('acc', CX + 5, TIP, 3.5);
circle('acc', 802, 562, 5.5);
circle('acc', 818, 562, 5.5);

// ---------- L-lbl ----------
text(90, 80, 'FIG. IX', 22);
text(910, 80, 'MCMXLVII', 18, 'end');
text(160, 540, 'EMITTER', 17);
text(580, 540, 'COLLECTOR', 17, 'end');
text(236, 684, 'GE', 18);
text(520, 732, 'BASE', 16);
text(725, 672, 'I / V', 16);
text(910, 418, 'X 200', 16, 'end');

out('09-transistor');
