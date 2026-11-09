// A small chart: lines, reference lines, dots and histogram bars on one axis
// pair, with a crosshair tooltip. Everything a station plots goes through here.
(() => {
  const QL = (globalThis.QL ||= {});
  const { el } = QL.ui;
  const { color: C, draw: D, math: M } = QL;

  const SURFACE = '#0c0e14';

  QL.Plot = class {
    constructor(host, o) {
      this.o = { height: 150, pad: { l: 38, r: 12, t: 10, b: 30 }, ...o };
      this.series = o.series;
      this.data = {};
      this.markers = {};
      this.hover = null;
      this.canvas = el('canvas', { role: 'img', 'aria-label': o.aria || 'chart' });
      this.tip = el('div', { class: 'tip' });
      this.root = el('div', { class: 'plot' }, this.canvas, this.tip);
      this.root.style.height = this.o.height + 'px';
      host.append(this.root);
      this.ctx = this.canvas.getContext('2d');
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.root);
      this.canvas.addEventListener('pointermove', (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.hover = { x: e.clientX - r.left, y: e.clientY - r.top };
        this.draw();
      });
      this.canvas.addEventListener('pointerleave', () => { this.hover = null; this.tip.classList.remove('on'); this.draw(); });
      this.resize();
    }

    // DOM legend for the card header. Text stays in ink; the key carries color.
    legend() {
      if (this.series.length < 2) return null;
      return el('div', { class: 'legend' }, this.series.map((s) =>
        el('span', {}, el('i', { class: s.type === 'dots' ? 'dot' : s.type === 'bars' ? 'bar' : s.dash ? 'dash' : '', style: { color: s.color, borderColor: s.color } }), s.label)));
    }

    resize() {
      const w = this.root.clientWidth, h = this.o.height;
      if (!w) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = w; this.h = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.height = h + 'px';
      this.draw();
    }

    set(id, pts) { this.data[id] = pts; }
    setX(min, max) { this.o.x.min = min; this.o.x.max = max; }
    setY(min, max) { this.o.y.min = min; this.o.y.max = max; }
    marker(id, m) { if (m) this.markers[id] = m; else delete this.markers[id]; }

    draw() {
      const { ctx, w, h, dpr, o } = this;
      if (!w) return;
      const { l, r, t, b } = o.pad;
      const pw = w - l - r, ph = h - t - b;
      const X = o.x, Y = o.y;
      const sx = (v) => l + ((v - X.min) / (X.max - X.min)) * pw;
      const sy = (v) => t + ph - ((v - Y.min) / (Y.max - Y.min)) * ph;
      this._sx = sx; this._sy = sy;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // grid and axes: solid hairlines, recessive
      const yt = Y.ticks || D.ticks(Y.min, Y.max, 4), xt = X.ticks || D.ticks(X.min, X.max, 5);
      const ystep = yt.length > 1 ? yt[1] - yt[0] : 1, xstep = xt.length > 1 ? xt[1] - xt[0] : 1;
      const yf = Y.fmt || ((v) => D.tickFmt(v, ystep)), xf = X.fmt || ((v) => D.tickFmt(v, xstep));
      for (const v of yt) {
        const y = Math.round(sy(v)) + 0.5;
        D.line(ctx, l, y, w - r, y, v === Y.min ? C.axis : C.grid);
        D.text(ctx, yf(v), l - 6, y, { size: 10, align: 'right', base: 'middle', color: C.ink3 });
      }
      for (const v of xt) {
        const x = sx(v);
        if (x < l - 1 || x > w - r + 1) continue;
        D.text(ctx, xf(v), x, t + ph + 13, { size: 10, align: 'center', color: C.ink3 });
      }
      D.line(ctx, l, t + ph + 0.5, w - r, t + ph + 0.5, C.axis);
      if (X.label) D.text(ctx, X.label, l + pw / 2, h - 3, { size: 10.5, align: 'center', color: C.ink3 });
      if (Y.label) D.text(ctx, Y.label, 2, 9, { size: 10.5, color: C.ink3 });

      ctx.save();
      ctx.beginPath();
      ctx.rect(l - 1, t - 6, pw + 2, ph + 7);
      ctx.clip();
      for (const s of this.series) {
        const pts = this.data[s.id];
        if (!pts || !pts.length) continue;
        if (s.type === 'bars') {
          const bw = Math.max(1, Math.min(24, Math.abs(sx(s.width) - sx(0)) - (s.gap ?? 2)));
          ctx.fillStyle = s.color;
          for (const p of pts) {
            const y = sy(p[1]), y0 = sy(Math.max(Y.min, 0)), x = sx(p[0]) - bw / 2;
            if (y0 - y < 0.5) continue;
            const rad = Math.min(4, bw / 2, y0 - y);
            ctx.beginPath();
            ctx.moveTo(x, y0); ctx.lineTo(x, y + rad);
            ctx.arcTo(x, y, x + rad, y, rad); ctx.lineTo(x + bw - rad, y);
            ctx.arcTo(x + bw, y, x + bw, y + rad, rad); ctx.lineTo(x + bw, y0);
            ctx.closePath();
            ctx.fill();
          }
        } else if (s.type === 'dots') {
          for (const p of pts) {
            const x = sx(p[0]), y = sy(p[1]);
            if (p[2]) D.line(ctx, x, sy(p[1] - p[2]), x, sy(p[1] + p[2]), s.color, 1.5);
            ctx.beginPath();
            ctx.arc(x, y, (s.r || 4) + 2, 0, M.TAU);
            ctx.fillStyle = SURFACE;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y, s.r || 4, 0, M.TAU);
            ctx.fillStyle = s.color;
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(sx(p[0]), sy(p[1])) : ctx.moveTo(sx(p[0]), sy(p[1]))));
          if (s.fill) {
            ctx.save();
            ctx.lineTo(sx(pts[pts.length - 1][0]), sy(Y.min));
            ctx.lineTo(sx(pts[0][0]), sy(Y.min));
            ctx.closePath();
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = s.color;
            ctx.fill();
            ctx.restore();
            ctx.beginPath();
            pts.forEach((p, i) => (i ? ctx.lineTo(sx(p[0]), sy(p[1])) : ctx.moveTo(sx(p[0]), sy(p[1]))));
          }
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.width || 2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.setLineDash(s.dash ? [5, 4] : []);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();

      for (const m of Object.values(this.markers)) {
        const x = Math.round(sx(m.x)) + 0.5;
        if (x < l || x > w - r) continue;
        D.line(ctx, x, t, x, t + ph, m.color || 'rgba(240,239,236,0.55)', 1);
        if (m.label) D.text(ctx, m.label, M.clamp(x, l + 24, w - r - 24), t + 9, { size: 10, align: 'center', color: C.ink2, halo: SURFACE });
      }
      this.drawHover(sx, sy, l, t, pw, ph);
    }

    valueAt(s, x) {
      const pts = this.data[s.id];
      if (!pts || !pts.length) return null;
      if (s.type === 'dots' || s.type === 'bars') {
        let best = null, bd = Infinity;
        for (const p of pts) { const d = Math.abs(p[0] - x); if (d < bd) { bd = d; best = p; } }
        return best && { x: best[0], y: best[1], snap: true, dist: bd };
      }
      if (x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
      let lo = 0, hi = pts.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][0] <= x) lo = mid; else hi = mid; }
      const a = pts[lo], b2 = pts[hi], f = b2[0] === a[0] ? 0 : (x - a[0]) / (b2[0] - a[0]);
      return { x, y: a[1] + (b2[1] - a[1]) * f };
    }

    drawHover(sx, sy, l, t, pw, ph) {
      const { ctx, o, hover, tip } = this;
      if (!hover || hover.x < l || hover.x > l + pw) { tip.classList.remove('on'); return; }
      let xv = o.x.min + ((hover.x - l) / pw) * (o.x.max - o.x.min), cx = hover.x;
      // Marks win: if a dot or bar is within reach, every series is read at its x.
      let snap = null;
      for (const s of this.series) {
        if (s.type !== 'dots' && s.type !== 'bars') continue;
        const v = this.valueAt(s, xv);
        if (!v) continue;
        const d = Math.abs(sx(v.x) - hover.x);
        if (d <= 24 && (!snap || d < snap.d)) snap = { d, x: v.x };
      }
      if (snap) { xv = snap.x; cx = sx(snap.x); }
      const rows = [];
      for (const s of this.series) {
        const v = this.valueAt(s, xv);
        if (!v) continue;
        if (v.snap && Math.abs(sx(v.x) - cx) > 3) continue;
        rows.push({ s, v });
      }
      if (!rows.length) { tip.classList.remove('on'); return; }
      D.line(ctx, Math.round(cx) + 0.5, t, Math.round(cx) + 0.5, t + ph, 'rgba(240,239,236,0.3)');
      for (const { s, v } of rows) {
        if (s.type === 'bars') continue;
        ctx.beginPath(); ctx.arc(sx(v.x), sy(v.y), 5.5, 0, M.TAU); ctx.fillStyle = SURFACE; ctx.fill();
        ctx.beginPath(); ctx.arc(sx(v.x), sy(v.y), 3.5, 0, M.TAU); ctx.fillStyle = s.color; ctx.fill();
      }
      const xf = o.x.tipFmt || o.x.fmt || ((v) => M.sig(v, 3));
      const yf = o.y.tipFmt || o.y.fmt || ((v) => M.sig(v, 3));
      tip.replaceChildren(
        el('div', { class: 'hd', text: `${o.x.name || o.x.label || 'x'}: ${xf(xv)}` }),
        ...rows.map(({ s, v }) => el('div', { class: 'row' }, el('i', { style: { borderColor: s.color } }), el('b', { text: (s.fmt || yf)(v.y) }), s.label)));
      tip.classList.add('on');
      const tw = tip.offsetWidth;
      tip.style.left = (cx + 14 + tw > this.w ? cx - tw - 12 : cx + 14) + 'px';
      tip.style.top = Math.max(0, Math.min(this.h - tip.offsetHeight, hover.y - 20)) + 'px';
    }

    destroy() { this.ro.disconnect(); this.root.remove(); }
  };
})();
