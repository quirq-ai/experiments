// Checks the numerical core against results known in closed form.
// Run with: node tests/numerics.mjs
import '../src/core/math.js';
import '../src/engines/wave1d.js';
import '../src/stations/atom.js';

const { math: M, Wave1D } = globalThis.QL;
let failed = 0;
const check = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${got.toPrecision(6)}, want ${want.toPrecision(6)} (tol ${tol})`);
};

// FFT round trip and a known transform.
{
  const n = 1024, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 5 * i) / n);
  M.fft(re, im);
  check('fft peak at bin 5', re[5], n / 2, 1e-9);
  M.fft(re, im, true);
  check('fft round trip', re[17], Math.cos((2 * Math.PI * 5 * 17) / n), 1e-12);
}

// Harmonic oscillator: E_n = omega (n + 1/2).
{
  const w = new Wave1D({ n: 601, xmin: -3, xmax: 3 });
  const omega = 4;
  w.setV((x) => 0.5 * omega * omega * x * x);
  const { E, phi } = w.eigen(6);
  for (let k = 0; k < 6; k++) check(`oscillator E${k}`, E[k], omega * (k + 0.5), 0.02);
  let dot = 0, nrm = 0;
  for (let i = 0; i < w.n; i++) { dot += phi[0][i] * phi[2][i] * w.dx; nrm += phi[3][i] * phi[3][i] * w.dx; }
  check('eigenvectors orthogonal', dot, 0, 1e-8);
  check('eigenvectors normalised', nrm, 1, 1e-9);
}

// Infinite well of width 2: E_n = n^2 pi^2 / 8.
{
  const w = new Wave1D({ n: 601, xmin: -3, xmax: 3 });
  w.setRange(-1, 1);
  const { E } = w.eigen(5);
  for (let k = 0; k < 5; k++) check(`box E${k + 1}`, E[k], ((k + 1) ** 2 * Math.PI ** 2) / 8, 0.02 * (k + 1) ** 2);
}

// A stationary state must stay put, and the norm must be conserved.
{
  const w = new Wave1D({ n: 601, xmin: -3, xmax: 3 });
  w.setV((x) => 8 * x * x);
  const { phi } = w.eigen(3);
  w.setReal(phi[1]);
  const before = w.re[220] ** 2 + w.im[220] ** 2;
  w.step(2000, 0.003);
  check('stationary density', w.re[220] ** 2 + w.im[220] ** 2, before, 1e-9);
  check('norm conserved', w.norm(), 1, 1e-10);
}

// Tunneling through a rectangular barrier against the transfer matrix.
{
  const w = new Wave1D({ n: 4096, xmin: -60, xmax: 60 });
  const V0 = 10, a0 = w.index(0), a1 = w.index(0.6);
  const width = (a1 - a0) * w.dx;
  w.setV((x, i) => (i >= a0 && i < a1 ? V0 : 0));
  w.setAbsorber(8, 6);
  const k0 = 4, sig = 5;
  w.setGaussian(-25, sig, k0);
  w.step(3200, 0.004);
  const T = w.norm(a1 + 1) + w.absorbedR;
  const R = w.norm(w.i0, a0 - 1) + w.absorbedL;
  const want = M.packetTransmission(k0, sig, [{ w: width, V: V0 }]);
  check('tunneling T (packet)', T, want, 0.004);
  check('T + R', T + R, 1, 0.002);
  const kap = Math.sqrt(2 * (V0 - 8));
  const closed = 1 / (1 + (V0 * V0 * Math.sinh(kap * width) ** 2) / (4 * 8 * (V0 - 8)));
  check('transfer matrix vs textbook', M.transmission(8, [{ w: width, V: V0 }]), closed, 1e-12);
}

// Hydrogen: sampled clouds, spectral lines and decay branching.
{
  const H = globalThis.QL.hydrogen;
  const mean = (n, l, m) => { const { rad } = H.sampleOrbital(n, l, m, 200000, false); let s = 0; for (const r of rad) s += r; return s / rad.length; };
  check('1s mean radius (1.5 a0)', mean(1, 0, 0), 1.5, 0.02);
  check('2p mean radius (5 a0)', mean(2, 1, 1), 5, 0.05);
  check('3d mean radius (10.5 a0)', mean(3, 2, 0), 10.5, 0.1);
  check('H-alpha wavelength', H.wavelength(3, 2), 656.1, 0.5);
  check('Lyman-alpha wavelength', H.wavelength(2, 1), 121.5, 0.2);
  const d3p = H.decays(3, 1);
  check('3p decays mostly to 1s', d3p.find((d) => d.n === 1).share, 0.882, 0.01);
  check('2s has no allowed decay', H.decays(2, 0).length, 0, 0);
  const { pos } = H.sampleOrbital(2, 1, 0, 50000, false);
  let onAxis = 0;
  for (let k = 0; k < 50000; k++) onAxis += pos[k * 3 + 1] ** 2 / (pos[k * 3] ** 2 + pos[k * 3 + 1] ** 2 + pos[k * 3 + 2] ** 2);
  check('2p0 points along its axis (<cos^2> = 3/5)', onAxis / 50000, 0.6, 0.01);
}

// Bell's test: the singlet rule and the hidden-variable twins.
{
  const RAD = Math.PI / 180;
  const pair = (a, b, quantum) => {
    if (quantum) { const A = Math.random() < 0.5 ? 1 : -1; return [A, Math.random() < Math.cos(((a - b) * RAD) / 2) ** 2 ? -A : A]; }
    const h = Math.random() * 360;
    return [Math.cos((a - h) * RAD) >= 0 ? 1 : -1, Math.cos((b - h) * RAD) >= 0 ? -1 : 1];
  };
  const chsh = (quantum) => {
    const E = [[0, 45], [0, 135], [90, 45], [90, 135]].map(([a, b]) => { let s = 0; const n = 200000; for (let i = 0; i < n; i++) { const [A, B] = pair(a, b, quantum); s += A * B; } return s / n; });
    return Math.abs(E[0] - E[1]) + Math.abs(E[2] + E[3]);
  };
  check('CHSH, entangled pairs', chsh(true), 2 * Math.SQRT2, 0.02);
  check('CHSH, classical twins', chsh(false), 2, 0.02);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
