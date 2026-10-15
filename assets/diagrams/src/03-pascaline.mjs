// 03-pascaline: plan of the brass box (six spoked input dials, numeral rings, display
// windows under the sliding bar) + cutaway of the carry: the weighted sautoir between two pin wheels.
// Plain Node, no deps, deterministic. Writes ../03-pascaline.svg
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const r1 = (n) => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)},${r1(y)}`;
const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${typeof v === 'number' ? r1(v) : v}"`).join(' ');
const line = (x1, y1, x2, y2) => `<line ${attrs({ x1, y1, x2, y2 })}/>`;
const circle = (cx, cy, r) => `<circle ${attrs({ cx, cy, r })}/>`;
const rect = (x, y, width, height, rx) => `<rect ${attrs(rx ? { x, y, width, height, rx } : { x, y, width, height })}/>`;
const path = (d) => `<path d="${d}"/>`;
const text = (x, y, s, anchor = 'start', size = 20) =>
  `<text ${attrs({ x, y })} font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" text-anchor="${anchor}" fill="currentColor">${s}</text>`;
const D2R = Math.PI / 180;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const PP = (cx, cy, r, a) => P(...pol(cx, cy, r, a));
function arc(cx, cy, r, a0, a1) {
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
  return `M${PP(cx, cy, r, a0 * D2R)}A${r1(r)} ${r1(r)} 0 ${large} ${sweep} ${PP(cx, cy, r, a1 * D2R)}`;
}
function arrowHead(x, y, ang, s = 9) {
  const a1 = ang + Math.PI - 0.35, a2 = ang + Math.PI + 0.35;
  return `M${P(x + s * Math.cos(a1), y + s * Math.sin(a1))}L${P(x, y)}L${P(x + s * Math.cos(a2), y + s * Math.sin(a2))}`;
}
function dimLine(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  return path(`M${P(x1, y1)}L${P(x2, y2)}` + arrowHead(x2, y2, a) + arrowHead(x1, y1, a + Math.PI));
}
function centreLine(x1, y1, x2, y2, pat = [26, 6, 4, 6]) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  let d = '', t = 0, i = 0;
  while (t < L) {
    const seg = Math.min(pat[i % pat.length], L - t);
    if (i % 2 === 0) d += `M${P(x1 + ux * t, y1 + uy * t)}L${P(x1 + ux * (t + seg), y1 + uy * (t + seg))}`;
    t += seg; i++;
  }
  return path(d);
}
const cross = (x, y, s = 10) => `M${P(x - s, y)}L${P(x + s, y)}M${P(x, y - s)}L${P(x, y + s)}`;

// single-stroke engraved numerals on a 4 x 6 grid
const GLYPH = {
  0: 'M0,1.2Q0,0 2,0Q4,0 4,1.2L4,4.8Q4,6 2,6Q0,6 0,4.8Z',
  1: 'M0.8,1.2L2.2,0L2.2,6M0.8,6L3.6,6',
  2: 'M0,1.2Q0.6,0 2,0Q4,0 4,1.6Q4,3 0,6L4,6',
  3: 'M0.2,0L4,0L1.8,2.5Q4,2.5 4,4.2Q4,6 2,6Q0.4,6 0,5',
  4: 'M3,6L3,0L0,4.2L4,4.2',
  5: 'M3.8,0L0.6,0L0.2,2.8Q1,2.3 2,2.3Q4,2.3 4,4.2Q4,6 2,6Q0.5,6 0,5',
  6: 'M3.4,0Q0,0.8 0,4.2Q0,6 2,6Q4,6 4,4.2Q4,2.6 2,2.6Q0,2.6 0,4',
  7: 'M0,0L4,0L1.4,6',
  8: 'M2,2.8Q0.2,2.8 0.2,1.4Q0.2,0 2,0Q3.8,0 3.8,1.4Q3.8,2.8 2,2.8Q0,2.8 0,4.4Q0,6 2,6Q4,6 4,4.4Q4,2.8 2,2.8',
  9: 'M4,1.8Q4,3.4 2,3.4Q0,3.4 0,1.7Q0,0 2,0Q4,0 4,1.8Q4,5 0.6,6',
};
function glyph(ch, cx, cy, h) {
  const s = h / 6, ox = cx - 2 * s, oy = cy - 3 * s;
  return GLYPH[ch].replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (m, x, y) => `${r1(ox + x * s)},${r1(oy + y * s)}`);
}

