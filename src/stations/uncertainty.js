// Station 2: the uncertainty principle. One wave, seen two ways: where the
// electron can be found, and how fast it can be going. Squeeze one picture
// and the other spreads, because they are Fourier transforms of each other.
(() => {
  const QL = globalThis.QL;
  const { el, slider, segmented, button, buttons } = QL.ui;
  const { math: M, draw: D, color: C, units: U } = QL;

  QL.register({
    id: 'uncertainty',
    title: 'Squeeze a wave',
    short: 'Uncertainty',
    kicker: 'The uncertainty principle',
    idea: 'Pin down where an electron is and you lose track of how fast it is going. Not because you jostled it: a wave cannot be narrow and have one wavelength at the same time.',

    create(lab) {
      const N = 8192, BOX = 200, dx = BOX / N, dk = M.TAU / BOX;
      const XV = [-8, 8], KV = [-14, 14], RATE = 0.35;
      const xs = new Float64Array(N), ks = new Float64Array(N);
      for (let i = 0; i < N; i++) { xs[i] = (i - N / 2) * dx; ks[i] = (i < N / 2 ? i : i - N) * dk; }
      const fR = new Float64Array(N), fI = new Float64Array(N);   // spectrum at t = 0
      const pR = new Float64Array(N), pI = new Float64Array(N);   // psi(x, t)
      const mom = new Float64Array(N), zero = new Float64Array(N); // sqrt of momentum density, k ascending
      const S = { shape: 'gauss', dx: 0.6, p0: 3, playing: false, speed: 1, t: 0 };
      const stats = { x: 0, dx: 0, dx0: 0, p: 0, dp: 0 };
      const dots = { x: [], p: [] };
      const seen = { shapes: new Set(['gauss']), released: false };
      let scaleX = 0, scaleK = 0;

      const L = lab.layer('2d');
      const zones = new QL.Zones(L.canvas);
      lab.onDestroy(() => zones.destroy());

      // -------------------------------------------------------------- state
      const fill = (width) => {
        for (let i = 0; i < N; i++) {
          const x = xs[i];
          let a;
          if (S.shape === 'gauss') a = Math.exp(-(x * x) / (4 * width * width));
          else if (S.shape === 'slit') { const half = (width * Math.sqrt(12)) / 2, e = half / 7; a = 0.5 * (Math.tanh((x + half) / e) - Math.tanh((x - half) / e)); }
          else { const sb = width / 4, d = width * Math.sqrt(15 / 16); a = Math.exp(-((x - d) ** 2) / (4 * sb * sb)) + Math.exp(-((x + d) ** 2) / (4 * sb * sb)); }
          pR[i] = a * Math.cos(S.p0 * x);
          pI[i] = a * Math.sin(S.p0 * x);
        }
      };
      const spreadX = () => {
        let s = 0, m = 0, v = 0;
        for (let i = 0; i < N; i++) { const p = pR[i] * pR[i] + pI[i] * pI[i]; s += p; m += p * xs[i]; }
        m /= s;
        for (let i = 0; i < N; i++) { const p = pR[i] * pR[i] + pI[i] * pI[i]; v += p * (xs[i] - m) ** 2; }
        return { s, m, sd: Math.sqrt(v / s) };
      };
      const build = () => {
        fill(S.dx);
        if (S.shape === 'slit') fill((S.dx * S.dx) / spreadX().sd); // tanh edges widen it a touch
        const { s } = spreadX();
        const nrm = 1 / Math.sqrt(s * dx);
        for (let i = 0; i < N; i++) { pR[i] *= nrm; pI[i] *= nrm; fR[i] = pR[i]; fI[i] = pI[i]; }
        M.fft(fR, fI);
        let ms = 0, mm = 0, mv = 0;
        for (let j = 0; j < N; j++) {
          const d = ((fR[j] * fR[j] + fI[j] * fI[j]) * dx * dx) / M.TAU;
          mom[(j + N / 2) % N] = Math.sqrt(d);
          ms += d; mm += d * ks[j];
        }
        mm /= ms;
        for (let j = 0; j < N; j++) mv += (((fR[j] * fR[j] + fI[j] * fI[j]) * dx * dx) / M.TAU) * (ks[j] - mm) ** 2;
        stats.p = mm; stats.dp = Math.sqrt(mv / ms);
        S.t = 0;
        const sx = spreadX();
        stats.x = sx.m; stats.dx = stats.dx0 = sx.sd;
        dots.x.length = 0; dots.p.length = 0;
      };
      const evolve = () => {
        for (let j = 0; j < N; j++) {
          const ph = -0.5 * ks[j] * ks[j] * S.t, c = Math.cos(ph), s = Math.sin(ph);
          pR[j] = fR[j] * c - fI[j] * s;
          pI[j] = fR[j] * s + fI[j] * c;
        }
        M.fft(pR, pI, true);
        const sx = spreadX();
        stats.x = sx.m; stats.dx = sx.sd;
      };

      const sample = (which, count) => {
        const w = new Float64Array(N);
        if (which === 'x') for (let i = 0; i < N; i++) w[i] = pR[i] * pR[i] + pI[i] * pI[i];
        else for (let i = 0; i < N; i++) w[i] = mom[i] * mom[i];
        const table = M.cdf(w);
        for (let n = 0; n < count; n++) {
          const idx = M.sample(table);
          const v = which === 'x' ? (idx - N / 2) * dx : (idx - N / 2) * dk;
          dots[which].push({ v, j: Math.random(), age: -n * 0.004 });
        }
        if (dots[which].length > 600) dots[which].splice(0, dots[which].length - 600);
      };
      const sd = (list) => {
        if (list.length < 2) return NaN;
        let m = 0, v = 0;
        for (const d of list) m += d.v;
        m /= list.length;
        for (const d of list) v += (d.v - m) ** 2;
        return Math.sqrt(v / (list.length - 1));
      };

      // ------------------------------------------------------------ controls
      const sDx = slider({
        label: 'Spread in position', min: 0.1, max: 3, step: 0.01, log: true, value: S.dx, fmt: (v) => M.fix(v, 2), unit: 'nm',
        onInput: (v) => { S.dx = v; build(); },
      });
      const sP = slider({
        label: 'Average velocity', min: 0, max: 6, step: 0.1, value: S.p0, fmt: (v) => M.int(v * U.KMS), unit: 'km/s',
        hint: 'Faster means a shorter wavelength: p = h / wavelength.', onInput: (v) => { S.p0 = v; build(); },
      });
      const shape = segmented({
        label: 'Shape of the wave',
        options: [{ value: 'gauss', label: 'Bell curve' }, { value: 'slit', label: 'One slit' }, { value: 'two', label: 'Two slits' }],
        value: S.shape, onChange: (v) => { S.shape = v; seen.shapes.add(v); build(); },
      });
      lab.control(shape, sDx, sP,
        el('div', { class: 'ctl' }, el('div', { class: 'row' }, el('span', { class: 'lab', text: 'Measure identically prepared electrons' }))),
        buttons(button({ label: 'Position x 1', onClick: () => sample('x', 1) }), button({ label: 'Position x 200', onClick: () => sample('x', 200) })),
        buttons(button({ label: 'Velocity x 1', onClick: () => sample('p', 1) }), button({ label: 'Velocity x 200', onClick: () => sample('p', 200) })),
        buttons(button({ label: 'Clear measurements', icon: 'trash', onClick: () => { dots.x.length = 0; dots.p.length = 0; } })));

      const stX = lab.stat({ label: 'Spread in position' });
      const stP = lab.stat({ label: 'Spread in velocity' });
      const stSX = lab.stat({ label: 'Measured position spread', swatch: C.data });
      const stSP = lab.stat({ label: 'Measured velocity spread', swatch: C.data });

      lab.physics(`
        <p>The lower picture is the Fourier transform of the upper one: it says how much of each wavelength the wave contains, and wavelength is momentum.
        A narrow bump can only be built by adding many different wavelengths, so its momentum is broad. That is the whole content of</p>
        <div class="eq">&Delta;x &middot; &Delta;p &ge; &#295; / 2</div>
        <p>The bell curve reaches the limit exactly; every other shape does worse. Let go of the packet and the different velocities inside it carry it apart,
        so the position spread grows while the momentum spread stays put.</p>`);

      // ---------------------------------------------------------------- dock
      const gcard = lab.card({ title: 'Uncertainty product', sub: 'the hatched zone is forbidden' });
      const gauge = el('canvas', { style: { width: '100%', height: '74px', display: 'block' }, role: 'img', 'aria-label': 'Uncertainty product gauge' });
      gcard.body.append(gauge);
      const gfit = QL.ui.fitCanvas(gauge, 74), gctx = gfit.ctx;
      const drawGauge = () => {
        if (!gfit.fit()) return;
        const gw = gfit.w;
        const ctx = gctx, l = 10, r = gw - 10, y = 44, max = 3, prod = stats.dx * stats.dp;
        const X = (v) => l + (Math.min(v, max) / max) * (r - l);
        ctx.clearRect(0, 0, gw, 74);
        D.rr(ctx, l, y - 4, r - l, 8, 4); ctx.fillStyle = 'rgba(57,135,229,0.18)'; ctx.fill();
        ctx.save();
        D.rr(ctx, l, y - 4, X(0.5) - l, 8, 4); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(l, y - 4, X(0.5) - l, 8);
        ctx.strokeStyle = 'rgba(240,239,236,0.35)'; ctx.lineWidth = 1;
        for (let x = l - 10; x < X(0.5) + 10; x += 5) { ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x + 9, y - 5); ctx.stroke(); }
        ctx.restore();
        D.rr(ctx, X(0.5), y - 4, Math.max(0, X(prod) - X(0.5)), 8, 4); ctx.fillStyle = C.theory; ctx.fill();
        D.line(ctx, X(0.5), y - 11, X(0.5), y + 11, C.ink, 2);
        D.text(ctx, 'limit ħ/2', X(0.5) - 4, y + 24, { size: 10, color: C.ink2 });
        for (const v of [1, 2, 3]) D.text(ctx, v + ' ħ', X(v), y + 24, { size: 10, align: v === 3 ? 'right' : 'center', color: C.ink4 });
        ctx.beginPath(); ctx.arc(X(prod), y, 7, 0, M.TAU); ctx.fillStyle = '#0c0e14'; ctx.fill();
        ctx.beginPath(); ctx.arc(X(prod), y, 5, 0, M.TAU); ctx.fillStyle = C.ink; ctx.fill();
        D.text(ctx, `${M.fix(prod, 2)} ħ`, l, 20, { size: 19, weight: 500, color: C.ink });
        D.text(ctx, prod < 0.505 ? 'the smallest value nature allows' : `${M.fix(prod / 0.5, 1)} times the minimum`, r, 19, { size: 11, color: C.ink3, align: 'right' });
      };
      const fcard = lab.card({ title: 'For a real electron', sub: 'what the trade costs', width: 300 });
      const fText = el('div', { class: 'tally' }, el('div', { class: 'big' }), el('div', { class: 'nums', style: { whiteSpace: 'normal', lineHeight: '1.5' } }));
      fcard.body.append(fText);

      const tp = lab.transport({
        playing: false, speeds: [0.25, 1, 4], speed: 1, clock: true,
        onToggle: (p) => { S.playing = p; if (p) seen.released = true; },
        onReset: () => { S.t = 0; evolve(); },
        onSpeed: (v) => { S.speed = v; },
      });

      // -------------------------------------------------------------- guide
      const set = (o) => { Object.assign(S, o); shape.value = S.shape; sDx.value = S.dx; sP.value = S.p0; seen.shapes.add(S.shape); S.playing = false; tp.set(false); build(); };
      lab.guide([
        {
          id: 'squeeze', title: 'Squeeze it',
          body: 'Drag one of the two handles on the upper wave inward (or use the slider) until the spread in position is <b>below 0.2 nm</b>. Watch the lower picture as you go.',
          check: () => S.dx <= 0.2 && S.t === 0,
          show: () => set({ dx: 0.15 }),
          insight: `The tighter you squeezed the position, the wider the range of velocities became. A narrow bump is made by adding together waves of <b>many different wavelengths</b>, and each wavelength is a different ${QL.ui.term('momentum')}. You did not disturb anything. You only changed the shape of one wave.`,
        },
        {
          id: 'relax', title: 'Now go the other way',
          body: 'Stretch the wave out until the spread in position is <b>above 2 nm</b>.',
          check: () => S.dx >= 2 && S.t === 0,
          show: () => set({ dx: 2.4 }),
          insight: 'A long, regular wave train has one clear wavelength, so one clear velocity. The price is that it is spread over a wide stretch of space. You can have a sharp position or a sharp velocity, and every setting in between, but never both. The product of the two spreads cannot fall below &#295;/2.',
        },
        {
          id: 'measure', title: 'Two hundred identical electrons',
          body: 'Prepare a spread of about 0.5 nm, then press <b>Position x 200</b> and <b>Velocity x 200</b>. Each dot is one electron, prepared exactly like all the others, measured once.',
          predict: { q: '200 electrons are prepared in exactly the same state. Measuring the position of each gives:', options: ['The same answer 200 times', '200 scattered answers, spread over the width of the wave', 'Answers that drift as the detector wears the wave down'], answer: 1 },
          check: () => dots.x.length >= 200 && dots.p.length >= 200,
          progress: () => `${Math.min(200, dots.x.length)} positions, ${Math.min(200, dots.p.length)} velocities`,
          show: () => { set({ dx: 0.5 }); sample('x', 200); sample('p', 200); },
          insight: 'Identical preparation, different results. The spread of the dots is what "uncertainty" means: not the error of an instrument, and not a kick from the measurement, but the <b>scatter of outcomes</b> across perfectly identical electrons. The two readouts in orange are measured from your dots and match the widths of the waves.',
        },
        {
          id: 'cheat', title: 'Try to beat the limit',
          body: 'Try the <b>One slit</b> and <b>Two slits</b> shapes at any widths you like. Keep an eye on the gauge under the bench.',
          check: () => seen.shapes.size >= 3,
          progress: () => `${seen.shapes.size} / 3 shapes tried`,
          show: () => { seen.shapes.add('slit'); set({ shape: 'two', dx: 0.8, p0: 0 }); },
          insight: 'The marker never enters the hatched zone. The bell curve sits exactly on the limit and every other shape lands above it. Look at the velocity pictures too: one slit gives a central peak with faint side lobes, two slits give <b>stripes</b>. Those are the diffraction and interference patterns from the double slit station. A far-away screen simply displays the momentum of the wave that left the slits.',
        },
        {
          id: 'release', title: 'Let it go',
          body: 'Make a tight packet (below 0.3 nm) and press <b>play</b> to let it evolve freely. Then try again with a wide one.',
          check: () => S.t > 0 && stats.dx > 2.5 * stats.dx0 && stats.dx0 < 0.4,
          show: () => { set({ shape: 'gauss', dx: 0.25, p0: 2 }); S.playing = true; tp.set(true); seen.released = true; },
          insight: 'The tight packet flew apart almost at once, because it contained a wide range of velocities and the fast parts outran the slow ones. Its velocity picture did not change at all. A free electron pinned to the width of an atom would spread across hundreds of metres within a millisecond. Position knowledge does not keep.',
        },
      ]);

      // ------------------------------------------------------------ drawing
      const draw = (dt) => {
        const { ctx, w, h } = L;
        ctx.clearRect(0, 0, w, h);
        zones.begin();
        const left = 30, right = w - 30, top = 40, bottom = h - 74;
        const mid = (top + bottom) / 2;
        const A = { top: top + 22, base: mid - 46 }, B = { top: mid + 34, base: bottom - 34 };
        const X = (x) => left + ((x - XV[0]) / (XV[1] - XV[0])) * (right - left);
        const Kx = (k) => left + ((k - KV[0]) / (KV[1] - KV[0])) * (right - left);
        const hA = A.base - A.top, hB = B.base - B.top;

        // titles
        D.text(ctx, 'WHERE IT CAN BE FOUND', left, A.top - 12, { size: 10.5, weight: 600, color: C.ink3 });
        D.text(ctx, 'position (nm)', right, A.top - 12, { size: 10.5, align: 'right', color: C.ink4 });
        D.text(ctx, 'HOW FAST IT CAN BE GOING', left, B.top - 12, { size: 10.5, weight: 600, color: C.ink3 });
        D.text(ctx, 'velocity (km/s)', right, B.top - 12, { size: 10.5, align: 'right', color: C.ink4 });

        const axis = (base, map, range, fmt) => {
          D.line(ctx, left, base + 0.5, right, base + 0.5, C.axis);
          for (const v of D.ticks(range[0], range[1], 8)) {
            if (v <= range[0] || v >= range[1]) continue;
            D.line(ctx, map(v), base, map(v), base + 4, C.axis);
            D.text(ctx, fmt(v), map(v), base + 44, { size: 10.5, align: 'center', family: 'mono' });
          }
        };
        axis(A.base, X, XV, (v) => String(v));
        axis(B.base, (v) => Kx(v / U.KMS), [KV[0] * U.KMS, KV[1] * U.KMS], (v) => M.int(v));

        // position picture
        let peakX = 1e-9, peakK = 1e-9;
        const iA = Math.max(0, Math.floor((XV[0] + BOX / 2) / dx)), iB = Math.min(N - 2, Math.ceil((XV[1] + BOX / 2) / dx));
        for (let i = iA; i <= iB; i += 2) peakX = Math.max(peakX, pR[i] * pR[i] + pI[i] * pI[i]);
        const jA = Math.max(0, Math.floor(KV[0] / dk + N / 2)), jB = Math.min(N - 2, Math.ceil(KV[1] / dk + N / 2));
        for (let j = jA; j <= jB; j++) peakK = Math.max(peakK, mom[j] * mom[j]);
        const targetX = (hA * 0.92) / peakX, targetK = (hB * 0.92) / peakK;
        scaleX = scaleX ? scaleX + (targetX - scaleX) * Math.min(1, dt * 10 + (dt ? 0 : 1)) : targetX;
        scaleK = scaleK ? scaleK + (targetK - scaleK) * Math.min(1, dt * 10 + (dt ? 0 : 1)) : targetK;
        ctx.save();
        ctx.beginPath(); ctx.rect(left, 0, right - left, h); ctx.clip();
        D.wave(ctx, { re: pR, im: pI, i0: iA, i1: iB, x0: X(-BOX / 2), dpx: ((right - left) / (XV[1] - XV[0])) * dx, baseY: A.base, scale: scaleX, maxH: hA + 10, left, right });
        D.wave(ctx, { re: mom, im: zero, i0: jA, i1: jB, x0: Kx((-N / 2) * dk), dpx: ((right - left) / (KV[1] - KV[0])) * dk, baseY: B.base, scale: scaleK, maxH: hB + 10, left, right, tint: 'rgba(132,150,255,0.82)' });
        ctx.restore();

        // spread brackets, and the drag handles on the position picture
        const bracket = (cx, half, y, label, hot) => {
          const a = Math.max(left, cx - half), b = Math.min(right, cx + half);
          D.line(ctx, a, y, b, y, hot ? C.ink : 'rgba(240,239,236,0.55)', hot ? 2 : 1.25);
          D.text(ctx, label, M.clamp((a + b) / 2, left + 70, right - 70), y - 8, { size: 11.5, weight: 600, align: 'center', color: C.ink, halo: true, family: 'mono' });
        };
        const half = (stats.dx / (XV[1] - XV[0])) * (right - left), cx = X(stats.x), yb = A.top + 4;
        const hotX = zones.isHot('hl') || zones.isHot('hr');
        bracket(cx, half, yb, `Δx = ${M.fix(stats.dx, 2)} nm`, hotX);
        if (S.t === 0) {
          for (const [id, sgn] of [['hl', -1], ['hr', 1]]) {
            const hx = cx + sgn * half;
            if (hx < left - 4 || hx > right + 4) continue;
            D.line(ctx, hx, yb - 2, hx, A.base, zones.isHot(id) ? 'rgba(240,239,236,0.7)' : 'rgba(240,239,236,0.22)', 1, [3, 4]);
            D.rr(ctx, hx - 5, yb - 9, 10, 18, 4);
            ctx.fillStyle = zones.isHot(id) ? '#fff' : C.ink; ctx.fill();
            zones.add({
              id, x: hx - 12, y: yb - 14, w: 24, h: A.base - yb + 14, cursor: 'ew-resize',
              drag: (p) => { S.dx = M.clamp(Math.abs(((p.x - cx) / (right - left)) * (XV[1] - XV[0])), 0.1, 3); sDx.value = S.dx; build(); },
            });
          }
        }
        const halfK = (stats.dp / (KV[1] - KV[0])) * (right - left);
        bracket(Kx(stats.p), halfK, B.top + 4, `Δv = ${M.int(stats.dp * U.KMS)} km/s`, false);

        // measurement dots
        const strip = (list, map, base) => {
          for (const d of list) {
            d.age += dt;
            if (d.age < 0) continue;
            const px = map(d.v);
            if (px < left || px > right) continue;
            const pop = Math.max(0, 1 - d.age / 0.5);
            if (pop > 0) D.glow(ctx, px, base + 9 + d.j * 14, 5 + 10 * pop, C.hit, 0.7 * pop);
            ctx.beginPath(); ctx.arc(px, base + 9 + d.j * 14, 2.2, 0, M.TAU);
            ctx.fillStyle = 'rgba(217,89,38,0.85)'; ctx.fill();
          }
        };
        strip(dots.x, X, A.base);
        strip(dots.p, Kx, B.base);
        zones.end();

        drawGauge();
        tp.clock(`${M.fix(S.t * U.FS, 1)} fs`);
        stX.set(M.fix(stats.dx, 2), 'nm');
        stP.set(M.int(stats.dp * U.KMS), 'km/s');
        const mx = sd(dots.x), mp = sd(dots.p);
        stSX.set(Number.isFinite(mx) ? M.fix(mx, 2) : 'no data', Number.isFinite(mx) ? `nm, ${dots.x.length} dots` : '');
        stSP.set(Number.isFinite(mp) ? M.int(mp * U.KMS) : 'no data', Number.isFinite(mp) ? `km/s, ${dots.p.length} dots` : '');
        const big = fText.children[0], small = fText.children[1];
        const txt = `± ${M.int(stats.dp * U.KMS)} km/s`;
        if (big.textContent !== txt) {
          big.textContent = txt;
          small.textContent = `Known to within ${M.fix(stats.dx0, 2)} nm, the electron's velocity is uncertain by at least this much. ${stats.dx0 < 0.2 ? 'About the size of an atom: this is why atomic electrons move so fast.' : stats.dx0 > 1.5 ? 'A loosely held electron can be nearly at rest.' : ''}`;
        }
      };

      lab.frame((dt) => {
        if (S.playing) { S.t += RATE * S.speed * dt; evolve(); if (Math.abs(stats.x) > 60) { S.t = 0; evolve(); } }
        draw(dt);
      });
      lab.note('Drag the handles on the upper wave');
      build();
      return { get state() { return { S, stats, dots, seen }; }, sample, build };
    },
  });
})();
