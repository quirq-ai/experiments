// 06-note-g: Ada Lovelace, Note G (1843). The Bernoulli-number table as an
// engraved plate: operations 13 to 23 (the repeated block), with the loop
// bracket returning from 23 to 13. Deterministic; run with plain node.
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
const text = (x, y, s, size = 16, anchor = 'middle', ls = 2) =>
  `<text x="${r(x)}" y="${r(y)}" font-family="JetBrains Mono" font-size="${size}" letter-spacing="${ls}" text-anchor="${anchor}" fill="currentColor">${s}</text>`;
const L = { con: [], main: [], detail: [], acc: [], lbl: [] };
function write(name) {
  const W = { con: 1.2, main: 2.6, detail: 1.3, acc: 3.6 };
  const g = (k) => `  <g class="L-${k}"${W[k] ? ` stroke-width="${W[k]}"` : ''}>\n    ${L[k].join('\n    ')}\n  </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">\n${['con', 'main', 'detail', 'acc', 'lbl'].map(g).join('\n')}\n</svg>\n`;
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', name);
  writeFileSync(out, svg);
  console.log('wrote', out, svg.length, 'bytes');
}

// ---------- table geometry ----------
const X0 = 98;
const WID = [50, 44, 112, 60, 72, 126, ...Array(10).fill(30)];
const XE = [X0];
for (const w of WID) XE.push(XE[XE.length - 1] + w);
const X1 = XE[XE.length - 1];                       // 862
const mid = (i) => (XE[i] + XE[i + 1]) / 2;
const vcol = (v) => 6 + (v - 1);                    // column index of V1..V10

const T_TOP = 140, H_BOT = 206, STUB = 28, RH = 58;
const R0 = H_BOT + 6 + STUB;                        // first data row top
const ROWS = [
  ['13', '-', 'V6-V1', 'V6', '2N-1', [6, 1], 6],
  ['14', '+', 'V1+V7', 'V7', '2+1=3', [1, 7], 7],
  ['15', '÷', 'V6÷V7', 'V8', '(2N-1)/3', [6, 7], 8],
  ['16', '×', 'V8×V11', 'V11', 'A1(2N-1)/3', [8], 0],
  ['17', '-', 'V6-V1', 'V6', '2N-2', [6, 1], 6],
  ['18', '+', 'V1+V7', 'V7', '3+1=4', [1, 7], 7],
  ['19', '÷', 'V6÷V7', 'V9', '(2N-2)/4', [6, 7], 9],
  ['20', '×', 'V9×V11', 'V11', 'A3', [9], 0],
  ['21', '×', 'V22×V11', 'V12', 'B3A3', [], 0],
  ['22', '+', 'V12+V13', 'V13', 'A0+..+B3A3', [], 0],
  ['23', '-', 'V10-V1', 'V10', 'N-3', [10, 1], 10],
];
const RB = R0 + ROWS.length * RH;                   // last data row bottom
const T_BOT = RB + STUB;
const rowMid = (i) => R0 + i * RH + RH / 2;

// ---------- L-con ----------
L.con.push(line(X0, 96, X0, T_BOT + 14), line(X1, 96, X1, T_BOT + 14));   // extended margins
L.con.push(line(72, T_TOP, X1 + 12, T_TOP), line(72, T_BOT + 6, X1 + 12, T_BOT + 6));
L.con.push(line(X0 - 18, 124, X1 + 18, 124));                           // title baseline guide
for (let i = 0; i <= ROWS.length; i++) L.con.push(line(72, R0 + i * RH, 82, R0 + i * RH)); // row ticks
L.con.push(line(77, R0, 77, RB));                                        // left dimension of the block
L.con.push(line(X0 - 14, T_TOP - 14, X0, T_TOP), line(X1 + 14, T_TOP - 14, X1, T_TOP)); // corner marks
L.con.push(line(XE[6], 128, XE[6], T_TOP), line(X1, 128, X1, T_TOP));  // span of working variables
L.con.push(line(XE[6], 132, X1, 132));
L.con.push(pathEl(d('M', XE[6] + 10, 128, 'L', XE[6], 132, 'L', XE[6] + 10, 136)));
L.con.push(pathEl(d('M', X1 - 10, 128, 'L', X1, 132, 'L', X1 - 10, 136)));

// ---------- L-main: ruling ----------
L.main.push(rect(X0, T_TOP, X1 - X0, T_BOT + 6 - T_TOP));                // outer border
L.main.push(line(X0, T_TOP + 6, X1, T_TOP + 6));                         // double top rule
L.main.push(line(X0, H_BOT, X1, H_BOT), line(X0, H_BOT + 6, X1, H_BOT + 6)); // header double rule
L.main.push(line(X0, T_BOT, X1, T_BOT));                                  // double bottom rule
for (let i = 1; i < XE.length - 1; i++) L.main.push(line(XE[i], T_TOP + 6, XE[i], T_BOT)); // column rules
for (let i = 0; i <= ROWS.length; i++) L.main.push(line(X0, R0 + i * RH, X1, R0 + i * RH)); // row rules
// torn continuation lines (operations 1-12 above, 24-25 below)
const wave = (y) => {
  const pts = [];
  for (let x = X0; x <= X1; x += 4) pts.push([x, y + 4 * Math.sin((x - X0) / 11)]);
  return 'M' + pts.map((p) => r(p[0]) + ' ' + r(p[1])).join(' L');
};
L.main.push(pathEl(wave(H_BOT + 6 + STUB / 2)), pathEl(wave(RB + STUB / 2)));

