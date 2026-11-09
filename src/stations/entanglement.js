// Station 6: entanglement. Pairs of spin-1/2 particles fly apart to two
// analyzers. Swap the source for "classical twins" that carry instructions
// and run Bell's test on both: the classical world has a ceiling, and
// nature goes through it.
(() => {
  const QL = globalThis.QL;
  const { el, slider, segmented, toggle, button, buttons } = QL.ui;
  const { math: M, draw: D, color: C } = QL;

  const RAD = Math.PI / 180;
  const fold = (a) => { a = ((a % 360) + 360) % 360; return a > 180 ? 360 - a : a; };
  const BELL = [[0, 45], [0, 135], [90, 45], [90, 135]];   // Alice a, a' against Bob b, b'

  QL.register({
    id: 'entanglement',
    title: 'Spooky correlations',
    short: 'Entanglement',
    kicker: 'Entanglement and Bell\'s test',
    idea: 'Two particles from one source give random results that match too well for either to have carried its answer along. Bell\'s test lets you check that claim instead of believing it.',

    create(lab) {
      const S = { source: 'quantum', a: 0, b: 0, rate: 10, stream: true, speed: 1, playing: true };
      const pairs = [], tape = [];
      const stats = { n: 0, same: 0, aUp: 0, bUp: 0 };
      const sweep = { quantum: new Map(), classical: new Map() };
      const aliceSeen = new Map();
      const bell = { active: false, left: 0, source: null, cells: null, result: { quantum: null, classical: null } };
      let emitAcc = 0, lampA = [0, 0], lampB = [0, 0];

      const L = lab.layer('2d');
      const zones = new QL.Zones(L.canvas);
      lab.onDestroy(() => zones.destroy());

      // -------------------------------------------------------- the physics
      // One pair measured along a (Alice) and b (Bob). Returns [+1 or -1, +1 or -1].
      const measure = (a, b, source) => {
        if (source === 'quantum') {
          // Singlet state: Alice is 50/50, and Bob is opposite with probability cos^2 of half the angle between them.
          const A = Math.random() < 0.5 ? 1 : -1;
          const opposite = Math.random() < Math.cos(((a - b) * RAD) / 2) ** 2;
          return [A, opposite ? -A : A, null];
        }
        // Classical twins: a shared hidden direction, fixed at the source, decides both answers.
        const hidden = Math.random() * 360;
        const A = Math.cos((a - hidden) * RAD) >= 0 ? 1 : -1;
        const B = Math.cos((b - hidden) * RAD) >= 0 ? -1 : 1;
        return [A, B, hidden];
      };
      const qE = (d) => -Math.cos(d * RAD);
      const cE = (d) => -1 + (2 * fold(d)) / 180;
      const tally = (a, b, A, B, source) => {
        stats.n++; if (A === B) stats.same++; if (A > 0) stats.aUp++; if (B > 0) stats.bUp++;
        const key = Math.round(fold(a - b) / 5) * 5, map = sweep[source];
        const e = map.get(key) || { n: 0, same: 0 };
        e.n++; if (A === B) e.same++;
        map.set(key, e);
        if (source === 'quantum') { const s = aliceSeen.get(a) || 0; aliceSeen.set(a, s + 1); }
      };
      const runFast = (n) => {
        for (let i = 0; i < n; i++) { const [A, B] = measure(S.a, S.b, S.source); tally(S.a, S.b, A, B, S.source); pushTape(A, B); }
        refreshChart();
      };
      const pushTape = (A, B) => { tape.push([A, B]); if (tape.length > 80) tape.shift(); };
      const resetStats = () => { stats.n = stats.same = stats.aUp = stats.bUp = 0; pairs.length = 0; tape.length = 0; };

      const startBell = () => {
        bell.active = true; bell.left = 4000; bell.source = S.source;
        bell.cells = BELL.map(() => ({ n: 0, same: 0 }));
        bell.keep = [S.a, S.b];
        pairs.length = 0;
      };
      const bellS = (cells) => {
        const E = cells.map((c) => (c.n ? (2 * c.same - c.n) / c.n : 0));
        const err = Math.sqrt(cells.reduce((s, c, i) => s + (c.n ? (1 - E[i] * E[i]) / c.n : 0), 0));
        return { S: Math.abs(E[0] - E[1]) + Math.abs(E[2] + E[3]), err, E, n: cells.reduce((s, c) => s + c.n, 0) };
      };

      // ------------------------------------------------------------ controls
      const angFmt = (v) => v + '°';
      const sA = slider({ label: 'Alice’s analyzer', min: 0, max: 355, step: 5, value: S.a, fmt: angFmt, onInput: (v) => { S.a = v; resetStats(); refreshChart(); } });
      const sB = slider({ label: 'Bob’s analyzer', min: 0, max: 355, step: 5, value: S.b, fmt: angFmt, onInput: (v) => { S.b = v; resetStats(); refreshChart(); } });
      const srcSeg = segmented({
        label: 'What the source sends',
        options: [{ value: 'quantum', label: 'Entangled pairs' }, { value: 'classical', label: 'Classical twins' }],
        value: S.source, onChange: (v) => { S.source = v; resetStats(); refreshChart(); },
        hint: 'Classical twins leave the source already carrying a shared instruction that fixes both answers.',
      });
      const streamT = toggle({ label: 'Stream of pairs', value: S.stream, onChange: (v) => { S.stream = v; } });
      lab.control(srcSeg, sA, sB, streamT,
        buttons(button({ label: 'Send 1,000 pairs', onClick: () => runFast(1000) }), button({ label: 'Run Bell’s test', kind: 'primary', icon: 'dice', onClick: startBell, kbd: 'B' })),
        buttons(button({ label: 'Reset counts', icon: 'trash', onClick: () => { resetStats(); sweep.quantum.clear(); sweep.classical.clear(); aliceSeen.clear(); refreshChart(); } })));
      lab.keys.b = startBell;

      const stC = lab.stat({ label: 'Correlation, measured', swatch: C.data, tip: '+1 means always the same, -1 always opposite, 0 unrelated.' });
      const stQ = lab.stat({ label: 'Quantum prediction', swatch: C.theory });
      const stA = lab.stat({ label: 'Alice sees up' });
      const stB = lab.stat({ label: 'Bob sees up' });

      lab.physics(`
        <p>The two particles are created in the <b>singlet</b> state: total spin zero, with neither particle having a direction of its own.
        Measured along axes that differ by an angle &theta;, their results multiply to an average of</p>
        <div class="eq">E(&theta;) = &minus;cos &theta;</div>
        <p>Any scheme in which each particle carries its answers from the source (a "local hidden variable") obeys Bell's inequality.
        In the CHSH form, with two settings each for Alice and Bob,</p>
        <div class="eq">S = |E(a,b) &minus; E(a,b&prime;)| + |E(a&prime;,b) + E(a&prime;,b&prime;)| &le; 2</div>
        <p>Quantum mechanics predicts 2&radic;2 &asymp; 2.83 at the angles used here, and experiments since 1972 agree. The 2022 Nobel Prize in Physics went to Aspect, Clauser and Zeilinger for them.</p>`);

      // ---------------------------------------------------------------- dock
      const chart = lab.plot({ title: 'Correlation against the angle between analyzers', sub: '' }, {
        height: 136,
        aria: 'Correlation of the two results against the angle between the analyzers',
        x: { min: 0, max: 180, ticks: [0, 45, 90, 135, 180], label: 'angle between the two analyzers (degrees)', name: 'Angle', tipFmt: (v) => Math.round(v) + '°' },
        y: { min: -1, max: 1, ticks: [-1, 0, 1], fmt: (v) => (v > 0 ? '+' : '') + v, tipFmt: (v) => (v > 0 ? '+' : '') + M.fix(v, 2) },
        series: [
          { id: 'limit', label: 'Best any instructions can do', type: 'line', color: C.ink3, dash: true, width: 1.5 },
          { id: 'theory', label: 'Quantum theory', type: 'line', color: C.theory },
          { id: 'quantum', label: 'Entangled, measured', type: 'dots', color: C.data },
          { id: 'classical', label: 'Twins, measured', type: 'dots', color: C.third },
        ],
      });
      const th = [], lim = [];
      for (let d = 0; d <= 180; d += 2) { th.push([d, qE(d)]); lim.push([d, cE(d)]); }
      const pts = (map) => [...map].filter(([, e]) => e.n >= 40).map(([d, e]) => { const E = (2 * e.same - e.n) / e.n; return [d, E, Math.sqrt(Math.max(0, 1 - E * E) / e.n)]; });
      const refreshChart = () => {
        chart.set('theory', th); chart.set('limit', lim);
        chart.set('quantum', pts(sweep.quantum)); chart.set('classical', pts(sweep.classical));
        chart.marker('now', { x: fold(S.a - S.b), label: 'now' });
        chart.draw();
      };

      const gcard = lab.card({ title: 'Bell’s test', sub: 'CHSH value S', width: 300 });
      const gauge = el('canvas', { style: { width: '100%', height: '112px', display: 'block' }, role: 'img', 'aria-label': 'Bell test result' });
      gcard.body.append(gauge);
      const gfit = QL.ui.fitCanvas(gauge, 112), gctx = gfit.ctx;
      const drawGauge = () => {
        if (!gfit.fit()) return;
        const gw = gfit.w;
        const ctx = gctx, l = 8, r = gw - 8, X = (v) => l + (M.clamp(v, 0, 3) / 3) * (r - l);
        ctx.clearRect(0, 0, gw, 112);
        const rows = [['quantum', 'Entangled pairs', C.data], ['classical', 'Classical twins', C.third]];
        rows.forEach(([key, name, col], i) => {
          const y = 26 + i * 34, live = bell.active && bell.source === key ? bellS(bell.cells) : null, res = live || bell.result[key];
          D.rr(ctx, l, y - 3, r - l, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
          D.text(ctx, name, l, y - 9, { size: 10.5, color: C.ink2 });
          if (res && res.n > 40) {
            D.rr(ctx, l, y - 3, X(res.S) - l, 6, 3); ctx.fillStyle = col; ctx.fill();
            ctx.beginPath(); ctx.arc(X(res.S), y, 6.5, 0, M.TAU); ctx.fillStyle = '#0c0e14'; ctx.fill();
            ctx.beginPath(); ctx.arc(X(res.S), y, 4.5, 0, M.TAU); ctx.fillStyle = col; ctx.fill();
            D.text(ctx, `S = ${M.fix(res.S, 2)} ± ${M.fix(res.err, 2)}`, r, y - 9, { size: 11, align: 'right', color: C.ink, weight: 600, family: 'mono' });
          } else D.text(ctx, 'not run yet', r, y - 9, { size: 10.5, align: 'right', color: C.ink4 });
        });
        for (const y of [26, 60]) {
          D.line(ctx, X(2), y - 8, X(2), y + 8, C.ink, 2);
          D.line(ctx, X(2.828), y - 8, X(2.828), y + 8, C.theory, 2);
        }
        D.line(ctx, X(2), 68, X(2), 80, 'rgba(240,239,236,0.4)');
        D.text(ctx, 'any instructions: 2 at most', X(2) + 3, 93, { size: 10, align: 'right', color: C.ink2 });
        D.line(ctx, X(2.828), 68, X(2.828), 96, 'rgba(57,135,229,0.6)');
        D.text(ctx, 'quantum theory: 2.83', r, 108, { size: 10, align: 'right', color: C.ink2 });
      };

      const tp = lab.transport({ playing: true, speeds: [0.5, 1, 3], speed: 1, onToggle: (p) => { S.playing = p; }, onReset: () => { resetStats(); }, onSpeed: (v) => { S.speed = v; } });

      // -------------------------------------------------------------- guide
      const set = (o) => { Object.assign(S, o); srcSeg.value = S.source; sA.value = S.a; sB.value = S.b; resetStats(); refreshChart(); };
      const measured = (map) => [...map].filter(([d, e]) => e.n >= 200 && d > 0 && d < 180).length;
      lab.guide([
        {
          id: 'same', title: 'Same question, both sides',
          body: 'Keep both analyzers at the <b>same angle</b> and let at least 40 entangled pairs through. Watch each side on its own, then compare the two rows of results.',
          check: () => S.source === 'quantum' && fold(S.a - S.b) === 0 && stats.n >= 40,
          progress: () => `${Math.min(40, stats.n)} / 40 pairs`,
          show: () => set({ source: 'quantum', a: 0, b: 0 }),
          insight: 'Each side by itself is a coin toss: up, down, down, up. But lay the two rows side by side and they are <b>perfect opposites</b>, every time, whatever angle you choose. Neither particle had a definite spin, yet the pair has a definite relationship.',
        },
        {
          id: 'gloves', title: 'Maybe they carry instructions',
          body: 'Einstein suspected each particle simply leaves the source with its answers written in. Switch to <b>Classical twins</b>, which do exactly that, and repeat with equal angles.',
          check: () => S.source === 'classical' && fold(S.a - S.b) === 0 && stats.n >= 40,
          progress: () => `${Math.min(40, stats.n)} / 40 pairs`,
          show: () => set({ source: 'classical', a: 0, b: 0 }),
          insight: 'Also perfect opposites. A pair of gloves posted in two boxes does the same: open one and you instantly know the other, with nothing spooky involved. Perfect correlation at equal angles <b>proves nothing</b>. To tell the two sources apart you have to ask the two particles different questions.',
        },
        {
          id: 'tilt', title: 'Ask different questions',
          body: 'With the twins, tilt Bob’s analyzer and measure the correlation at <b>three different angles</b> (send 1,000 pairs at each). Then switch to <b>entangled pairs</b> and do the same.',
          check: () => measured(sweep.classical) >= 3 && measured(sweep.quantum) >= 3,
          progress: () => `twins ${Math.min(3, measured(sweep.classical))} / 3, entangled ${Math.min(3, measured(sweep.quantum))} / 3 angles`,
          show: () => {
            for (const src of ['classical', 'quantum']) for (const b of [30, 45, 60, 120, 135]) { set({ source: src, a: 0, b }); runFast(1500); }
            set({ source: 'quantum', a: 0, b: 45 }); runFast(1000);
          },
          insight: 'The twins fall on the straight dashed line. The entangled pairs fall on the curve, which bows away from it: at 45 degrees their results are opposite 85% of the time. Instructions that also get the easy cases right (always opposite at 0 degrees, always the same at 180) cannot do better than 75% there. The entangled particles are <b>more strongly correlated</b> than any pair of objects with pre-written answers can be.',
        },
        {
          id: 'bell', title: 'Run Bell’s test',
          body: 'Press <b>Run Bell’s test</b> with each source. The lab switches both analyzers at random between two settings each, pair by pair, and combines the four correlations into one number, S.',
          predict: { q: 'Could a cleverer set of hidden instructions reach the quantum value of S?', options: ['Yes, with enough ingenuity', 'No: any instructions fixed at the source give S of 2 or less', 'Only if the particles are identical'], answer: 1 },
          check: () => bell.result.quantum && bell.result.classical,
          progress: () => `${bell.result.quantum ? 'entangled done' : 'entangled to do'}, ${bell.result.classical ? 'twins done' : 'twins to do'}`,
          show: () => {
            for (const src of ['classical', 'quantum']) {
              const cells = BELL.map(() => ({ n: 0, same: 0 }));
              for (let i = 0; i < 4000; i++) { const k = (Math.random() * 4) | 0, [A, B] = measure(BELL[k][0], BELL[k][1], src); cells[k].n++; if (A === B) cells[k].same++; }
              bell.result[src] = bellS(cells);
            }
          },
          insight: 'The twins stop at 2. That is not a weakness of this particular model: John Bell proved in 1964 that <b>every</b> scheme of answers decided at the source, however elaborate, obeys S &le; 2. The entangled pairs reach about 2.8. So the results were not written down in advance. Until a measurement is made, there is no fact about what it will show.',
        },
        {
          id: 'signal', title: 'Try to send a message',
          body: 'If Alice’s choice affects Bob’s particle, can she signal to him? With entangled pairs, set Alice to <b>three different angles</b> (1,000 pairs each) and watch only <b>Bob sees up</b>.',
          check: () => [...aliceSeen.values()].filter((n) => n >= 300).length >= 3,
          progress: () => `${Math.min(3, [...aliceSeen.values()].filter((n) => n >= 300).length)} / 3 settings tried`,
          show: () => { for (const a of [0, 60, 120]) { set({ source: 'quantum', a, b: 45 }); runFast(1000); } },
          insight: 'Bob sees half up and half down, whatever Alice does. Her setting changes how his results line up with hers, but that only shows once the two lists are brought together and compared, which cannot happen faster than light. Entanglement is real and it is non-local, and it still <b>cannot carry a message</b>. It can, however, make secret keys and power quantum computers.',
        },
      ]);

      // ------------------------------------------------------------ drawing
      const geo = () => {
        const { w, h } = L;
        const yc = Math.round(M.clamp(h * 0.36, 120, h - 250));
        const side = M.clamp(w * 0.2, 132, 250);
        return { w, h, yc, ax: side, bx: w - side, sx: w / 2 };
      };
      const arrow = (ctx, x, y, deg, len, color, width = 1.8) => {
        const a = deg * RAD, dx = Math.sin(a) * len, dy = -Math.cos(a) * len;
        D.arrow(ctx, x - dx * 0.5, y - dy * 0.5, x + dx * 0.5, y + dy * 0.5, color, width, Math.max(4, len * 0.3));
      };

      const drawStation = (ctx, g, x, ang, lamps, name, id, set2) => {
        const hot = zones.isHot(id), side = x < g.sx ? -1 : 1;
        D.rr(ctx, x - 50, g.yc - 62, 100, 124, 16);
        const bg = ctx.createLinearGradient(0, g.yc - 62, 0, g.yc + 62);
        bg.addColorStop(0, 'rgba(46,52,68,0.92)'); bg.addColorStop(1, 'rgba(22,26,36,0.92)');
        ctx.fillStyle = bg; ctx.fill();
        ctx.strokeStyle = hot ? 'rgba(240,239,236,0.55)' : 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, g.yc, 30, 0, M.TAU);
        ctx.fillStyle = 'rgba(8,10,15,0.75)'; ctx.fill();
        ctx.strokeStyle = hot ? C.ink : 'rgba(240,239,236,0.4)'; ctx.lineWidth = 1.25; ctx.stroke();
        for (let t = 0; t < 360; t += 45) {
          const s = Math.sin(t * RAD), c = -Math.cos(t * RAD);
          D.line(ctx, x + s * 26, g.yc + c * 26, x + s * 30, g.yc + c * 30, 'rgba(240,239,236,0.4)');
        }
        arrow(ctx, x, g.yc, ang, 46, hot ? '#fff' : C.ink, 2.2);
        D.text(ctx, name, x, g.yc - 74, { size: 12, weight: 600, align: 'center', color: C.ink });
        D.text(ctx, ang + '°', x, g.yc + 82, { size: 12, align: 'center', color: C.ink2, family: 'mono' });
        [[1, C.up, 'up'], [-1, C.down, 'down']].forEach(([s, col, label], i) => {
          const lx = x + side * 72, ly = g.yc - s * 26, f = lamps[i];
          ctx.beginPath(); ctx.arc(lx, ly, 9, 0, M.TAU);
          ctx.fillStyle = C.css(col, 0.22 + 0.78 * f); ctx.fill();
          if (f > 0) D.glow(ctx, lx, ly, 14 + 30 * f, col, 0.85 * f);
          D.text(ctx, label, lx + side * 16, ly, { size: 10.5, align: side < 0 ? 'right' : 'left', base: 'middle', color: C.ink3 });
        });
        zones.add({
          id, x, y: g.yc, r: 44, cursor: 'grab',
          drag: (p) => {
            let deg = Math.atan2(p.x - x, -(p.y - g.yc)) / RAD;
            deg = (((Math.round(deg / 15) * 15) % 360) + 360) % 360;
            set2(deg);
          },
        });
      };

      const draw = (dt) => {
        const { ctx } = L;
        const g = geo(), { w, h, yc } = g;
        ctx.clearRect(0, 0, w, h);
        zones.begin();
        for (let i = 0; i < 2; i++) { lampA[i] = Math.max(0, lampA[i] - dt * 3.5); lampB[i] = Math.max(0, lampB[i] - dt * 3.5); }

        D.line(ctx, g.ax + 50, yc, g.bx - 50, yc, 'rgba(240,239,236,0.08)');
        // source
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
        const sc = S.source === 'quantum' ? [150, 130, 255] : [150, 200, 170];
        D.glow(ctx, g.sx, yc, 42 + 6 * pulse, sc, 0.5);
        ctx.beginPath(); ctx.arc(g.sx, yc, 13, 0, M.TAU); ctx.fillStyle = '#12151d'; ctx.fill();
        ctx.strokeStyle = C.css(sc, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
        D.text(ctx, S.source === 'quantum' ? 'entangled source' : 'twin source', g.sx, yc + 40, { size: 11, align: 'center', color: C.ink2 });
        D.text(ctx, S.source === 'quantum' ? 'total spin zero, no direction of its own' : 'each pair carries a hidden instruction', g.sx, yc + 55, { size: 10, align: 'center', color: C.ink3 });

        drawStation(ctx, g, g.ax, S.a, lampA, 'Alice', 'dialA', (d) => { if (d !== S.a) { S.a = d; sA.value = d; resetStats(); refreshChart(); } });
        drawStation(ctx, g, g.bx, S.b, lampB, 'Bob', 'dialB', (d) => { if (d !== S.b) { S.b = d; sB.value = d; resetStats(); refreshChart(); } });

        // pairs in flight
        for (const p of pairs) {
          const xa = g.sx + (g.ax + 50 - g.sx) * p.t, xb = g.sx + (g.bx - 50 - g.sx) * p.t;
          const lg = ctx.createLinearGradient(xa, 0, xb, 0);
          const la = S.source === 'quantum' ? 0.5 * (1 - p.t * 0.5) : 0;
          lg.addColorStop(0, C.css(sc, la)); lg.addColorStop(0.5, C.css(sc, la * 0.25)); lg.addColorStop(1, C.css(sc, la));
          if (la > 0) { ctx.strokeStyle = lg; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xa, yc); ctx.lineTo(xb, yc); ctx.stroke(); }
          for (const [x, flip] of [[xa, 0], [xb, 180]]) {
            D.glow(ctx, x, yc, 10, [255, 244, 220], 0.8);
            ctx.beginPath(); ctx.arc(x, yc, 2.8, 0, M.TAU); ctx.fillStyle = '#fff'; ctx.fill();
            if (p.hidden != null) arrow(ctx, x, yc, p.hidden + flip, 17, 'rgba(160,220,185,0.95)', 1.4);
          }
        }

        // result tape
        const tx0 = g.ax + 20, tx1 = g.bx - 20, ty = yc + 118, cell = 15;
        const cols = Math.max(4, Math.floor((tx1 - tx0) / cell));
        const view = tape.slice(-cols);
        D.text(ctx, 'Alice', tx0 - 10, ty, { size: 10.5, align: 'right', base: 'middle', color: C.ink2 });
        D.text(ctx, 'Bob', tx0 - 10, ty + 20, { size: 10.5, align: 'right', base: 'middle', color: C.ink2 });
        D.text(ctx, 'same?', tx0 - 10, ty + 42, { size: 10.5, align: 'right', base: 'middle', color: C.ink3 });
        view.forEach(([A, B], i) => {
          const x = tx0 + (cols - view.length + i) * cell + cell / 2, fresh = i === view.length - 1 ? 1 : 0;
          for (const [v, y] of [[A, ty], [B, ty + 20]]) {
            D.rr(ctx, x - 5, y - 5, 10, 10, 3);
            ctx.fillStyle = C.css(v > 0 ? C.up : C.down, 0.9); ctx.fill();
            if (fresh) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke(); }
          }
          ctx.beginPath(); ctx.arc(x, ty + 42, 3.5, 0, M.TAU);
          if (A === B) { ctx.fillStyle = C.ink; ctx.fill(); } else { ctx.strokeStyle = 'rgba(240,239,236,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
        });
        const ky = ty + 70;
        ctx.fillStyle = C.css(C.up); D.rr(ctx, tx0, ky - 5, 10, 10, 3); ctx.fill();
        D.text(ctx, 'up', tx0 + 15, ky, { size: 10.5, base: 'middle', color: C.ink3 });
        ctx.fillStyle = C.css(C.down); D.rr(ctx, tx0 + 40, ky - 5, 10, 10, 3); ctx.fill();
        D.text(ctx, 'down', tx0 + 55, ky, { size: 10.5, base: 'middle', color: C.ink3 });
        ctx.beginPath(); ctx.arc(tx0 + 100, ky, 3.5, 0, M.TAU); ctx.fillStyle = C.ink; ctx.fill();
        D.text(ctx, 'both gave the same result', tx0 + 110, ky, { size: 10.5, base: 'middle', color: C.ink3 });
        if (stats.n) {
          const opp = 1 - stats.same / stats.n;
          D.text(ctx, `${M.int(stats.n)} pairs: opposite ${M.fix(100 * opp, 1)}%, same ${M.fix(100 * (1 - opp), 1)}%`, g.sx, ky + 26, { size: 11.5, align: 'center', base: 'middle', color: C.ink, family: 'mono' });
        }
        if (bell.active) D.text(ctx, `Bell test running: switching settings at random, ${M.int(4000 - bell.left)} of 4,000 pairs`, g.sx, yc - 92, { size: 11.5, align: 'center', color: C.ink, weight: 600 });
        zones.end();

        drawGauge();
        const E = stats.n ? (2 * stats.same - stats.n) / stats.n : NaN;
        stC.set(Number.isFinite(E) ? (E > 0 ? '+' : '') + M.fix(E, 2) : 'no pairs yet');
        const q = qE(S.a - S.b);
        stQ.set((q > 0 ? '+' : '') + M.fix(q, 2));
        stA.set(stats.n ? M.fix((100 * stats.aUp) / stats.n, 1) : '...', stats.n ? '%' : '');
        stB.set(stats.n ? M.fix((100 * stats.bUp) / stats.n, 1) : '...', stats.n ? '%' : '');
      };

      let sinceChart = 0, dirty = false;
      const update = (dt) => {
        if (!S.playing) return;
        if (bell.active) {
          const batch = Math.min(bell.left, Math.max(1, Math.round(2400 * dt)));
          for (let i = 0; i < batch; i++) {
            const k = (Math.random() * 4) | 0, [A, B] = measure(BELL[k][0], BELL[k][1], bell.source);
            bell.cells[k].n++; if (A === B) bell.cells[k].same++;
            if (i === batch - 1) { S.a = BELL[k][0]; S.b = BELL[k][1]; pushTape(A, B); lampA[A > 0 ? 0 : 1] = 1; lampB[B > 0 ? 0 : 1] = 1; }
          }
          bell.left -= batch;
          if (bell.left <= 0) {
            bell.active = false;
            bell.result[bell.source] = bellS(bell.cells);
            [S.a, S.b] = bell.keep; sA.value = S.a; sB.value = S.b;
            resetStats(); refreshChart();
            const r = bell.result[bell.source];
            lab.toast(`Bell test: S = ${M.fix(r.S, 2)} ${r.S > 2 + 2 * r.err ? 'breaks the ceiling of 2' : 'stays within the ceiling of 2'}`);
          }
          return;
        }
        if (S.stream) {
          emitAcc += S.rate * S.speed * dt;
          while (emitAcc >= 1) { emitAcc -= 1; const [A, B, hidden] = measure(S.a, S.b, S.source); pairs.push({ t: 0, A, B, hidden, a: S.a, b: S.b, src: S.source }); }
        }
        for (let i = pairs.length - 1; i >= 0; i--) {
          const p = pairs[i];
          p.t += dt * S.speed / 1.15;
          if (p.t >= 1) {
            tally(p.a, p.b, p.A, p.B, p.src); pushTape(p.A, p.B);
            lampA[p.A > 0 ? 0 : 1] = 1; lampB[p.B > 0 ? 0 : 1] = 1;
            pairs.splice(i, 1); dirty = true;
          }
        }
        sinceChart += dt;
        if (dirty && sinceChart > 0.5) { dirty = false; sinceChart = 0; refreshChart(); }
      };

      lab.frame((dt) => { update(dt); draw(dt); });
      lab.note('Drag either dial to turn that analyzer');
      refreshChart();
      return { get state() { return { S, stats, sweep, bell }; }, runFast, startBell, measure };
    },
  });
})();