const con = [], main = [], det = [], acc = [], lbl = [];
const spinWrap = (cx, cy, deg, els) => `<g class="spin" data-cx="${r1(cx)}" data-cy="${r1(cy)}" data-deg="${r1(deg)}">\n${els.join('\n')}\n</g>`;

// ---------------- FIG. I : the box in plan ----------------
const BX0 = 80, BY0 = 120, BX1 = 920, BY1 = 500, IN = 12;
const DY = 352, xs = Array.from({ length: 6 }, (_, k) => BX0 + 68 + 136 * k);
const RING_O = 63, RING_I = 47, WHEEL = 42, HUB = 9;
const shown = [0, 0, 1, 6, 4, 2];
const spinDeg = [36, 72, 108, 36, 72, 108];

main.push(rect(BX0, BY0, BX1 - BX0, BY1 - BY0, 6));
main.push(rect(BX0 + IN, BY0 + IN, BX1 - BX0 - 2 * IN, BY1 - BY0 - 2 * IN, 3));
// sliding bar with the six windows
const barY0 = 158, barY1 = 222;
main.push(path(`M${P(BX0 + IN + 14, barY0)}L${P(BX1 - IN - 14, barY0)}L${P(BX1 - IN - 14, barY1)}L${P(BX0 + IN + 14, barY1)}Z`));
main.push(path(`M${P(BX1 - IN - 14, 176)}L${P(BX1 - IN - 2, 176)}L${P(BX1 - IN - 2, 204)}L${P(BX1 - IN - 14, 204)}`));
xs.forEach((x) => main.push(rect(x - 23, 168, 46, 44, 3)));