// ---------- L-detail ----------
// operator glyphs for the Nature of Operation column
const glyph = (op, cx, cy, s) => {
  if (op === '-') return pathEl(d('M', cx - s, cy, 'L', cx + s, cy));
  if (op === '+') return pathEl(d('M', cx - s, cy, 'L', cx + s, cy, 'M', cx, cy - s, 'L', cx, cy + s));
  if (op === '×') return pathEl(d('M', cx - s * 0.75, cy - s * 0.75, 'L', cx + s * 0.75, cy + s * 0.75, 'M', cx + s * 0.75, cy - s * 0.75, 'L', cx - s * 0.75, cy + s * 0.75));
  const q = Math.max(1.4, s * 0.2), o = s * 0.62;
  return pathEl(d('M', cx - s, cy, 'L', cx + s, cy, 'M', cx - q, cy - o, 'A', q, q, 0, 1, 0, cx + q, cy - o, 'A', q, q, 0, 1, 0, cx - q, cy - o, 'M', cx - q, cy + o, 'A', q, q, 0, 1, 0, cx + q, cy + o, 'A', q, q, 0, 1, 0, cx - q, cy + o));
};
// header of the nature column: the four operations in a 2x2 cluster
{
  const cx = mid(1), cy = (T_TOP + H_BOT) / 2 + 3;
  L.detail.push(glyph('+', cx - 10, cy - 11, 6), glyph('-', cx + 10, cy - 11, 6), glyph('×', cx - 10, cy + 11, 6), glyph('÷', cx + 10, cy + 11, 6));
}
ROWS.forEach((row, i) => {
  const y = rowMid(i);
  L.detail.push(glyph(row[1], mid(1), y, 9));
  // indication of change: a small arrow, value passes from one state to the next
  const cx = mid(4);
  L.detail.push(pathEl(d('M', cx - 20, y - 6, 'L', cx - 20, y + 6, 'M', cx - 20, y, 'L', cx + 16, y, 'M', cx + 9, y - 5, 'L', cx + 16, y, 'L', cx + 9, y + 5)));
  // working variables: acted upon = short value stroke, receiving = ringed cell
  for (const v of row[5]) L.detail.push(line(mid(vcol(v)) - 7, y, mid(vcol(v)) + 7, y));
  if (row[6]) L.detail.push(circle(mid(vcol(row[6])), y, 9));
});
// hatching in the torn stubs (engraved shading of omitted rows)
for (const [ya, yb] of [[H_BOT + 6, R0], [RB, T_BOT]]) {
  const h = [];
  for (let x = X0 + 4; x < X1 - 10; x += 10) h.push(d('M', x, yb - 3, 'L', x + 8, ya + 3));
  L.detail.push(pathEl(h.join(' ')));
}
// iteration ticks along the loop bracket (one per operation in the cycle)
for (let i = 0; i < ROWS.length; i++) L.detail.push(line(X1 + 36, rowMid(i), X1 + 52, rowMid(i)));
// leader from the bracket to the returning arrow
L.detail.push(line(X1 + 4, rowMid(0), X1 + 20, rowMid(0)));

// ---------- L-acc: the loop (repeat operations 13 to 23) ----------
{
  const yA = rowMid(ROWS.length - 1), yB = rowMid(0), xR = X1 + 45;
  L.acc.push(pathEl(d('M', X1 + 6, yA, 'L', xR - 14, yA, 'Q', xR, yA, xR, yA - 14, 'L', xR, yB + 14, 'Q', xR, yB, xR - 14, yB, 'L', X1 + 8, yB)));
  L.acc.push(pathEl(d('M', X1 + 20, yB - 8, 'L', X1 + 6, yB, 'L', X1 + 20, yB + 8)));
  L.acc.push(circle(X1 + 6, yA, 4));
}

// ---------- L-lbl: header + cells (60 texts max) ----------
L.lbl.push(text((X0 + X1) / 2, 116, 'NOTE G', 22, 'middle', 6));
const HY = (T_TOP + H_BOT) / 2 + 8;
L.lbl.push(text(mid(0), HY, 'NO.', 14));
L.lbl.push(text(mid(2), HY, 'ACTED', 14));
L.lbl.push(text(mid(3), HY, 'RECVD', 14, 'middle', 1));
L.lbl.push(text(mid(4), HY, 'CHANGE', 14, 'middle', 1));
L.lbl.push(text(mid(5), HY, 'RESULT', 14));
for (let v = 1; v <= 10; v++) L.lbl.push(text(mid(vcol(v)), HY, 'V' + v, 13, 'middle', v === 10 ? 0 : 1));
ROWS.forEach((row, i) => {
  const y = rowMid(i) + 6;
  L.lbl.push(text(mid(0), y, row[0], 17));
  L.lbl.push(text(mid(2), y, row[2], 15, 'middle', 1));
  L.lbl.push(text(mid(3), y, row[3], 15, 'middle', 1));
  L.lbl.push(text(mid(5), y, row[4], 14, 'middle', 1));
});

write('06-note-g.svg');
