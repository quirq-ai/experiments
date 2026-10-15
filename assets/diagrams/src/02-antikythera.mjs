// 02-antikythera: front elevation of the main gear train, front dial ring fragment,
// and a magnified inset of the pin-and-slot lunar gear pair (k1/k2).
// Plain Node, no deps, deterministic. Writes ../02-antikythera.svg
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const r1 = (n) => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)},${r1(y)}`;
const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${typeof v === 'number' ? r1(v) : v}"`).join(' ');
const line = (x1, y1, x2, y2) => `<line ${attrs({ x1, y1, x2, y2 })}/>`;
const circle = (cx, cy, r) => `<circle ${attrs({ cx, cy, r })}/>`;
const path = (d) => `<path d="${d}"/>`;
const text = (x, y, s, anchor = 'start', size = 20) =>
  `<text ${attrs({ x, y })} font-family="JetBrains Mono" font-size="${size}" letter-spacing="2" text-anchor="${anchor}" fill="currentColor">${s}</text>`;
const D2R = Math.PI / 180;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const PP = (cx, cy, r, a) => P(...pol(cx, cy, r, a));
function arc(cx, cy, r, a0, a1) { // degrees, clockwise when a1 > a0
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
  return `M${PP(cx, cy, r, a0 * D2R)}A${r1(r)} ${r1(r)} 0 ${large} ${sweep} ${PP(cx, cy, r, a1 * D2R)}`;
}
function arrowHead(x, y, ang, s = 9) {
  const a1 = ang + Math.PI - 0.35, a2 = ang + Math.PI + 0.35;
  return `M${P(x + s * Math.cos(a1), y + s * Math.sin(a1))}L${P(x, y)}L${P(x + s * Math.cos(a2), y + s * Math.sin(a2))}`;
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
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// triangular teeth (Antikythera teeth were filed as triangles)
function teethD(cx, cy, N, rp, m, phase, a0 = -1e9, a1 = 1e9) {
  const p = (2 * Math.PI) / N, rr = rp - 1.15 * m, rt = rp + 1.1 * m;
  let d = '', open = false;
  for (let i = 0; i < N; i++) {
    const a = phase + i * p;
    let rel = ((a * 180) / Math.PI) % 360; if (rel > 180) rel -= 360; if (rel < -180) rel += 360;
    if (rel < a0 || rel > a1) { open = false; continue; }
    if (!open) { d += `M${PP(cx, cy, rr, a - p / 2)}`; open = true; }
    d += `L${PP(cx, cy, rt, a)}L${PP(cx, cy, rr, a + p / 2)}`;
  }
  return d;
}

const con = [], main = [], det = [], acc = [], lbl = [];
const spinWrap = (cx, cy, deg, els) => `<g class="spin" data-cx="${r1(cx)}" data-cy="${r1(cy)}" data-deg="${r1(deg)}">\n${els.join('\n')}\n</g>`;

// ---------- the train ----------
const M = (2 * 270) / 223; // module in px
const C1 = [450, 560];
const G = {};
G.b1 = { c: C1, N: 223 };
function place(from, N, angDeg) {
  const rpF = (M * from.N) / 2, rp = (M * N) / 2;
  const [x, y] = pol(from.c[0], from.c[1], rpF + rp, angDeg * D2R);
  // phase so a tooth of `from` meets a gap of the new wheel
  const pF = (2 * Math.PI) / from.N, p = (2 * Math.PI) / N, th = angDeg * D2R;
  let f = ((th - from.phase) / pF) % 1; if (f < 0) f += 1;
  return { c: [x, y], N, phase: th + Math.PI + (0.5 - f) * p, contact: angDeg };
}
G.b1.phase = -20 * D2R;
G.b2 = place(G.b1, 64, -20);
G.c2 = place(G.b2, 48, -100);
G.d = place(G.c2, 40, -150);
G.b1.deg = 20;
G.b2.deg = -G.b1.deg * 223 / 64;
G.c2.deg = -G.b2.deg * 64 / 48;
G.d.deg = -G.c2.deg * 48 / 40;

function gear(g, opt) {
  const [cx, cy] = g.c, rp = (M * g.N) / 2, rr = rp - 1.15 * M;
  const { rim, hub, spokes, hw0, hw1, rot } = opt;
  const mm = [], dd = [];
  mm.push(circle(cx, cy, rr));
  mm.push(circle(cx, cy, rr - rim));
  mm.push(circle(cx, cy, hub));
  let sd = '', hat = '';
  for (let k = 0; k < spokes; k++) {
    const a = (rot + (k * 360) / spokes) * D2R, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const r0 = Math.sqrt(hub * hub - hw0 * hw0), rO = Math.sqrt((rr - rim) ** 2 - hw1 * hw1);
    for (const s of [-1, 1]) sd += `M${P(cx + ux * r0 + nx * hw0 * s, cy + uy * r0 + ny * hw0 * s)}L${P(cx + ux * rO + nx * hw1 * s, cy + uy * rO + ny * hw1 * s)}`;
    // shading along the shadow edge of each spoke
    for (const f of [0.55, 0.78]) {
      const w0 = hw0 * f, w1 = hw1 * f, q0 = r0 + 6, q1 = rO - 6;
      hat += `M${P(cx + ux * q0 - nx * w0, cy + uy * q0 - ny * w0)}L${P(cx + ux * q1 - nx * w1, cy + uy * q1 - ny * w1)}`;
    }
  }
  mm.push(path(sd));
  dd.push(path(teethD(cx, cy, g.N, rp, M, g.phase)));
  dd.push(path(hat));
  // square arbor hole + collar
  const s = hub * 0.38; let sq = '';
  for (let k = 0; k < 4; k++) sq += `${k ? 'L' : 'M'}${PP(cx, cy, s * Math.SQRT2, (rot + 45 + k * 90) * D2R)}`;
  dd.push(path(sq + 'Z'));
  dd.push(circle(cx, cy, hub * 0.72));
  // rim band shading on the lower-right
  let rb = '';
  for (let a = 15; a <= 115; a += Math.max(2.2, 360 / g.N * 1.5)) rb += `M${PP(cx, cy, rr - rim + 2, a * D2R)}L${PP(cx, cy, rr - 2, (a - 1.5) * D2R)}`;
  dd.push(path(rb));
  if (opt.rivets) {
    for (let k = 0; k < spokes; k++) {
      const a = (rot + (k * 360) / spokes) * D2R, nx = -Math.sin(a), ny = Math.cos(a);
      const ro = rr - rim - 12;
      for (const s of [-1, 1]) dd.push(circle(cx + Math.cos(a) * ro + nx * hw1 * 0.5 * s, cy + Math.sin(a) * ro + ny * hw1 * 0.5 * s, 3));
      dd.push(circle(cx + Math.cos(a) * (hub + 12), cy + Math.sin(a) * (hub + 12), 3));
    }
  }
  return { mm, dd };
}

const specs = {
  b1: { rim: 18, hub: 42, spokes: 4, hw0: 12, hw1: 19, rot: 12, rivets: true },
  b2: { rim: 11, hub: 15, spokes: 4, hw0: 5, hw1: 8, rot: 30 },
  c2: { rim: 9, hub: 13, spokes: 4, hw0: 4.5, hw1: 7, rot: 5 },
  d: { rim: 8, hub: 11, spokes: 4, hw0: 4, hw1: 6, rot: 40 },
};
const built = {};
for (const k of ['b1', 'b2', 'c2', 'd']) built[k] = gear(G[k], specs[k]);

// ---------- construction ----------
con.push(centreLine(84, C1[1], 916, C1[1]));
con.push(centreLine(C1[0], 236, C1[0], 918));
for (const k of ['b1', 'b2', 'c2', 'd']) {
  const g = G[k];
  con.push(circle(g.c[0], g.c[1], (M * g.N) / 2));
  if (k !== 'b1') con.push(path(cross(g.c[0], g.c[1], 16)));
}
con.push(path(`M${P(...G.b1.c)}L${P(...G.b2.c)}L${P(...G.c2.c)}L${P(...G.d.c)}`));
con.push(path(arc(C1[0], C1[1], 120, -20, 0) + arrowHead(...pol(C1[0], C1[1], 120, -20 * D2R), -110 * D2R, 8)));
// radius dimension of b1
{
  const a = 135 * D2R, [x, y] = pol(C1[0], C1[1], 266, a);
  con.push(path(`M${PP(C1[0], C1[1], 44, a)}L${P(x, y)}` + arrowHead(x, y, a, 10)));
}
// dial ring end radials
con.push(path(`M${PP(C1[0], C1[1], 280, 105 * D2R)}L${PP(C1[0], C1[1], 366, 105 * D2R)}M${PP(C1[0], C1[1], 280, 222 * D2R)}L${PP(C1[0], C1[1], 366, 222 * D2R)}`));

// ---------- inset FIG. II : pin-and-slot pair ----------
const IC = [230, 196], IR = 112;
const A = [220, 196], B = [240, 196]; // k1 front, k2 behind, eccentric axes
const Mk = (2 * 78) / 50;
con.push(circle(IC[0], IC[1], IR));
con.push(circle(IC[0], IC[1], IR + 6));
const call = C1;
con.push(circle(call[0], call[1], 58));
{
  const ang = Math.atan2(IC[1] - call[1], IC[0] - call[0]);
  con.push(path(`M${PP(call[0], call[1], 58, ang)}L${PP(IC[0], IC[1], IR + 6, ang + Math.PI)}`));
}
con.push(path(cross(A[0], A[1], 9) + cross(B[0], B[1], 9)));
con.push(line(A[0] - 30, A[1] + 100, B[0] + 30, B[1] + 100));

// k2 (behind): only the crescent that shows past k1
main.push(path(arc(B[0], B[1], 78 - 1.15 * Mk, -74, 74)));
det.push(path(teethD(B[0], B[1], 50, 78, Mk, 3 * D2R, -74, 74)));
// k1 (front)
main.push(circle(A[0], A[1], 78 - 1.15 * Mk));
main.push(circle(A[0], A[1], 13));
det.push(path(teethD(A[0], A[1], 50, 78, Mk, 0)));
det.push(circle(A[0], A[1], 5));
// k1 face shading: diagonal chords on the lower-left crescent
{
  let d = ''; const R = 66;
  for (let o = -60; o <= -22; o += 5) {
    const h = Math.sqrt(R * R - o * o); // chord along direction (1,-1)/sqrt2 offset o along (1,1)/sqrt2
    const cx = A[0] + o / Math.SQRT2, cy = A[1] + o / Math.SQRT2;
    d += `M${P(cx - h / Math.SQRT2, cy + h / Math.SQRT2)}L${P(cx + h / Math.SQRT2, cy - h / Math.SQRT2)}`;
  }
  det.push(path(d));
}
// slot in k1 and the pin carried by k2
{
  const al = -32 * D2R, ux = Math.cos(al), uy = Math.sin(al), nx = -uy, ny = ux;
  const ax = A[0] - B[0], ay = A[1] - B[1];
  const bq = ax * ux + ay * uy, t = -bq + Math.sqrt(bq * bq - (ax * ax + ay * ay - 38 * 38));
  const t0 = 24, t1 = 64, w = 8;
  const p0 = [A[0] + ux * t0, A[1] + uy * t0], p1 = [A[0] + ux * t1, A[1] + uy * t1];
  acc.push(path(`M${P(p0[0] + nx * w, p0[1] + ny * w)}L${P(p1[0] + nx * w, p1[1] + ny * w)}A${w} ${w} 0 0 0 ${P(p1[0] - nx * w, p1[1] - ny * w)}` +
    `L${P(p0[0] - nx * w, p0[1] - ny * w)}A${w} ${w} 0 0 0 ${P(p0[0] + nx * w, p0[1] + ny * w)}Z`));
  acc.push(circle(A[0] + ux * t, A[1] + uy * t, 5.2));
  // pin radius from k2 axis (construction) and rotation sense
  con.push(path(`M${P(...B)}L${P(A[0] + ux * t, A[1] + uy * t)}`));
  const [ex, ey] = pol(A[0], A[1], 93, 250 * D2R);
  acc.push(path(arc(A[0], A[1], 93, 140, 250) + arrowHead(ex, ey, 340 * D2R, 10)));
}

// ---------- front dial ring fragment (zodiac + Egyptian calendar) ----------
const R = { z0: 296, z1: 320, c0: 327, c1: 352 };
const a0 = 105, a1 = 222;
main.push(path(arc(C1[0], C1[1], R.z0, a0 + 2, a1 - 3)));
main.push(path(arc(C1[0], C1[1], R.z1, a0, a1)));
main.push(path(arc(C1[0], C1[1], R.c0, a0 + 1, a1 - 1)));
main.push(path(arc(C1[0], C1[1], R.c1, a0 + 3, a1 + 1)));
// corroded fracture ends
function fracture(aDeg, dir) {
  let d = '', first = true;
  for (let r = R.z0; r <= R.c1 + 0.1; r += 7) {
    const j = (rnd() - 0.3) * 3.2 * dir;
    d += `${first ? 'M' : 'L'}${PP(C1[0], C1[1], r, (aDeg + j) * D2R)}`; first = false;
  }
  return path(d);
}
main.push(fracture(a0 + 1.5, 1));
main.push(fracture(a1 - 1, -1));
// zodiac: 30 degree sign divisions
{
  let d = '';
  for (let a = 120; a < a1; a += 30) d += `M${PP(C1[0], C1[1], R.z0, a * D2R)}L${PP(C1[0], C1[1], R.z1, a * D2R)}`;
  main.push(path(d));
}
// degree ticks on the zodiac ring
{
  let d = '';
  for (let a = a0 + 3; a < a1 - 3; a += 1) {
    const L = a % 5 === 0 ? 8 : 4.5;
    d += `M${PP(C1[0], C1[1], R.z0, a * D2R)}L${PP(C1[0], C1[1], R.z0 + L, a * D2R)}`;
  }
  det.push(path(d));
}
// day ticks (365) and 30-day month lines on the calendar ring
{
  let d = '', m = '';
  const step = 360 / 365;
  for (let i = 0; i < 365; i++) {
    const a = i * step; if (a < a0 + 3 || a > a1 - 1) continue;
    d += `M${PP(C1[0], C1[1], R.c1 - 7, a * D2R)}L${PP(C1[0], C1[1], R.c1, a * D2R)}`;
    if (i % 30 === 0) m += `M${PP(C1[0], C1[1], R.c0, a * D2R)}L${PP(C1[0], C1[1], R.c1 - 7, a * D2R)}`;
  }
  det.push(path(d));
  det.push(path(m));
}
// engraved inscription marks inside each zodiac sector (stylised letterforms)
for (let s = 0; s < 4; s++) {
  const base = 124 + s * 30; let d = '';
  for (let k = 0; k < 5; k++) {
    const a = (base + k * 4.4) * D2R, rm = (R.z0 + R.z1) / 2 + 2;
    const kind = Math.floor(rnd() * 4);
    const t = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)], n = [Math.cos(a), Math.sin(a)];
    const pt = (u, v) => P(C1[0] + n[0] * (rm + v) + t[0] * u, C1[1] + n[1] * (rm + v) + t[1] * u);
    if (kind === 0) d += `M${pt(-3, -6)}L${pt(0, 6)}L${pt(3, -6)}`; // Lambda
    else if (kind === 1) d += `M${pt(-3, -6)}L${pt(3, -6)}M${pt(0, -6)}L${pt(0, 6)}`; // Tau
    else if (kind === 2) d += `M${pt(3, -6)}L${pt(-3, -6)}L${pt(1, 0)}L${pt(-3, 6)}L${pt(3, 6)}`; // Sigma
    else d += `M${pt(-3, 6)}L${pt(-3, -6)}L${pt(3, -6)}L${pt(3, 6)}`; // Pi
  }
  det.push(path(d));
}
// light hatch across the calendar band near each end (worn bronze)
{
  let d = '';
  for (let a = a0 + 4; a < a0 + 22; a += 1.6) d += `M${PP(C1[0], C1[1], R.c0 + 3, a * D2R)}L${PP(C1[0], C1[1], R.c1 - 9, (a + 1.2) * D2R)}`;
  for (let a = a1 - 20; a < a1 - 3; a += 1.6) d += `M${PP(C1[0], C1[1], R.c0 + 3, a * D2R)}L${PP(C1[0], C1[1], R.c1 - 9, (a + 1.2) * D2R)}`;
  det.push(path(d));
}

