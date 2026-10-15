// 01-abacus: counting frame (front elevation, oblique depth) + counting board plan.
// Plain Node, no deps, deterministic. Writes ../01-abacus.svg
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const r1 = (n) => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)},${r1(y)}`;
const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${typeof v === 'number' ? r1(v) : v}"`).join(' ');
const line = (x1, y1, x2, y2) => `<line ${attrs({ x1, y1, x2, y2 })}/>`;
const circle = (cx, cy, r) => `<circle ${attrs({ cx, cy, r })}/>`;
const rect = (x, y, width, height) => `<rect ${attrs({ x, y, width, height })}/>`;
const path = (d) => `<path d="${d}"/>`;
const text = (x, y, s, anchor = 'start', size = 20) =>
  `<text ${attrs({ x, y })} font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" text-anchor="${anchor}" fill="currentColor">${s}</text>`;

// dash-dot centre line as one path
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
function arrowHead(x, y, ang, s = 9) {
  const a1 = ang + Math.PI - 0.35, a2 = ang + Math.PI + 0.35;
  return `M${P(x + s * Math.cos(a1), y + s * Math.sin(a1))}L${P(x, y)}L${P(x + s * Math.cos(a2), y + s * Math.sin(a2))}`;
}
// dimension line with arrowheads (one path)
function dimLine(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  return path(`M${P(x1, y1)}L${P(x2, y2)}` + arrowHead(x2, y2, a) + arrowHead(x1, y1, a + Math.PI));
}

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------------- FIG. I : counting frame ----------------
const X0 = 130, Y0 = 120, X1 = 870, Y1 = 520; // outer front
const x0 = 170, y0 = 160, x1 = 830, y1 = 480; // inner opening
const DX = 22, DY = -16; // oblique depth
const beamT = 235, beamB = 255;
const rods = Array.from({ length: 9 }, (_, i) => x0 + 66 * (i + 1));
const digits = [3, 1, 4, 1, 5, 9, 2, 6, 5];
const CARRY = 5; // column caught mid-carry (9 -> 0, +1 to the left)

// construction
con.push(centreLine(500, 58, 500, 944));
con.push(centreLine(96, 320, 904, 320));
con.push(path(`M${P(X0, Y1 + 6)}L${P(X0, 566)}M${P(X1, Y1 + 6)}L${P(X1, 566)}`));
con.push(dimLine(X0, 560, X1, 560));
con.push(path(`M${P(X0 - 6, Y0)}L${P(92, Y0)}M${P(X0 - 6, Y1)}L${P(92, Y1)}`));
con.push(dimLine(100, Y0, 100, Y1));
// rod pitch dimension under the frame
con.push(path(`M${P(rods[0], Y1 + 4)}L${P(rods[0], 540)}M${P(rods[1], Y1 + 4)}L${P(rods[1], 540)}`));
con.push(dimLine(rods[0], 536, rods[1], 536));
// beam axis
con.push(line(X0 - 20, (beamT + beamB) / 2, X1 + 40, (beamT + beamB) / 2));

// main: frame silhouette first
main.push(rect(X0, Y0, X1 - X0, Y1 - Y0));
main.push(path(`M${P(X0, Y0)}L${P(X0 + DX, Y0 + DY)}L${P(X1 + DX, Y0 + DY)}L${P(X1 + DX, Y1 + DY)}L${P(X1, Y1)}M${P(X1, Y0)}L${P(X1 + DX, Y0 + DY)}`));
main.push(rect(x0, y0, x1 - x0, y1 - y0));
main.push(path(`M${P(x0, y1)}L${P(x0 + DX, y1 + DY)}L${P(x1, y1 + DY)}M${P(x0 + DX, y0)}L${P(x0 + DX, y1 + DY)}`));
// divider beam with its depth
main.push(rect(x0, beamT, x1 - x0, beamB - beamT));
main.push(path(`M${P(x0 + DX, beamT)}L${P(x0 + DX, beamT + DY + 2)}`));

function beadD(x, y) {
  // bicone bead in side view: a softened hexagon
  return `M${P(x - 28, y)}L${P(x - 17, y - 11)}Q${P(x - 14, y - 13)} ${P(x - 10, y - 13)}L${P(x + 10, y - 13)}Q${P(x + 14, y - 13)} ${P(x + 17, y - 11)}L${P(x + 28, y)}` +
    `L${P(x + 17, y + 11)}Q${P(x + 14, y + 13)} ${P(x + 10, y + 13)}L${P(x - 10, y + 13)}Q${P(x - 14, y + 13)} ${P(x - 17, y + 11)}Z`;
}
function beadHatch(x, y) {
  // equator ridge + engraved shading on the lower cone
  return `M${P(x - 27, y)}L${P(x + 27, y)}M${P(x - 21, y + 4.5)}L${P(x + 21, y + 4.5)}M${P(x - 16, y + 8.5)}L${P(x + 16, y + 8.5)}` +
    `M${P(x + 12, y - 9)}L${P(x + 20, y - 3)}`;
}

