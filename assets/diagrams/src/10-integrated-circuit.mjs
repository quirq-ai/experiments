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

// FIG. X : Jack Kilby's first integrated circuit, Texas Instruments, 12 Sept 1958
// Upper figure: oblique projection of the germanium bar on its glass slide with flying gold wires.
// Lower figure: section A-A through the bar.
const S = 11.5, CA = Math.cos(40 * Math.PI / 180), SA = Math.sin(40 * Math.PI / 180), DF = 0.75;
const pj = (x, y, z) => [92 + x * S + y * S * DF * CA, 500 - y * S * DF * SA - z * S];
const SW = 60, SD = 20; // slide segment shown (broken at both ends)
const pp = (pts) => pts.map(p => pj(...p));
const B = { x0: 10, x1: 50, y0: 7, y1: 13, z0: 1.2, z1: 3.2 };
const faceTop = (x0, x1, y0, y1, z) => pp([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
const faceFront = (x0, x1, y, z0, z1) => pp([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
const faceRight = (x, y0, y1, z0, z1) => pp([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
const ln3 = (l, a, b) => { const p = pj(...a), q = pj(...b); line(l, p[0], p[1], q[0], q[1]); };

// ---------- L-con ----------
ln3('con', [3, 10, 3.2], [57, 10, 3.2]);                     // bar long axis
ln3('con', [30, 1, 3.2], [30, 19, 3.2]);                     // bar cross axis
ln3('con', [-4, 10, 1.2], [1, 10, 1.2]); ln3('con', [59, 10, 1.2], [64, 10, 1.2]); // cut line A-A beyond slide
{ const a = pj(-4, 10, 1.2), b = pj(64, 10, 1.2); line('con', a[0], a[1], a[0], a[1] + 26); arrow('con', a[0], a[1] + 26, Math.PI / 2, 8); line('con', b[0], b[1], b[0], b[1] + 26); arrow('con', b[0], b[1] + 26, Math.PI / 2, 8); }
ln3('con', [0, 0, 0], [0, 27, 0]);                            // receding axis
{ const o = pj(0, 0, 0); line('con', o[0], o[1], o[0] - 30, o[1]); }
{ const o = pj(0, 0, 0); pline('con', arcPts(o[0], o[1], 46, -40 * Math.PI / 180, 0, 10)); }
ln3('con', [10, 7, 1.2], [10, -4, 1.2]); ln3('con', [50, 7, 1.2], [50, -4, 1.2]); // extension lines
{ const a = pj(10, -3, 1.2), b = pj(50, -3, 1.2); dim('con', a[0], a[1], b[0], b[1]); }
// section construction
line('con', 90, 830, 910, 830);                               // datum on glass
line('con', 500, 600, 500, 905);                              // section centre line
line('con', 800, 745, 860, 745); line('con', 800, 818, 860, 818);
dim('con', 850, 745, 850, 818, 7);
line('con', 890, 830, 900, 830); dim('con', 895, 830, 895, 890, 7);
line('con', 200, 610, 200, 700); line('con', 800, 610, 800, 700);
dim('con', 200, 620, 800, 620);

// ---------- L-main ----------
{ // glass slide segment with zigzag break lines at both ends
  const zz = (x, z) => { const pts = []; for (let i = 0; i <= 6; i++) { const y = SD * i / 6; pts.push([x + (i % 2 ? 0.9 : -0.9), y, z]); } return pts; };
  const left = zz(0, 1.2), right = zz(SW, 1.2);
  pgon('main', pp([...left, ...right.slice().reverse()]));
  pgon('main', pp([[left[0][0], 0, 0], [right[0][0], 0, 0], [right[0][0], 0, 1.2], [left[0][0], 0, 1.2]]));
}
pgon('main', faceTop(B.x0, B.x1, B.y0, B.y1, B.z1));          // germanium bar
pgon('main', faceFront(B.x0, B.x1, B.y0, B.z0, B.z1));
pgon('main', faceRight(B.x1, B.y0, B.y1, B.z0, B.z1));
pgon('main', faceTop(13, 20, 8, 12, 3.9));                   // transistor mesa
pgon('main', faceFront(13, 20, 8, 3.2, 3.9));
pgon('main', faceRight(20, 8, 12, 3.2, 3.9));
pgon('main', faceTop(37, 45, 8, 12, 3.3));                   // capacitor plate
const pads = [[2.5, 2], [2.5, 13], [52.5, 2], [52.5, 13]];
for (const [x, y] of pads) pgon('main', faceTop(x, x + 5, y, y + 5, 1.2));
// section A-A
rect('main', 110, 830, 780, 60);                              // glass
rect('main', 200, 818, 600, 12);                              // cement
pgon('main', [[200, 818], [800, 818], [800, 745], [360, 745], [360, 715], [250, 715], [250, 745], [200, 745]]); // Ge bar with mesa
line('main', 200, 760, 250, 760); line('main', 360, 760, 800, 760);   // diffused junction
pline('main', [[250, 745], [250, 730], [360, 730], [360, 745]]);       // mesa junction
rect('main', 560, 737, 120, 8);                               // capacitor plate
const sc = [[268, 707], [320, 707], [410, 737], [470, 737], [520, 737], [740, 737]];
for (const [x, y] of sc) rect('main', x, y, 18, 8);
rect('main', 138, 824, 26, 6); rect('main', 848, 824, 26, 6);   // terminal pads on glass
// section wires (gold, arched)
const sw = [[277, 707, 150, 830], [329, 707, 479, 737], [419, 737, 620, 737], [529, 737, 749, 737], [749, 737, 860, 830]];
for (const [x1, y1, x2, y2] of sw) { const h = 40 + Math.abs(x2 - x1) * 0.18; path('main', `M${x1},${y1} C${x1 + (x2 - x1) * 0.15},${Math.min(y1, y2) - h} ${x2 - (x2 - x1) * 0.2},${Math.min(y1, y2) - h * 0.9} ${x2},${y2}`); }

// ---------- L-detail ----------
// glass glints on slide top
for (const [x, y, n] of [[4, 16, 3], [48, 1, 3], [26, 15.5, 2]]) for (let i = 0; i < n; i++) ln3('detail', [x + i * 1.6, y, 1.2], [x + i * 1.6 + 4, y + 3, 1.2]);
for (let x = 1.5; x < SW - 1; x += 3) ln3('detail', [x, 0, 0.15], [x, 0, 1.05]);        // slide edge hatch
for (let x = B.x0 + 1.4; x < B.x1; x += 1.4) ln3('detail', [x, B.y0, B.z0 + 0.1], [x, B.y0, B.z1 - 0.1]); // bar front face
for (let y = B.y0 + 1; y < B.y1; y += 1) ln3('detail', [B.x1, y, B.z0 + 0.1], [B.x1, y, B.z1 - 0.1]);
for (let x = 13.7; x < 20; x += 1) ln3('detail', [x, 8, 3.25], [x, 8, 3.85]);          // mesa face
for (let y = 8.6; y < 12; y += 0.9) ln3('detail', [20, y, 3.25], [20, y, 3.85]);
for (let y = 8.6; y < 12; y += 0.9) ln3('detail', [37.5, y, 3.3], [44.5, y, 3.3]);      // capacitor film
for (const x of [22, 27, 32, 35.5, 47]) ln3('detail', [x, B.y0 + 0.5, B.z1], [x + 1.2, B.y1 - 0.5, B.z1]); // etched surface marks
for (const [x, y] of pads) for (let i = 1; i < 5; i++) ln3('detail', [x + i, y + 0.4, 1.2], [x + i, y + 4.6, 1.2]);
const cts = [[15, 9, 3.9], [18, 11, 3.9], [24, 10, 3.2], [29, 10, 3.2], [34, 10, 3.2], [41, 10, 3.3], [48, 10, 3.2]];
for (const c of cts) { const p = pj(...c); circle('detail', p[0], p[1], 3.2); }
// leaders
{ const p = pj(26, 7, 2.2); line('detail', p[0], p[1], 300, 548); }
{ const p = pj(6, 0, 0.6); line('detail', p[0], p[1], 150, 548); }
// section hatching
hatch('detail', [[200, 818], [800, 818], [800, 760], [200, 760]], 45, 16);
hatch('detail', [[250, 745], [250, 730], [360, 730], [360, 745]], 45, 10);
hatch('detail', [[200, 760], [250, 760], [250, 745], [200, 745]], -45, 9);
hatch('detail', [[360, 760], [800, 760], [800, 745], [680, 745], [680, 737], [560, 737], [560, 745], [360, 745]], -45, 9);
hatch('detail', [[250, 730], [360, 730], [360, 715], [250, 715]], -45, 9);
for (let x = 130; x < 880; x += 95) for (let i = 0; i < 2; i++) line('detail', x + i * 8, 880, x + i * 8 + 22, 840);   // glass convention
for (let x = 210; x < 800; x += 20) line('detail', x, 821, x + 4, 827);                 // cement
for (const [x, y] of sc) line('detail', x + 3, y + 4, x + 15, y + 4);
line('detail', 570, 741, 670, 741);

// ---------- L-acc : the flying gold wires ----------
const wires = [[[5, 4.5, 1.2], cts[0]], [[5, 15.5, 1.2], cts[1]], [cts[1], cts[4]], [cts[2], cts[5]], [cts[5], [55, 15.5, 1.2]], [cts[6], [55, 4.5, 1.2]]];
for (const [a, b] of wires) {
  const d3 = Math.hypot(b[0] - a[0], b[1] - a[1]); const h = 7 + d3 * 0.62;
  const c1 = [a[0] + (b[0] - a[0]) * 0.12, a[1] + (b[1] - a[1]) * 0.12, Math.max(a[2], b[2]) + h];
  const c2 = [b[0] - (b[0] - a[0]) * 0.18, b[1] - (b[1] - a[1]) * 0.18, Math.max(a[2], b[2]) + h * 0.85];
  const [p0, p1, p2, p3] = [a, c1, c2, b].map(q => pj(...q));
  path('acc', `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`);
}

line('detail', 880, 160, 748, 262);   // leader to a flying wire crest
// ---------- L-lbl ----------
text(90, 80, 'FIG. X', 22);
text(910, 80, 'MCMLVIII', 18, 'end');
text(300, 568, 'GE', 18, 'middle');
text(150, 568, 'VITRUM', 16, 'middle');
text(910, 150, 'AU FILUM', 16, 'end');
text(110, 672, 'SECTIO A-A', 17);
text(500, 608, '11 MM', 16, 'middle');
text(90, 112, 'OSC 1.3 MHZ', 16);

out('10-integrated-circuit');
