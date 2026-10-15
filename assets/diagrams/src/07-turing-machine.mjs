// 07-turing-machine: Turing's a-machine (1936). A tape of cells fading off both
// ends, a mechanical read/write carriage riding a rail over the active cell,
// and above it the state-transition table drawn as a five-state diagram.
// Deterministic; run with plain node.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---------- tiny SVG helpers (shared pattern across diagrams) ----------
const r = (n) => { const v = Math.round(n * 10) / 10; return Object.is(v, -0) ? '0' : String(v); };
const d = (...a) => a.map((x) => (typeof x === 'number' ? r(x) : x)).join(' ');
const line = (x1, y1, x2, y2) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}"/>`;
const circle = (cx, cy, rr) => `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}"/>`;
const ellipse = (cx, cy, rx, ry) => `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}"/>`;
const rect = (x, y, w, h) => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"/>`;
const pathEl = (dd) => `<path d="${dd}"/>`;
const polygon = (pts) => `<polygon points="${pts.map((p) => r(p[0]) + ',' + r(p[1])).join(' ')}"/>`;
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

// ---------- geometry ----------
const CX = 500;
const TT = 690, TB = 760, TK = 768, CW = 64;          // tape top, bottom, thickness line, cell width
const cellC = (k) => CX + k * CW;
const SOLID = [212, 788];                              // solid tape between these x
const SYM = { '-5': '0', '-4': '1', '-3': 'B', '-2': '1', '-1': '1', 0: '1', 1: '0', 2: '1', 3: '1', 4: 'B', 5: '0' };

// state diagram on a guide ellipse
const EC = [500, 262], ERX = 330, ERY = 125, SRAD = 38;
const angs = [170, 235, 305, 10, 90];
const S = angs.map((a) => [EC[0] + ERX * Math.cos((a * Math.PI) / 180), EC[1] + ERY * Math.sin((a * Math.PI) / 180)]);

// ---------- L-con ----------
L.con.push(line(CX, 96, CX, 870));                                 // principal axis through head
L.con.push(line(84, (TT + TB) / 2, 916, (TT + TB) / 2));           // tape centre line
L.con.push(ellipse(EC[0], EC[1], ERX, ERY));                       // guide ellipse of states
L.con.push(line(EC[0] - ERX - 20, EC[1], EC[0] + ERX + 20, EC[1]));
for (const [x, y] of S) L.con.push(pathEl(d('M', x - SRAD - 10, y, 'L', x + SRAD + 10, y, 'M', x, y - SRAD - 10, 'L', x, y + SRAD + 10)));
for (let k = -5; k <= 5; k++) L.con.push(line(cellC(k), 838, cellC(k), 848));   // cell index ticks
L.con.push(line(cellC(-5), 843, cellC(5), 843));
// dimension of one cell (k = 3) with extension lines and arrows
{
  const a = cellC(3) - CW / 2, b = cellC(3) + CW / 2, y = 866;
  L.con.push(line(a, TK + 6, a, y + 8), line(b, TK + 6, b, y + 8), line(a, y, b, y));
  L.con.push(pathEl(d('M', a + 10, y - 5, 'L', a, y, 'L', a + 10, y + 5)));
  L.con.push(pathEl(d('M', b - 10, y - 5, 'L', b, y, 'L', b - 10, y + 5)));
}

// ---------- L-main: states, arrows, rail, carriage, tape ----------
S.forEach(([x, y]) => L.main.push(circle(x, y, SRAD)));
// arrows between states (quadratic arcs); heads go to detail
const heads = [];
function arrow(a, b, bend) {
  const [ax, ay] = S[a], [bx, by] = S[b];
  const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  const qx = mx + (-dy / len) * bend, qy = my + (dx / len) * bend;
  const ua = Math.atan2(qy - ay, qx - ax), ub = Math.atan2(qy - by, qx - bx);
  const p0 = [ax + (SRAD + 4) * Math.cos(ua), ay + (SRAD + 4) * Math.sin(ua)];
  const p1 = [bx + (SRAD + 6) * Math.cos(ub), by + (SRAD + 6) * Math.sin(ub)];
  L.main.push(pathEl(d('M', p0[0], p0[1], 'Q', qx, qy, p1[0], p1[1])));
  heads.push([p1, Math.atan2(p1[1] - qy, p1[0] - qx)]);
  return [(p0[0] + 2 * qx + p1[0]) / 4, (p0[1] + 2 * qy + p1[1]) / 4];
}
function selfLoop(i, ang) {
  const [x, y] = S[i], a1 = ang - 0.5, a2 = ang + 0.5, R2 = SRAD + 86;
  const p0 = [x + (SRAD + 3) * Math.cos(a1), y + (SRAD + 3) * Math.sin(a1)];
  const p1 = [x + (SRAD + 6) * Math.cos(a2), y + (SRAD + 6) * Math.sin(a2)];
  const c0 = [x + R2 * Math.cos(a1 - 0.2), y + R2 * Math.sin(a1 - 0.2)];
  const c1 = [x + R2 * Math.cos(a2 + 0.2), y + R2 * Math.sin(a2 + 0.2)];
  L.main.push(pathEl(d('M', p0[0], p0[1], 'C', c0[0], c0[1], c1[0], c1[1], p1[0], p1[1])));
  heads.push([p1, Math.atan2(p1[1] - c1[1], p1[0] - c1[0])]);
}
const m01 = arrow(0, 1, -34);
arrow(1, 2, -22);
const m23 = arrow(2, 3, -34);
arrow(3, 4, -30);
arrow(4, 0, -30);
arrow(2, 4, 18);
selfLoop(1, -Math.PI / 2 - 0.25);
selfLoop(2, -Math.PI / 2 + 0.25);
// start arrow into q0
L.main.push(line(S[0][0] - SRAD - 50, S[0][1], S[0][0] - SRAD - 6, S[0][1]));
heads.push([[S[0][0] - SRAD - 6, S[0][1]], 0]);