const upRest = y0 + 14, upSet = beamT - 14;
const loSet = (k) => beamB + 14 + 26 * k, loRest = (k) => y1 - 14 - 26 * (3 - k);

rods.forEach((x, i) => {
  const d = digits[i];
  let ys;
  if (i === CARRY) {
    ys = [(upRest + upSet) / 2, ...[0, 1, 2, 3].map((k) => (loSet(k) + loRest(k)) / 2)];
  } else {
    ys = [d >= 5 ? upSet : upRest, ...[0, 1, 2, 3].map((k) => (k < d % 5 ? loSet(k) : loRest(k)))];
  }
  // rod segments between beads and beam
  const blocks = [[beamT, beamB], ...ys.map((y) => [y - 13, y + 13])].sort((a, b) => a[0] - b[0]);
  let cur = y0, rodD = '';
  for (const [a, b] of blocks) { if (a - cur > 1) rodD += `M${P(x, cur)}L${P(x, a)}`; cur = Math.max(cur, b); }
  if (y1 - cur > 1) rodD += `M${P(x, cur)}L${P(x, y1)}`;
  main.push(path(rodD));
  const target = i === CARRY ? acc : main;
  ys.forEach((y) => target.push(path(beadD(x, y))));
  ys.forEach((y) => det.push(path(beadHatch(x, y))));
  if (i === CARRY) {
    // motion ticks: upper bead rising, lower beads falling
    det.push(path(`M${P(x - 34, ys[0] + 4)}L${P(x - 34, ys[0] + 16)}M${P(x + 34, ys[0] + 4)}L${P(x + 34, ys[0] + 16)}`));
    det.push(path(`M${P(x - 34, ys[1] - 26)}L${P(x - 34, ys[1] - 12)}M${P(x + 34, ys[1] - 26)}L${P(x + 34, ys[1] - 12)}` +
      `M${P(x - 38, ys[1] - 20)}L${P(x - 38, ys[1] - 10)}M${P(x + 38, ys[1] - 20)}L${P(x + 38, ys[1] - 10)}`));
  }
});
// carry arc: from the carry column over to its left neighbour
{
  const xa = rods[CARRY], xb = rods[CARRY - 1];
  acc.push(path(`M${P(xa, 92)}C${P(xa, 40)} ${P(xb, 40)} ${P(xb, 90)}` + arrowHead(xb, 90, Math.PI / 2, 12)));
}

// detail: frame shading, grain, pegs, beam dots
{
  let d = '';
  for (let y = Y0 + 8; y < Y1 + DY; y += 9) d += `M${P(X1 + 3, y + 4)}L${P(X1 + DX - 3, y + 4 + DY * (DX - 6) / DX)}`;
  det.push(path(d));
  d = '';
  for (let y = y0 + 10; y < y1 - 6; y += 10) d += `M${P(x0 + 3, y + 6)}L${P(x0 + DX - 4, y + 6 + DY * (DX - 7) / DX)}`;
  det.push(path(d));
  d = '';
  for (let x = x0 + DX + 6; x < x1 - 2; x += 12) d += `M${P(x, y1 - 2)}L${P(x + 10, y1 + DY + 2)}`;
  det.push(path(d));
  // top face hatch (light)
  d = '';
  for (let x = X0 + 14; x < X1 + 8; x += 18) d += `M${P(x, Y0 - 2)}L${P(x + DX - 8, Y0 + DY + 4)}`;
  det.push(path(d));
  // wood grain on the rails
  const grain = (ya, yb, ph) => {
    let g = '';
    [ya, yb].forEach((yy, j) => {
      g += `M${P(X0 + 20, yy)}`;
      for (let x = X0 + 60; x <= X1 - 20; x += 80) g += `Q${P(x - 20, yy + (j ? -3 : 3) * Math.sin(x * 0.02 + ph))} ${P(x, yy)}`;
    });
    return path(g);
  };
  det.push(grain(Y0 + 12, Y0 + 28, 0));
  det.push(grain(Y1 - 28, Y1 - 12, 1.7));
  // corner pegs (tenon pins)
  [[150, 140], [850, 140], [150, 500], [850, 500]].forEach(([x, y]) => { det.push(circle(x, y, 5)); det.push(circle(x, y, 1.5)); });
  // beam unit dots, every third rod
  [1, 4, 7].forEach((i) => det.push(circle(rods[i], (beamT + beamB) / 2, 2.5)));
  // beam hatch
  d = '';
  for (let x = x0 + 8; x < x1 - 4; x += 14) d += `M${P(x, beamB - 2)}L${P(x + 8, beamT + 2)}`;
  det.push(path(d));
}

