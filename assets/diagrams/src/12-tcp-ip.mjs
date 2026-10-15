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

// FIG. XII : 1 January 1983, ARPANET cuts over from NCP to TCP/IP.
// Engraved map plate of the continental United States with IMP sites and links,
// plus the four-layer TCP/IP stack and an encapsulated packet.
const mx = lon => 90 + (lon + 125) * 14.14, my = lat => 160 + (49 - lat) * 17.6;
const M = ([lon, lat]) => [mx(lon), my(lat)];
const coast = [
  [-124.7, 48.4], [-123.3, 49], [-95.2, 49], [-95.2, 49.4], [-94.6, 48.7], [-89.6, 48], [-88.4, 48.3], [-84.8, 46.5], [-83.9, 46.1], [-82.4, 43], [-83.1, 42], [-82.5, 41.7], [-79, 42.8], [-79.2, 43.4], [-76.5, 44.2], [-75, 45], [-71.5, 45], [-70.8, 45.4], [-70, 46.7], [-69.2, 47.4], [-67.8, 47.1], [-67.8, 45.6], [-67, 44.9],
  [-68.5, 44.3], [-70.2, 43.7], [-70.7, 42.6], [-71, 42.3], [-70.5, 41.8], [-70, 42], [-70, 41.6], [-71.9, 41.3], [-73.9, 40.8], [-74, 40.5], [-74.1, 39.8], [-74.9, 38.9], [-75.1, 38.3], [-75.9, 37.3], [-76.3, 37], [-75.9, 36.6], [-75.5, 35.2], [-76.5, 34.7], [-77.9, 33.9], [-79.2, 33.2], [-80.9, 32], [-81.4, 30.4], [-80.6, 28.4], [-80.1, 26.7], [-80.4, 25.2], [-81.1, 25.1], [-81.8, 26.1], [-82.7, 27.9], [-83, 29.1], [-84.3, 30.1], [-85.4, 29.7], [-86.5, 30.4], [-88, 30.7], [-89.4, 30.2], [-89.2, 29.2], [-90.5, 29.1], [-92, 29.6], [-93.8, 29.7], [-94.8, 29.3], [-96.8, 28.2], [-97.4, 27.3], [-97.2, 25.9],
  [-99.5, 27.5], [-101, 29.8], [-103.1, 29], [-104.5, 29.7], [-106.5, 31.8], [-108.2, 31.8], [-108.2, 31.3], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5],
  [-117.3, 33.2], [-118.4, 33.9], [-119.6, 34.4], [-120.6, 34.6], [-121, 35.5], [-121.9, 36.6], [-122.5, 37.7], [-123, 38.3], [-123.7, 39], [-124.2, 40.4], [-124.1, 41.8], [-124.5, 42.8], [-124, 44.6], [-123.9, 46.2], [-124.1, 47.3],
];
const cp = coast.map(M);
// sea-facing runs of the outline (index ranges) for engraved water lines
const ix = (lon, lat) => coast.findIndex(p => p[0] === lon && p[1] === lat);
const seaRuns = [[ix(-67, 44.9), ix(-97.2, 25.9)], [ix(-117.1, 32.5), coast.length]];
const lakes = [
  [[-92.1, 46.7], [-90.4, 46.6], [-87.6, 46.5], [-84.9, 46.5], [-84.6, 47], [-86, 47.9], [-88.5, 48.3], [-89.6, 48], [-90.9, 47.3]],  // Superior
  [[-87.8, 42.3], [-87.5, 41.7], [-86.6, 41.9], [-86.2, 43.3], [-86.4, 44.8], [-85.2, 45.8], [-86.8, 45.9], [-87.8, 44.6], [-88, 43.4]], // Michigan
  [[-84.5, 45.8], [-83.4, 45.3], [-83.3, 44.3], [-82.5, 43.1], [-81.7, 43.3], [-81.3, 44.5], [-80.6, 44.9], [-81.6, 45.3], [-82.7, 46]], // Huron
  [[-83.4, 41.7], [-82, 41.5], [-80.5, 42], [-79, 42.6], [-79.4, 42.9], [-81.2, 42.6], [-82.5, 42.1]],                                   // Erie
  [[-79.7, 43.3], [-78, 43.3], [-76.3, 43.5], [-76.5, 44], [-78.5, 43.9], [-79.4, 43.7]],                                               // Ontario
];
// IMP sites (cluster members nudged apart for legibility)
const N = {
  UCLA: [-118.2, 34.1], RAND: [-119.0, 33.6], SDC: [-117.6, 33.5], UCSB: [-119.85, 34.7],
  SRI: [-122.2, 37.7], STANFORD: [-122.7, 36.9], AMES: [-121.5, 37.1], MCCLELLAN: [-121.4, 38.7],
  UTAH: [-111.85, 40.76], GWC: [-95.9, 41.1], TINKER: [-97.4, 35.4], ILLINOIS: [-88.23, 40.11],
  CASE: [-81.6, 41.5], CMU: [-79.94, 40.44], NBS: [-77.2, 39.1], RADC: [-75.4, 43.2],
  TEXAS: [-97.7, 30.3], GUNTER: [-86.2, 32.4],
  BBN: [-71.1, 42.4], MIT: [-70.9, 41.6], HARVARD: [-72.0, 42.0], LINCOLN: [-71.6, 43.2],
};
const NP = Object.fromEntries(Object.entries(N).map(([k, v]) => [k, M(v)]));
const links = [
  ['UCLA', 'RAND'], ['RAND', 'SDC'], ['SDC', 'UCLA'], ['UCLA', 'UCSB'], ['UCSB', 'STANFORD'], ['UCLA', 'SRI'], ['SRI', 'STANFORD'], ['STANFORD', 'AMES'],
  ['SRI', 'MCCLELLAN'], ['MCCLELLAN', 'UTAH'], ['UCLA', 'UTAH'], ['UTAH', 'GWC'], ['RAND', 'TINKER'], ['TINKER', 'ILLINOIS'], ['TINKER', 'TEXAS'], ['TEXAS', 'GUNTER'], ['GUNTER', 'NBS'],
  ['GWC', 'ILLINOIS'], ['ILLINOIS', 'CASE'], ['ILLINOIS', 'CMU'], ['CASE', 'RADC'], ['CMU', 'NBS'], ['CMU', 'BBN'], ['NBS', 'HARVARD'], ['RADC', 'LINCOLN'],
  ['LINCOLN', 'BBN'], ['BBN', 'MIT'], ['MIT', 'HARVARD'], ['HARVARD', 'BBN'], ['AMES', 'SRI'],
];
// great-arc: quadratic bow toward the pole, proportional to span
const arc = (a, b) => { const [x1, y1] = NP[a], [x2, y2] = NP[b]; const L = Math.hypot(x2 - x1, y2 - y1); const bow = L * 0.1; const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 - bow; return { x1, y1, cx, cy, x2, y2 }; };
const route = ['UCLA', 'UTAH', 'GWC', 'ILLINOIS', 'CMU', 'BBN'];
const inRoute = (a, b) => route.some((r, i) => i < route.length - 1 && ((route[i] === a && route[i + 1] === b) || (route[i] === b && route[i + 1] === a)));

