// 05-analytical-engine: Babbage Analytical Engine (1837), after the 1840 plan.
// Upper half: plan of the Mill (ring of figure-wheel columns around the great
// central wheel) joined by racks to the Store. Lower half: elevation of both.
// Deterministic; run: node assets/diagrams/src/05-analytical-engine.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---------- tiny SVG helpers (shared pattern across diagrams) ----------
const r = (n) => { const v = Math.round(n * 10) / 10; return Object.is(v, -0) ? '0' : String(v); };
const d = (...a) => a.map((x) => (typeof x === 'number' ? r(x) : x)).join(' ');
const line = (x1, y1, x2, y2) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}"/>`;
const circle = (cx, cy, rr) => `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}"/>`;
const rect = (x, y, w, h) => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"/>`;
const pathEl = (dd) => `<path d="${dd}"/>`;
const poly = (pts) => `<polyline points="${pts.map((p) => r(p[0]) + ',' + r(p[1])).join(' ')}"/>`;
const text = (x, y, s, size = 20, anchor = 'middle') =>
  `<text x="${r(x)}" y="${r(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" text-anchor="${anchor}" fill="currentColor">${s}</text>`;
const spin = (cx, cy, deg, items) =>
  `<g class="spin" data-cx="${r(cx)}" data-cy="${r(cy)}" data-deg="${deg}">${items.join('')}</g>`;
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
const P = (a, rr, cx, cy) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
function gear(cx, cy, rp, n, depth, phase = 0) {
  const s = (Math.PI * 2) / n, ro = rp + depth / 2, ri = rp - depth / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + i * s;
    out.push(P(a, ri, cx, cy), P(a + 0.4 * s, ri, cx, cy), P(a + 0.55 * s, ro, cx, cy), P(a + 0.85 * s, ro, cx, cy));
  }
  return 'M' + out.map((p) => r(p[0]) + ' ' + r(p[1])).join(' L') + ' Z';
}
function write(name) {
  const W = { con: 1.2, main: 2.6, detail: 1.3, acc: 3.6 };
  const g = (k) => `  <g class="L-${k}"${W[k] ? ` stroke-width="${W[k]}"` : ''}>\n    ${L[k].join('\n    ')}\n  </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">\n${['con', 'main', 'detail', 'acc', 'lbl'].map(g).join('\n')}\n</svg>\n`;
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', name);
  writeFileSync(out, svg);
  console.log('wrote', out, svg.length, 'bytes');
}

// ---------- geometry ----------
const MX = 305, MY = 300;          // Mill centre (plan)
const RC = 135, NC = 60;           // central wheel pitch radius, teeth
const RR = 178, RF = 43, NF = 19;  // ring radius, figure-wheel pitch radius, teeth
const NCOL = 10;
const cols = [];
for (let i = 0; i < NCOL; i++) {
  const a = (i / NCOL) * Math.PI * 2;
  cols.push({ a, x: MX + RR * Math.cos(a), y: MY + RR * Math.sin(a) });
}
const RACK_Y = [279, 321];
const STORE_X = [];
for (let x = 570; x <= 890; x += 40) STORE_X.push(x);
const SROW = [236, 364], SR = 19;

// elevation
const EL_TOP = 605, EL_BOT = 880;

