// 04-jacquard: FIG. I side elevation of a Jacquard head: the square prism with its hinged card
// chain, eight needles reading one row of the card, hooks lifted (hole) or pushed off the griffe
// knife (blank), neck cords and harness running down to the mails and warp ends.
// FIG. II: face view of the card chain (four laced cards, a lozenge brocade motif as data),
// with the row the needles are reading marked.
// Plain Node, no deps, deterministic. Writes ../04-jacquard.svg
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
function arrowHead(x, y, ang, s = 9) {
  const a1 = ang + Math.PI - 0.35, a2 = ang + Math.PI + 0.35;
  return `M${P(x + s * Math.cos(a1), y + s * Math.sin(a1))}L${P(x, y)}L${P(x + s * Math.cos(a2), y + s * Math.sin(a2))}`;
}
function dimLine(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  return path(`M${P(x1, y1)}L${P(x2, y2)}` + arrowHead(x2, y2, a, 8) + arrowHead(x1, y1, a + Math.PI, 8));
}
function centreLine(x1, y1, x2, y2, pat = [22, 5, 3, 5]) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  let d = '', t = 0, i = 0;
  while (t < L) {
    const seg = Math.min(pat[i % pat.length], L - t);
    if (i % 2 === 0) d += `M${P(x1 + ux * t, y1 + uy * t)}L${P(x1 + ux * (t + seg), y1 + uy * (t + seg))}`;
    t += seg; i++;
  }
  return path(d);
}
const dot = (x, y, r) => `M${P(x - r, y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------- punch data: lozenge brocade, one card per pick ----------
const ROWS = 8, COLS = 40, NCARDS = 4;
function punched(c, i, j) {
  const y = c * ROWS + i, x = j;
  const a = Math.abs(((x + 4) % 14) - 7) + Math.abs(((y + 3) % 14) - 7);
  return a <= 2 || a === 5 || (a >= 9 && (x + y) % 2 === 0);
}
const READ_CARD = 0;
// pick the column with the most even mix of holes and blanks (deterministic)
const READ_COL = [...Array(14)].map((_, k) => k + 9).sort((a, b) => {
  const cnt = (j) => [...Array(ROWS)].filter((_, i) => punched(READ_CARD, i, j)).length;
  const alt = (j) => [...Array(ROWS - 1)].filter((_, i) => punched(READ_CARD, i, j) !== punched(READ_CARD, i + 1, j)).length;
  return (Math.abs(cnt(a) - 4) - alt(a) * 0.5) - (Math.abs(cnt(b) - 4) - alt(b) * 0.5) || a - b;
})[0];
const holeAt = (i) => punched(READ_CARD, i, READ_COL);

// ---------- FIG. I : side elevation ----------
const DXo = 70; // horizontal offset of the whole figure
const X = (x) => x + DXo;
const PR = { x0: X(210), y0: 250, s: 100 };
const TL = [PR.x0, PR.y0], TR = [PR.x0 + PR.s, PR.y0], BR = [PR.x0 + PR.s, PR.y0 + PR.s];
const ax = [PR.x0 + 50, PR.y0 + 50];
const rowY = (i) => PR.y0 + 11.5 + 11 * i;
const hookX = (i) => X(405) + 29 * i;
const NEEDLE_R = X(730);
const SB = { x0: X(668), x1: X(724) }; // spring box
const GRIFFE_Y = 150, BOARD_Y = 400, COMBER_Y = 440, MAIL_Y = 500;
const add = (p, a, L) => [p[0] + L * Math.cos(a * D2R), p[1] + L * Math.sin(a * D2R)];

// construction
con.push(centreLine(ax[0] - 80, ax[1], NEEDLE_R + 30, ax[1]));
con.push(centreLine(ax[0], ax[1] - 90, ax[0], ax[1] + 80));
con.push(circle(ax[0], ax[1], 70.7));
{
  const R = 84, a0 = -160, a1 = -112;
  const e = add(ax, a1, R);
  con.push(path(`M${P(...add(ax, a0, R))}A${R} ${R} 0 0 1 ${P(...e)}` + arrowHead(...e, (a1 + 90) * D2R, 8)));
}
con.push(path(`M${P(TR[0], TR[1] - 6)}L${P(TR[0], 214)}M${P(TL[0], TL[1] - 6)}L${P(TL[0], 214)}`));
con.push(dimLine(TL[0], 222, TR[0], 222));
// griffe lift and needle travel
con.push(path(`M${P(hookX(7) + 40, GRIFFE_Y + 40)}L${P(hookX(7) + 40, GRIFFE_Y - 8)}` + arrowHead(hookX(7) + 40, GRIFFE_Y - 8, -Math.PI / 2, 8)));
con.push(path(`M${P(hookX(0) - 12, rowY(0))}L${P(hookX(0) - 12, BOARD_Y + 60)}`));
// projection from the reading face down to FIG. II
con.push(path(`M${P(TR[0] + 1, BR[1] + 6)}L${P(TR[0] + 1, 596)}`));

// prism with end flange and batten
main.push(rect(PR.x0, PR.y0, PR.s, PR.s));
main.push(rect(PR.x0 + 12, PR.y0 + 12, PR.s - 24, PR.s - 24, 3));
main.push(circle(ax[0], ax[1], 12));
main.push(circle(ax[0], ax[1], 22));
{
  const piv = [X(120), 110];
  const a = Math.atan2(piv[1] - ax[1], piv[0] - ax[0]), nx = -Math.sin(a) * 9, ny = Math.cos(a) * 9;
  const s0 = add(ax, a / D2R, 14), s1 = add(piv, a / D2R + 180, 14);
  main.push(path(`M${P(s0[0] + nx, s0[1] + ny)}L${P(s1[0] + nx, s1[1] + ny)}M${P(s0[0] - nx, s0[1] - ny)}L${P(s1[0] - nx, s1[1] - ny)}`));
  main.push(circle(...piv, 16));
  det.push(circle(...piv, 5));
  det.push(circle(ax[0], ax[1], 4.5));
  let h = '';
  for (let t = 0.1; t < 0.92; t += 0.06) {
    const x = s0[0] + (s1[0] - s0[0]) * t, y = s0[1] + (s1[1] - s0[1]) * t;
    h += `M${P(x - nx * 0.7, y - ny * 0.7)}L${P(x - nx * 0.7 + Math.cos(a) * 9, y - ny * 0.7 + Math.sin(a) * 9)}`;
  }
  det.push(path(h));
}
// flange hatch (lower right) and locating pegs at the corners
{
  let h = '';
  for (let k = 14; k < 100; k += 8) h += `M${P(BR[0] - k, BR[1] - 2)}L${P(BR[0] - 2, BR[1] - k)}`;
  det.push(path(h));
  [[TL[0] + 6, TL[1] + 6], [TR[0] - 6, TR[1] + 6], [BR[0] - 6, BR[1] - 6], [PR.x0 + 6, BR[1] - 6]].forEach(([x, y]) => det.push(circle(x, y, 2.6)));
  // bored holes in the reading face, one per needle row
  let b = '';
  for (let i = 0; i < ROWS; i++) b += `M${P(TR[0] - 1, rowY(i) - 3)}L${P(TR[0] - 16, rowY(i) - 3)}M${P(TR[0] - 1, rowY(i) + 3)}L${P(TR[0] - 16, rowY(i) + 3)}`;
  det.push(path(b));
}
// card chain in profile: L2, L1 hang at left, T over the top, R on the reading face, D1, D2 hang below
const L1 = add(TL, 106, 100), L2 = add(L1, 96, 100);
const D1 = add(BR, 96, 100), D2 = add(D1, 118, 100);
[[L2, L1], [L1, TL], [TL, TR]].forEach(([a, b]) => main.push(path(`M${P(...a)}L${P(...b)}`)));
acc.push(path(`M${P(TR[0] + 2, TR[1])}L${P(BR[0] + 2, BR[1])}`));
[[BR, D1], [D1, D2]].forEach(([a, b]) => main.push(path(`M${P(...a)}L${P(...b)}`)));
[L2, L1, TL, TR, BR, D1, D2].forEach((p) => det.push(circle(p[0], p[1], 3.2)));
// hole marks along the profile of the hanging cards (edge-on perforations)
{
  let d = '';
  for (const [a, b] of [[L2, L1], [L1, TL], [BR, D1], [D1, D2]]) {
    const ux = (b[0] - a[0]) / 100, uy = (b[1] - a[1]) / 100, nx = -uy, ny = ux;
    for (let t = 12; t < 96; t += 11) d += `M${P(a[0] + ux * t + nx * 3, a[1] + uy * t + ny * 3)}L${P(a[0] + ux * t - nx * 3, a[1] + uy * t - ny * 3)}`;
  }
  det.push(path(d));
}

// needle board, spring box, bottom board, griffe
main.push(rect(X(356), PR.y0 - 6, 10, PR.s + 12));
main.push(rect(SB.x0, PR.y0 - 6, SB.x1 - SB.x0, PR.s + 12));
main.push(rect(X(372), BOARD_Y, hookX(7) + 26 - X(372), 10));
main.push(rect(X(372), GRIFFE_Y - 44, hookX(7) + 26 - X(372), 10));
main.push(rect(X(350), COMBER_Y, hookX(7) + 40 - X(350), 8));
// griffe lifting rod and its lever
{
  const gx = (X(372) + hookX(7) + 26) / 2;
  main.push(path(`M${P(gx - 4, GRIFFE_Y - 44)}L${P(gx - 4, 92)}M${P(gx + 4, GRIFFE_Y - 44)}L${P(gx + 4, 92)}`));
  main.push(path(`M${P(gx - 90, 86)}L${P(gx + 120, 80)}L${P(gx + 120, 90)}L${P(gx - 90, 96)}Z`));
  det.push(circle(gx, 88, 3));
  det.push(circle(gx - 80, 91, 5));
}
// hooks: upright and caught by the griffe knife where the needle found a hole,
// pushed off the knife (and left down) where the card was blank
const hooks = [];
for (let i = 0; i < ROWS; i++) {
  const hole = holeAt(i), dx = hole ? 0 : 15, lift = hole ? -26 : 0;
  const x = hookX(i) + dx, top = GRIFFE_Y + 12 + lift, bot = BOARD_Y - 2 + lift;
  hooks.push({ x, top, bot, lift, dx });
  main.push(path(`M${P(x, bot)}L${P(x, top)}Q${P(x, top - 9)} ${P(x - 7, top - 9)}L${P(x - 11, top - 3)}`));
}
// griffe knives (blades in section), needle loops around the hooks, springs, cords
{
  let k = '';
  for (let i = 0; i < ROWS; i++) {
    const x = hookX(i) - 8, y = GRIFFE_Y - 6;
    k += `M${P(x - 4, y)}L${P(x + 3, y)}L${P(x + 1, y + 16)}L${P(x - 4, y + 16)}ZM${P(x - 1, y)}L${P(x - 1, GRIFFE_Y - 34)}`;
  }
  det.push(path(k));
  let loops = '', springs = '';
  for (let i = 0; i < ROWS; i++) {
    const h = hooks[i], y = rowY(i);
    loops += `M${P(h.x - 5, y)}a5 3.6 0 1 0 10 0a5 3.6 0 1 0 -10 0`;
    let s = `M${P(SB.x0 + 6 + (h.dx ? 0 : 0), y)}`;
    const x0 = SB.x0 + 6, x1 = SB.x1 - 8 + (h.dx ? 0 : -8);
    const n = 7;
    for (let q = 1; q <= n; q++) s += `L${P(x0 + ((x1 - x0) * q) / n, y + (q % 2 ? -3.5 : 3.5))}`;
    springs += s;
  }
  det.push(path(loops));
  det.push(path(springs));
  // board hatching
  let h = '';
  for (let x = X(376); x < hookX(7) + 24; x += 8) h += `M${P(x, BOARD_Y + 10)}L${P(x + 8, BOARD_Y)}M${P(x, GRIFFE_Y - 34)}L${P(x + 8, GRIFFE_Y - 44)}`;
  det.push(path(h));
  h = '';
  for (let x = X(354); x < hookX(7) + 38; x += 8) h += `M${P(x, COMBER_Y + 8)}L${P(x + 7, COMBER_Y)}`;
  det.push(path(h));
  // spring box end-grain
  h = '';
  for (let y = PR.y0; y < PR.y0 + PR.s + 4; y += 9) h += `M${P(SB.x1 - 4, y + 6)}L${P(SB.x1 - 1, y)}`;
  det.push(path(h));
}
// needles: the one row being read (accent)
{
  let d = '';
  for (let i = 0; i < ROWS; i++) {
    const tip = holeAt(i) ? TR[0] - 14 : TR[0] + 4;
    const tail = holeAt(i) ? SB.x1 - 10 : SB.x1 - 2;
    d += `M${P(tip, rowY(i))}L${P(tail, rowY(i))}`;
  }
  acc.push(path(d));
}
// neck cords, comber board, harness to the mails, warp ends, lingoes
{
  let neck = '', harn = '', mails = '', warp = '', ling = '';
  for (let i = 0; i < ROWS; i++) {
    const h = hooks[i], mx = X(392) + 28 * i, my = MAIL_Y + h.lift;
    neck += `M${P(h.x, h.bot)}L${P(h.x, BOARD_Y + 12)}L${P(hookX(i), COMBER_Y)}`;
    harn += `M${P(hookX(i), COMBER_Y + 8)}L${P(mx, my - 8)}M${P(mx, my + 8)}L${P(mx, my + 34)}`;
    mails += `M${P(mx, my - 8)}L${P(mx + 3.5, my - 4)}L${P(mx + 3.5, my + 4)}L${P(mx, my + 8)}L${P(mx - 3.5, my + 4)}L${P(mx - 3.5, my - 4)}Z`;
    warp += dot(mx, my, 1.8);
    ling += `M${P(mx - 2, my + 34)}L${P(mx - 2, my + 54)}L${P(mx + 2, my + 54)}L${P(mx + 2, my + 34)}Z`;
  }
  det.push(path(neck));
  det.push(path(harn));
  main.push(path(mails));
  det.push(path(warp));
  con.push(line(X(372), MAIL_Y, hookX(7) + 24, MAIL_Y));
  con.push(line(X(372), MAIL_Y - 26, hookX(7) + 24, MAIL_Y - 26));
  det.push(path(ling));
}

// ---------- FIG. II : face view of the laced card chain ----------
const CX0 = 130, CX1 = 870, CH = 68, CG = 9, CY0 = 610;
const colX = (j) => CX0 + 58 + ((CX1 - CX0 - 116) / (COLS - 1)) * j;
const cardRowY = (c, i) => CY0 + c * (CH + CG) + 7.4 + 7.6 * i;
for (let c = 0; c < NCARDS; c++) main.push(rect(CX0, CY0 + c * (CH + CG), CX1 - CX0, CH, 4));
for (let c = 0; c < NCARDS; c++) {
  for (let i = 0; i < ROWS; i++) {
    let d = '';
    for (let j = 0; j < COLS; j++) {
      if (!punched(c, i, j)) continue;
      if (c === READ_CARD && j === READ_COL) continue;
      d += dot(colX(j), cardRowY(c, i), 2.8);
    }
    det.push(path(d));
  }
  // peg holes and lacing
  const y0 = CY0 + c * (CH + CG);
  det.push(path(dot(CX0 + 24, y0 + CH / 2, 6) + dot(CX1 - 24, y0 + CH / 2, 6)));
  if (c < NCARDS - 1) {
    let l = '';
    for (let x = CX0 + 60; x < CX1 - 40; x += 128) {
      l += `M${P(x - 6, y0 + CH - 5)}L${P(x + 6, y0 + CH + CG + 5)}M${P(x + 6, y0 + CH - 5)}L${P(x - 6, y0 + CH + CG + 5)}`;
    }
    det.push(path(l));
  }
}
// the row the needles are reading (same eight positions as the needles in FIG. I)
{
  let d = '';
  for (let i = 0; i < ROWS; i++) if (holeAt(i)) d += dot(colX(READ_COL), cardRowY(READ_CARD, i), 2.8);
  acc.push(path(d));
  const x = colX(READ_COL), y0 = CY0 - 4, y1 = CY0 + CH + 4;
  acc.push(path(`M${P(x - 8, y0)}L${P(x + 8, y0)}L${P(x + 8, y1)}L${P(x - 8, y1)}Z`));
  con.push(path(`M${P(x, CY0 - 8)}L${P(x, 586)}L${P(TR[0] + 1, 586)}`));
}
con.push(dimLine(CX0, 924, CX1, 924));
con.push(path(`M${P(CX0, CY0 + NCARDS * (CH + CG))}L${P(CX0, 930)}M${P(CX1, CY0 + NCARDS * (CH + CG))}L${P(CX1, 930)}`));

// leaders
det.push(path(`M${P(hookX(7) + 20, GRIFFE_Y - 38)}L${P(X(760), 128)}L${P(X(772), 128)}`));
det.push(path(`M${P(SB.x1 + 2, rowY(2))}L${P(X(760), 214)}L${P(X(772), 214)}`));
det.push(path(`M${P(X(392) + 28 * 7 + 6, MAIL_Y)}L${P(X(760), 500)}L${P(X(772), 500)}`));

// labels
lbl.push(text(90, 80, 'FIG. I  JACQVARD', 'start', 20));
lbl.push(text(910, 80, 'ANNO 1804', 'end', 20));
lbl.push(text(X(778), 134, 'HAMI', 'start', 18));
lbl.push(text(X(778), 220, 'ACVS', 'start', 18));
lbl.push(text(X(778), 506, 'STAMINA', 'start', 18));
lbl.push(text(CX0, 596, 'FIG. II  CHARTAE', 'start', 18));

const g = (cls, sw, arr) => `<g class="${cls}"${sw ? ` stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` : ''}>\n${arr.join('\n')}\n</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
${g('L-con', 1.2, con)}
${g('L-main', 2.6, main)}
${g('L-detail', 1.3, det)}
${g('L-acc', 3.6, acc)}
${g('L-lbl', 0, lbl)}
</svg>
`;
writeFileSync(fileURLToPath(new URL('../04-jacquard.svg', import.meta.url)), svg);
console.log('wrote 04-jacquard.svg', svg.length, 'bytes', 'read column holes:', [...Array(ROWS)].map((_, i) => (holeAt(i) ? 'o' : '.')).join(''));