// control brace under the diagram and the linking rod down to the carriage
L.main.push(pathEl(d('M', 150, 430, 'Q', 150, 442, 166, 442, 'L', 484, 442, 'Q', 500, 442, 500, 456, 'Q', 500, 442, 516, 442, 'L', 834, 442, 'Q', 850, 442, 850, 430)));
L.main.push(line(CX, 456, CX, 524));
// rail
L.main.push(pathEl(d('M', 110, 490, 'L', 890, 490, 'L', 890, 500, 'L', 110, 500, 'Z')));
L.main.push(rect(96, 480, 14, 30), rect(890, 480, 14, 30));
// trolley wheels on the rail (spin), hangers to housing
const WHEELS = [[452, 476], [548, 476]];
for (const [x, y] of WHEELS) L.main.push(spin(x, y, 90, [circle(x, y, 14), circle(x, y, 4)]));
for (const [x] of WHEELS) L.main.push(line(x, 476, x, 522));
// housing
const HOUSING = [[410, 522], [590, 522], [590, 562], [560, 610], [440, 610], [410, 562]];
L.main.push(polygon(HOUSING));
L.main.push(rect(438, 534, 90, 56));
// yoke around the tape (broken where the tape passes in front)
L.main.push(pathEl(d('M', 410, 562, 'L', 378, 562, 'L', 378, 682)));
L.main.push(pathEl(d('M', 590, 562, 'L', 622, 562, 'L', 622, 682)));
L.main.push(pathEl(d('M', 378, 776, 'L', 378, 822, 'L', 622, 822, 'L', 622, 776)));
// arms to pinch rollers
const ROL = [[424, 666, 1], [576, 666, 1], [424, 790, -1], [576, 790, -1]];
L.main.push(line(440, 610, 424, 666), line(560, 610, 576, 666));
L.main.push(line(378, 790, 424, 790), line(622, 790, 576, 790));
for (const [x, y, s] of ROL) L.main.push(spin(x, y, s * 72, [circle(x, y, 22)]));
// anvil under the active cell
L.main.push(rect(CX - 30, TK + 2, 60, 30), line(CX, TK + 32, CX, 822));
// tape: solid centre section, cell dividers
for (const y of [TT, TB, TK]) L.main.push(line(SOLID[0], y, SOLID[1], y));
for (let x = SOLID[0]; x <= SOLID[1] + 0.1; x += CW) L.main.push(line(x, TT, x, TB));