const mainSpin = [], detSpin = [];
xs.forEach((x, k) => {
  main.push(circle(x, DY, RING_O));
  main.push(circle(x, DY, RING_I));
  // turning wheel: rim + hub + ten spokes (stylus goes between them)
  let sp = '';
  for (let i = 0; i < 10; i++) {
    const a = (-90 + 18 + 36 * i) * D2R;
    sp += `M${PP(x, DY, HUB + 1, a)}L${PP(x, DY, WHEEL - 1, a)}`;
  }
  mainSpin.push(spinWrap(x, DY, spinDeg[k], [circle(x, DY, WHEEL), circle(x, DY, HUB)]));
  detSpin.push(spinWrap(x, DY, spinDeg[k], [path(sp), circle(x, DY, 3.5), path(arc(x, DY, WHEEL - 5, 20, 110))]));
  // fixed numerals 0-9 on the ring, clockwise from the top
  let nd = '';
  for (let i = 0; i < 10; i++) {
    const [gx, gy] = pol(x, DY, (RING_O + RING_I) / 2, (-90 + 36 * i) * D2R);
    nd += glyph(String(i), gx, gy, 9.5);
  }
  det.push(path(nd));
  // the stop (a curved finger at the lower right)
  det.push(path(`M${PP(x, DY, RING_O - 2, 67 * D2R)}Q${PP(x, DY, 52, 71 * D2R)} ${PP(x, DY, WHEEL - 6, 70 * D2R)}` +
    `L${PP(x, DY, WHEEL - 7, 74 * D2R)}Q${PP(x, DY, 54, 77 * D2R)} ${PP(x, DY, RING_O - 2, 76 * D2R)}`));
  // shown digit in the window
  det.push(path(glyph(String(shown[k]), x, 195, 22)));
  // window shading (upper inner edge)
  det.push(path(`M${P(x - 18, 172)}L${P(x - 20, 178)}M${P(x - 12, 172)}L${P(x - 14, 178)}M${P(x - 6, 172)}L${P(x - 8, 178)}M${P(x, 172)}L${P(x - 2, 178)}M${P(x + 6, 172)}L${P(x + 4, 178)}M${P(x + 12, 172)}L${P(x + 10, 178)}M${P(x + 18, 172)}L${P(x + 16, 178)}`));
});
// stylus resting in its groove
main.push(path(`M${P(250, 462)}L${P(690, 462)}L${P(724, 466)}L${P(690, 470)}L${P(250, 470)}Q${P(238, 466)} ${P(250, 462)}Z`));
det.push(path(`M${P(262, 462)}L${P(262, 470)}M${P(270, 462)}L${P(270, 470)}M${P(278, 462)}L${P(278, 470)}M${P(640, 462)}L${P(640, 470)}`));
det.push(path(`M${P(236, 456)}L${P(738, 456)}Q${P(746, 466)} ${P(738, 476)}L${P(236, 476)}Q${P(228, 466)} ${P(236, 456)}`));
// box bevel shading (right + bottom), corner screws, engraved border fillet
{
  let d = '';
  for (let x = BX0 + 14; x < BX1 - 4; x += 8) d += `M${P(x, BY1 - 2)}L${P(x + 9, BY1 - IN + 2)}`;
  det.push(path(d));
  d = '';
  for (let y = BY0 + 16; y < BY1 - 6; y += 8) d += `M${P(BX1 - IN + 2, y + 9)}L${P(BX1 - 2, y)}`;
  det.push(path(d));
  [[BX0 + 30, BY0 + 30], [BX1 - 30, BY0 + 30], [BX0 + 30, BY1 - 30], [BX1 - 30, BY1 - 30]].forEach(([x, y], i) => {
    det.push(circle(x, y, 7));
    const a = (25 + i * 40) * D2R;
    det.push(path(`M${PP(x, y, 7, a)}L${PP(x, y, 7, a + Math.PI)}`));
  });
  det.push(rect(BX0 + IN + 6, BY0 + IN + 6, BX1 - BX0 - 2 * IN - 12, BY1 - BY0 - 2 * IN - 12, 2));
  // bar shading under its lower edge
  d = '';
  for (let x = BX0 + IN + 20; x < BX1 - IN - 16; x += 10) if (!xs.some((c) => Math.abs(c - x) < 26)) d += `M${P(x, barY1 - 2)}L${P(x + 6, barY1 - 10)}`;
  det.push(path(d));
}
// construction for FIG. I
con.push(centreLine(BX0 - 6, DY, BX1 + 6, DY));
con.push(path(xs.map((x) => `M${P(x, 140)}L${P(x, 150)}M${P(x, 228)}L${P(x, DY - RING_O - 4)}M${P(x, DY + RING_O + 4)}L${P(x, 436)}`).join('')));
con.push(dimLine(xs[0], 530, xs[1], 530));
con.push(path(`M${P(xs[0], BY1 + 4)}L${P(xs[0], 538)}M${P(xs[1], BY1 + 4)}L${P(xs[1], 538)}`));
con.push(circle(xs[5], DY, RING_O + 12));
con.push(path(arc(xs[5], DY, RING_O + 20, -80, 10) + arrowHead(...pol(xs[5], DY, RING_O + 20, 10 * D2R), 100 * D2R, 9)));