// input drive: crown wheel a1 seen edge-on, arbor, bearing and crank
{
  const yc = C1[1], xr = C1[0] + 274;
  main.push(path(`M${P(xr + 2, yc - 34)}L${P(xr + 16, yc - 34)}L${P(xr + 16, yc + 34)}L${P(xr + 2, yc + 34)}`));
  main.push(path(`M${P(xr + 16, yc - 6)}L${P(870, yc - 6)}M${P(xr + 16, yc + 6)}L${P(870, yc + 6)}`));
  main.push(path(`M${P(800, yc - 22)}L${P(826, yc - 22)}L${P(826, yc + 30)}L${P(800, yc + 30)}Z`));
  main.push(path(`M${P(870, yc + 8)}L${P(870, yc - 70)}Q${P(870, yc - 82)} ${P(882, yc - 82)}L${P(900, yc - 82)}`));
  main.push(circle(870, yc, 9));
  main.push(path(`M${P(888, yc - 94)}L${P(912, yc - 94)}L${P(912, yc - 70)}L${P(888, yc - 70)}Z`));
  let t = '';
  for (let y = yc - 32; y <= yc + 32; y += 5) t += `M${P(xr + 2, y)}L${P(xr - 3, y + 2.5)}L${P(xr + 2, y + 5)}`;
  det.push(path(t));
  let h = '';
  for (let x = 804; x < 826; x += 5) h += `M${P(x, yc + 28)}L${P(x + 6, yc + 20)}`;
  for (let x = xr + 26; x < 796; x += 10) h += `M${P(x, yc + 4)}L${P(x + 4, yc - 4)}`;
  det.push(path(h));
  det.push(path(`M${P(890, yc - 90)}L${P(910, yc - 90)}M${P(890, yc - 86)}L${P(910, yc - 86)}M${P(890, yc - 82)}L${P(910, yc - 82)}M${P(890, yc - 78)}L${P(910, yc - 78)}`));
  det.push(circle(813, yc - 12, 2.5));
  det.push(circle(813, yc + 20, 2.5));
}
// leaders
det.push(path(`M${PP(G.b2.c[0], G.b2.c[1], 84, -35 * D2R)}L${P(846, 372)}L${P(856, 372)}`));
det.push(path(`M${PP(C1[0], C1[1], 274, 48 * D2R)}L${P(700, 812)}L${P(760, 812)}`));

