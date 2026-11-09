// Color maps and canvas helpers shared by every station.
(() => {
  const QL = (globalThis.QL ||= {});
  const M = QL.math;
  const C = (QL.color = {});
  const D = (QL.draw = {});

  // Phase of a complex amplitude as a color. The same map lives in the GLSL.
  C.phase = (ph) => {
    const f = (o) => 255 * (0.1 + 0.9 * (0.5 + 0.5 * Math.cos(ph - o)));
    return [f(0), f(2.0944), f(4.1888)];
  };
  C.css = (rgb, a = 1) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
  C.phaseCss = (ph, a = 1) => C.css(C.phase(ph), a);
  C.wheel = () => {
    const stops = [];
    for (let i = 0; i <= 24; i++) stops.push(C.phaseCss((-i / 24) * M.TAU));
    return `conic-gradient(from 90deg, ${stops.join(',')})`;
  };

  // Approximate color of monochromatic light (nm). Outside the visible band
  // it returns a dim violet or dim red so ultraviolet and infrared stay drawable.
  C.light = (nm) => {
    if (nm < 380) return [150, 120, 255];
    if (nm > 750) return [150, 40, 40];
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
    else r = 1;
    const f = nm < 420 ? 0.45 + (0.55 * (nm - 380)) / 40 : nm > 700 ? 0.45 + (0.55 * (750 - nm)) / 50 : 1;
    return [r, g, b].map((c) => 255 * Math.pow(c * f, 0.8));
  };

  C.ink = '#f0efec';
  C.ink2 = '#c3c2b7';
  C.ink3 = '#898781';
  C.ink4 = '#5d5c58';
  C.grid = 'rgba(255,255,255,0.06)';
  C.axis = 'rgba(255,255,255,0.16)';
  C.theory = '#3987e5';
  C.data = '#d95926';
  C.third = '#199e70';
  C.up = [255, 190, 92];     // spin up / detector A
  C.down = [110, 170, 255];  // spin down / detector B
  C.hit = [255, 232, 196];   // a detected particle

  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const SERIF = 'ui-serif, "New York", "Iowan Old Style", Georgia, serif';
  D.font = (size = 11, weight = 400, family = 'sans') =>
    `${family === 'serif-italic' ? 'italic ' : ''}${weight} ${size}px ${family === 'mono' ? MONO : family.startsWith('serif') ? SERIF : SANS}`;

  D.text = (ctx, str, x, y, o = {}) => {
    ctx.save();
    ctx.font = D.font(o.size, o.weight, o.family);
    ctx.fillStyle = o.color || C.ink3;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.halo) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = typeof o.halo === 'string' ? o.halo : 'rgba(6,7,11,0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  D.rr = (ctx, x, y, w, h, r) => {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Soft additive dot: the lab's universal "a particle was here".
  D.glow = (ctx, x, y, r, rgb, a = 1) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.css(rgb, a));
    g.addColorStop(0.35, C.css(rgb, a * 0.35));
    g.addColorStop(1, C.css(rgb, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, M.TAU);
    ctx.fill();
    ctx.restore();
  };

  D.line = (ctx, x1, y1, x2, y2, color = C.axis, width = 1, dash) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  D.arrow = (ctx, x1, y1, x2, y2, color = C.ink, width = 1.5, head = 6) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
    ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Dimension line with end ticks and a centred label.
  D.dimension = (ctx, x1, y1, x2, y2, label, o = {}) => {
    const color = o.color || C.ink3;
    const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a), t = 4;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.moveTo(x1 - nx * t, y1 - ny * t); ctx.lineTo(x1 + nx * t, y1 + ny * t);
    ctx.moveTo(x2 - nx * t, y2 - ny * t); ctx.lineTo(x2 + nx * t, y2 + ny * t);
    ctx.stroke();
    ctx.restore();
    const side = o.side ?? 1;
    D.text(ctx, label, (x1 + x2) / 2 + nx * 10 * side, (y1 + y2) / 2 + ny * 10 * side, {
      size: 11, color: o.textColor || C.ink2, align: 'center', base: 'middle', halo: true, family: 'mono',
    });
  };

  D.ticks = (min, max, target = 5) => {
    const span = max - min;
    if (!(span > 0)) return [min];
    const raw = span / target, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  };
  D.tickFmt = (v, step) => {
    const d = Math.max(0, -Math.floor(Math.log10(Math.abs(step) || 1) + 1e-9));
    return v.toFixed(Math.min(d, 6));
  };

  // A wavefunction on a line: height is probability density (or |psi| when
  // o.amp is set), color is phase.
  // xpx(i) = x0 + i * dpx maps a grid index to canvas pixels.
  D.wave = (ctx, o) => {
    const { re, im, x0, dpx, baseY, scale, maxH = 1e9 } = o;
    const left = Math.max(o.left ?? -1e9, x0 + o.i0 * dpx), right = Math.min(o.right ?? 1e9, x0 + o.i1 * dpx);
    if (right <= left) return;
    const alpha = o.alpha ?? 0.9;
    const step = 1;
    const tops = [];
    let peak = 0;
    ctx.save();
    for (let px = Math.floor(left); px <= right; px += step) {
      const f = (px - x0) / dpx;
      const i = Math.max(o.i0, Math.min(o.i1 - 1, Math.floor(f))), w = M.clamp(f - i, 0, 1);
      const r = re[i] + (re[i + 1] - re[i]) * w, m = im[i] + (im[i + 1] - im[i]) * w;
      const rho = r * r + m * m;
      const h = Math.min(maxH, scale * (o.amp ? Math.sqrt(rho) : rho));
      tops.push(px, baseY - h);
      if (h > peak) peak = h;
      if (h < 0.3) continue;
      ctx.fillStyle = o.tint ? o.tint : C.phaseCss(Math.atan2(m, r) + (o.phase0 || 0), alpha);
      ctx.fillRect(px, baseY - h, step + 0.5, h);
    }
    if (o.shade !== false && peak > 2) {
      // Darken toward the baseline so the crest reads as the bright edge.
      const g = ctx.createLinearGradient(0, baseY - peak, 0, baseY);
      g.addColorStop(0, 'rgba(6,7,11,0)');
      g.addColorStop(1, 'rgba(6,7,11,0.6)');
      ctx.beginPath();
      ctx.moveTo(tops[0], baseY);
      for (let k = 0; k < tops.length; k += 2) ctx.lineTo(tops[k], tops[k + 1]);
      ctx.lineTo(tops[tops.length - 2], baseY);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
    if (o.outline !== false) {
      // Lift the pen where the wave is flat so the baseline stays clean.
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k < tops.length; k += 2) {
        if (baseY - tops[k + 1] < 0.45) { pen = false; continue; }
        pen ? ctx.lineTo(tops[k], tops[k + 1]) : ctx.moveTo(tops[k], tops[k + 1]);
        pen = true;
      }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.stroke || 'rgba(255,255,255,0.9)';
      ctx.lineWidth = o.lineWidth || 1.25;
      ctx.stroke();
    }
    ctx.restore();
  };

  // Real-valued curve (an eigenfunction, a potential) through index space.
  D.curve = (ctx, arr, o) => {
    const { x0, dpx, baseY, scale } = o;
    ctx.save();
    ctx.beginPath();
    let started = false;
    const stride = Math.max(1, Math.floor(1 / dpx));
    for (let i = o.i0; i <= o.i1; i += stride) {
      const x = x0 + i * dpx, y = baseY - scale * arr[i];
      started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      started = true;
    }
    ctx.strokeStyle = o.color || C.ink3;
    ctx.lineWidth = o.width || 1;
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.stroke();
    ctx.restore();
  };

  // Pointer hit regions for canvas-drawn handles. Rebuilt every frame:
  //   zones.begin(); zones.add({ id, x, y, w, h, cursor, drag, click }); zones.end();
  QL.Zones = class {
    constructor(canvas) {
      this.canvas = canvas;
      this.list = [];
      this.next = [];
      this.hover = null;
      this.active = null;
      this.pos = { x: -1, y: -1 };
      const at = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const find = (p) => {
        for (let i = this.list.length - 1; i >= 0; i--) {
          const z = this.list[i];
          if (z.r != null ? Math.hypot(p.x - z.x, p.y - z.y) <= z.r : p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z;
        }
        return null;
      };
      const byId = (id) => this.list.find((z) => z.id === id);
      this._down = (e) => {
        const p = at(e), z = find(p);
        if (!z) return;
        this.active = { id: z.id, start: p, moved: false };
        canvas.setPointerCapture?.(e.pointerId);
        z.down?.(p);
        e.preventDefault();
      };
      this._move = (e) => {
        const p = at(e);
        this.pos = p;
        if (this.active) {
          const z = byId(this.active.id), s = this.active.start;
          if (Math.hypot(p.x - s.x, p.y - s.y) > 3) this.active.moved = true;
          z?.drag?.({ x: p.x, y: p.y, dx: p.x - s.x, dy: p.y - s.y, start: s });
          return;
        }
        const z = find(p);
        this.hover = z ? z.id : null;
        canvas.style.cursor = z ? z.cursor || 'pointer' : '';
      };
      this._up = (e) => {
        if (!this.active) return;
        const z = byId(this.active.id), p = at(e);
        if (!this.active.moved) z?.click?.(p);
        z?.up?.(p);
        this.active = null;
      };
      this._leave = () => { if (!this.active) { this.hover = null; this.pos = { x: -1, y: -1 }; canvas.style.cursor = ''; } };
      canvas.addEventListener('pointerdown', this._down);
      canvas.addEventListener('pointermove', this._move);
      canvas.addEventListener('pointerup', this._up);
      canvas.addEventListener('pointercancel', this._up);
      canvas.addEventListener('pointerleave', this._leave);
    }
    begin() { this.next = []; }
    add(z) { this.next.push(z); return this.hover === z.id || this.active?.id === z.id; }
    end() { this.list = this.next; }
    isActive(id) { return this.active?.id === id; }
    isHot(id) { return this.hover === id || this.active?.id === id; }
    destroy() {
      const c = this.canvas;
      c.removeEventListener('pointerdown', this._down);
      c.removeEventListener('pointermove', this._move);
      c.removeEventListener('pointerup', this._up);
      c.removeEventListener('pointercancel', this._up);
      c.removeEventListener('pointerleave', this._leave);
    }
  };
})();