// ---------- L-con : graticule, compass, scale ----------
for (const lon of [-120, -110, -100, -90, -80, -70]) line('con', mx(lon), my(50.5), mx(lon), my(24));
for (const lat of [30, 40]) line('con', mx(-126), my(lat), mx(-66), my(lat));
{ const cx = 872, cy = 470; circle('con', cx, cy, 34); circle('con', cx, cy, 5);
  line('con', cx, cy - 50, cx, cy + 50); line('con', cx - 50, cy, cx + 50, cy);
  pgon('con', [[cx, cy - 46], [cx + 8, cy - 8], [cx, cy], [cx - 8, cy - 8]]); }
{ const x0 = 110, y0 = 600; line('con', x0, y0, x0 + 210, y0); for (let i = 0; i <= 3; i++) line('con', x0 + i * 70, y0 - 6, x0 + i * 70, y0 + 6); }

// ---------- L-main ----------
pgon('main', cp);                                                      // coastline & borders
for (const [a, b] of links) if (!inRoute(a, b)) { const g = arc(a, b); path('main', `M${g.x1},${g.y1} Q${g.cx},${g.cy} ${g.x2},${g.y2}`); }
for (const k in NP) circle('main', NP[k][0], NP[k][1], 7);
// TCP/IP stack as four engraved slabs
const slabs = [['APP', 690], ['TCP', 745], ['IP', 800], ['LINK', 855]];
for (const [, y] of slabs) { rect('main', 600, y, 260, 30); pgon('main', [[600, y], [628, y - 16], [888, y - 16], [860, y]]); line('main', 860, y + 30, 888, y + 14); line('main', 888, y - 16, 888, y + 14); }
// packet: link hdr | ip hdr | tcp hdr | payload | trailer
rect('main', 110, 640, 410, 40);
for (const x of [160, 230, 300, 480]) line('main', x, 640, x, 680);