// ---------- L-con: construction ----------
L.con.push(line(MX - 232, MY, MX + 232, MY));                 // horizontal centre line of Mill
L.con.push(line(MX, MY - 245, MX, EL_BOT + 20));             // vertical axis, carried down to elevation
L.con.push(circle(MX, MY, RR));                              // pitch circle of figure-wheel columns
L.con.push(circle(MX, MY, RC + 28));                         // guide circle
for (const k of [0.5, 1.5, 2.5, 3.5]) {                      // radial construction rays at half-steps
  const a = (k / NCOL) * Math.PI * 2 + Math.PI;
  const [x1, y1] = P(a, 40, MX, MY), [x2, y2] = P(a, RR + 60, MX, MY);
  L.con.push(line(x1, y1, x2, y2));
}
L.con.push(line(540, (RACK_Y[0] + RACK_Y[1]) / 2, 918, (RACK_Y[0] + RACK_Y[1]) / 2)); // store centre line
// projection lines plan -> elevation
for (const x of [MX - RR, MX + RR, STORE_X[0], STORE_X[STORE_X.length - 1]]) L.con.push(line(x, x < 540 ? MY + 50 : SROW[1] + SR + 6, x, EL_TOP - 8));
L.con.push(line(80, EL_BOT + 18, 920, EL_BOT + 18));        // ground line
// dimension line over the store with end ticks and arrowheads
const DY = 192, DX1 = STORE_X[0] - SR, DX2 = STORE_X[STORE_X.length - 1] + SR;
L.con.push(line(DX1, DY, DX2, DY));
L.con.push(line(DX1, DY - 10, DX1, SROW[0] - SR - 4), line(DX2, DY - 10, DX2, SROW[0] - SR - 4));
L.con.push(pathEl(d('M', DX1 + 12, DY - 5, 'L', DX1, DY, 'L', DX1 + 12, DY + 5)));
L.con.push(pathEl(d('M', DX2 - 12, DY - 5, 'L', DX2, DY, 'L', DX2 - 12, DY + 5)));
// dimension for Mill diameter (left, vertical)
L.con.push(line(88, MY - RR, 88, MY + RR));
L.con.push(line(82, MY - RR, 118, MY - RR), line(82, MY + RR, 118, MY + RR));
// small arc marking the angular pitch between two columns
L.con.push(pathEl(d('M', ...P(-0.2, RR + 30, MX, MY), 'A', RR + 30, RR + 30, 0, 0, 1, ...P(0.2 + (2 * Math.PI) / NCOL, RR + 30, MX, MY))));

// ---------- L-main + L-detail: PLAN ----------
// Central wheel: inner web + hub (main), spokes (detail); toothed rim is the accent.
const CDEG = 30, FDEG = -Math.round((CDEG * RC) / RF); // meshing ratio
L.main.push(spin(MX, MY, CDEG, [circle(MX, MY, RC - 16), circle(MX, MY, 30)]));
{
  const sp = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const [x1, y1] = P(a - 0.09, 30, MX, MY), [x2, y2] = P(a - 0.035, RC - 16, MX, MY);
    const [x3, y3] = P(a + 0.035, RC - 16, MX, MY), [x4, y4] = P(a + 0.09, 30, MX, MY);
    sp.push(pathEl(d('M', x1, y1, 'L', x2, y2, 'M', x3, y3, 'L', x4, y4)));
  }
  sp.push(circle(MX, MY, 11));
  sp.push(circle(MX, MY, RC - 24));
  L.detail.push(spin(MX, MY, CDEG, sp));
}
// ring of figure-wheel columns
cols.forEach((c, i) => {
  const ph = i * 0.31;
  L.main.push(spin(c.x, c.y, FDEG, [pathEl(gear(c.x, c.y, RF, NF, 7, ph)), circle(c.x, c.y, 9)]));
  // figure ticks 0..9 on the wheel face + inner ring
  const ticks = [];
  for (let k = 0; k < 10; k++) {
    const a = ph + (k / 10) * Math.PI * 2;
    const [x1, y1] = P(a, RF - 14, c.x, c.y), [x2, y2] = P(a, RF - (k === 0 ? 26 : 21), c.x, c.y);
    ticks.push('M' + r(x1) + ' ' + r(y1) + ' L' + r(x2) + ' ' + r(y2));
  }
  L.detail.push(spin(c.x, c.y, FDEG, [pathEl(ticks.join(' ')), circle(c.x, c.y, RF - 12)]));
});
// Store racks (plan)
for (const y of RACK_Y) L.main.push(rect(532, y - 6, 386, 12));
for (const [j, y] of RACK_Y.entries()) {
  const pts = [];
  const yy = j === 0 ? y - 6 : y + 6, dir = j === 0 ? -1 : 1;
  for (let x = 536; x < 914; x += 10) pts.push([x, yy], [x + 3, yy + dir * 5], [x + 6, yy + dir * 5], [x + 9, yy]);
  L.detail.push(poly(pts));
}
// Store columns (plan): two rows flanking the racks
for (const y of SROW) for (const x of STORE_X) L.main.push(circle(x, y, SR));
for (const y of SROW) for (const x of STORE_X) L.detail.push(circle(x, y, 5));
// links from store columns to racks (pinions engaging)
for (const [j, y] of SROW.entries()) for (const x of STORE_X) {
  const y1 = j === 0 ? y + SR : y - SR, y2 = j === 0 ? RACK_Y[0] - 11 : RACK_Y[1] + 11;
  L.detail.push(line(x, y1, x, y2));
}
// hatching inside the band between racks (engraved shading)
{
  const h = [];
  for (let x = 540; x < 912; x += 9) h.push(d('M', x, RACK_Y[0] + 9, 'L', x + 7, RACK_Y[1] - 9));
  L.detail.push(pathEl(h.join(' ')));
}

