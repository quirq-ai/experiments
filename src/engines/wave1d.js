// One-dimensional time-dependent Schrödinger equation,
//   i dpsi/dt = [ -1/2 d2/dx2 + V(x) - i W(x) ] psi,
// advanced with the Crank-Nicolson scheme. The scheme is unitary for W = 0,
// so probability is conserved to rounding error, and eigenstates of the same
// discrete Hamiltonian (see eigen()) stay exactly stationary under it.
(() => {
  const QL = (globalThis.QL ||= {});
  const M = QL.math;

  QL.Wave1D = class {
    constructor({ n, xmin, xmax }) {
      this.n = n;
      this.xmin = xmin;
      this.xmax = xmax;
      this.dx = (xmax - xmin) / (n - 1);
      this.x = new Float64Array(n);
      for (let i = 0; i < n; i++) this.x[i] = xmin + i * this.dx;
      this.re = new Float64Array(n);
      this.im = new Float64Array(n);
      this.V = new Float64Array(n);
      this.W = new Float64Array(n);
      this.i0 = 1;        // psi is pinned to zero outside [i0, i1]: hard walls
      this.i1 = n - 2;
      this.t = 0;
      this.dt = 0;
      this.absorbedL = 0; // probability swallowed by each absorbing edge
      this.absorbedR = 0;
      this._dirty = true;
      const f = () => new Float64Array(n);
      this._cpR = f(); this._cpI = f(); this._invR = f(); this._invI = f();
      this._dR = f(); this._dI = f();
    }

    index(x) { return M.clamp(Math.round((x - this.xmin) / this.dx), 0, this.n - 1); }

    // Hard walls exactly at xa and xb (psi vanishes on those two grid points).
    setRange(xa, xb) {
      this.i0 = Math.max(1, this.index(xa) + 1);
      this.i1 = Math.min(this.n - 2, this.index(xb) - 1);
      for (let i = 0; i < this.n; i++) if (i < this.i0 || i > this.i1) { this.re[i] = 0; this.im[i] = 0; }
      this._dirty = true;
    }

    setV(fn) {
      for (let i = 0; i < this.n; i++) this.V[i] = fn(this.x[i], i);
      this._dirty = true;
    }

    // Smooth absorbing layers so outgoing waves leave instead of bouncing back.
    setAbsorber(width, strength) {
      this.W.fill(0);
      const cells = Math.max(1, Math.round(width / this.dx));
      for (let j = 0; j < cells; j++) {
        const s = strength * Math.pow(1 - j / cells, 2);
        if (this.i0 + j <= this.i1) this.W[this.i0 + j] = s;
        if (this.i1 - j >= this.i0) this.W[this.i1 - j] = s;
      }
      this._absCells = cells;
      this._dirty = true;
    }

    prepare(dt) {
      const { V, W, i0, i1 } = this;
      const al = dt / (4 * this.dx * this.dx);
      this.dt = dt;
      this._al = al;
      const cpR = this._cpR, cpI = this._cpI, invR = this._invR, invI = this._invI;
      for (let j = i0; j <= i1; j++) {
        let dr = 1 + 0.5 * dt * W[j], di = 2 * al + 0.5 * dt * V[j];
        if (j > i0) { dr -= al * cpI[j - 1]; di += al * cpR[j - 1]; }
        const m = 1 / (dr * dr + di * di);
        invR[j] = dr * m; invI[j] = -di * m;
        cpR[j] = al * invI[j]; cpI[j] = -al * invR[j];
      }
      this._dirty = false;
    }

    step(count = 1, dt = this.dt) {
      if (this._dirty || dt !== this.dt) this.prepare(dt);
      const { re, im, V, W, i0, i1 } = this;
      const al = this._al, h = 0.5 * dt;
      const cpR = this._cpR, cpI = this._cpI, invR = this._invR, invI = this._invI;
      const dR = this._dR, dI = this._dI;
      const cells = this._absCells || 0;
      for (let s = 0; s < count; s++) {
        if (cells) {
          let aL = 0, aR = 0;
          for (let j = 0; j < cells; j++) {
            const l = i0 + j, r = i1 - j;
            aL += W[l] * (re[l] * re[l] + im[l] * im[l]);
            aR += W[r] * (re[r] * re[r] + im[r] * im[r]);
          }
          this.absorbedL += 2 * aL * dt * this.dx;
          this.absorbedR += 2 * aR * dt * this.dx;
        }
        let pR = 0, pI = 0; // previous forward-eliminated value
        for (let j = i0; j <= i1; j++) {
          const br = 1 - h * W[j], bi = -(2 * al + h * V[j]);
          const sR = (j > i0 ? re[j - 1] : 0) + (j < i1 ? re[j + 1] : 0);
          const sI = (j > i0 ? im[j - 1] : 0) + (j < i1 ? im[j + 1] : 0);
          const tR = br * re[j] - bi * im[j] - al * sI - al * pI;
          const tI = br * im[j] + bi * re[j] + al * sR + al * pR;
          pR = tR * invR[j] - tI * invI[j];
          pI = tR * invI[j] + tI * invR[j];
          dR[j] = pR; dI[j] = pI;
        }
        re[i1] = dR[i1]; im[i1] = dI[i1];
        for (let j = i1 - 1; j >= i0; j--) {
          re[j] = dR[j] - (cpR[j] * re[j + 1] - cpI[j] * im[j + 1]);
          im[j] = dI[j] - (cpR[j] * im[j + 1] + cpI[j] * re[j + 1]);
        }
        this.t += dt;
      }
    }

    clear() { this.re.fill(0); this.im.fill(0); this.t = 0; this.absorbedL = 0; this.absorbedR = 0; }

    // Minimum-uncertainty packet centred on x0, moving with wavenumber k0.
    setGaussian(x0, sigma, k0) {
      this.clear();
      for (let i = this.i0; i <= this.i1; i++) {
        const u = this.x[i] - x0;
        const a = Math.exp(-(u * u) / (4 * sigma * sigma));
        this.re[i] = a * Math.cos(k0 * u);
        this.im[i] = a * Math.sin(k0 * u);
      }
      this.normalize();
    }

    setReal(vec, scale = 1) {
      this.clear();
      for (let i = this.i0; i <= this.i1; i++) this.re[i] = scale * vec[i];
    }

    norm(a = this.i0, b = this.i1) {
      let s = 0;
      const { re, im } = this;
      for (let i = Math.max(a, this.i0); i <= Math.min(b, this.i1); i++) s += re[i] * re[i] + im[i] * im[i];
      return s * this.dx;
    }

    normalize() {
      const s = 1 / Math.sqrt(this.norm() || 1);
      for (let i = this.i0; i <= this.i1; i++) { this.re[i] *= s; this.im[i] *= s; }
    }

    meanX() {
      let s = 0, m = 0;
      const { re, im, x } = this;
      for (let i = this.i0; i <= this.i1; i++) { const p = re[i] * re[i] + im[i] * im[i]; s += p; m += p * x[i]; }
      return s ? m / s : 0;
    }

    // <H> with the same finite-difference Hamiltonian the stepper uses.
    energy() {
      const { re, im, V, dx, i0, i1 } = this;
      const c = 1 / (2 * dx * dx);
      let e = 0, s = 0;
      for (let i = i0; i <= i1; i++) {
        const lr = (i > i0 ? re[i - 1] : 0) + (i < i1 ? re[i + 1] : 0) - 2 * re[i];
        const li = (i > i0 ? im[i - 1] : 0) + (i < i1 ? im[i + 1] : 0) - 2 * im[i];
        e += re[i] * (-c * lr + V[i] * re[i]) + im[i] * (-c * li + V[i] * im[i]);
        s += re[i] * re[i] + im[i] * im[i];
      }
      return s ? e / s : 0;
    }

    // Lowest stationary states of the active region. Vectors are real, full
    // length, and normalised so that sum(phi^2) dx = 1.
    eigen(count) {
      const { i0, i1, dx, V, n } = this;
      const m = i1 - i0 + 1;
      const d = new Float64Array(m);
      for (let i = 0; i < m; i++) d[i] = 1 / (dx * dx) + V[i0 + i];
      const { values, vectors } = M.tridiagEigen(d, -1 / (2 * dx * dx), count);
      const s = 1 / Math.sqrt(dx);
      const phi = vectors.map((v) => {
        const full = new Float64Array(n);
        for (let i = 0; i < m; i++) full[i0 + i] = v[i] * s;
        return full;
      });
      return { E: Array.from(values), phi };
    }

    // Complex overlap <phi|psi> for a real phi.
    project(phi) {
      let r = 0, i = 0;
      for (let j = this.i0; j <= this.i1; j++) { r += phi[j] * this.re[j]; i += phi[j] * this.im[j]; }
      return [r * this.dx, i * this.dx];
    }

    // Collapse onto a narrow packet around x0, as a position measurement would.
    collapseTo(x0, sigma) {
      const t = this.t;
      for (let i = this.i0; i <= this.i1; i++) {
        const u = this.x[i] - x0;
        this.re[i] = Math.exp(-(u * u) / (4 * sigma * sigma));
        this.im[i] = 0;
      }
      this.normalize();
      this.t = t;
    }
  };
})();