// ---------------- FIG. II : counting board (plan) ----------------
const bx0 = 170, by0 = 610, bx1 = 830, by1 = 880;
const ix0 = 188, iy0 = 628, ix1 = 812, iy1 = 862;
const lines = [rods[1], rods[3], rods[5], rods[7]]; // M C X I
const spaces = [(lines[0] + lines[1]) / 2, (lines[1] + lines[2]) / 2, (lines[2] + lines[3]) / 2]; // D L V
const divY = 730, lineTop = 664, lineBot = 850;

main.push(rect(bx0, by0, bx1 - bx0, by1 - by0));
main.push(rect(ix0, iy0, ix1 - ix0, iy1 - iy0));
main.push(line(ix0, divY, ix1, divY));

// value MDCCXLII = 1742
const onLine = [1, 2, 4, 2];
const onSpace = [1, 0, 0];
const pebbles = [];
lines.forEach((x, i) => { for (let k = 0; k < onLine[i]; k++) pebbles.push([x, 830 - 28 * k, true]); });
spaces.forEach((x, i) => { for (let k = 0; k < onSpace[i]; k++) pebbles.push([x, 694, false]); });

lines.forEach((x) => {
  const blocks = pebbles.filter((p) => p[0] === x).map((p) => [p[1] - 13, p[1] + 13]).sort((a, b) => a[0] - b[0]);
  let cur = lineTop, d = '';
  for (const [a, b] of blocks) { if (a - cur > 1) d += `M${P(x, cur)}L${P(x, a)}`; cur = b; }
  d += `M${P(x, cur)}L${P(x, lineBot)}`;
  main.push(path(d));
});
pebbles.forEach(([x, y]) => main.push(circle(x, y, 12)));
pebbles.forEach(([x, y]) => det.push(path(`M${P(x - 6, y - 4)}A7 7 0 0 1 ${P(x - 1, y - 8)}` +
  `M${P(x + 4, y + 10)}L${P(x + 10, y + 4)}M${P(x - 1, y + 11)}L${P(x + 11, y - 1)}M${P(x - 6, y + 10)}L${P(x + 10, y - 6)}`)));
// Salamis-style crosses on the divider
lines.forEach((x) => det.push(path(`M${P(x - 5, divY - 5)}L${P(x + 5, divY + 5)}M${P(x + 5, divY - 5)}L${P(x - 5, divY + 5)}`)));
spaces.forEach((x) => det.push(path(`M${P(x, divY + 8)}L${P(x, divY + 20)}`)));
// shadowed border band (bottom + right), diagonal engraving
{
  let d = '';
  for (let x = bx0 + 10; x < bx1; x += 9) d += `M${P(x, by1 - 2)}L${P(x + 14, iy1 + 2)}`;
  det.push(path(d));
  d = '';
  for (let y = by0 + 10; y < iy1; y += 9) d += `M${P(ix1 + 2, y + 14)}L${P(bx1 - 2, y)}`;
  det.push(path(d));
}
// projection lines from the frame rods to the board lines
con.push(path(lines.map((x) => `M${P(x, Y1 + 8)}L${P(x, by0 - 6)}`).join('')));
con.push(centreLine(bx0 - 30, (by0 + by1) / 2 + 20, bx1 + 30, (by0 + by1) / 2 + 20, [18, 5, 3, 5]));
// corner diagonals of the board (surveyor construction)
con.push(path(`M${P(bx0, by1)}L${P(bx0 - 22, by1 + 22)}M${P(bx1, by1)}L${P(bx1 + 22, by1 + 22)}`));

// labels
lbl.push(text(X0, 592, 'FIG. I  ABACVS', 'start', 18));
lbl.push(text(X1 + DX, 592, 'FIG. II  TABVLA', 'end', 18));
['M', 'C', 'X', 'I'].forEach((s, i) => lbl.push(text(lines[i], 654, s, 'middle', 22)));
lbl.push(text(500, 916, 'SVMMA MDCCXLII', 'middle', 18));
lbl.push(text(500, 576, 'PES II', 'middle', 16));

const g = (cls, sw, arr) => `<g class="${cls}"${sw ? ` stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` : ''}>\n${arr.join('\n')}\n</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
${g('L-con', 1.2, con)}
${g('L-main', 2.6, main)}
${g('L-detail', 1.3, det)}
${g('L-acc', 3.6, acc)}
${g('L-lbl', 0, lbl)}
</svg>
`;
writeFileSync(fileURLToPath(new URL('../01-abacus.svg', import.meta.url)), svg);
console.log('wrote 01-abacus.svg', svg.length, 'bytes');
