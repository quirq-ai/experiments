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

// FIG. XI : Intel 4004 (1971). Die floorplan in plan view plus the 16-pin ceramic DIP.
const D = { x0: 130, y0: 150, x1: 770, y1: 630 };
const blk = {
  acc: [175, 195, 145, 58], alu: [175, 268, 145, 207], dec: [340, 195, 180, 205],
  pc: [540, 195, 185, 135], reg: [540, 345, 185, 160], tim: [340, 415, 180, 90], io: [175, 555, 550, 30],
};
const rr = (l, b) => rect(l, ...b);

// ---------- L-con ----------
line('con', (D.x0 + D.x1) / 2, 110, (D.x0 + D.x1) / 2, 660);
line('con', 95, (D.y0 + D.y1) / 2, 805, (D.y0 + D.y1) / 2);
line('con', D.x0, 118, D.x0, 145); line('con', D.x1, 118, D.x1, 145); dim('con', D.x0, 125, D.x1, 125);
line('con', 98, D.y0, 125, D.y0); line('con', 98, D.y1, 125, D.y1); dim('con', 105, D.y0, 105, D.y1);
for (const [x, y] of [[D.x0, D.y0], [D.x1, D.y0], [D.x0, D.y1], [D.x1, D.y1]]) { line('con', x - 14, y, x + 14, y); line('con', x, y - 14, x, y + 14); }
line('con', D.x0, D.y1, 610, 805); line('con', D.x1, D.y1, 680, 805);    // projection to die in package
line('con', 410, 825, 880, 825);                                             // package centre line
line('con', 645, 740, 645, 915);
circle('con', 247, 371, 118);                                                // guide circle on ALU

// ---------- L-main ----------
rect('main', D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);                          // die edge
rect('main', D.x0 + 8, D.y0 + 8, D.x1 - D.x0 - 16, D.y1 - D.y0 - 16);        // seal ring
const pads = [];
for (const x of [200, 310, 450, 590, 700]) { pads.push([x, 172, 'd']); pads.push([x, 608, 'u']); }
for (const y of [300, 390, 480]) { pads.push([152, y, 'r']); pads.push([748, y, 'l']); }
for (const [x, y] of pads) rect('main', x - 12, y - 12, 24, 24);
rect('main', 175, 195, 70, 58); rect('main', 250, 195, 70, 58);             // accumulator, temp register
for (const k of ['dec', 'pc', 'reg', 'tim']) rr('main', blk[k]);
for (let i = 0; i < 4; i++) rect('main', 175 + i * 140, 555, 130, 30);       // I/O buffers
// package (16-pin ceramic DIP)
path('main', 'M430,760 L860,760 L860,890 L430,890 L430,842 A17,17 0 0 0 430,808 Z');
rect('main', 585, 792, 120, 66, 4);                                          // cavity
rect('main', 612, 805, 66, 50);                                              // die in cavity
circle('main', 455, 872, 6);                                                 // pin 1 mark

// ---------- L-detail ----------
for (const [x, y] of pads) rect('detail', x - 7, y - 7, 14, 14);             // pad metal openings
// pad routing into the core
for (const [x, y, dir] of pads) {
  if (dir === 'd') pline('detail', [[x, y + 12], [x, 190]]);
  if (dir === 'u') pline('detail', [[x, y - 12], [x, 590]]);
  if (dir === 'r') pline('detail', [[x + 12, y], [172, y]]);
  if (dir === 'l') pline('detail', [[x - 12, y], [728, y]]);
}
// accumulator & temp register cells
for (let i = 1; i < 4; i++) { line('detail', 175 + i * 17.5, 212, 175 + i * 17.5, 253); line('detail', 250 + i * 17.5, 212, 250 + i * 17.5, 253); }
line('detail', 175, 212, 245, 212); line('detail', 250, 212, 320, 212);
// ALU: four bit slices with diagonal routing
line('detail', 175, 292, 320, 292);
hatch('detail', box(175, 292, 145, 183), 60, 13);
// instruction register + decoder (PLA-like vertical metal lines)
line('detail', 340, 222, 520, 222); line('detail', 340, 250, 520, 250);
for (let x = 348; x < 520; x += 7) line('detail', x, 256, x, 394);
for (let y = 272; y < 394; y += 30) line('detail', 340, y, 520, y);
for (let i = 1; i < 8; i++) line('detail', 340 + i * 22.5, 222, 340 + i * 22.5, 250);
// program counter + 3-level address stack: 4 rows x 12 bits
for (let i = 1; i < 12; i++) line('detail', 540 + i * 185 / 12, 217, 540 + i * 185 / 12, 330);
for (let j = 1; j < 4; j++) line('detail', 540, 217 + j * 113 / 4, 725, 217 + j * 113 / 4);
line('detail', 540, 217, 725, 217);
// index register array 16 x 4
line('detail', 540, 367, 725, 367);
for (let j = 1; j < 16; j++) line('detail', 540, 367 + j * 138 / 16, 725, 367 + j * 138 / 16);
for (let i = 1; i < 4; i++) line('detail', 540 + i * 185 / 4, 367, 540 + i * 185 / 4, 505);
// timing & control: random logic hatching
line('detail', 340, 437, 520, 437);
hatch('detail', box(340, 437, 180, 68), -45, 11);
// internal 4-bit data bus and its taps
for (let k = 0; k < 4; k++) line('detail', 175, 520 + k * 7, 725, 520 + k * 7);
for (const x0 of [230, 420, 470, 615, 680]) for (let k = 0; k < 4; k++) line('detail', x0 + k * 7, x0 < 330 ? 475 : x0 < 530 ? (x0 < 450 ? 505 : 505) : 505, x0 + k * 7, 520);
for (let i = 0; i < 4; i++) for (let k = 1; k < 4; k++) line('detail', 175 + i * 140 + k * 32.5, 560, 175 + i * 140 + k * 32.5, 580);
// package: pins (8 per side) and bond wire fan
const pinX = i => 470 + i * 50;
for (let i = 0; i < 8; i++) { rect('detail', pinX(i) - 7, 745, 14, 15); rect('detail', pinX(i) - 7, 890, 14, 15); }
for (let i = 0; i < 8; i++) {
  const fx = 596 + i * 14;
  line('detail', fx, 792, pinX(i), 760); line('detail', fx, 858, pinX(i), 890);        // lead traces
  line('detail', fx, 797, 616 + i * 8.3, 809); line('detail', fx, 853, 616 + i * 8.3, 851); // bond wires
}
rect('detail', 442, 770, 406, 110, 3);                                     // lid seal ring
for (const x of [327, 333, 527, 533]) line('detail', x, 200, x, 508);          // routing channels

// ---------- L-acc : the ALU ----------
rr('acc', blk.alu);
for (let i = 1; i < 4; i++) line('acc', 175 + i * 36.25, 292, 175 + i * 36.25, 475);   // four bit slices

// ---------- L-lbl ----------
text(90, 80, 'FIG. XI', 22);
text(910, 80, 'MCMLXXI', 18, 'end');
text(247, 287, 'ALU', 16, 'middle');
text(632, 363, '16 X 4', 16, 'middle');
text(632, 213, 'PC', 16, 'middle');
text(90, 790, '2300 T', 20);
text(90, 830, '10 UM', 20);
text(90, 870, '740 KHZ', 20);
text(645, 940, 'C4004', 18, 'middle');

out('11-intel-4004');
