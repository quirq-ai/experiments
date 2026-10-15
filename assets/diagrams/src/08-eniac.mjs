// 08-eniac: ENIAC (1945). One-point perspective of the U of panel cabinets,
// with an enlarged panel of vacuum tubes, decade switches and a patch cable,
// and a cutaway of one glowing tube. Deterministic; run with plain node.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---------- tiny SVG helpers (shared pattern across diagrams) ----------
const r = (n) => { const v = Math.round(n * 10) / 10; return Object.is(v, -0) ? '0' : String(v); };
const d = (...a) => a.flat().map((x) => (typeof x === 'number' ? r(x) : x)).join(' ');
const line = (x1, y1, x2, y2) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}"/>`;
const circle = (cx, cy, rr) => `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}"/>`;
const ellipse = (cx, cy, rx, ry) => `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}"/>`;
const rect = (x, y, w, h) => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"/>`;
const pathEl = (dd) => `<path d="${dd}"/>`;
const polygon = (pts) => `<polygon points="${pts.map((p) => r(p[0]) + ',' + r(p[1])).join(' ')}"/>`;
const poly = (pts) => `<polyline points="${pts.map((p) => r(p[0]) + ',' + r(p[1])).join(' ')}"/>`;
const text = (x, y, s, size = 20, anchor = 'middle') =>
  `<text x="${r(x)}" y="${r(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" text-anchor="${anchor}" fill="currentColor">${s}</text>`;
const spin = (cx, cy, deg, items) =>
  `<g class="spin" data-cx="${r(cx)}" data-cy="${r(cy)}" data-deg="${deg}">${items.join('')}</g>`;
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
function write(name) {
  const W = { con: 1.2, main: 2.6, detail: 1.3, acc: 3.6 };
  const g = (k) => `  <g class="L-${k}"${W[k] ? ` stroke-width="${W[k]}"` : ''}>\n    ${L[k].join('\n    ')}\n  </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">\n${['con', 'main', 'detail', 'acc', 'lbl'].map(g).join('\n')}\n</svg>\n`;
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', name);
  writeFileSync(out, svg);
  console.log('wrote', out, svg.length, 'bytes');
}

// ---------- perspective room ----------
const VP = [500, 290], F = 630, ZB = 3.5, ZF = 1.5, PW = 0.25, YT = -0.5, YB = 0.5;
const proj = (X, Y, Z) => [VP[0] + (F * X) / Z, VP[1] + (F * Y) / Z];
// panel point: wall 'L' | 'B' | 'R', panel index i, u in [0,1] across panel, Y
function pp(wall, i, u, Y) {
  if (wall === 'B') return proj(-1 + (i + u) * PW, Y, ZB);
  const Z = ZB - (i + u) * PW;              // i=0 at the back corner, increasing toward viewer
  return proj(wall === 'L' ? -1 : 1, Y, Z);
}
const NW = 8, NB = 8;
const walls = [['L', NW], ['B', NB], ['R', NW]];

// ---------- L-con ----------
L.con.push(line(90, VP[1], 910, VP[1]));                                  // horizon
L.con.push(circle(VP[0], VP[1], 6));                                     // vanishing point
for (const [X, Y] of [[-1, YT], [1, YT], [-1, YB], [1, YB]]) {           // rays to VP
  const [x, y] = proj(X, Y, ZF);
  L.con.push(line(x, y, ...proj(X, Y, ZB)));
}
for (const X of [-0.5, 0, 0.5]) L.con.push(line(...proj(X, YB, 1.4), ...proj(X, YB, ZB)));   // floor lines
for (const Z of [1.75, 2.25, 2.75]) L.con.push(line(...proj(-1, YB, Z), ...proj(1, YB, Z)));  // floor transverse
// projection from the enlarged panel (left wing, panel 6) to the inset
const INS = { x: 90, y: 566, w: 410, h: 338 };
L.con.push(line(...pp('L', 6, 1, YB), INS.x, INS.y));
L.con.push(line(...pp('L', 6, 0, YB), INS.x + INS.w, INS.y));
// big-tube inset axes
const TC = [730, 736], TR = 168;
L.con.push(line(TC[0], TC[1] - TR - 8, TC[0], TC[1] + TR + 8));
L.con.push(line(TC[0] - TR - 8, TC[1], TC[0] + TR + 8, TC[1]));
L.con.push(circle(TC[0], TC[1], TR - 12));
// height dimension of the tube
L.con.push(line(812, 588, 812, 872), line(804, 588, 820, 588), line(804, 872, 820, 872));
L.con.push(pathEl(d('M', 807, 598, 'L', 812, 588, 'L', 817, 598)), pathEl(d('M', 807, 862, 'L', 812, 872, 'L', 817, 862)));
// inset corner marks
for (const [x, y, sx, sy] of [[INS.x, INS.y, -1, -1], [INS.x + INS.w, INS.y, 1, -1], [INS.x, INS.y + INS.h, -1, 1], [INS.x + INS.w, INS.y + INS.h, 1, 1]])
  L.con.push(pathEl(d('M', x + sx * 10, y, 'L', x + sx * 3, y, 'M', x, y + sy * 10, 'L', x, y + sy * 3)));

