// Station 3: tunneling. A wave packet meets a barrier it has no classical
// right to cross. Real units: an electron, nanometres, electronvolts.
(() => {
  const QL = globalThis.QL;
  const { el, slider, segmented, toggle, button, buttons } = QL.ui;
  const { math: M, draw: D, color: C, units: U } = QL;

  QL.register({
    id: 'tunneling',
    title: 'Through the wall',
    short: 'Tunneling',
    kicker: 'Quantum tunneling',
    idea: 'Fire an electron at a barrier it does not have the energy to climb. Sometimes it turns up on the far side anyway.',

    create(lab) {
      const sim = new QL.Wave1D({ n: 6001, xmin: -96, xmax: 96 });
      const DT = 0.004, VIEW = [-16, 16], RATE = 1.2;
      const startX = () => -(3.5 * S.sigma + 1);
      const S = {
        preset: 'barrier', E: 0.61 / U.EV, V0: 0.76 / U.EV, w: 0.6, gap: 1.0, sigma: 2.5,
        amp: true, ball: true, auto: true, speed: 1, playing: true,
      };
      let run = null, acc = 0, struct = null;
      const measured = [];
      const tally = { through: 0, back: 0 };
      const seen = { thick: false };

      const L = lab.layer('2d');
      const zones = new QL.Zones(L.canvas);
      lab.onDestroy(() => zones.destroy());

      // ------------------------------------------------------- the apparatus
      const snap = (w) => Math.max(1, Math.round(w / sim.dx)) * sim.dx;
      const structure = () => {
        const w = snap(S.w), g = snap(S.gap);
        if (S.preset === 'barrier') return { segs: [{ w, V: S.V0 }], VR: 0 };
        if (S.preset === 'double') return { segs: [{ w, V: S.V0 }, { w: g, V: 0 }, { w, V: S.V0 }], VR: 0 };
        if (S.preset === 'well') return { segs: [{ w, V: -S.V0 }], VR: 0 };
        return { segs: [], VR: S.V0 };
      };
      const applyPotential = () => {
        struct = structure();
        const i00 = sim.index(0);
        sim.V.fill(0);
        let i = i00;
        for (const s of struct.segs) {
          const cells = Math.round(s.w / sim.dx);
          for (let j = 0; j < cells; j++) sim.V[i + j] = s.V;
          i += cells;
        }
        if (struct.VR) for (let j = i; j < sim.n; j++) sim.V[j] = struct.VR;
        sim._dirty = true;
        struct.x0 = sim.x[i00] - sim.dx / 2;
        struct.x1 = sim.x[i] - sim.dx / 2;
        struct.iL = sim.index(struct.x0 - 1);
        struct.iR = sim.index(struct.x1 + 1);
      };
      const top = () => (S.preset === 'well' ? 0 : S.V0);

      const launch = () => {
        applyPotential();
        sim.setAbsorber(9, 8);
        const k0 = Math.sqrt(2 * S.E);
        sim.setGaussian(startX(), S.sigma, k0);
        acc = 0;
        run = {
          phase: 'run', k0, T: 0, R: 0, mid: 0, ballX: startX(), ballDir: 1, detected: null, fade: 1,
          arrive: (struct.x0 - startX()) / k0,
          predicted: M.packetTransmission(k0, S.sigma, struct.segs, 0, struct.VR),
        };
        if (!tp.playing) { tp.set(true); S.playing = true; }
      };

      const measure = () => {
        run.R = sim.norm(sim.i0, struct.iL) + sim.absorbedL;
        run.T = sim.norm(struct.iR, sim.i1) + sim.absorbedR;
        run.mid = Math.max(0, 1 - run.R - run.T);
      };

      const finish = () => {
        run.phase = 'done';
        const eV = S.E * U.EV;
        const at = measured.findIndex((p) => Math.abs(p[0] - eV) < 0.012);
        if (at >= 0) measured.splice(at, 1);
        measured.push([eV, run.T]);
        if (S.w >= 1.1 && S.preset === 'barrier' && S.E < S.V0) seen.thick = true;
        refreshChart();
        if (S.auto) detect(true);
      };

      const detect = (animate) => {
        if (!run || run.phase !== 'done') return;
        const through = Math.random() < run.T / Math.max(1e-9, run.T + run.R);
        through ? tally.through++ : tally.back++;
        if (animate) {
          const [a, b] = through ? [struct.iR, sim.i1] : [sim.i0, struct.iL];
          const w = new Float64Array(b - a + 1);
          for (let i = a; i <= b; i++) w[i - a] = sim.re[i] ** 2 + sim.im[i] ** 2;
          const table = M.cdf(w);
          const x = table.total > 1e-6 ? sim.x[a + Math.round(M.sample(table))] : through ? VIEW[1] - 3 : VIEW[0] + 3;
          run.detected = { x: M.clamp(x, VIEW[0] + 1, VIEW[1] - 1), through, age: 0 };
        }
        refreshTally();
      };
      const detectMany = (n) => {
        if (!run || run.phase !== 'done') { lab.toast('Let the packet finish scattering first'); return; }
        for (let i = 0; i < n; i++) detect(false);
      };

      // ------------------------------------------------------------ controls
      const eV = (v) => M.fix(v * U.EV, 2);
      const sE = slider({ label: 'Electron energy', min: 0.1 / U.EV, max: 1.5 / U.EV, step: 0.01 / U.EV, value: S.E, fmt: eV, unit: 'eV', onInput: (v) => { S.E = v; changed(false); } });
      const sV = slider({ label: 'Barrier height', min: 0.1 / U.EV, max: 1.4 / U.EV, step: 0.01 / U.EV, value: S.V0, fmt: eV, unit: 'eV', onInput: (v) => { S.V0 = v; changed(true); } });
      const sW = slider({ label: 'Barrier width', min: 0.1, max: 3, step: 0.05, value: S.w, fmt: (v) => M.fix(v, 2), unit: 'nm', onInput: (v) => { S.w = v; changed(true); } });
      const sG = slider({ label: 'Gap between walls', min: 0.4, max: 3, step: 0.05, value: S.gap, fmt: (v) => M.fix(v, 2), unit: 'nm', onInput: (v) => { S.gap = v; changed(true); } });
      const sS = slider({
        label: 'Packet length', min: 1.5, max: 8, step: 0.1, value: S.sigma, fmt: (v) => M.fix(v, 1), unit: 'nm',
        hint: 'A longer packet has a sharper energy.', onInput: (v) => { S.sigma = v; changed(false); },
      });
      const preset = segmented({
        options: [{ value: 'barrier', label: 'Barrier' }, { value: 'double', label: 'Double' }, { value: 'step', label: 'Step' }, { value: 'well', label: 'Well' }],
        value: S.preset,
        onChange: (v) => {
          S.preset = v;
          if (v === 'double') { S.w = 0.3; S.V0 = 1.0 / U.EV; S.gap = 1.0; S.E = 0.3 / U.EV; S.sigma = 6; }
          if (v === 'barrier') { S.w = 0.6; S.V0 = 0.76 / U.EV; S.E = 0.61 / U.EV; S.sigma = 2.5; }
          if (v === 'step') { S.V0 = 0.5 / U.EV; S.E = 0.61 / U.EV; S.sigma = 2.5; }
          if (v === 'well') { S.w = 1.2; S.V0 = 0.8 / U.EV; S.E = 0.3 / U.EV; S.sigma = 3; }
          syncControls();
          changed(true);
        },
      });
      const syncControls = () => {
        preset.value = S.preset; sE.value = S.E; sV.value = S.V0; sW.value = S.w; sG.value = S.gap; sS.value = S.sigma;
        sW.setDisabled(S.preset === 'step');
        sG.el.hidden = S.preset !== 'double';
      };
      lab.control(
        preset, sE, sV, sW, sG, sS,
        segmented({ label: 'Height of the wave shows', options: [{ value: true, label: 'Amplitude |ψ|' }, { value: false, label: 'Probability |ψ|²' }], value: S.amp, onChange: (v) => { S.amp = v; } }),
        toggle({ label: 'Classical particle for comparison', value: S.ball, onChange: (v) => { S.ball = v; } }),
        toggle({ label: 'Detect the electron after each run', value: S.auto, onChange: (v) => { S.auto = v; } }),
        buttons(button({ label: 'Launch', icon: 'bolt', kind: 'primary', kbd: 'R', onClick: () => launch() })),
      );

      const stT = lab.stat({ label: 'Got through (simulation)', swatch: C.data });
      const stP = lab.stat({ label: 'Predicted for this packet', swatch: C.theory });
      const stR = lab.stat({ label: 'Bounced back' });
      const stK = lab.stat({ label: 'Reach inside the wall', tip: 'Distance over which the amplitude falls by a factor e inside the barrier.' });

      lab.physics(`
        <p>Inside the barrier the electron's energy is below the potential, so its wave cannot oscillate. It decays instead, with a reach of
        1/&kappa;. If the wall is thin compared with that reach, some amplitude survives to the far side.</p>
        <div class="eq">T &asymp; e<sup>&minus;2&kappa;L</sup>, &nbsp; &kappa; = &radic;(2m(V<sub>0</sub> &minus; E)) / &#295;</div>
        <p>The blue curve in the chart is the exact result for a single energy, from matching the wave and its slope at every edge.
        Nothing here is animated by hand: the packet is advanced by the time-dependent Schrödinger equation, one step every ${M.fix(DT * U.FS * 1000, 0)} attoseconds.</p>`);

      // ---------------------------------------------------------------- dock
      const chart = lab.plot({ title: 'Transmission against energy', sub: 'each finished run adds a point' }, {
        height: 132,
        aria: 'Transmission probability against electron energy',
        x: { min: 0, max: 1.6, label: 'electron energy (eV)', name: 'Energy', tipFmt: (v) => M.fix(v, 2) + ' eV' },
        y: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => Math.round(v * 100) + '%', tipFmt: (v) => M.fix(v * 100, v < 0.1 ? 2 : 1) + '%' },
        series: [
          { id: 'classical', label: 'Classical', type: 'line', color: C.ink3, dash: true, width: 1.5 },
          { id: 'theory', label: 'Quantum theory', type: 'line', color: C.theory, fill: true },
          { id: 'measured', label: 'Your runs', type: 'dots', color: C.data },
        ],
      });
      const refreshChart = () => {
        const s = structure();
        const pts = [], cls = [];
        for (let i = 1; i <= 320; i++) {
          const e = (i / 320) * 1.6;
          pts.push([e, M.transmission(e / U.EV, s.segs, 0, s.VR)]);
        }
        const edge = Math.max(0, top() * U.EV);
        cls.push([0, 0], [edge, 0], [edge, 1], [1.6, 1]);
        chart.set('theory', pts);
        chart.set('classical', cls);
        chart.set('measured', measured);
        chart.marker('E', { x: S.E * U.EV, label: 'now' });
        chart.draw();
      };

      const tcard = lab.card({ title: 'Detections', sub: 'whole electrons, one side or the other', width: 290 });
      const tBig = el('div', { class: 'big' });
      const tFill = el('i'), tTick = el('b');
      const tNums = el('div', { class: 'nums' });
      tcard.body.append(el('div', { class: 'tally' }, tBig, el('div', { class: 'meter' }, tFill, tTick), tNums,
        el('div', { class: 'btns', style: { display: 'flex', gap: '6px' } },
          button({ label: 'Detect 20', small: true, onClick: () => detectMany(20) }),
          button({ label: 'Detect 500', small: true, onClick: () => detectMany(500) }),
          button({ label: 'Clear', small: true, onClick: () => { tally.through = tally.back = 0; refreshTally(); } }))));
      const refreshTally = () => {
        const n = tally.through + tally.back, f = n ? tally.through / n : 0;
        tBig.replaceChildren(`${tally.through}`, el('small', { text: `of ${n} got through` }));
        tFill.style.width = (100 * f).toFixed(1) + '%';
        const p = run ? (run.phase === 'done' ? run.T : run.predicted) : 0;
        tTick.style.left = (100 * p).toFixed(1) + '%';
        tNums.replaceChildren(el('span', {}, 'measured ', el('b', { text: n ? M.fix(100 * f, 1) + '%' : '...' })), el('span', {}, 'expected ', el('b', { text: M.fix(100 * p, 1) + '%' })));
      };

      const changed = (structural) => {
        if (structural) { measured.length = 0; tally.through = tally.back = 0; }
        launch();
        refreshChart();
        refreshTally();
      };

      const tp = lab.transport({
        playing: true, speeds: [0.5, 1, 2], speed: 1, clock: true,
        onToggle: (p) => { S.playing = p; if (p && run.phase === 'done') launch(); },
        onReset: () => launch(),
        onSpeed: (v) => { S.speed = v; },
      });

      // -------------------------------------------------------------- guide
      lab.guide([
        {
          id: 'first', title: 'Launch at the wall',
          body: 'The electron has <b>less energy than the barrier is tall</b>. The white dot is a classical particle with the same energy. Press <b>Launch</b> and watch both.',
          check: () => run.phase === 'done' && S.E < S.V0 && run.T > 0.01,
          show: () => { preset.value = S.preset = 'barrier'; S.w = 0.6; S.V0 = 0.76 / U.EV; S.E = 0.61 / U.EV; S.sigma = 2.5; syncControls(); changed(true); },
          insight: `The classical particle bounced back, as it always will. The ${QL.ui.term('wavefunction', 'wave')} did not stop at the wall. Inside the barrier it cannot oscillate, so it <b>decays exponentially</b> instead, and the part that survives to the far side carries on as a free wave. That surviving share is the tunneling probability.`,
        },
        {
          id: 'whole', title: 'One electron, one place',
          body: 'The wave split in two. Now look for the electron itself: press <b>Detect 20</b> under the chart a few times.',
          predict: { q: 'When you detect the electron, what will you find?', options: ['Part of the electron on each side', 'A whole electron, on one side or the other', 'A whole electron, always on the left'], answer: 1 },
          check: () => tally.through + tally.back >= 40,
          progress: () => `${Math.min(40, tally.through + tally.back)} / 40 detections`,
          show: () => { if (run.phase === 'done') detectMany(40); else lab.toast('Wait for the run to finish, then try again'); },
          insight: 'The wave splits; the electron never does. Every detection finds <b>one whole electron</b> on one side. The size of each piece of the wave only sets the odds, and over many runs the tally settles on those odds. This is the Born rule: probability = |&psi;|&sup2;.',
        },
        {
          id: 'thick', title: 'Thicken the wall',
          body: 'Drag the right edge of the barrier, or use the slider, to make it <b>about twice as wide</b>. Launch again and compare the share that gets through.',
          check: () => seen.thick && run.phase === 'done',
          show: () => { preset.value = S.preset = 'barrier'; S.w = 1.2; S.V0 = 0.76 / U.EV; S.E = 0.61 / U.EV; syncControls(); changed(true); },
          insight: 'Doubling the width did far more than halve the transmission. The amplitude falls by the same factor for every extra slice of wall, so the result is exponential in thickness. A <b>scanning tunneling microscope</b> lives on this: its current changes roughly tenfold when the tip moves by a tenth of a nanometre, which is how it feels individual atoms.',
        },
        {
          id: 'curve', title: 'Trace the curve yourself',
          body: 'Run the experiment at <b>four different energies</b>, some below the barrier top and some above. Drag the dashed energy line or use the slider.',
          check: () => measured.length >= 4,
          progress: () => `${Math.min(4, measured.length)} / 4 energies measured`,
          show: () => {
            preset.value = S.preset = 'barrier'; S.w = 0.6; S.V0 = 0.76 / U.EV; syncControls(); applyPotential();
            for (const e of [0.35, 0.55, 0.9, 1.2]) if (!measured.some((p) => Math.abs(p[0] - e) < 0.012)) measured.push([e, M.packetTransmission(Math.sqrt((2 * e) / U.EV), S.sigma, struct.segs, 0, struct.VR)]);
            refreshChart();
          },
          insight: 'Your points follow the smooth quantum curve, not the classical step. Below the barrier top some electrons get through. Above it some still <b>bounce back</b>, off a wall they could clear with room to spare. Both are impossible for particles and ordinary for waves.',
        },
        {
          id: 'resonance', title: 'Two walls beat one',
          body: 'Switch to <b>Double</b>. The theory curve now has sharp peaks. Set the energy onto the first peak and launch.',
          check: () => S.preset === 'double' && run.phase === 'done' && run.T > 0.4,
          show: () => {
            preset.value = S.preset = 'double'; S.w = 0.3; S.V0 = 1.0 / U.EV; S.gap = 1.0; S.sigma = 8;
            const s = structure();
            let best = 0, at = 0.3;
            for (let e = 0.1; e < 0.9; e += 0.002) { const t = M.transmission(e / U.EV, s.segs); if (t > best) { best = t; at = e; } }
            S.E = at / U.EV; syncControls(); changed(true);
          },
          insight: 'At the peak, two walls let through far more than one. The wave trapped between them bounces back and forth, and at just the right wavelength those bounces line up and <b>cancel the reflection</b>. This is resonant tunneling, the working principle of the resonant tunneling diode. Light does the same between two mirrors, which is how a laser cavity picks out its color.',
        },
      ]);

      // ------------------------------------------------------------ drawing
      const geo = () => {
        const { w, h } = L;
        const left = 66, right = w - 22, topY = 50, bottom = h - 98;
        const Elo = (S.preset === 'well' ? -1.15 : -0.25) / U.EV, Ehi = 1.6 / U.EV;
        return {
          left, right, topY, bottom, Elo, Ehi,
          x: (x) => left + ((x - VIEW[0]) / (VIEW[1] - VIEW[0])) * (right - left),
          y: (e) => bottom - ((e - Elo) / (Ehi - Elo)) * (bottom - topY),
          eAt: (y) => Elo + ((bottom - y) / (bottom - topY)) * (Ehi - Elo),
          xAt: (px) => VIEW[0] + ((px - left) / (right - left)) * (VIEW[1] - VIEW[0]),
        };
      };

      const draw = (dt) => {
        const { ctx, w, h } = L;
        const g = geo();
        ctx.clearRect(0, 0, w, h);
        zones.begin();

        // energy grid
        for (const e of D.ticks(g.Elo * U.EV, g.Ehi * U.EV, 6)) {
          const y = Math.round(g.y(e / U.EV)) + 0.5;
          D.line(ctx, g.left, y, g.right, y, e === 0 ? C.axis : C.grid);
          D.text(ctx, M.fix(e, 1) + ' eV', g.left - 10, y, { size: 10.5, align: 'right', base: 'middle', color: C.ink3, family: 'mono' });
        }
        for (const x of D.ticks(VIEW[0], VIEW[1], 8)) {
          if (x <= VIEW[0] || x >= VIEW[1]) continue;
          D.line(ctx, g.x(x), g.bottom, g.x(x), g.bottom + 5, C.axis);
          D.text(ctx, x + ' nm', g.x(x), g.bottom + 18, { size: 10.5, align: 'center', color: C.ink3, family: 'mono' });
        }
        D.text(ctx, 'energy', g.left - 10, g.topY - 16, { size: 10.5, color: C.ink3, align: 'right' });

        // potential
        const y0 = g.y(0);
        const hot = (id) => zones.isHot(id);
        let structLabel = null;
        let cursor = struct.x0;
        const blocks = struct.segs.map((s) => { const b = { x0: cursor, x1: cursor + s.w, V: s.V }; cursor += s.w; return b; });
        if (struct.VR) blocks.push({ x0: struct.x0, x1: VIEW[1] + 5, V: struct.VR, step: true });
        for (const b of blocks) {
          if (b.V === 0) continue;
          const xa = g.x(b.x0), xb = Math.min(g.right, g.x(b.x1)), yt = g.y(b.V);
          const grad = ctx.createLinearGradient(0, Math.min(yt, y0), 0, Math.max(yt, y0));
          grad.addColorStop(0, b.V > 0 ? 'rgba(150,170,225,0.30)' : 'rgba(150,170,225,0.04)');
          grad.addColorStop(1, b.V > 0 ? 'rgba(150,170,225,0.07)' : 'rgba(150,170,225,0.20)');
          ctx.fillStyle = grad;
          ctx.fillRect(xa, Math.min(yt, y0), xb - xa, Math.abs(y0 - yt));
          ctx.strokeStyle = hot('V0') ? C.ink : 'rgba(190,205,245,0.75)';
          ctx.lineWidth = hot('V0') ? 2 : 1.25;
          ctx.beginPath();
          ctx.moveTo(xa, y0); ctx.lineTo(xa, yt); ctx.lineTo(xb, yt);
          if (!b.step) ctx.lineTo(xb, y0);
          ctx.stroke();
        }
        const first = blocks.find((b) => b.V !== 0);
        if (first) {
          const xa = g.x(first.x0), xb = Math.min(g.right, g.x(first.x1)), yt = g.y(first.V);
          zones.add({
            id: 'V0', x: xa - 6, y: yt - 9, w: xb - xa + 12, h: 18, cursor: 'ns-resize',
            drag: (p) => {
              const v = g.eAt(p.y) * (S.preset === 'well' ? -1 : 1);
              S.V0 = M.clamp(Math.round((v * U.EV) / 0.01) * 0.01 / U.EV, 0.1 / U.EV, 1.4 / U.EV);
              sV.value = S.V0; changed(true);
            },
          });
          if (S.preset !== 'step') {
            const edge = S.preset === 'double' ? g.x(first.x1) : xb;
            zones.add({
              id: 'W', x: edge - 7, y: Math.min(yt, y0) + 10, w: 14, h: Math.max(10, Math.abs(y0 - yt) - 10), cursor: 'ew-resize',
              drag: (p) => { S.w = M.clamp(Math.round((g.xAt(p.x) - struct.x0) / 0.05) * 0.05, 0.1, 3); sW.value = S.w; changed(true); },
            });
            if (hot('W')) {
              D.line(ctx, edge, Math.min(yt, y0), edge, Math.max(yt, y0), C.ink, 2);
              D.dimension(ctx, xa, Math.max(yt, y0) + 14, g.x(first.x1), Math.max(yt, y0) + 14, M.fix(S.w, 2) + ' nm', { side: 1 });
            }
          }
          const name = S.preset === 'well' ? 'well' : S.preset === 'step' ? 'step' : S.preset === 'double' ? 'two barriers' : 'barrier';
          const size = S.preset === 'step' ? `${eV(S.V0)} eV` : `${eV(S.V0)} eV ${S.preset === 'well' ? 'deep' : 'high'}, ${M.fix(S.w, 2)} nm${S.preset === 'double' ? ' each' : ''}`;
          structLabel = {
            text: `${name}: ${size}`, hot: hot('V0') || hot('W'),
            x: M.clamp((xa + (S.preset === 'double' ? g.x(blocks[2].x1) : xb)) / 2, g.left + 90, g.right - 90),
            y: (S.preset === 'well' ? g.y(-S.V0) : y0) + 17,
          };
        }

        // energy line
        const yE = g.y(S.E);
        D.line(ctx, g.left, yE + 0.5, g.right, yE + 0.5, hot('E') ? 'rgba(240,239,236,0.7)' : 'rgba(240,239,236,0.28)', 1, [4, 4]);

        // the wave
        if (run.detected) { run.detected.age += dt; run.fade = Math.max(0, 1 - run.detected.age / 0.45); }
        const dpx = ((g.right - g.left) / (VIEW[1] - VIEW[0])) * sim.dx;
        const peak0 = 1 / (S.sigma * Math.sqrt(M.TAU));
        const tall = Math.min(92, 0.2 * (g.bottom - g.topY));
        if (run.fade > 0.01) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(g.left, 0, g.right - g.left, h);
          ctx.clip();
          ctx.globalAlpha = run.fade;
          D.wave(ctx, {
            re: sim.re, im: sim.im, i0: sim.i0, i1: sim.i1, x0: g.x(sim.xmin), dpx, baseY: yE,
            scale: S.amp ? tall / Math.sqrt(peak0) : tall / peak0, amp: S.amp, left: g.left, right: g.right, maxH: yE - 8,
          });
          ctx.restore();
        }

        // grip for the energy line, on top of the wave
        const tag = `E = ${eV(S.E)} eV`;
        ctx.font = D.font(11, 500, 'mono');
        const tw = ctx.measureText(tag).width + 16;
        D.rr(ctx, g.left + 6, yE - 11, tw, 22, 7);
        ctx.fillStyle = hot('E') ? '#262b38' : '#161a23';
        ctx.fill();
        ctx.strokeStyle = hot('E') ? 'rgba(240,239,236,0.6)' : 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
        D.text(ctx, tag, g.left + 14, yE, { size: 11, weight: 500, family: 'mono', base: 'middle', color: C.ink });
        zones.add({
          id: 'E', x: g.left, y: yE - 13, w: tw + 12, h: 26, cursor: 'ns-resize',
          drag: (p) => { S.E = M.clamp(Math.round((g.eAt(p.y) * U.EV) / 0.01) * 0.01 / U.EV, 0.1 / U.EV, 1.5 / U.EV); sE.value = S.E; changed(false); },
        });

        if (structLabel) D.text(ctx, structLabel.text, structLabel.x, structLabel.y, { size: 11, align: 'center', color: structLabel.hot ? C.ink : C.ink2, halo: true });

        // share labels riding on each packet
        if (!run.detected && sim.t > run.arrive * 0.8) {
          const share = (a, b, name, v) => {
            if (v < 0.002) return;
            let s = 0, mx = 0, pk = 0;
            for (let i = a; i <= b; i += 4) { const p = sim.re[i] ** 2 + sim.im[i] ** 2; s += p; mx += p * sim.x[i]; if (p > pk) pk = p; }
            if (!s) return;
            const x = M.clamp(g.x(mx / s), g.left + 46, g.right - 46);
            const hgt = Math.min(yE - 40, (S.amp ? (tall / Math.sqrt(peak0)) * Math.sqrt(pk) : (tall / peak0) * pk));
            D.text(ctx, `${M.fix(100 * v, v < 0.1 ? 1 : 0)}% ${name}`, x, yE - hgt - 12, { size: 11.5, weight: 600, align: 'center', color: C.ink, halo: true });
          };
          share(sim.i0, struct.iL, 'reflected', run.R);
          share(struct.iR, sim.i1, 'through', run.T);
        }

        // classical particle
        if (S.ball && !run.detected) {
          const bx = g.x(run.ballX);
          if (bx > g.left && bx < g.right) {
            D.glow(ctx, bx, yE, 13, [255, 255, 255], 0.5);
            ctx.beginPath(); ctx.arc(bx, yE, 4, 0, M.TAU); ctx.fillStyle = '#fff'; ctx.fill();
            D.text(ctx, 'classical', bx, yE + 20, { size: 10, align: 'center', color: C.ink3, halo: true });
          }
        }

        // detection flash
        if (run.detected) {
          const d = run.detected, px = g.x(d.x), pulse = Math.max(0, 1 - d.age / 0.7);
          D.glow(ctx, px, yE, 18 + 46 * pulse, C.hit, 0.55 + 0.45 * pulse);
          ctx.beginPath(); ctx.arc(px, yE, 4.5, 0, M.TAU); ctx.fillStyle = '#fff'; ctx.fill();
          if (pulse > 0) { ctx.beginPath(); ctx.arc(px, yE, 12 + 60 * (1 - pulse), 0, M.TAU); ctx.strokeStyle = C.css(C.hit, pulse * 0.7); ctx.lineWidth = 1.5; ctx.stroke(); }
          D.text(ctx, d.through ? 'detected: it got through' : 'detected: it bounced back', M.clamp(px, g.left + 90, g.right - 90), yE - 30, { size: 12, weight: 600, align: 'center', color: C.ink, halo: true });
        }
        if (run.phase === 'done' && (!run.detected || run.detected.age > 1.2)) D.text(ctx, 'Run finished. Press R or Launch to fire again.', g.right, g.topY - 16, { size: 11, align: 'right', color: C.ink2 });
        zones.end();

        // readouts
        tp.clock(`${M.fix(sim.t * U.FS, 0).padStart(3, ' ')} fs`);
        stT.set(M.fix(100 * run.T, run.T < 0.1 ? 2 : 1), '%');
        stP.set(M.fix(100 * run.predicted, run.predicted < 0.1 ? 2 : 1), '%');
        stR.set(M.fix(100 * run.R, 1), '%');
        const dV = top() - S.E;
        stK.set(dV > 0 && S.preset !== 'well' ? M.fix(1 / Math.sqrt(2 * dV), 2) : 'none', dV > 0 && S.preset !== 'well' ? 'nm' : '');
      };

      const moveBall = (t) => {
        const steps = Math.max(1, Math.round(t / 0.002)), h2 = t / steps;
        for (let s = 0; s < steps; s++) {
          const v2 = 2 * (S.E - sim.V[sim.index(run.ballX)]);
          const nx = run.ballX + run.ballDir * Math.sqrt(Math.max(v2, 0)) * h2;
          if (S.E <= sim.V[sim.index(nx + run.ballDir * sim.dx)]) run.ballDir = -run.ballDir;
          else run.ballX = nx;
        }
      };

      lab.frame((dt) => {
        if (S.playing && run.phase === 'run') {
          acc += (RATE * S.speed * dt) / DT;
          const n = Math.min(80, Math.floor(acc));
          acc -= n;
          if (n) {
            sim.step(n, DT);
            moveBall(n * DT);
            measure();
            const near = sim.norm(sim.index(struct.x0 - 7), sim.index(struct.x1 + 7));
            if ((sim.t > run.arrive + 1 && near < 0.01) || sim.t > 3.4 * run.arrive + 10) finish();
          }
        }
        draw(dt);
      });

      lab.note('Drag the barrier, its edge, or the energy tag');
      syncControls();
      launch();
      refreshChart();
      refreshTally();

      return { get state() { return { S, run, measured, tally, sim }; }, launch, detectMany };
    },
  });
})();
