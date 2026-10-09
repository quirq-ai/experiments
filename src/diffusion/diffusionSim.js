// 2D enclosed-room diffusion: Fick's law ∂c/∂t = D ∇²c + advection.
// Reflective (no-flux) walls bounce the plume; optional wall holes leak mass out.

export const MEDIUM = {
  gas: {
    label: 'Gas',
    D: 0.22,
    driftY: 0.08,
    decay: 0.008,
  },
  liquid: {
    label: 'Liquid',
    D: 0.022,
    driftY: -0.045,
    decay: 0.003,
  },
};

const WALLS = ['left', 'right', 'bottom', 'top'];

/**
 * Explicit FTCS diffusion on a square room.
 * Walls are Neumann (reflective). Leak holes are open (Dirichlet c→0).
 * A separate reflect field lights up where the plume presses into walls.
 */
export class DiffusionField {
  constructor(size = 160) {
    this.size = size;
    this.field = new Float32Array(size * size);
    this.next = new Float32Array(size * size);
    // Accumulated wall-hit intensity (decays slowly) for reflection viz
    this.reflect = new Float32Array(size * size);
    this.rgba = new Uint8Array(size * size * 4);
    this.time = 0;
    this.peak = 0;
    this.total = 0;
    this.spread = 0;
    this.steps = 0;
    this.massLost = 0;
    this.leakRate = 0;
    this.wallHits = 0;
  }

  index(x, y) {
    return y * this.size + x;
  }

  clear() {
    this.field.fill(0);
    this.next.fill(0);
    this.reflect.fill(0);
    this.time = 0;
    this.peak = 0;
    this.total = 0;
    this.spread = 0;
    this.steps = 0;
    this.massLost = 0;
    this.leakRate = 0;
    this.wallHits = 0;
  }