// ---------------- FIG. II : carry mechanism (vertical section) ----------------
const FY0 = 580, FY1 = 912, FX0 = 110, FX1 = 890;
// broken-edge frame of the cutaway
{
  let d = `M${P(FX0, FY0)}L${P(FX1, FY0)}`;
  for (let y = FY0, i = 0; y < FY1; y += 16, i++) d += `L${P(FX1 + (i % 2 ? -7 : 5), Math.min(y + 16, FY1))}`;
  d += `L${P(FX0, FY1)}`;
  for (let y = FY1, i = 0; y > FY0; y -= 16, i++) d += `L${P(FX0 + (i % 2 ? 7 : -5), Math.max(y - 16, FY0))}`;
  main.push(path(d + 'Z'));
}
// top plate in section
main.push(path(`M${P(FX0 + 4, 604)}L${P(FX1 - 4, 604)}M${P(FX0 + 4, 620)}L${P(FX1 - 4, 620)}`));
{
  let d = '';
  for (let x = FX0 + 10; x < FX1 - 10; x += 9) d += `M${P(x, 620)}L${P(x + 14, 604)}`;
  det.push(path(d));
}
const WL = [330, 770], WR = [670, 770], RW = 100, RP = 86;
const pinPh = 3; // degrees
for (const [cx, cy] of [WL, WR]) {
  main.push(circle(cx, cy, RW));
  main.push(circle(cx, cy, 20));
  let pins = [];
  for (let i = 0; i < 10; i++) { const [px, py] = pol(cx, cy, RP, (pinPh + 36 * i) * D2R); pins.push(circle(px, py, 5.5)); }
  det.push(...pins);
  let sp = '';
  for (let i = 0; i < 6; i++) {
    const a = (30 + 60 * i) * D2R, nx = -Math.sin(a), ny = Math.cos(a);
    for (const s of [-1, 1]) sp += `M${P(cx + Math.cos(a) * 22 + nx * 5 * s, cy + Math.sin(a) * 22 + ny * 5 * s)}L${P(cx + Math.cos(a) * 74 + nx * 7 * s, cy + Math.sin(a) * 74 + ny * 7 * s)}`;
  }
  det.push(path(sp));
  det.push(circle(cx, cy, 76));
  // axle in section: circle with hatch
  det.push(circle(cx, cy, 8));
  det.push(path(`M${P(cx - 5, cy + 5)}L${P(cx + 5, cy - 5)}M${P(cx - 7, cy + 1)}L${P(cx + 1, cy - 7)}M${P(cx - 1, cy + 7)}L${P(cx + 7, cy - 1)}`));
  // shadow side of the rim
  let h = '';
  for (let a = 20; a <= 150; a += 5) h += `M${PP(cx, cy, RW - 1, a * D2R)}L${PP(cx, cy, RW - 7, (a + 3) * D2R)}`;
  det.push(path(h));
}
// carry pin on the lower-order wheel (right) that lifts the sautoir
const liftA = -140 * D2R, LIFT = pol(WR[0], WR[1], 55, liftA);
det.push(circle(LIFT[0], LIFT[1], 6));
det.push(circle(...pol(WR[0], WR[1], 55, liftA + Math.PI), 6));
// posts / bearings standing on the bottom plate
main.push(path(`M${P(FX0 + 4, 890)}L${P(FX1 - 4, 890)}`));
{
  let d = '';
  for (let x = FX0 + 10; x < FX1 - 10; x += 9) d += `M${P(x, 904)}L${P(x + 12, 890)}`;
  det.push(path(d));
}