// ---------- L-main: room ----------
// wall silhouettes
for (const [w, n] of walls) {
  const q = [pp(w, 0, 0, YT), pp(w, n - 1, 1, YT), pp(w, n - 1, 1, YB), pp(w, 0, 0, YB)];
  L.main.push(polygon(q));
}
// panel dividers
for (const [w, n] of walls) for (let i = 1; i < n; i++) L.main.push(line(...pp(w, i, 0, YT), ...pp(w, i, 0, YB)));
// cornice and plinth bands
for (const Y of [YT + 0.06, YB - 0.06]) {
  const pts = [pp('L', NW - 1, 1, Y), pp('L', 0, 0, Y), pp('B', NB - 1, 1, Y), pp('R', NW - 1, 1, Y)];
  L.main.push(poly(pts));
}
// patch cables draped between panels at jack height
const JY = 0.2;
const cables = [
  [['L', 7, 0.5], ['L', 5, 0.5], 34],
  [['L', 6, 0.3], ['L', 2, 0.6], 46],
  [['L', 1, 0.5], ['B', 1, 0.5], 26],
  [['B', 2, 0.4], ['B', 5, 0.6], 22],
  [['B', 6, 0.5], ['R', 2, 0.5], 26],
  [['R', 3, 0.4], ['R', 6, 0.5], 40],
];
for (const [[w1, i1, u1], [w2, i2, u2], sag] of cables) {
  const a = pp(w1, i1, u1, JY), b = pp(w2, i2, u2, JY);
  L.main.push(pathEl(d('M', a, 'Q', (a[0] + b[0]) / 2, Math.max(a[1], b[1]) + sag, b)));
}

// ---------- L-main: tube-panel inset ----------
L.main.push(rect(INS.x, INS.y, INS.w, INS.h));
const TUBES = [];
for (let row = 0; row < 3; row++) for (let c = 0; c < 7; c++) TUBES.push([130 + c * 55, 588 + row * 72, row, c]);
const smallTube = (x, yt) => d('M', x - 11, yt + 52, 'L', x - 11, yt + 11, 'A', 11, 11, 0, 0, 1, x + 11, yt + 11, 'L', x + 11, yt + 52);
const ACC_TUBE = [1, 6];
for (const [x, yt, row, c] of TUBES) if (!(row === ACC_TUBE[0] && c === ACC_TUBE[1])) L.main.push(pathEl(smallTube(x, yt)));
for (let row = 0; row < 3; row++) L.main.push(line(INS.x + 8, 588 + row * 72 + 60, INS.x + INS.w - 8, 588 + row * 72 + 60)); // chassis shelves
// decade switches (spin) and patch jacks
const SW = [[162, 848, 40], [295, 848, -60], [428, 848, 90]];
for (const [x, y, deg] of SW) L.main.push(circle(x, y, 24));
L.main.push(pathEl(d('M', 228, 846, 'C', 236, 905, 354, 905, 362, 846)));   // patch cord between jacks

// ---------- L-main: big tube cutaway ----------
L.main.push(circle(TC[0], TC[1], TR));
L.main.push(pathEl(d('M', 670, 830, 'L', 670, 866, 'Q', 670, 874, 678, 874, 'L', 782, 874, 'Q', 790, 874, 790, 866, 'L', 790, 830, 'Z'))); // base
L.main.push(pathEl(d('M', 698, 652, 'L', 762, 652, 'L', 762, 782, 'L', 698, 782, 'Z')));  // plate (cut open)