  /** Soft Gaussian puff at normalized (nx, ny) in [0,1]. */
  inject(nx, ny, amount = 1, radius = 0.04) {
    const N = this.size;
    const cx = Math.min(Math.max(nx, 0), 1) * (N - 1);
    const cy = Math.min(Math.max(ny, 0), 1) * (N - 1);
    const r = Math.max(radius * N, 1.2);
    const r2 = r * r;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 > r2 * 9) continue;
        this.field[this.index(x, y)] += amount * Math.exp(-d2 / (2 * r2));
      }
    }
  }

  /**
   * Hole coverage on a wall edge. center in [0,1] along the wall, size as fraction of wall.
   */
  _holeRange(center, size) {
    const N = this.size;
    const half = Math.max(1, Math.round((size * N) / 2));
    const mid = Math.round(Math.min(Math.max(center, 0), 1) * (N - 1));
    return {
      lo: Math.max(0, mid - half),
      hi: Math.min(N - 1, mid + half),
    };
  }

  isLeakCell(x, y, opts) {
    if (!opts.leaks) return false;
    const N = this.size;
    const size = Math.min(Math.max(opts.holeSize ?? 0.12, 0.02), 0.55);
    const center = opts.holeCenter ?? 0.5;
    const walls = opts.holeWalls || ['right'];
    const { lo, hi } = this._holeRange(center, size);
    const edge = 1; // one-cell rim

    for (const w of walls) {
      if (w === 'right' && x >= N - 1 - edge && y >= lo && y <= hi) return true;
      if (w === 'left' && x <= edge && y >= lo && y <= hi) return true;
      if (w === 'top' && y >= N - 1 - edge && x >= lo && x <= hi) return true;
      if (w === 'bottom' && y <= edge && x >= lo && x <= hi) return true;
    }
    return false;
  }

  step(dt, opts = {}) {
    const medium = MEDIUM[opts.medium] || MEDIUM.gas;
    const D = Math.max(0.001, medium.D * (opts.DScale ?? 1));
    const driftY = medium.driftY * (opts.driftScale ?? 1);
    const decay = medium.decay * (opts.decayScale ?? 1);
    const srcRate = opts.sourceRate ?? 0;
    const sx = opts.sourceX ?? 0.5;
    const sy = opts.sourceY ?? 0.35;
    const sR = opts.sourceRadius ?? 0.035;

    const maxDt = 0.22 / Math.max(D, 0.01);
    let remain = Math.min(Math.max(dt, 0), 0.2);
    let subs = 0;
    let lostThis = 0;

    while (remain > 1e-6 && subs < 8) {
      const h = Math.min(remain, maxDt);
      remain -= h;
      subs++;
      lostThis += this._diffuseOnce(h, D, driftY, decay, opts);
      if (srcRate > 0) this.inject(sx, sy, srcRate * h * 18, sR);
    }

    this.time += dt;
    this.steps += subs;
    this.leakRate = lostThis / Math.max(dt, 1e-6);
    this.massLost += lostThis;
    this._stats(sx, sy);
    this._packRGBA(opts);
  }

  _diffuseOnce(dt, D, driftY, decay, opts) {
    const N = this.size;
    const a = D * dt;
    const field = this.field;
    const next = this.next;
    const reflect = this.reflect;
    const damp = Math.max(0, 1 - decay * dt);
    const vy = driftY * dt * N * 0.35;
    const vyAbs = Math.abs(vy);
    const vySign = vy >= 0 ? 1 : -1;
    const showReflect = opts.showReflection !== false;
    let lost = 0;
    let hits = 0;

    // Decay reflection glow
    const rDecay = Math.exp(-dt * 1.8);
    for (let i = 0; i < reflect.length; i++) reflect[i] *= rDecay;

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;

        // Open leak: mass escapes to exterior (c = 0)
        if (this.isLeakCell(x, y, opts)) {
          lost += field[i];
          next[i] = 0;
          continue;
        }

        // Reflective Neumann: mirror neighbors across walls (unless neighbor is a leak)
        const xm = x > 0 ? x - 1 : 1;
        const xp = x < N - 1 ? x + 1 : N - 2;
        const ym = y > 0 ? y - 1 : 1;
        const yp = y < N - 1 ? y + 1 : N - 2;

        let cxm = field[y * N + xm];
        let cxp = field[y * N + xp];
        let cym = field[ym * N + x];
        let cyp = field[yp * N + x];

        // At solid walls, mirrored sample = self (true no-flux reflection)
        if (x === 0) cxm = field[i];
        if (x === N - 1) cxp = field[i];
        if (y === 0) cym = field[i];
        if (y === N - 1) cyp = field[i];

        // Near a leak, treat open side as exterior vacuum
        if (x > 0 && this.isLeakCell(x - 1, y, opts)) cxm = 0;
        if (x < N - 1 && this.isLeakCell(x + 1, y, opts)) cxp = 0;
        if (y > 0 && this.isLeakCell(x, y - 1, opts)) cym = 0;
        if (y < N - 1 && this.isLeakCell(x, y + 1, opts)) cyp = 0;

        const c = field[i];
        const lap = cxm + cxp + cym + cyp - 4 * c;
        let v = (c + a * lap) * damp;

        if (vyAbs > 1e-8) {
          const yFrom = y - vySign;
          if (yFrom >= 0 && yFrom < N && !this.isLeakCell(x, yFrom, opts)) {
            const mix = Math.min(vyAbs, 0.45);
            v = v * (1 - mix) + field[yFrom * N + x] * mix * damp;
          }
        }

        // Reflection signal: concentration pressing into a solid wall edge
        if (showReflect) {
          let press = 0;
          if (x <= 1 && !this.isLeakCell(0, y, opts)) press += c;
          if (x >= N - 2 && !this.isLeakCell(N - 1, y, opts)) press += c;
          if (y <= 1 && !this.isLeakCell(x, 0, opts)) press += c;
          if (y >= N - 2 && !this.isLeakCell(x, N - 1, opts)) press += c;
          if (press > 0.02) {
            reflect[i] = Math.min(1.5, reflect[i] + press * dt * 2.5);
            hits += press;
          }
        }

        next[i] = Math.max(0, v);
      }
    }

    this.field = next;
    this.next = field;
    this.wallHits = hits;
    return lost;
  }

  _stats(sx, sy) {
    const N = this.size;
    let peak = 0;
    let total = 0;
    let m2 = 0;
    const cx = sx * (N - 1);
    const cy = sy * (N - 1);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = this.field[y * N + x];
        if (c > peak) peak = c;
        total += c;
        const dx = x - cx;
        const dy = y - cy;
        m2 += c * (dx * dx + dy * dy);
      }
    }
    this.peak = peak;
    this.total = total;
    this.spread = total > 1e-8 ? Math.sqrt(m2 / total) / N : 0;
  }

  /**
   * Pack RGBA:
   *   R = peak-normalized concentration
   *   G = soft glow
   *   B = reflection intensity
   *   A = leak mask (255 = open hole cell)
   */
  _packRGBA(opts = {}) {
    const N = this.size;
    const peak = Math.max(this.peak, 1e-6);
    const rgba = this.rgba;
    const reflect = this.reflect;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const c = this.field[i] / peak;
        const g = Math.min(1, Math.pow(Math.max(c, 0), 0.65));
        const r = Math.min(1, reflect[i]);
        const o = i * 4;
        rgba[o] = Math.min(255, Math.round(c * 255));
        rgba[o + 1] = Math.min(255, Math.round(g * 255));
        rgba[o + 2] = Math.min(255, Math.round(r * 255));
        rgba[o + 3] = this.isLeakCell(x, y, opts) ? 255 : 0;
      }
    }
  }
}

export function stepDiffusion(field, dt, params) {
  const opts = {
    medium: params.medium || 'gas',
    DScale: params.DScale ?? 1,
    driftScale: params.driftScale ?? 1,
    decayScale: params.decayScale ?? 1,
    sourceRate: params.sourceRate ?? 0,
    sourceX: params.sourceX ?? 0.5,
    sourceY: params.sourceY ?? 0.35,
    sourceRadius: params.sourceRadius ?? 0.035,
    leaks: !!params.leaks,
    holeSize: params.holeSize ?? 0.12,
    holeCenter: params.holeCenter ?? 0.5,
    holeWalls: params.holeWalls || ['right'],
    showReflection: params.showReflection !== false,
  };
  if (!params.paused) {
    field.step(dt * (params.speed ?? 1), opts);
  } else {
    field._packRGBA(opts);
  }
  return {
    time: field.time,
    peak: field.peak,
    total: field.total,
    spread: field.spread,
    steps: field.steps,
    massLost: field.massLost,
    leakRate: field.leakRate,
    wallHits: field.wallHits,
    size: field.size,
    medium: opts.medium,
  };
}

export function createDiffusionField(size = 160) {
  return new DiffusionField(size);
}

export { WALLS };