// the sautoir: pivots on the higher-order wheel's arbor, rests on the carry pin
{
  const [px, py] = WL, th = Math.atan2(LIFT[1] - py, LIFT[0] - px) + 0.02;
  const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
  const Q = (a, b) => P(px + ux * a + nx * b, py + uy * a + ny * b);
  const along = (LIFT[0] - px) * ux + (LIFT[1] - py) * uy;
  const perp = (LIFT[0] - px) * nx + (LIFT[1] - py) * ny; // pin sits below the arm
  const lip = perp - 6.5;
  // arm with boss at the pivot and a lip that rides on the carry pin
  acc.push(path(`M${Q(20, -11)}L${Q(along + 22, -9)}Q${Q(along + 34, -9)} ${Q(along + 34, 0)}L${Q(along + 34, lip)}L${Q(along + 10, lip)}L${Q(along - 4, 9)}L${Q(28, 11)}` +
    `A30 30 0 1 1 ${Q(20, -11)}Z`));
  // weight
  acc.push(path(`M${Q(150, 9)}L${Q(150, 56)}Q${Q(150, 64)} ${Q(158, 64)}L${Q(202, 64)}Q${Q(210, 64)} ${Q(210, 56)}L${Q(210, 9)}`));
  // pawl hinged on the arm, pushing a pin of the higher-order wheel
  const pinTarget = pol(px, py, RP, (pinPh + 36 * 10) * D2R); // pin at ~3 deg
  const hinge = [px + ux * 112 + nx * -4, py + uy * 112 + ny * -4];
  acc.push(path(`M${P(...hinge)}L${P(pinTarget[0] + 3, pinTarget[1] - 12)}Q${P(pinTarget[0] - 6, pinTarget[1] - 10)} ${P(pinTarget[0] - 6, pinTarget[1] - 3)}` +
    `L${P(pinTarget[0] + 1, pinTarget[1] - 7)}L${P(hinge[0] - 4, hinge[1] + 6)}`));
  // fall of the lever (sense of the carry)
  const [ex, ey] = pol(px, py, 215, th - 0.06);
  acc.push(path(arc(px, py, 215, (th - 0.24) * 180 / Math.PI, (th - 0.06) * 180 / Math.PI) + arrowHead(ex, ey, th - 0.06 + Math.PI / 2, 10)));
  det.push(path(`M${Q(180, 70)}L${P(515, 862)}`));
  // details on the lever
  det.push(circle(...hinge, 3.5));
  let s = `M${Q(64, -11)}`;
  for (let i = 1; i <= 6; i++) s += `L${Q(64 + i * 8, i % 2 ? -26 : -16)}`;
  det.push(path(s + `L${Q(118, -11)}`));
  let h = '';
  for (let a = 156; a < 206; a += 7) h += `M${Q(a, 14)}L${Q(a + 4, 58)}`;
  det.push(path(h));
  // swing construction: arc of the lever tip and the lift line
  con.push(path(arc(px, py, along + 20, (th - 0.22) * 180 / Math.PI, (th + 0.12) * 180 / Math.PI)));
  con.push(path(`M${P(px, py)}L${Q(along + 60, 0)}`));
}
con.push(path(cross(WL[0], WL[1], 118) + cross(WR[0], WR[1], 118)));
con.push(circle(WR[0], WR[1], 55));
con.push(circle(WL[0], WL[1], RP));
con.push(circle(WR[0], WR[1], RP));
con.push(dimLine(WL[0], 646, WR[0], 646));

// ---------------- labels ----------------
lbl.push(text(BX0, 98, 'FIG. I  PASCALINE', 'start', 20));
lbl.push(text(BX1, 98, 'ANNO 1642', 'end', 20));
lbl.push(text(FX0, 566, 'FIG. II  SAUTOIR', 'start', 20));
lbl.push(text(515, 882, 'PONDVS', 'middle', 16));
lbl.push(text(FX1 - 20, 646, 'CARRY 9 → 0', 'end', 16));

const g = (cls, sw, arr) => `<g class="${cls}"${sw ? ` stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` : ''}>\n${arr.join('\n')}\n</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
${g('L-con', 1.2, con)}
${g('L-main', 2.6, [...main.slice(0, 4), ...mainSpin, ...main.slice(4)])}
${g('L-detail', 1.3, [...detSpin, ...det])}
${g('L-acc', 3.6, acc)}
${g('L-lbl', 0, lbl)}
</svg>
`;
writeFileSync(fileURLToPath(new URL('../03-pascaline.svg', import.meta.url)), svg);
console.log('wrote 03-pascaline.svg', svg.length, 'bytes');