// ---------- L-detail ----------
for (const [[x, y], a] of heads) {
  const s = 11, w = 0.42;
  L.detail.push(pathEl(d('M', x - s * Math.cos(a - w), y - s * Math.sin(a - w), 'L', x, y, 'L', x - s * Math.cos(a + w), y - s * Math.sin(a + w))));
}
L.detail.push(circle(S[4][0], S[4][1], SRAD - 7));                 // halting state: double ring
// tape fade: dashes growing sparser toward both ends
const fade = (x0, dir, y) => {
  const segs = [[0, 36], [44, 72], [84, 104], [118, 128]];
  return pathEl(segs.map(([a, b]) => d('M', x0 + dir * a, y, 'L', x0 + dir * b, y)).join(' '));
};
for (const y of [TT, TB, TK]) L.detail.push(fade(SOLID[0], -1, y), fade(SOLID[1], 1, y));
for (const x of [SOLID[0] - CW, SOLID[1] + CW]) L.detail.push(pathEl(d('M', x, TT, 'L', x, TT + 22, 'M', x, TT + 34, 'L', x, TT + 48)));
// tape thickness hatching
{
  const h = [];
  for (let x = SOLID[0] + 4; x < SOLID[1]; x += 8) h.push(d('M', x, TK - 1, 'L', x + 6, TB + 1));
  L.detail.push(pathEl(h.join(' ')));
}
// symbols on the tape, engraved as strokes
const one = (cx, cy) => pathEl(d('M', cx - 9, cy - 12, 'L', cx + 1, cy - 20, 'L', cx + 1, cy + 20, 'M', cx - 9, cy + 20, 'L', cx + 11, cy + 20));
const zero = (cx, cy) => ellipse(cx, cy, 11, 20);
for (let k = -5; k <= 5; k++) {
  if (k === 0) continue; // drawn in the accent layer
  const s = SYM[k], cx = cellC(k), cy = (TT + TB) / 2;
  if (s === '1') L.detail.push(one(cx, cy));
  else if (s === '0') L.detail.push(zero(cx, cy));
  else L.detail.push(line(cx - 6, cy + 18, cx + 6, cy + 18)); // blank: underscore mark
}
// rail hatching
{
  const h = [];
  for (let x = 114; x < 888; x += 9) h.push(d('M', x, 499, 'L', x + 8, 491));
  L.detail.push(pathEl(h.join(' ')));
}
// trolley wheel spokes
for (const [x, y] of WHEELS) {
  const sp = [];
  for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; sp.push(d('M', x + 4 * Math.cos(a), y + 4 * Math.sin(a), 'L', x + 13 * Math.cos(a), y + 13 * Math.sin(a))); }
  L.detail.push(spin(x, y, 90, [pathEl(sp.join(' '))]));
}
// roller hubs + spokes
for (const [x, y, s] of ROL) {
  const sp = [];
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + 0.4; sp.push(d('M', x + 6 * Math.cos(a), y + 6 * Math.sin(a), 'L', x + 18 * Math.cos(a), y + 18 * Math.sin(a))); }
  L.detail.push(spin(x, y, s * 72, [circle(x, y, 6), pathEl(sp.join(' ')), circle(x, y, 18)]));
}
// housing: bolts, hatching, state dial with pointer and ticks
for (const [x, y] of [[422, 532], [578, 532], [422, 552], [578, 552]]) L.detail.push(circle(x, y, 3));
for (let x = 540; x <= 584; x += 6) {
  const yb = x <= 560 ? 606 : 606 - ((x - 560) * 50) / 30;
  L.detail.push(line(x, 530, x, yb));
}
L.detail.push(circle(483, 562, 17));
{
  const t = [];
  for (let i = 0; i < 5; i++) { const a = Math.PI + (i * Math.PI) / 4; t.push(d('M', 483 + 17 * Math.cos(a), 562 + 17 * Math.sin(a), 'L', 483 + 23 * Math.cos(a), 562 + 23 * Math.sin(a))); }
  L.detail.push(pathEl(t.join(' ')));
  L.detail.push(line(483, 562, 483 + 13 * Math.cos(-0.9), 562 + 13 * Math.sin(-0.9)));
}
// coil spring on the stylus shaft
{
  const z = [];
  for (let i = 0; i <= 8; i++) z.push([i % 2 ? 509 : 491, 612 + i * 4.5]);
  L.detail.push(pathEl('M' + z.map((p) => r(p[0]) + ' ' + r(p[1])).join(' L')));
}
// travel arrows (the head moves one cell left or right)
L.detail.push(pathEl(d('M', 350, 640, 'L', 262, 640, 'M', 274, 633, 'L', 262, 640, 'L', 274, 647)));
L.detail.push(pathEl(d('M', 650, 640, 'L', 738, 640, 'M', 726, 633, 'L', 738, 640, 'L', 726, 647)));
// yoke hatching at the bottom crossbar
{
  const h = [];
  for (let x = 384; x < 618; x += 10) h.push(d('M', x, 832, 'L', x + 8, 824));
  L.detail.push(pathEl(h.join(' ')));
}
L.detail.push(line(378, 832, 622, 832));

// ---------- L-acc: read/write head and the active cell ----------
L.acc.push(pathEl(d('M', 494, 610, 'L', 494, 652, 'L', 489, 652, 'L', 500, 684, 'L', 511, 652, 'L', 506, 652, 'L', 506, 610)));
L.acc.push(rect(cellC(0) - CW / 2, TT, CW, TB - TT));
L.acc.push(one(cellC(0), (TT + TB) / 2));

// ---------- L-lbl ----------
['Q0', 'Q1', 'Q2', 'Q3', 'Q4'].forEach((s, i) => L.lbl.push(text(S[i][0] + 1, S[i][1] + 7, s, 20)));
L.lbl.push(text(m01[0] - 34, m01[1] - 16, '1/0,R', 18));
L.lbl.push(text(m23[0] + 34, m23[1] - 16, '0/1,L', 18));
L.lbl.push(text(CX, 912, 'A.D. MCMXXXVI', 20));

write('07-turing-machine.svg');