// ---------- assemble gears into spin groups (outline in main, teeth in detail) ----------
const mainGears = [], detGears = [];
for (const k of ['b1', 'b2', 'c2', 'd']) {
  const g = G[k];
  mainGears.push(spinWrap(g.c[0], g.c[1], g.deg, built[k].mm));
  detGears.push(spinWrap(g.c[0], g.c[1], g.deg, built[k].dd));
}

// ---------- labels ----------
lbl.push(text(905, 910, 'FIG. I', 'end', 22));
lbl.push(text(766, 818, 'N = 223', 'start', 18));
lbl.push(text(862, 378, 'N = 64', 'start', 18));
lbl.push(text(356, 108, 'FIG. II', 'start', 20));
lbl.push(text(356, 136, 'ΓΟΜΦΟΣ', 'start', 16));
lbl.push(`<g transform="rotate(-90 92 560)">${text(92, 560, 'ΖΩΔΙΑΚΟΣ', 'middle', 16)}</g>`);

const g = (cls, sw, arr) => `<g class="${cls}"${sw ? ` stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` : ''}>\n${arr.join('\n')}\n</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
${g('L-con', 1.2, con)}
${g('L-main', 2.6, [...mainGears, ...main])}
${g('L-detail', 1.3, [...detGears, ...det])}
${g('L-acc', 3.6, acc)}
${g('L-lbl', 0, lbl)}
</svg>
`;
writeFileSync(fileURLToPath(new URL('../02-antikythera.svg', import.meta.url)), svg);
console.log('wrote 02-antikythera.svg', svg.length, 'bytes', Object.fromEntries(Object.entries(G).map(([k, v]) => [k, [v.c.map(r1), r1(v.deg)]])));
