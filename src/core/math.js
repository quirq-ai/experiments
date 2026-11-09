// Numerical core: FFT, sampling, tridiagonal eigenproblems, transfer matrices.
// Internal units everywhere: hbar = electron mass = 1, lengths in nanometres.
(() => {
  const QL = (globalThis.QL ||= {});
  const M = (QL.math = {});

  M.TAU = Math.PI * 2;
  M.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.smooth = (t) => { t = M.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  M.ease = (t) => { t = M.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };

  // What one internal unit is worth for an electron when lengths are in nm.
  QL.units = {
    EV: 0.0762,   // energy unit (hbar^2 / m nm^2) in electronvolts
    FS: 8.638,    // time unit in femtoseconds
    KMS: 115.8,   // velocity unit (hbar / m nm) in km/s
  };

  M.randn = () => {
    let u = 0;
    while (u === 0) u = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(M.TAU * Math.random());
  };

  M.poisson = (lam) => {
    if (lam <= 0) return 0;
    if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * M.randn()));
    const L = Math.exp(-lam);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  };

  // ---------------------------------------------------------------- FFT
  const plans = new Map();
  const plan = (n) => {
    let p = plans.get(n);
    if (p) return p;
    const bits = Math.round(Math.log2(n));
    if (1 << bits !== n) throw new Error('fft size must be a power of two');
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((M.TAU * i) / n);
      sin[i] = Math.sin((M.TAU * i) / n);
    }
    p = { rev, cos, sin };
    plans.set(n, p);
    return p;
  };

  // In-place complex FFT. Forward: X_k = sum x_j exp(-2 pi i jk / n).
  M.fft = (re, im, inverse = false) => {
    const n = re.length;
    const { rev, cos, sin } = plan(n);
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, stride = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += stride) {
          const wr = cos[k], wi = inverse ? sin[k] : -sin[k];
          const a = i + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inverse) {
      const s = 1 / n;
      for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; }
    }
  };

  // ------------------------------------------------------------ sampling
  // Cumulative table over non-negative weights; sample() returns a fractional index.
  M.cdf = (w, from = 0, to = w.length) => {
    const c = new Float64Array(to - from + 1);
    let s = 0;
    for (let i = from; i < to; i++) { s += w[i] > 0 ? w[i] : 0; c[i - from + 1] = s; }
    return { c, total: s, from };
  };
  M.sample = (table, u = Math.random()) => {
    const { c, total, from } = table;
    if (!(total > 0)) return from;
    const target = u * total;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid] <= target) lo = mid; else hi = mid;
    }
    const span = c[hi] - c[lo];
    return from + lo + (span > 0 ? (target - c[lo]) / span : 0.5);
  };

  // ------------------------------------- symmetric tridiagonal eigenpairs
  // Lowest `count` eigenpairs of the matrix with diagonal d[] and a constant
  // off-diagonal e. Sturm bisection for values, pivoted inverse iteration for
  // vectors. Fast enough to re-solve a 600 point well on every pointer move.
  M.tridiagEigen = (d, e, count) => {
    const n = d.length, e2 = e * e;
    count = Math.min(count, n);
    let lo = Infinity, hi = -Infinity;
    const r = 2 * Math.abs(e);
    for (let i = 0; i < n; i++) {
      if (d[i] - r < lo) lo = d[i] - r;
      if (d[i] + r > hi) hi = d[i] + r;
    }
    const below = (x) => {
      let c = 0, q = 1;
      for (let i = 0; i < n; i++) {
        q = d[i] - x - (i ? e2 / q : 0);
        if (q === 0) q = 1e-300;
        if (q < 0) c++;
      }
      return c;
    };
    const values = new Float64Array(count);
    let floor = lo;
    for (let k = 0; k < count; k++) {
      let a = floor, b = hi;
      for (let it = 0; it < 200 && b - a > 1e-13 * Math.max(1, Math.abs(a) + Math.abs(b)); it++) {
        const mid = 0.5 * (a + b);
        if (below(mid) > k) b = mid; else a = mid;
      }
      values[k] = 0.5 * (a + b);
      floor = a;
    }

    const U0 = new Float64Array(n), U1 = new Float64Array(n), U2 = new Float64Array(n);
    const rhs = new Float64Array(n);
    const solve = (lam, v) => {
      rhs.set(v);
      let p0 = d[0] - lam, p1 = e;
      for (let i = 0; i < n - 1; i++) {
        const dd = d[i + 1] - lam, cc = i + 2 < n ? e : 0;
        if (Math.abs(p0) >= Math.abs(e)) {
          const m = e / p0;
          U0[i] = p0; U1[i] = p1; U2[i] = 0;
          rhs[i + 1] -= m * rhs[i];
          p0 = dd - m * p1; p1 = cc;
        } else {
          const m = p0 / e;
          U0[i] = e; U1[i] = dd; U2[i] = cc;
          const t = rhs[i]; rhs[i] = rhs[i + 1]; rhs[i + 1] = t - m * rhs[i + 1];
          p0 = p1 - m * dd; p1 = -m * cc;
        }
      }
      U0[n - 1] = p0 === 0 ? 1e-300 : p0;
      v[n - 1] = rhs[n - 1] / U0[n - 1];
      if (n > 1) v[n - 2] = (rhs[n - 2] - U1[n - 2] * v[n - 1]) / U0[n - 2];
      for (let i = n - 3; i >= 0; i--) v[i] = (rhs[i] - U1[i] * v[i + 1] - U2[i] * v[i + 2]) / U0[i];
    };
    const scale = (v) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += v[i] * v[i];
      s = 1 / Math.sqrt(s || 1);
      for (let i = 0; i < n; i++) v[i] *= s;
    };

    const vectors = [];
    const span = Math.max(1e-12, hi - lo);
    for (let k = 0; k < count; k++) {
      const v = new Float64Array(n);
      for (let i = 0; i < n; i++) v[i] = 1 + 0.37 * Math.sin(1.7 * i + k);
      const lam = values[k] + span * 1e-12 * (k + 1);
      for (let it = 0; it < 4; it++) {
        solve(lam, v);
        // Keep near-degenerate partners (double wells) orthogonal.
        for (let j = Math.max(0, k - 3); j < k; j++) {
          const w = vectors[j];
          let dot = 0;
          for (let i = 0; i < n; i++) dot += v[i] * w[i];
          for (let i = 0; i < n; i++) v[i] -= dot * w[i];
        }
        scale(v);
      }
      let peak = 0;
      for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(v[i]));
      for (let i = 0; i < n; i++) {
        if (Math.abs(v[i]) > 0.2 * peak) {
          if (v[i] < 0) for (let j = 0; j < n; j++) v[j] = -v[j];
          break;
        }
      }
      vectors.push(v);
    }
    return { values, vectors };
  };

  // ------------------------------------------------ plane wave transmission
  // Probability that a plane wave of energy E crosses a stack of constant
  // potential segments [{w, V}], listed left to right. Exact, by matching
  // psi and its slope across every edge.
  M.transmission = (E, segs, VL = 0, VR = 0) => {
    if (E <= VR || E <= VL) return 0;
    const kR = Math.sqrt(2 * (E - VR)), kL = Math.sqrt(2 * (E - VL));
    let pr = 1, pi = 0, qr = 0, qi = kR; // psi and dpsi/dx on the far side
    for (let s = segs.length - 1; s >= 0; s--) {
      const { w, V } = segs[s];
      const k2 = 2 * (E - V);
      let c, sn;
      if (Math.abs(k2) < 1e-12) { c = 1; sn = w; }
      else if (k2 > 0) { const k = Math.sqrt(k2); c = Math.cos(k * w); sn = Math.sin(k * w) / k; }
      else { const kap = Math.sqrt(-k2); c = Math.cosh(kap * w); sn = Math.sinh(kap * w) / kap; }
      const npr = pr * c - qr * sn, npi = pi * c - qi * sn;
      const nqr = pr * k2 * sn + qr * c, nqi = pi * k2 * sn + qi * c;
      pr = npr; pi = npi; qr = nqr; qi = nqi;
    }
    // incoming amplitude A = (psi - i dpsi / kL) / 2
    const ar = 0.5 * (pr + qi / kL), ai = 0.5 * (pi - qr / kL);
    return M.clamp(kR / kL / (ar * ar + ai * ai), 0, 1);
  };

  // Transmission averaged over a Gaussian packet's spread of wavenumbers.
  M.packetTransmission = (k0, sigmaX, segs, VL = 0, VR = 0) => {
    const sk = 1 / (2 * sigmaX);
    let num = 0, den = 0;
    for (let i = -60; i <= 60; i++) {
      const k = k0 + (i / 20) * sk;
      if (k <= 0) continue;
      const w = Math.exp(-0.5 * (i / 20) * (i / 20));
      num += w * M.transmission(0.5 * k * k, segs, VL, VR);
      den += w;
    }
    return den ? num / den : 0;
  };

  // ------------------------------------------------------------ formatting
  M.fix = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '...');
  M.sig = (v, n = 3) => {
    if (!Number.isFinite(v)) return '...';
    if (v === 0) return '0';
    const mag = Math.floor(Math.log10(Math.abs(v)));
    const digits = M.clamp(n - 1 - mag, 0, 8);
    return v.toFixed(digits);
  };
  M.pct = (v, digits = 0) => (Number.isFinite(v) ? (100 * v).toFixed(digits) + '%' : '...');
  M.int = (v) => Math.round(v).toLocaleString('en-US');
})();