// ---------- L-detail ----------
// per panel: section rules, neon display ticks, two decade switches
for (const [w, n] of walls) for (let i = 0; i < n; i++) {
  const sec = [];
  for (const Y of [-0.3, 0.02, 0.3]) sec.push(d('M', pp(w, i, 0.06, Y), 'L', pp(w, i, 0.94, Y)));
  L.detail.push(pathEl(sec.join(' ')));
  const tk = [];
  for (let u = 0.16; u < 0.9; u += 0.14) tk.push(d('M', pp(w, i, u, -0.41), 'L', pp(w, i, u, -0.35)));
  for (let u = 0.16; u < 0.9; u += 0.14) tk.push(d('M', pp(w, i, u, 0.36), 'L', pp(w, i, u, 0.42)));
  L.detail.push(pathEl(tk.join(' ')));
  for (const u of [0.3, 0.7]) {
    const c = pp(w, i, u, -0.14), a = pp(w, i, u - 0.14, -0.14), b = pp(w, i, u + 0.14, -0.14);
    const ry = Math.abs(pp(w, i, u, -0.14 + 0.035)[1] - c[1]);
    L.detail.push(ellipse(c[0], c[1], Math.max(0.8, Math.abs(b[0] - a[0]) / 2), ry));
  }
}
// cable plugs (short stubs at each end)
for (const [[w1, i1, u1], [w2, i2, u2]] of cables) for (const [w, i, u] of [[w1, i1, u1], [w2, i2, u2]]) {
  const p = pp(w, i, u, JY), q = pp(w, i, u, JY - 0.05);
  L.detail.push(line(q[0], q[1], p[0], p[1]));
}
// small tubes: bases + filaments
for (const [x, yt, row, c] of TUBES) {
  L.detail.push(rect(x - 13, yt + 52, 26, 8));
  L.detail.push(pathEl(d('M', x - 4, yt + 44, 'L', x - 4, yt + 24, 'L', x, yt + 19, 'L', x + 4, yt + 24, 'L', x + 4, yt + 44)));
}
// switch ticks, jacks
for (const [x, y, deg] of SW) {
  const t = [];
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI * 2) / 10; t.push(d('M', x + 27 * Math.cos(a), y + 27 * Math.sin(a), 'L', x + 32 * Math.cos(a), y + 32 * Math.sin(a))); }
  L.detail.push(pathEl(t.join(' ')));
  L.detail.push(spin(x, y, deg, [circle(x, y, 10), pathEl(d('M', x, y - 9, 'L', x, y - 21, 'M', x - 5, y - 16, 'L', x, y - 22, 'L', x + 5, y - 16))]));
}
for (const x of [228, 362]) L.detail.push(circle(x, 846, 5), circle(x, 846, 9));
// leader from the glowing tube in the panel to the cutaway
L.detail.push(line(130 + ACC_TUBE[1] * 55 + 14, 588 + ACC_TUBE[0] * 72 + 30, TC[0] - TR + 2, TC[1] - 20));
// big tube internals
L.detail.push(ellipse(730, 640, 50, 7), ellipse(730, 794, 50, 7));        // mica spacers
L.detail.push(line(712, 628, 712, 806), line(748, 628, 748, 806));       // grid support rods
{
  const g = [];
  for (let y = 664; y < 776; y += 7) g.push(d('M', 712, y, 'L', 748, y + 2));
  L.detail.push(pathEl(g.join(' ')));                                      // grid winding
}
L.detail.push(rect(725, 654, 10, 132));                                    // cathode sleeve
L.detail.push(ellipse(730, 612, 20, 5));                                   // getter ring
L.detail.push(pathEl(d('M', 704, 830, 'L', 716, 808, 'L', 744, 808, 'L', 756, 830)));   // glass stem press
L.detail.push(pathEl(d('M', 716, 808, 'L', 712, 800, 'M', 744, 808, 'L', 748, 800, 'M', 726, 808, 'L', 726, 786, 'M', 734, 808, 'L', 734, 786))); // leads
for (const x of [690, 716, 744, 770]) L.detail.push(line(x, 874, x, 896));   // base pins
{
  const h = [];
  for (let y = 660; y < 780; y += 8) h.push(d('M', 753, y, 'L', 762, y + 6));
  for (let y = 660; y < 780; y += 8) h.push(d('M', 698, y + 6, 'L', 704, y));
  L.detail.push(pathEl(h.join(' ')));                                      // plate shading
}
{
  const h = [];
  for (let x = 676; x < 786; x += 8) h.push(d('M', x, 836, 'L', x + 6, 868));
  L.detail.push(pathEl(h.join(' ')));                                      // base shading
}

// ---------- L-acc: the glowing tube ----------
L.acc.push(pathEl(d('M', 676, 830, 'L', 676, 640, 'Q', 676, 590, 724, 586, 'L', 726, 572, 'L', 734, 572, 'L', 736, 586, 'Q', 784, 590, 784, 640, 'L', 784, 830)));
L.acc.push(pathEl(d('M', 727, 782, 'L', 727, 662, 'L', 730, 656, 'L', 733, 662, 'L', 733, 782)));
{
  const [x, yt] = [130 + ACC_TUBE[1] * 55, 588 + ACC_TUBE[0] * 72];
  L.acc.push(pathEl(smallTube(x, yt)));
}

// ---------- L-lbl ----------
L.lbl.push(text(500, 134, 'ENIAC', 24));
L.lbl.push(text(500, 166, 'A.D. MCMXLV', 18));
L.lbl.push(text(INS.x, 552, '17468 TUBES', 18, 'start'));
L.lbl.push(text(910, 552, '6SN7 TRIODE', 18, 'end'));
L.lbl.push(text(500, 98, 'FIG. VIII', 16));

write('08-eniac.svg');