// ---------- ELEVATION ----------
// base plate + frame
L.main.push(rect(84, EL_BOT, 834, 14));
L.main.push(rect(532, EL_TOP - 14, 386, 10));                     // store top plate
L.main.push(line(540, EL_TOP - 4, 540, EL_BOT), line(912, EL_TOP - 4, 912, EL_BOT)); // store posts
// Mill elevation: central axle + stack of great wheels
L.main.push(line(MX, EL_TOP - 20, MX, EL_BOT));
const CW = [];
for (let k = 0; k < 6; k++) CW.push(EL_TOP + 22 + k * 44);
{
  const dd = CW.map((y) => d('M', MX - RC, y, 'L', MX + RC, y, 'L', MX + RC, y + 12, 'L', MX - RC, y + 12, 'Z')).join(' ');
  L.main.push(pathEl(dd));
}
// ring-column elevations (the extreme left and right columns, plus two receding behind)
const stack = (x, w, y0, n, pitch, hgt) =>
  Array.from({ length: n }, (_, k) => d('M', x - w, y0 + k * pitch, 'L', x + w, y0 + k * pitch, 'L', x + w, y0 + k * pitch + hgt, 'L', x - w, y0 + k * pitch + hgt, 'Z')).join(' ');
for (const x of [MX - RR, MX + RR]) {
  L.main.push(line(x, EL_TOP - 6, x, EL_BOT));
  L.main.push(pathEl(stack(x, RF, EL_TOP + 8, 12, 22, 10)));
}
// store elevation columns
for (const x of STORE_X) {
  L.main.push(line(x, EL_TOP - 4, x, EL_BOT));
  L.main.push(pathEl(stack(x, 15, EL_TOP + 8, 12, 22, 10)));
}
// store racks in elevation, running into the Mill
for (const y of [EL_TOP + 96, EL_TOP + 184]) L.main.push(line(MX + RR + RF, y, 910, y));

// elevation detail: hatching on great wheels (right-hand shade), figure ticks on columns
for (const y of CW) {
  const h = [];
  for (let x = MX + 40; x < MX + RC - 2; x += 7) h.push(d('M', x, y + 2, 'L', x + 4, y + 10));
  L.detail.push(pathEl(h.join(' ')));
}
for (const x of [MX - RR, MX + RR]) {
  const t = [];
  for (let k = 0; k < 12; k++) {
    const y = EL_TOP + 8 + k * 22;
    for (const dx of [-30, -15, 0, 15, 30]) t.push(d('M', x + dx, y + 2, 'L', x + dx, y + 8));
  }
  L.detail.push(pathEl(t.join(' ')));
}
for (const x of STORE_X) {
  const t = [];
  for (let k = 0; k < 12; k++) {
    const y = EL_TOP + 8 + k * 22;
    t.push(d('M', x - 8, y + 2, 'L', x - 8, y + 8, 'M', x + 1, y + 2, 'L', x + 1, y + 8, 'M', x + 10, y + 2, 'L', x + 10, y + 8));
  }
  L.detail.push(pathEl(t.join(' ')));
}
// bolts on base plate
for (let x = 110; x < 910; x += 80) L.detail.push(circle(x, EL_BOT + 7, 3));
// hatching under base plate (ground section)
{
  const h = [];
  for (let x = 90; x < 912; x += 14) h.push(d('M', x, EL_BOT + 26, 'L', x + 10, EL_BOT + 16));
  L.detail.push(pathEl(h.join(' ')));
}
// collars where axles pass through the top of the stacks
for (const x of [MX - RR, MX, MX + RR]) L.detail.push(rect(x - 7, EL_TOP - 4, 14, 8));

// ---------- L-acc: the great central wheel of the Mill ----------
L.acc.push(spin(MX, MY, CDEG, [pathEl(gear(MX, MY, RC, NC, 8, 0.05)), circle(MX, MY, 20)]));

// ---------- L-lbl ----------
L.lbl.push(text(912, 116, 'FIG. V', 22, 'end'));
L.lbl.push(text((DX1 + DX2) / 2, DY - 14, 'THE STORE', 20));
L.lbl.push(text(735, 440, 'A.D. MDCCCXXXVII', 18));
L.lbl.push(text(MX, 568, 'THE MILL', 20));
L.lbl.push(text(735, 500, 'PLAN', 18));
L.lbl.push(text(735, 568, 'ELEVATION', 18));

write('05-analytical-engine.svg');