// ---------- L-detail ----------
for (const lk of lakes) pgon('detail', lk.map(M));
// water lines along coasts
for (const [i0, i1] of seaRuns) for (const d of [8, 15]) {
  const pts = [];
  for (let i = i0; i <= i1; i++) {
    const p = cp[(i - 1 + cp.length) % cp.length], q = cp[(i + 1) % cp.length];
    const tx = q[0] - p[0], ty = q[1] - p[1], m = Math.hypot(tx, ty) || 1;
    const c = cp[i % cp.length]; pts.push([c[0] + ty / m * d, c[1] - tx / m * d]);
  }
  pline('detail', pts);
}
for (const k in NP) { const [x, y] = NP[k]; line('detail', x - 5, y, x + 5, y); line('detail', x, y - 5, x, y + 5); }
// slab engraving: short hatch on the side faces
for (const [, y] of slabs) for (let t = 0.2; t < 1; t += 0.2) line('detail', 860 + 28 * t, y - 16 * t + 2, 860 + 28 * t, y + 30 - 16 * t - 2);
// payload bits and header fields
for (let x = 310; x < 476; x += 8) line('detail', x, 650, x, x % 16 < 8 ? 670 : 662);
for (const [x0, x1] of [[110, 160], [160, 230], [230, 300], [480, 520]]) line('detail', x0 + 4, 660, x1 - 4, 660);
// encapsulation leaders: each header drops to its layer
pline('detail', [[390, 680], [390, 705], [600, 705]]);
pline('detail', [[265, 680], [265, 760], [600, 760]]);
pline('detail', [[195, 680], [195, 815], [600, 815]]);
pline('detail', [[135, 680], [135, 870], [600, 870]]);
for (const y of [705, 760, 815, 870]) arrow('detail', 600, y, 0, 8);
// label leaders
line('detail', NP.UCLA[0] - 8, NP.UCLA[1] + 6, 250, 540);
line('detail', NP.SRI[0] - 3, NP.SRI[1] + 8, 112, 468);
line('detail', NP.BBN[0] + 6, NP.BBN[1] + 6, 880, 330);
// a packet in flight on the route (small glyph near GWC-ILLINOIS)
{ const g = arc('GWC', 'ILLINOIS'); const t = 0.5; const x = (1 - t) ** 2 * g.x1 + 2 * t * (1 - t) * g.cx + t * t * g.x2, y = (1 - t) ** 2 * g.y1 + 2 * t * (1 - t) * g.cy + t * t * g.y2;
  rect('detail', x - 14, y - 22, 28, 12); line('detail', x - 6, y - 22, x - 6, y - 10); }

// ---------- L-acc : the packet route, UCLA to BBN in five hops ----------
{ let d = ''; for (let i = 0; i < route.length - 1; i++) { const g = arc(route[i], route[i + 1]); d += (i ? ' ' : `M${g.x1},${g.y1} `) + `Q${g.cx},${g.cy} ${g.x2},${g.y2}`; } path('acc', d); }
circle('acc', NP.UCLA[0], NP.UCLA[1], 13);
circle('acc', NP.BBN[0], NP.BBN[1], 13);

// ---------- L-lbl ----------
text(90, 80, 'FIG. XII', 22);
text(910, 80, 'MCMLXXXIII', 18, 'end');
text(250, 556, 'UCLA', 18);
text(92, 490, 'SRI', 18);
text(NP.UTAH[0], NP.UTAH[1] - 18, 'UTAH', 18, 'middle');
text(880, 348, 'BBN', 18, 'middle');
for (const [n, y] of slabs) text(730, y + 22, n, 18, 'middle');

out('12-tcp-ip');
