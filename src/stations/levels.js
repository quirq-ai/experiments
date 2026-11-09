// Station 4: energy levels. An electron confined in a well can only hold
// certain energies. Stationary states, superpositions that move, and what a
// measurement of energy or position does to them.
(() => {
  const QL = globalThis.QL;
  const { el, slider, segmented, toggle, button, buttons } = QL.ui;
  const { math: M, draw: D, color: C, units: U } = QL;

  QL.register({
    id: 'levels',
    title: 'Energy comes in steps',
    short: 'Energy levels',
    kicker: 'Quantization and superposition',
    idea: 'Trap an electron and it can only hold certain energies. Blend two of them and the electron starts to move.',

    create(lab) {
      const sim = new QL.Wave1D({ n: 481, xmin: -2.4, xmax: 2.4 });
      const DT = 0.002, RATE = 1.4, K = 10, EVIEW = [-0.15 / U.EV, 3.4 / U.EV];
      const S = { preset: 'box', L: 2, omega: 4, Vb: 12, depth: 15.75, speed: 1, playing: true, sculpt: false };
      let eig = { E: [], phi: [] };
      let probs = new Float64Array(K), rest = 0, meanE = 0, acc = 0, since = 0;
      let prepared = null;            // copy of the last prepared state
      let flash = null;               // { n | x, age } after a measurement
      const tally = new Float64Array(K + 1);
      const seen = { solo: new Set(), squeezed: false, moved: false, tunneled: false, swung: false, startedLeft: false, kicked: false };

      const L = lab.layer('2d');
      const zones = new QL.Zones(L.canvas);
      lab.onDestroy(() => zones.destroy());

      // ---------------------------------------------------------- potential
      const shape = () => {
        sim.i0 = 1; sim.i1 = sim.n - 2;
        sim.W.fill(0); sim._absCells = 0;
        if (S.preset === 'box') { sim.setV(() => 0); sim.setRange(-S.L / 2, S.L / 2); }
        else if (S.preset === 'harmonic') sim.setV((x) => 0.5 * S.omega * S.omega * x * x);
        else if (S.preset === 'double') sim.setV((x) => Math.min(70, S.Vb * ((x / 0.7) ** 2 - 1) ** 2));
        else if (S.preset === 'finite') { sim.setV((x) => (Math.abs(x) < 0.8 ? 0 : S.depth)); sim.setAbsorber(0.5, 25); } // anything that climbs out is gone
      };
      const solve = () => { eig = sim.eigen(K); };
      const project = () => {
        let sum = 0;
        for (let n = 0; n < K; n++) { const [r, i] = sim.project(eig.phi[n]); probs[n] = r * r + i * i; sum += probs[n]; }
        rest = Math.max(0, 1 - sum);
        meanE = sim.energy();
      };
      const keep = () => { prepared = { re: sim.re.slice(), im: sim.im.slice() }; };
      const fromProbs = (p) => {
        sim.clear();
        for (let n = 0; n < K; n++) {
          if (p[n] <= 0) continue;
          const a = Math.sqrt(p[n]), phi = eig.phi[n];
          for (let i = sim.i0; i <= sim.i1; i++) sim.re[i] += a * phi[i];
        }
        sim.normalize();
        project(); keep(); since = 0; flash = null;
      };
      const solo = (n) => { const p = new Float64Array(K); p[n] = 1; fromProbs(p); seen.solo.add(n); tally.fill(0); };
      const prepare = () => {
        if (!prepared) return;
        sim.clear(); sim.re.set(prepared.re); sim.im.set(prepared.im);
        project(); since = 0; flash = null;
      };
      // Change the well under a live state: carry the amplitudes onto the new levels.
      const reshape = () => {
        const c = eig.phi.map((phi) => sim.project(phi));
        const had = sim.norm() > 0.5;
        shape(); solve();
        if (had) {
          sim.clear();
          for (let n = 0; n < K; n++) for (let i = sim.i0; i <= sim.i1; i++) { sim.re[i] += c[n][0] * eig.phi[n][i]; sim.im[i] += c[n][1] * eig.phi[n][i]; }
          if (sim.norm() < 1e-6) sim.setReal(eig.phi[0]);
          sim.normalize();
        } else sim.setReal(eig.phi[0]);
        project(); keep();
      };
      const setPreset = (name) => {
        S.preset = name; S.sculpt = false; sculptT.value = false;
        shape(); solve(); solo(0); seen.solo.delete(0);
        syncControls();
      };

      // -------------------------------------------------------- measurement
      const measureEnergy = () => {
        project();
        let u = Math.random(), pick = K;
        for (let n = 0; n < K; n++) { if (u < probs[n]) { pick = n; break; } u -= probs[n]; }
        if (pick < K) {
          sim.setReal(eig.phi[pick]);
          flash = { n: pick, age: 0 };
          lab.toast(`Energy measured: level ${pick + 1}, ${M.fix(eig.E[pick] * U.EV, 2)} eV`);
        } else {
          for (let n = 0; n < K; n++) {
            const [r, i] = sim.project(eig.phi[n]);
            for (let j = sim.i0; j <= sim.i1; j++) { sim.re[j] -= r * eig.phi[n][j]; sim.im[j] -= i * eig.phi[n][j]; }
          }
          sim.normalize();
          lab.toast('Energy measured: above the levels shown');
        }
        project(); since = 0;
      };
      const measurePosition = () => {
        const w = new Float64Array(sim.n);
        for (let i = sim.i0; i <= sim.i1; i++) w[i] = sim.re[i] ** 2 + sim.im[i] ** 2;
        const x = sim.x[Math.round(M.sample(M.cdf(w)))];
        sim.collapseTo(x, 0.12);
        flash = { x, age: 0 };
        seen.kicked = true;
        project(); since = 0;
        lab.toast(`Position measured: x = ${M.fix(x, 2)} nm`);
      };
      const repeatEnergy = (count) => {
        prepare();
        const p = probs.slice();
        for (let k = 0; k < count; k++) {
          let u = Math.random(), pick = K;
          for (let n = 0; n < K; n++) { if (u < p[n]) { pick = n; break; } u -= p[n]; }
          tally[pick]++;
        }
      };
      const tallyTotal = () => tally.reduce((a, b) => a + b, 0);
      const mixed = () => { let k = 0; for (let n = 0; n < K; n++) if (probs[n] > 0.12) k++; return k >= 2; };

      // ------------------------------------------------------------ controls
      const sL = slider({ label: 'Box width', min: 0.8, max: 4, step: 0.05, value: S.L, fmt: (v) => M.fix(v, 2), unit: 'nm', onInput: (v) => { S.L = v; if (v <= 1.3) seen.squeezed = true; reshape(); } });
      const sO = slider({ label: 'Spring stiffness', min: 2, max: 7, step: 0.1, value: S.omega, fmt: (v) => M.fix(v * U.EV, 2), unit: 'eV per step', onInput: (v) => { S.omega = v; reshape(); } });
      const sB = slider({ label: 'Barrier between the wells', min: 5, max: 22, step: 0.25, value: S.Vb, fmt: (v) => M.fix(v * U.EV, 2), unit: 'eV', onInput: (v) => { S.Vb = v; reshape(); } });
      const sD = slider({ label: 'Well depth', min: 4, max: 30, step: 0.25, value: S.depth, fmt: (v) => M.fix(v * U.EV, 2), unit: 'eV', onInput: (v) => { S.depth = v; reshape(); } });
      const preset = segmented({
        options: [{ value: 'box', label: 'Box' }, { value: 'harmonic', label: 'Spring' }, { value: 'double', label: 'Double well' }, { value: 'finite', label: 'Finite' }],
        value: S.preset, onChange: setPreset,
      });
      const sculptT = toggle({ label: 'Sculpt the potential by dragging', value: false, onChange: (v) => { S.sculpt = v; }, hint: 'Reshape the well with the pointer and watch the levels follow.' });
      const quick = el('div', { class: 'chips' });
      const chip = (label, fn) => el('button', { class: 'chip', type: 'button', text: label, onclick: fn });
      const paintQuick = () => {
        const items = [chip('Ground state', () => solo(0)), chip('Levels 1 + 2', () => { const p = new Float64Array(K); p[0] = p[1] = 0.5; fromProbs(p); tally.fill(0); })];
        if (S.preset === 'double') items.push(chip('Left well only', () => leftWell()));
        if (S.preset === 'harmonic') items.push(chip('Pulled to one side', () => displaced()));
        quick.replaceChildren(...items);
      };
      const leftWell = () => {
        sim.clear();
        for (let i = sim.i0; i <= sim.i1; i++) sim.re[i] = eig.phi[0][i] + eig.phi[1][i];
        if (sim.meanX() > 0) for (let i = sim.i0; i <= sim.i1; i++) sim.re[i] = eig.phi[0][i] - eig.phi[1][i];
        sim.normalize(); project(); keep(); since = 0; flash = null; tally.fill(0);
        seen.startedLeft = true;
      };
      const displaced = () => {
        const shift = Math.round(0.9 / sim.dx);
        sim.clear();
        for (let i = sim.i0; i <= sim.i1; i++) { const j = i + shift; sim.re[i] = j >= sim.i0 && j <= sim.i1 ? eig.phi[0][j] : 0; }
        sim.normalize(); project(); keep(); since = 0; flash = null; tally.fill(0);
        seen.kicked = true;
      };
      const syncControls = () => {
        preset.value = S.preset;
        sL.el.hidden = S.preset !== 'box'; sO.el.hidden = S.preset !== 'harmonic';
        sB.el.hidden = S.preset !== 'double'; sD.el.hidden = S.preset !== 'finite';
        sL.value = S.L; sO.value = S.omega; sB.value = S.Vb; sD.value = S.depth;
        paintQuick();
      };
      lab.control(preset, sL, sO, sB, sD,
        el('div', { class: 'ctl' }, el('div', { class: 'row' }, el('span', { class: 'lab', text: 'Prepare a state' })), quick,
          el('div', { class: 'hint', text: 'Or click a level on the bench, or drag the bars in the mixer below it.' })),
        buttons(button({ label: 'Measure energy', icon: 'target', onClick: measureEnergy, kbd: 'E' }), button({ label: 'Measure position', icon: 'target', onClick: measurePosition, kbd: 'X' })),
        buttons(button({ label: 'Prepare again', icon: 'reset', onClick: prepare, kbd: 'R' })),
        sculptT);
      lab.keys.e = measureEnergy;
      lab.keys.x = measurePosition;

      const stE = lab.stat({ label: 'Average energy' });
      const stZ = lab.stat({ label: 'Lowest allowed energy', tip: 'Zero-point energy: the electron can never have less than this.' });
      const stX = lab.stat({ label: 'Average position' });
      const stB = lab.stat({ label: 'Beat period', tip: 'h divided by the gap between the two main levels.' });

      lab.physics(`
        <p>A confined wave must fit its container, like a string fixed at both ends. Only certain wavelengths fit, so only certain energies are allowed.
        In a box of width L the n-th level sits at</p>
        <div class="eq">E<sub>n</sub> = n<sup>2</sup> h<sup>2</sup> / 8mL<sup>2</sup></div>
        <p>A single level is a <b>stationary state</b>: its probability density never changes and only its phase turns, at a rate E/&#295;.
        Add two levels and their phases drift apart, so the density sloshes with frequency (E<sub>2</sub> &minus; E<sub>1</sub>)/h.</p>
        <p>Levels and wave shapes are found by diagonalising the Hamiltonian on a ${sim.n} point grid, then advanced in time with the same matrix.</p>`);

      // ---------------------------------------------------------- mixer card
      const mcard = lab.card({ title: 'Level mixer', sub: 'drag a bar to change its share, click to solo' });
      mcard.legend.append(el('div', { class: 'legend' },
        el('span', {}, el('i', { class: 'bar', style: { color: C.theory } }), 'Probability of each energy'),
        el('span', {}, el('i', { class: 'dot', style: { color: C.data } }), 'Measured share')));
      const mix = el('canvas', { style: { width: '100%', height: '118px', display: 'block', touchAction: 'none' }, role: 'img', 'aria-label': 'Probability of each energy level' });
      mcard.body.append(mix);
      const mfit = QL.ui.fitCanvas(mix, 118), mctx = mfit.ctx, mh = 118;
      let mw = 0;
      const shown = () => { const cap = S.preset === 'finite' ? Math.min(EVIEW[1], S.depth) : EVIEW[1]; let k = 0; while (k < K && eig.E[k] < cap) k++; return Math.max(1, k); };
      const mgeo = () => { const n = shown(), l = 34, r = 10, slot = (mw - l - r) / n; return { n, l, r, slot, top: 8, base: mh - 22 }; };
      let mdrag = null;
      const mAt = (e) => {
        const b = mix.getBoundingClientRect(), g = mgeo();
        const n = M.clamp(Math.floor((e.clientX - b.left - g.l) / g.slot), 0, g.n - 1);
        return { n, p: M.clamp((g.base - (e.clientY - b.top)) / (g.base - g.top), 0, 1) };
      };
      const setShare = (n, p) => {
        const out = new Float64Array(K);
        let others = 0;
        for (let k = 0; k < K; k++) if (k !== n) others += probs[k];
        for (let k = 0; k < K; k++) out[k] = k === n ? p : others > 1e-9 ? (probs[k] * (1 - p)) / others : 0;
        if (others <= 1e-9 && p < 1) out[n === 0 ? 1 : 0] = 1 - p;
        fromProbs(out); tally.fill(0);
      };
      mix.addEventListener('pointerdown', (e) => { mdrag = { ...mAt(e), moved: false, y: e.clientY }; mix.setPointerCapture(e.pointerId); });
      mix.addEventListener('pointermove', (e) => { if (!mdrag) return; if (Math.abs(e.clientY - mdrag.y) > 3) mdrag.moved = true; if (mdrag.moved) setShare(mdrag.n, mAt(e).p); });
      mix.addEventListener('pointerup', () => { if (mdrag && !mdrag.moved) solo(mdrag.n); mdrag = null; });
      const drawMixer = () => {
        if (!mfit.fit()) return;
        mw = mfit.w;
        const g = mgeo(), total = tallyTotal();
        mctx.clearRect(0, 0, mw, mh);
        for (const v of [0, 0.5, 1]) {
          const y = Math.round(g.base - v * (g.base - g.top)) + 0.5;
          D.line(mctx, g.l, y, mw - g.r, y, v ? C.grid : C.axis);
          D.text(mctx, Math.round(v * 100) + '%', g.l - 6, y, { size: 10, align: 'right', base: 'middle' });
        }
        const bw = Math.min(24, g.slot - 6);
        for (let n = 0; n < g.n; n++) {
          const cx = g.l + (n + 0.5) * g.slot, hgt = probs[n] * (g.base - g.top);
          if (hgt > 0.5) {
            const r = Math.min(4, hgt);
            mctx.fillStyle = C.theory;
            mctx.beginPath();
            mctx.moveTo(cx - bw / 2, g.base); mctx.lineTo(cx - bw / 2, g.base - hgt + r);
            mctx.arcTo(cx - bw / 2, g.base - hgt, cx - bw / 2 + r, g.base - hgt, r);
            mctx.lineTo(cx + bw / 2 - r, g.base - hgt);
            mctx.arcTo(cx + bw / 2, g.base - hgt, cx + bw / 2, g.base - hgt + r, r);
            mctx.lineTo(cx + bw / 2, g.base);
            mctx.fill();
          }
          if (total > 0) {
            const y = g.base - (tally[n] / total) * (g.base - g.top);
            mctx.beginPath(); mctx.arc(cx, y, 6, 0, M.TAU); mctx.fillStyle = '#0c0e14'; mctx.fill();
            mctx.beginPath(); mctx.arc(cx, y, 4, 0, M.TAU); mctx.fillStyle = C.data; mctx.fill();
          }
          D.text(mctx, String(n + 1), cx, mh - 7, { size: 10.5, align: 'center', color: probs[n] > 0.02 ? C.ink : C.ink3, weight: probs[n] > 0.02 ? 600 : 400 });
          if (probs[n] > 0.03) D.text(mctx, Math.round(probs[n] * 100) + '%', cx, g.base - hgt - 5, { size: 10, align: 'center', color: C.ink2 });
        }
      };
      const rcard = lab.card({ title: 'Repeat the measurement', sub: 'prepare, measure, repeat', width: 236 });
      const rText = el('div', { class: 'nums', style: { whiteSpace: 'normal', lineHeight: '1.5' } });
      rcard.body.append(el('div', { class: 'tally' },
        el('div', { style: { display: 'flex', gap: '6px' } },
          button({ label: 'Run 20', small: true, onClick: () => repeatEnergy(20) }),
          button({ label: 'Run 500', small: true, onClick: () => repeatEnergy(500) }),
          button({ label: 'Clear', small: true, onClick: () => tally.fill(0) })),
        rText));

      const tp = lab.transport({
        playing: true, speeds: [0.25, 1, 4], speed: 1, clock: true,
        onToggle: (p) => { S.playing = p; }, onReset: prepare, onSpeed: (v) => { S.speed = v; },
      });

      // -------------------------------------------------------------- guide
      const two = () => { const p = new Float64Array(K); p[0] = p[1] = 0.5; fromProbs(p); tally.fill(0); };
      lab.guide([
        {
          id: 'solo', title: 'Meet the stationary states',
          body: 'Click the <b>three lowest levels</b> on the bench, one after another. Watch the shape of each wave and what its color does.',
          check: () => [0, 1, 2].every((n) => seen.solo.has(n)),
          progress: () => `${[0, 1, 2].filter((n) => seen.solo.has(n)).length} / 3 levels visited`,
          show: () => { seen.solo.add(0); seen.solo.add(1); solo(2); },
          insight: `Each level is a standing wave that fits the well exactly: one hump, then two, then three. More humps mean a shorter wavelength and more energy. Nothing in between fits, so <b>nothing in between is allowed</b>. Notice that the shape never moves. Only the color, the ${QL.ui.term('phase')}, turns, and it turns faster for higher levels. That is why these are called stationary states.`,
        },
        {
          id: 'squeeze', title: 'Squeeze the box',
          body: 'In the <b>Box</b>, drag a wall inward (or use the width slider) until the box is narrower than 1.3 nm. Keep an eye on the energy scale.',
          check: () => seen.squeezed && S.preset === 'box',
          show: () => { if (S.preset !== 'box') setPreset('box'); S.L = 1.2; seen.squeezed = true; reshape(); syncControls(); },
          insight: 'Every level shot upward. Confining the electron to a smaller space forces a shorter wavelength, and shorter wavelength means more momentum and more energy: E grows as 1/L&sup2;. Even the lowest level is not zero. A trapped particle <b>can never sit still</b>. This is why quantum dots glow bluer as they are made smaller, and why atoms do not collapse.',
        },
        {
          id: 'mix', title: 'Make it move',
          body: 'Give the electron a <b>half share of level 1 and half of level 2</b>: drag the bars in the mixer, or use the quick state above.',
          check: () => { if (probs[0] > 0.25 && probs[1] > 0.25 && since > 2.5) seen.moved = true; return seen.moved; },
          show: two,
          insight: `Neither level moves on its own, yet together they slosh from side to side. The two phases turn at different rates, so the levels drift in and out of step: where they agree they add, where they disagree they cancel. All motion in quantum mechanics is this kind of <b>${QL.ui.term('superposition', 'interference between energy levels')}</b>. The sloshing frequency is the energy gap divided by h, the same frequency of light the electron would emit jumping between them.`,
        },
        {
          id: 'energy', title: 'Ask it for its energy',
          body: 'Keep that half and half state and press <b>Run 20</b> under the bench. The lab prepares the same state afresh before each measurement.',
          predict: { q: 'The state is half level 1, half level 2. What will a measurement of its energy give?', options: ['The average of the two energies, every time', 'Level 1 or level 2, at random', 'Any value between the two'], answer: 1 },
          check: () => tallyTotal() >= 20 && mixed(),
          progress: () => `${Math.min(20, tallyTotal())} / 20 measurements`,
          show: () => { if (!mixed()) two(); repeatEnergy(20); },
          insight: `Never the average. Each measurement returns <b>one allowed level</b>, with odds given by the bars. The "average energy" is only the mean of many such results. Try the single <b>Measure energy</b> button too: afterwards the electron simply is in the level you found, and measuring again gives the same answer. That jump is the ${QL.ui.term('collapse')}.`,
        },
        {
          id: 'double', title: 'Through the middle',
          body: 'Switch to the <b>Double well</b> and choose <b>Left well only</b>. A classical particle with this energy would stay on the left forever.',
          check: () => { if (S.preset === 'double' && seen.startedLeft && sim.meanX() > 0.25) seen.tunneled = true; return seen.tunneled; },
          show: () => { setPreset('double'); leftWell(); },
          insight: 'The electron leaked through the barrier into the right-hand well and will keep swapping sides. "Left" is not a stationary state here: it is levels 1 and 2 added together, and their tiny energy gap sets the swapping rate. Raise the barrier and the swapping slows dramatically. The nitrogen atom in ammonia does exactly this, 24 billion times a second, and that beat ran the first atomic clocks.',
        },
        {
          id: 'classical', title: 'Find the classical world',
          body: 'Switch to the <b>Spring</b> and choose <b>Pulled to one side</b>. Then try <b>Measure position</b> and watch what the electron does next.',
          check: () => { if (S.preset === 'harmonic' && seen.kicked && since > 3.2) seen.swung = true; return seen.swung; },
          show: () => { setPreset('harmonic'); displaced(); },
          insight: 'A compact packet swings back and forth like a ball on a spring, at exactly the classical frequency. It is built from many neighbouring levels whose phases keep step. This is how the ordinary world emerges: big objects are always in such blends, never in one sharp level. Measuring position creates a blend too, which is why finding the electron also sets it moving.',
        },
      ]);

      // ------------------------------------------------------------ drawing
      const geo = () => {
        const { w, h } = L;
        const left = 66, right = w - 104, topY = 44, bottom = h - 92;
        return {
          left, right, topY, bottom,
          x: (x) => left + ((x - sim.xmin) / (sim.xmax - sim.xmin)) * (right - left),
          y: (e) => bottom - ((e - EVIEW[0]) / (EVIEW[1] - EVIEW[0])) * (bottom - topY),
          eAt: (y) => EVIEW[0] + ((bottom - y) / (bottom - topY)) * (EVIEW[1] - EVIEW[0]),
          xAt: (px) => sim.xmin + ((px - left) / (right - left)) * (sim.xmax - sim.xmin),
        };
      };

      const draw = (dt) => {
        const { ctx, w, h } = L;
        const g = geo();
        ctx.clearRect(0, 0, w, h);
        zones.begin();
        const dpx = (g.right - g.left) / (sim.n - 1), x0 = g.left;

        for (const e of D.ticks(0, EVIEW[1] * U.EV, 6)) {
          const y = Math.round(g.y(e / U.EV)) + 0.5;
          D.line(ctx, g.left, y, g.right, y, e === 0 ? C.axis : C.grid);
          D.text(ctx, M.fix(e, 1) + ' eV', g.left - 10, y, { size: 10.5, align: 'right', base: 'middle', family: 'mono' });
        }
        for (const x of D.ticks(sim.xmin, sim.xmax, 8)) {
          if (x <= sim.xmin || x >= sim.xmax) continue;
          D.line(ctx, g.x(x), g.bottom, g.x(x), g.bottom + 5, C.axis);
          D.text(ctx, x + ' nm', g.x(x), g.bottom + 18, { size: 10.5, align: 'center', family: 'mono' });
        }
        D.text(ctx, 'energy', g.left - 10, g.topY - 16, { size: 10.5, align: 'right' });

        // the well
        ctx.save();
        ctx.beginPath();
        ctx.rect(g.left, g.topY - 14, g.right - g.left, g.bottom - g.topY + 14);
        ctx.clip();
        const xa = g.x(sim.x[sim.i0 - 1]), xb = g.x(sim.x[sim.i1 + 1]);
        if (S.preset === 'box') {
          for (const [a, b, id] of [[g.left, xa, 'wallL'], [xb, g.right, 'wallR']]) {
            const grad = ctx.createLinearGradient(a, 0, b, 0);
            grad.addColorStop(id === 'wallL' ? 1 : 0, 'rgba(150,170,225,0.26)');
            grad.addColorStop(id === 'wallL' ? 0 : 1, 'rgba(150,170,225,0.05)');
            ctx.fillStyle = grad;
            ctx.fillRect(a, g.topY - 14, b - a, g.bottom - g.topY + 14);
            const edge = id === 'wallL' ? xa : xb, hot = zones.isHot(id);
            D.line(ctx, edge, g.topY - 14, edge, g.bottom, hot ? C.ink : 'rgba(190,205,245,0.8)', hot ? 2 : 1.25);
            zones.add({
              id, x: edge - 8, y: g.topY, w: 16, h: g.bottom - g.topY, cursor: 'ew-resize',
              drag: (p) => { S.L = M.clamp(Math.round((2 * Math.abs(g.xAt(p.x))) / 0.05) * 0.05, 0.8, 4); sL.value = S.L; if (S.L <= 1.3) seen.squeezed = true; reshape(); },
            });
          }
          ctx.beginPath();
          for (let i = sim.i0 - 1; i <= sim.i1 + 1; i++) { const y = Math.max(g.topY - 20, g.y(sim.V[i])); i === sim.i0 - 1 ? ctx.moveTo(x0 + i * dpx, y) : ctx.lineTo(x0 + i * dpx, y); }
          ctx.strokeStyle = 'rgba(190,205,245,0.8)';
          ctx.lineWidth = 1.25;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(g.left, g.bottom + 2);
          for (let i = 0; i < sim.n; i++) ctx.lineTo(x0 + i * dpx, Math.max(g.topY - 20, g.y(sim.V[i])));
          ctx.lineTo(g.right, g.bottom + 2);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, g.topY, 0, g.bottom);
          grad.addColorStop(0, 'rgba(150,170,225,0.22)');
          grad.addColorStop(1, 'rgba(150,170,225,0.05)');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.beginPath();
          for (let i = 0; i < sim.n; i++) { const y = Math.max(g.topY - 20, g.y(sim.V[i])); i ? ctx.lineTo(x0 + i * dpx, y) : ctx.moveTo(x0, y); }
          ctx.strokeStyle = 'rgba(190,205,245,0.8)';
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
        ctx.restore();

        // allowed levels
        const nShown = shown();
        const labelY = [];   // keep the labels of nearly degenerate levels apart
        for (let n = 0; n < nShown; n++) { const y = g.y(eig.E[n]); labelY.push(n ? Math.min(y, labelY[n - 1] - 13) : y); }
        for (let n = 0; n < nShown; n++) {
          const E = eig.E[n];
          if (!(E < EVIEW[1])) continue;
          const y = Math.round(g.y(E)) + 0.5, id = 'lv' + n, hot = zones.isHot(id), p = probs[n];
          let a = -1, lo = 1e9, hi = -1e9;
          ctx.strokeStyle = hot ? C.ink : `rgba(240,239,236,${0.2 + 0.6 * Math.min(1, p * 1.5)})`;
          ctx.lineWidth = hot || p > 0.02 ? 1.5 : 1;
          ctx.beginPath();
          for (let i = sim.i0; i <= sim.i1 + 1; i++) {
            const inside = i <= sim.i1 && sim.V[i] < E;
            if (inside && a < 0) a = i;
            if (!inside && a >= 0) {
              const xs = x0 + a * dpx, xe = x0 + (i - 1) * dpx;
              ctx.moveTo(xs, y); ctx.lineTo(xe, y);
              lo = Math.min(lo, xs); hi = Math.max(hi, xe); a = -1;
            }
          }
          ctx.stroke();
          if (hi < lo) continue;
          const flashing = flash && flash.n === n ? Math.max(0, 1 - flash.age / 0.9) : 0;
          if (flashing) { D.line(ctx, lo, y, hi, y, C.css(C.hit, flashing), 3); D.glow(ctx, (lo + hi) / 2, y, 60 * flashing + 10, C.hit, 0.5 * flashing); }
          if (hot || p > 0.02) D.curve(ctx, eig.phi[n], { x0, dpx, baseY: y, scale: 16, i0: sim.i0, i1: sim.i1, color: hot ? 'rgba(240,239,236,0.7)' : 'rgba(240,239,236,0.28)', width: 1 });
          const ly = labelY[n];
          if (Math.abs(ly - y) > 1) D.line(ctx, g.right + 1, y, g.right + 8, ly, 'rgba(240,239,236,0.3)');
          D.text(ctx, `${n + 1}`, g.right + 12, ly, { size: 11, weight: 600, base: 'middle', color: hot || p > 0.02 ? C.ink : C.ink3, family: 'mono' });
          D.text(ctx, `${M.fix(E * U.EV, 2)} eV${p > 0.02 ? '  ' + Math.round(p * 100) + '%' : ''}`, g.right + 26, ly, { size: 10.5, base: 'middle', color: hot || p > 0.02 ? C.ink2 : C.ink4, family: 'mono' });
          if (!S.sculpt) zones.add({ id, x: lo - 4, y: y - 7, w: hi - lo + 100, h: 14, cursor: 'pointer', click: () => solo(n) });
        }

        // the state itself
        const yBase = M.clamp(g.y(meanE), g.topY + 30, g.bottom);
        ctx.save();
        ctx.beginPath();
        ctx.rect(g.left, 0, g.right - g.left, h);
        ctx.clip();
        D.wave(ctx, { re: sim.re, im: sim.im, i0: sim.i0, i1: sim.i1, x0, dpx, baseY: yBase, scale: Math.min(64, 0.17 * (g.bottom - g.topY)), maxH: yBase - 6, left: g.left, right: g.right });
        ctx.restore();
        if (flash && flash.x != null) {
          const f = Math.max(0, 1 - flash.age / 0.9);
          if (f > 0) { D.glow(ctx, g.x(flash.x), yBase, 16 + 50 * f, C.hit, 0.8 * f); ctx.beginPath(); ctx.arc(g.x(flash.x), yBase, 4, 0, M.TAU); ctx.fillStyle = C.css([255, 255, 255], f); ctx.fill(); }
        }
        if (flash) flash.age += dt;

        // where the electron is on average
        const mx = sim.meanX(), px = g.x(mx);
        ctx.beginPath(); ctx.moveTo(px, g.bottom + 1); ctx.lineTo(px - 5, g.bottom + 9); ctx.lineTo(px + 5, g.bottom + 9); ctx.closePath();
        ctx.fillStyle = C.ink; ctx.fill();

        if (S.sculpt) {
          zones.add({
            id: 'sculpt', x: g.left, y: g.topY - 14, w: g.right - g.left, h: g.bottom - g.topY + 14, cursor: 'crosshair',
            drag: (p) => {
              const c = sim.index(g.xAt(p.x)), target = M.clamp(g.eAt(p.y), 0, 60);
              const c0 = eig.phi.map((phi) => sim.project(phi));
              for (let i = Math.max(sim.i0, c - 40); i <= Math.min(sim.i1, c + 40); i++) { const b = Math.exp(-((i - c) ** 2) / 200); sim.V[i] += (target - sim.V[i]) * b * 0.5; }
              sim._dirty = true;
              solve();
              sim.clear();
              for (let n = 0; n < K; n++) for (let i = sim.i0; i <= sim.i1; i++) { sim.re[i] += c0[n][0] * eig.phi[n][i]; sim.im[i] += c0[n][1] * eig.phi[n][i]; }
              sim.normalize(); project(); keep();
            },
          });
        }
        zones.end();

        drawMixer();
        tp.clock(`${M.fix(sim.t * U.FS, 0)} fs`);
        stE.set(M.fix(meanE * U.EV, 2), 'eV');
        stZ.set(M.fix(eig.E[0] * U.EV, 3), 'eV');
        stX.set(M.fix(mx, 2), 'nm');
        const top2 = [...probs].map((p, n) => [p, n]).sort((a, b) => b[0] - a[0]);
        if (top2[1][0] > 0.05) stB.set(M.fix((M.TAU / Math.abs(eig.E[top2[0][1]] - eig.E[top2[1][1]])) * U.FS, 1), 'fs');
        else stB.set('none', '');
        const total = tallyTotal();
        rText.replaceChildren(total
          ? `${total} runs: ` + [...tally].map((c, n) => (c ? `level ${n < K ? n + 1 : 'above'}: ${c}` : '')).filter(Boolean).join(', ')
          : 'No runs yet. Each run starts from the prepared state.');
      };

      lab.frame((dt) => {
        if (S.playing) {
          acc += (RATE * S.speed * dt) / DT;
          const n = Math.min(120, Math.floor(acc));
          acc -= n;
          if (n) { sim.step(n, DT); since += n * DT; }
        }
        draw(dt);
      });

      lab.note('Click a level, drag the walls, or drag the mixer bars');
      shape(); solve(); solo(0); seen.solo.clear();
      syncControls();

      return { get state() { return { S, sim, eig, probs, tally, seen }; }, solo, setPreset, measureEnergy, measurePosition };
    },
  });
})();
