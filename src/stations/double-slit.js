// Station 1: the double slit. A real two-dimensional Schrödinger wave leaves
// an electron source, passes a wall with slits, and reaches a screen that can
// only ever register whole electrons, one dot at a time.
(() => {
  const QL = globalThis.QL;
  const { el, slider, segmented, toggle, button, buttons } = QL.ui;
  const { math: M, draw: D, color: C } = QL;

  const NX = 720, NY = 600, PAD = 40, GUN = 56, WALL = 230, WT = 6, SCR = NX - PAD - 2, CY = NY / 2;
  const VIEW = { x: PAD, y: PAD, w: SCR - PAD, h: NY - 2 * PAD };
  const NM = 0.0625;         // one grid cell in nanometres
  const NB = 80;             // histogram bins down the screen
  const SX = 34, SY = 60;    // length and width of one electron's wave packet, in cells

  QL.register({
    id: 'double-slit',
    title: 'One electron, two slits',
    short: 'Double slit',
    kicker: 'Wave-particle duality',
    idea: 'Send electrons at a wall with two slits, one at a time. Each lands as a single dot. Together the dots draw a pattern that only a wave passing through both slits could make.',

    create(lab) {
      const G = lab.layer('webgl2');
      const L = lab.layer('2d');
      let sim;
      try { sim = new QL.Wave2D(G.gl, NX, NY); }
      catch (e) {
        lab.fallback(`This station solves a wave equation on the graphics card and needs WebGL2 with floating point textures.<br><span style="color:var(--ink-3)">${e.message}</span>`);
        return {};
      }
      const zones = new QL.Zones(L.canvas);
      lab.onDestroy(() => zones.destroy());

      const S = { source: 'single', slits: 2, d: 80, a: 22, volt: 1.2, watch: false, rate: 400, view: 'phase', auto: true, speed: 1, playing: true };
      const mask = new Uint8Array(NX * NY * 4);
      const fluxA = new Float64Array(NY), fluxB = new Float64Array(NY), both = new Float64Array(NY);
      const pattern = new Float64Array(NY);
      const counts = new Uint32Array(NB);
      const hits = [], recent = [];
      const seen = { userShot: false, tuned: false };
      let total = 0, shot = null, beam = null, vis = [1, 0], clock = 0, lay = null;
      let stats = { spacing: NaN, contrast: NaN };
      const sensor = [0, 0];
      const plate = document.createElement('canvas');
      const pctx = plate.getContext('2d');

      const watching = () => S.watch && S.slits === 2;
      const lam = () => 1.2264 / NM / Math.sqrt(S.volt);  // de Broglie wavelength in cells
      const kk = () => M.TAU / lam();
      const omega = () => 1 - Math.cos(kk());             // lattice dispersion
      const vg = () => Math.sin(kk());
      const pulse = () => { const v = vg(), tau = (SX * Math.SQRT2) / v; return { v, tau, s0: Math.sqrt(v / (tau * Math.sqrt(Math.PI) * SY * Math.sqrt(M.TAU))) }; };

      // ------------------------------------------------------- the apparatus
      const openings = () => {
        const slit = (c) => [Math.round(c - S.a / 2), Math.round(c + S.a / 2)];
        return S.slits === 1 ? [slit(CY)] : [slit(CY - S.d / 2), slit(CY + S.d / 2)];
      };
      const buildMask = () => {
        const all = openings();
        const f1 = watching() ? [all[0]] : all, f2 = watching() ? [all[1]] : all;
        const open = (list, y) => list.some(([a, b]) => y >= a && y < b);
        for (let y = 0; y < NY; y++) {
          const o1 = open(f1, y), o2 = open(f2, y);
          for (let x = 0; x < NX; x++) {
            const i = (y * NX + x) * 4, edge = Math.min(x, NX - 1 - x, y, NY - 1 - y);
            const inWall = x >= WALL && x < WALL + WT;
            mask[i] = inWall && !o1 ? 255 : 0;
            mask[i + 1] = inWall && !o2 ? 255 : 0;
            mask[i + 2] = edge < PAD ? Math.round(255 * ((PAD - edge) / PAD) ** 2) : 0;
            mask[i + 3] = 255;
          }
        }
        sim.setMask(mask);
      };

      const clearScreen = () => {
        hits.length = 0; recent.length = 0; counts.fill(0); total = 0;
        pctx.clearRect(0, 0, plate.width, plate.height);
      };
      const reconfigure = () => {
        buildMask();
        sim.clear();
        pattern.fill(0);
        clearScreen();
        stats = { spacing: NaN, contrast: NaN };
        shot = null;
        if (S.source === 'beam') startBeam(); else fire(false);
      };

      const fire = (byUser) => {
        if (S.source !== 'single') return;
        sim.clear();
        const { v, tau, s0 } = pulse();
        sim.source = { x: GUN, y: CY, sigma: SY };
        const tc = sim.t + 2.6 * tau;
        const jit = (s) => M.clamp(M.randn(), -1.5, 1.5) * s;
        shot = {
          t0: sim.t, tc, tau, s0, state: 'fly', path: null, byUser,
          tPath: tc + (WALL + WT - GUN) / v + jit(0.35 * tau),
          tDet: tc + (SCR - GUN) / v + jit(tau / Math.SQRT2),
          tGiveUp: tc + (SCR - GUN) / v + 3 * tau,
        };
        vis = watching() ? [1, 1] : [1, 0];
        if (!tp.playing) { tp.set(true); S.playing = true; }
      };
      const startBeam = () => {
        sim.clear();
        sim.source = { x: GUN, y: CY, sigma: 150 };
        beam = { t0: sim.t, s0: 0.5 * pulse().s0, fmax: 0 };
        vis = watching() ? [1, 1] : [1, 0];
      };
      const drive = (time, pass) => {
        let a;
        if (S.source === 'single') {
          if (!shot || shot.state !== 'fly') return null;
          const e = Math.exp(-((time - shot.tc) ** 2) / (2 * shot.tau * shot.tau));
          if (e < 1e-6) return null;
          const ph = omega() * (time - shot.t0);
          a = sim.dt * shot.s0 * e * (pass ? Math.cos(ph) : Math.sin(ph));
        } else {
          const ph = omega() * (time - beam.t0);
          a = sim.dt * beam.s0 * M.smooth((time - beam.t0) / 260) * (pass ? Math.cos(ph) : Math.sin(ph));
        }
        return watching() ? [a * Math.SQRT1_2, a * Math.SQRT1_2] : [a, 0];
      };

      const addHit = (y, flashy) => {
        const h = { y, x: 0.06 + 0.88 * Math.random() };
        hits.push(h);
        if (hits.length > 60000) hits.shift();
        const b = Math.floor(((y - PAD) / VIEW.h) * NB);
        if (b >= 0 && b < NB) counts[b]++;
        total++;
        dot(h);
        if (flashy) recent.push({ ...h, age: 0, big: flashy === 'big' });
        if (recent.length > 24) recent.shift();
      };
      const dot = (h) => {
        if (!lay) return;
        const s = plate.width / lay.P.w, x = h.x * plate.width, y = ((h.y - PAD) / VIEW.h) * plate.height;
        pctx.globalCompositeOperation = 'lighter';
        pctx.fillStyle = 'rgba(255,214,160,0.05)';
        pctx.beginPath(); pctx.arc(x, y, 3 * s, 0, M.TAU); pctx.fill();
        pctx.fillStyle = 'rgba(255,232,200,0.62)';
        pctx.beginPath(); pctx.arc(x, y, 1.05 * s, 0, M.TAU); pctx.fill();
      };

      // Fringe spacing and contrast, read off the wave that reached the screen.
      const analyse = () => {
        const n = VIEW.h, p = new Float64Array(n);
        let peak = 0, at = 0;
        for (let i = 0; i < n; i++) {
          let s = 0, c = 0;
          for (let j = -3; j <= 3; j++) { const y = PAD + i + j; if (y >= PAD && y < NY - PAD) { s += pattern[y]; c++; } }
          p[i] = s / c;
          if (p[i] > peak) { peak = p[i]; at = i; }
        }
        if (!(peak > 0)) return { spacing: NaN, contrast: NaN };
        const walk = (dir) => {
          let i = at;
          while (i + dir > 0 && i + dir < n - 1 && p[i + dir] <= p[i]) i += dir;
          const lo = i;
          while (i + dir > 0 && i + dir < n - 1 && p[i + dir] >= p[i]) i += dir;
          return p[i] - p[lo] > 0.04 * peak ? { lo, hi: i } : null;
        };
        const a = walk(-1), b = walk(1);
        if (!a && !b) return { spacing: NaN, contrast: 0 };
        const sides = [a, b].filter(Boolean);
        const spacing = sides.reduce((s, r) => s + Math.abs(r.hi - at), 0) / sides.length;
        const low = sides.reduce((s, r) => s + p[r.lo], 0) / sides.length;
        return { spacing, contrast: (peak - low) / (peak + low) };
      };

      // ------------------------------------------------------------ controls
      const src = segmented({
        label: 'Electron source',
        options: [{ value: 'single', label: 'One at a time' }, { value: 'beam', label: 'Steady beam' }],
        value: S.source, onChange: (v) => { S.source = v; syncControls(); sim.clear(); pattern.fill(0); shot = null; v === 'beam' ? startBeam() : fire(false); },
      });
      const fireBtn = button({ label: 'Fire one electron', icon: 'bolt', kind: 'primary', kbd: 'F', onClick: () => fire(true) });
      const fireRow = buttons(fireBtn);
      const autoT = toggle({ label: 'Keep firing', value: S.auto, onChange: (v) => { S.auto = v; if (v && (!shot || shot.state === 'idle')) fire(true); } });
      const sRate = slider({ label: 'Arrival rate', min: 20, max: 5000, step: 10, log: true, value: S.rate, fmt: (v) => M.int(v), unit: 'per second', onInput: (v) => { S.rate = v; } });
      const slitSeg = segmented({ label: 'Slits open', options: [{ value: 1, label: 'One' }, { value: 2, label: 'Two' }], value: S.slits, onChange: (v) => { S.slits = v; syncControls(); reconfigure(); } });
      const sD = slider({ label: 'Slit separation', min: 56, max: 128, step: 4, value: S.d, fmt: (v) => M.fix(v * NM, 2), unit: 'nm', onInput: (v) => { S.d = v; seen.tuned = true; reconfigure(); } });
      const sA = slider({ label: 'Slit width', min: 10, max: 36, step: 2, value: S.a, fmt: (v) => M.fix(v * NM, 2), unit: 'nm', onInput: (v) => { S.a = v; reconfigure(); } });
      const sV = slider({
        label: 'Gun voltage', min: 0.6, max: 2.4, step: 0.05, value: S.volt, fmt: (v) => M.fix(v, 2), unit: 'V',
        hint: '', onInput: (v) => { S.volt = v; seen.tuned = true; paintVolt(); reconfigure(); },
      });
      const paintVolt = () => { sV.hint = `Faster electrons have a shorter wavelength: ${M.fix(lam() * NM, 2)} nm at this setting.`; };
      const watchT = toggle({
        label: 'Which-slit detector', value: S.watch,
        hint: 'A marker at the slits records which one each electron used, without blocking it.',
        onChange: (v) => { S.watch = v; reconfigure(); },
      });
      const viewSeg = segmented({ label: 'Show the wave as', options: [{ value: 'phase', label: 'Phase and amplitude' }, { value: 'prob', label: 'Probability only' }], value: S.view, onChange: (v) => { S.view = v; } });
      const syncControls = () => {
        src.value = S.source; slitSeg.value = S.slits; sD.value = S.d; sA.value = S.a; sV.value = S.volt; watchT.value = S.watch; autoT.value = S.auto; sRate.value = S.rate;
        fireRow.hidden = autoT.el.hidden = S.source !== 'single';
        sRate.el.hidden = S.source !== 'beam';
        sD.setDisabled(S.slits === 1);
        watchT.setDisabled(S.slits === 1);
        paintVolt();
      };
      lab.control(src, fireRow, autoT, sRate, slitSeg, sD, sA, sV, watchT, viewSeg,
        buttons(button({ label: 'Wipe the screen', icon: 'trash', onClick: clearScreen })));
      lab.keys.f = () => { if (S.source === 'single') fire(true); };

      const stN = lab.stat({ label: 'Electrons detected', swatch: C.data });
      const stL = lab.stat({ label: 'Wavelength' });
      const stF = lab.stat({ label: 'Fringe spacing, formula', tip: 'wavelength times screen distance, divided by slit separation' });
      const stW = lab.stat({ label: 'Fringe spacing, in the wave', swatch: C.theory });
      const stC = lab.stat({ label: 'Fringe contrast', wide: true, tip: 'How deep the dark bands are: 100% means no electrons at all arrive there.' });

      lab.physics(`
        <p>The picture on the bench is a top view. Color is the phase of the electron's wavefunction and brightness is where it could be found.
        With both slits open the amplitudes from the two slits add <i>before</i> they are squared:</p>
        <div class="eq">P = |&psi;<sub>1</sub> + &psi;<sub>2</sub>|<sup>2</sup> = |&psi;<sub>1</sub>|<sup>2</sup> + |&psi;<sub>2</sub>|<sup>2</sup> + 2 Re(&psi;<sub>1</sub><sup>*</sup>&psi;<sub>2</sub>)</div>
        <p>The last term is the interference. It makes bright bands a distance &lambda;L/d apart, and it vanishes the moment anything records which slit was used,
        because the two paths then end in different states of the world and can no longer add.</p>
        <p>The wave is computed on a ${NX} by ${NY} grid on your graphics card, close to two thousand time steps a second. Each dot is drawn at random from the
        probability current arriving at the screen.</p>`);

      const tp = lab.transport({
        playing: true, speeds: [0.5, 1, 2], speed: 1,
        onToggle: (p) => { S.playing = p; }, onReset: () => reconfigure(), onSpeed: (v) => { S.speed = v; },
      });

      // -------------------------------------------------------------- guide
      const setup = (o) => { Object.assign(S, o); syncControls(); reconfigure(); };
      lab.guide([
        {
          id: 'one', title: 'Fire a single electron',
          body: 'Press <b>Fire one electron</b> and follow that one wave from the source, through the wall, to the screen on the right.',
          check: () => seen.userShot,
          show: () => { if (S.source !== 'single') setup({ source: 'single' }); fire(true); },
          insight: `The wave spread out, went through <b>both slits</b>, and overlapped with itself. Yet the screen registered one small dot in one place. The wave is not the electron smeared out. It is the electron's ${QL.ui.term('amplitude')}: it says where a dot is likely to appear, and the dot itself appears at random.`,
        },
        {
          id: 'many', title: 'Let the dots pile up',
          body: 'One dot tells you nothing. Switch the source to <b>Steady beam</b> and collect a few hundred. Every dot is still a single electron arriving alone.',
          check: () => total >= 400 && S.slits === 2 && !S.watch,
          progress: () => `${Math.min(400, total)} / 400 electrons`,
          show: () => setup({ source: 'beam', slits: 2, watch: false }),
          insight: 'Stripes. No single electron carries the pattern, yet each one avoids the dark bands. The blue curve is the brightness of the wave where it meets the screen, and the orange counts grow into exactly that shape. Each electron interferes <b>with itself</b>: its wave took both routes, and where the two routes arrive out of step, it is never found.',
        },
        {
          id: 'close', title: 'Close one slit',
          body: 'Set <b>Slits open</b> to One and collect a few hundred electrons again.',
          predict: { q: 'With one slit closed, what happens to the dark bands?', options: ['They stay dark: fewer electrons arrive everywhere', 'They fill in: electrons now land where none did before', 'The whole pattern shifts sideways'], answer: 1 },
          check: () => S.slits === 1 && total >= 250,
          progress: () => (S.slits === 1 ? `${Math.min(250, total)} / 250 electrons` : 'set Slits open to One'),
          show: () => setup({ source: 'beam', slits: 1, watch: false }),
          insight: 'One broad hump, no stripes. Compare a dark band from before: with two slits open no electrons landed there, and now they do. <b>Opening a second door made electrons arrive less often</b> at that spot. For bullets that is impossible, since more doors can only let more through. For waves it is routine: two contributions can cancel.',
        },
        {
          id: 'watch', title: 'Find out which slit',
          body: 'Open both slits again and switch on the <b>Which-slit detector</b>. It tags each electron by slit without stopping it. Collect a few hundred.',
          predict: { q: 'Both slits are open, but now you know which one each electron used. The pattern will be:', options: ['Stripes, exactly as before', 'Two overlapping humps with no stripes', 'Stripes, but shifted'], answer: 1 },
          check: () => S.slits === 2 && S.watch && total >= 300,
          progress: () => (S.slits === 2 && S.watch ? `${Math.min(300, total)} / 300 electrons` : 'two slits, detector on'),
          show: () => setup({ source: 'beam', slits: 2, watch: true }),
          insight: `The stripes are gone, with both slits still open. On the bench the wave from each slit is now painted its own color, because the two have become <b>distinguishable</b>: one ends with the detector saying "upper", the other "lower". Amplitudes only add when nothing in the universe could tell the routes apart. This loss of interference through recorded information is called ${QL.ui.term('decoherence')}, and it is why everyday objects never show stripes.`,
        },
        {
          id: 'tune', title: 'Measure a wavelength',
          body: 'Detector off. Change the <b>slit separation</b> or the <b>gun voltage</b> and watch the stripes respond. Drag a slit on the bench if you like.',
          check: () => seen.tuned && !S.watch && S.slits === 2 && total >= 250 && stats.contrast > 0.3,
          progress: () => (seen.tuned ? `${Math.min(250, total)} / 250 electrons` : 'change the separation or voltage'),
          show: () => { seen.tuned = true; setup({ source: 'beam', slits: 2, watch: false, d: 60, volt: 1.9 }); },
          insight: 'Closer slits spread the stripes apart; faster electrons squeeze them together. The spacing follows &lambda;L/d, with &lambda; = h/p the wavelength de Broglie predicted for matter in 1924. Reading &lambda; off electron diffraction patterns is how that prediction was confirmed three years later, and the same short wavelength is what lets an electron microscope see atoms.',
        },
      ]);

      // -------------------------------------------------------------- layout
      const layout = () => {
        const { w, h } = L;
        const top = 44, bottom = h - 66, gap = 10;
        const histW = M.clamp(w * 0.16, 80, 170), plateW = M.clamp(w * 0.07, 40, 64);
        const availW = w - 36 - histW - plateW - 2 * gap, availH = bottom - top;
        const scale = Math.min(availW / VIEW.w, availH / VIEW.h);
        const fw = VIEW.w * scale, fh = VIEW.h * scale;
        const x = Math.max(18, (w - (fw + plateW + histW + 2 * gap)) / 2), y = top + (availH - fh) / 2;
        lay = {
          F: { x, y, w: fw, h: fh }, scale,
          P: { x: x + fw + gap, y, w: plateW, h: fh },
          H: { x: x + fw + gap + plateW + gap, y, w: histW, h: fh },
        };
        const dpr = L.dpr;
        plate.width = Math.round(plateW * dpr);
        plate.height = Math.round(fh * dpr);
        for (const hh of hits) dot(hh);
      };
      lab.onResize(layout);

      // ------------------------------------------------------------ drawing
      const draw = (dt) => {
        const { ctx, w, h, dpr } = L;
        if (!lay) layout();
        const { F, P, H, scale } = lay;
        const cx = (x) => F.x + (x - PAD) * scale, cy = (y) => F.y + (y - PAD) * scale;
        const gain = 1 / (pulse().s0 / pulse().v) ** 2;
        sim.render({ x: Math.round(F.x * dpr), y: Math.round(F.y * dpr), w: Math.round(F.w * dpr), h: Math.round(F.h * dpr) }, VIEW,
          { mode: S.view === 'prob' ? 1 : watching() ? 2 : 0, vis, gain: S.source === 'beam' ? gain * 2.2 : gain });

        ctx.clearRect(0, 0, w, h);
        zones.begin();
        D.text(ctx, 'VIEW FROM ABOVE', F.x, F.y - 10, { size: 10, weight: 600, color: C.ink3 });
        D.text(ctx, 'SCREEN', P.x + P.w / 2, F.y - 10, { size: 10, weight: 600, color: C.ink3, align: 'center' });
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(F.x - 0.5, F.y - 0.5, F.w + 1, F.h + 1);

        // source
        const sg = sim.source.sigma, gx = cx(GUN) - 6;
        const live = S.source === 'beam' ? 1 : shot && shot.state === 'fly' ? Math.exp(-((sim.t - shot.tc) ** 2) / (2 * shot.tau ** 2)) : 0;
        const ga = Math.max(F.y + 6, cy(CY - 1.5 * sg)), gb = Math.min(F.y + F.h - 6, cy(CY + 1.5 * sg));
        D.rr(ctx, gx - 4, ga, 6, gb - ga, 3);
        ctx.fillStyle = `rgba(${200 + 55 * live},${205 + 30 * live},${225 - 20 * live},${0.3 + 0.6 * live})`;
        ctx.fill();
        if (live > 0.02) D.glow(ctx, gx, cy(CY), 40 * live + 8, [255, 226, 170], 0.5 * live);
        D.text(ctx, 'electron source', F.x + 8, F.y + F.h - 10, { size: 10.5, color: C.ink3, halo: true });

        // wall and slits
        const wx = cx(WALL), ww = WT * scale, ops = openings();
        const segs = [];
        let from = PAD;
        for (const [a, b] of ops) { segs.push([from, a]); from = b; }
        segs.push([from, NY - PAD]);
        const wg = ctx.createLinearGradient(wx, 0, wx + ww, 0);
        wg.addColorStop(0, '#59627a'); wg.addColorStop(0.5, '#3a4258'); wg.addColorStop(1, '#232a3a');
        ctx.fillStyle = wg;
        for (const [a, b] of segs) ctx.fillRect(wx, cy(a), ww, cy(b) - cy(a));
        ops.forEach(([a, b], i) => {
          const id = 'slit' + i, hot = zones.isHot(id), ym = (cy(a) + cy(b)) / 2;
          if (S.slits === 2) {
            zones.add({
              id, x: wx - 14, y: cy(a) - 8, w: ww + 28, h: cy(b) - cy(a) + 16, cursor: 'ns-resize',
              drag: (p) => {
                const yc = PAD + (p.y - F.y) / scale;
                const d = M.clamp(Math.round(Math.abs(yc - CY) / 2) * 4, 56, 128);
                if (d !== S.d) { S.d = d; sD.value = d; seen.tuned = true; reconfigure(); }
              },
            });
            if (hot) {
              ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
              ctx.strokeRect(wx - 3, cy(a) - 3, ww + 6, cy(b) - cy(a) + 6);
            }
          }
          if (watching()) {
            const col = i === 0 ? [255, 170, 80] : [96, 172, 255];
            sensor[i] = Math.max(0, sensor[i] - dt * 2.2);
            D.glow(ctx, wx + ww + 9, ym, 9 + 22 * sensor[i], col, 0.55 + 0.45 * sensor[i]);
            ctx.beginPath(); ctx.arc(wx + ww + 9, ym, 3.2, 0, M.TAU); ctx.fillStyle = C.css(col); ctx.fill();
          }
        });
        if (S.slits === 2 && (zones.isHot('slit0') || zones.isHot('slit1'))) {
          D.dimension(ctx, wx - 16, cy(CY - S.d / 2), wx - 16, cy(CY + S.d / 2), `d = ${M.fix(S.d * NM, 2)} nm`, { side: 1 });
        }
        D.dimension(ctx, wx + ww, F.y + F.h - 14, cx(SCR), F.y + F.h - 14, `L = ${M.fix((SCR - WALL - WT) * NM, 1)} nm`, { side: -1, color: 'rgba(240,239,236,0.3)' });
        if (watching()) D.text(ctx, 'detector', wx + ww + 20, cy(CY) + 4, { size: 10.5, color: C.ink2, halo: true });

        // screen edge, and the same screen seen face on
        D.line(ctx, cx(SCR), F.y, cx(SCR), F.y + F.h, 'rgba(255,232,196,0.5)', 2);
        D.rr(ctx, P.x, P.y, P.w, P.h, 4);
        ctx.fillStyle = '#090b11'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();
        ctx.drawImage(plate, P.x, P.y, P.w, P.h);
        for (const r of recent) {
          r.age += dt;
          const f = Math.max(0, 1 - r.age / (r.big ? 0.9 : 0.3));
          if (f <= 0) continue;
          const px = P.x + r.x * P.w, py = cy(r.y);
          if (r.big) {
            D.glow(ctx, px, py, 5 + 22 * f, C.hit, f);
            D.glow(ctx, cx(SCR), py, 8 + 36 * f, C.hit, 0.9 * f);
            ctx.beginPath(); ctx.arc(cx(SCR), py, 10 + 50 * (1 - f), 0, M.TAU);
            ctx.strokeStyle = C.css(C.hit, 0.6 * f); ctx.lineWidth = 1.5; ctx.stroke();
          } else D.glow(ctx, px, py, 3 + 6 * f, C.hit, 0.5 * f);
        }

        // histogram and the wave's prediction
        D.text(ctx, 'COUNTS', H.x, F.y - 10, { size: 10, weight: 600, color: C.ink3 });
        let pmax = 0, psum = 0;
        for (let y = PAD; y < NY - PAD; y++) psum += pattern[y];
        const binH = VIEW.h / NB, pred = new Float64Array(NB);
        if (psum > 0) for (let b = 0; b < NB; b++) {
          let s = 0;
          for (let y = Math.floor(PAD + b * binH); y < Math.floor(PAD + (b + 1) * binH); y++) s += pattern[y];
          pred[b] = (total * s) / psum;
          pmax = Math.max(pmax, pred[b]);
        }
        let cmax = 4;
        for (let b = 0; b < NB; b++) cmax = Math.max(cmax, counts[b]);
        const top = Math.max(cmax, pmax) * 1.08, bw = H.w - 8, bh = Math.max(1, (F.h / NB) - 1);
        D.line(ctx, H.x + 0.5, H.y, H.x + 0.5, H.y + H.h, C.axis);
        ctx.fillStyle = C.data;
        for (let b = 0; b < NB; b++) {
          if (!counts[b]) continue;
          const len = (counts[b] / top) * bw, y = H.y + (b * F.h) / NB + 0.5;
          D.rr(ctx, H.x + 1, y, Math.max(1.5, len), bh, Math.min(2, bh / 2));
          ctx.fill();
        }
        if (psum > 0 && total > 0) {
          ctx.beginPath();
          for (let b = 0; b < NB; b++) {
            const x = H.x + 1 + (pred[b] / top) * bw, y = H.y + ((b + 0.5) * F.h) / NB;
            b ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = C.theory; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
        }
        D.text(ctx, '0', H.x + 1, H.y + H.h + 13, { size: 10, color: C.ink3 });
        D.text(ctx, String(Math.round(top)), H.x + bw, H.y + H.h + 13, { size: 10, color: C.ink3, align: 'right' });
        const ly = H.y + H.h + 30;
        ctx.fillStyle = C.data; D.rr(ctx, H.x + 1, ly - 7, 9, 7, 2); ctx.fill();
        D.text(ctx, 'detected', H.x + 14, ly, { size: 10.5, color: C.ink2 });
        D.line(ctx, H.x + 1, ly + 12, H.x + 11, ly + 12, C.theory, 2);
        D.text(ctx, 'wave prediction', H.x + 14, ly + 16, { size: 10.5, color: C.ink2 });
        zones.end();

        stN.set(M.int(total));
        stL.set(M.fix(lam() * NM, 2), 'nm');
        stF.set(S.slits === 2 ? M.fix(((lam() * (SCR - WALL - WT)) / S.d) * NM, 1) : 'one slit', S.slits === 2 ? 'nm' : '');
        stW.set(Number.isFinite(stats.spacing) ? M.fix(stats.spacing * NM, 1) : 'none', Number.isFinite(stats.spacing) ? 'nm' : '');
        stC.set(Number.isFinite(stats.contrast) ? Math.round(100 * stats.contrast) + '%' : 'waiting for the wave', stats.contrast < 0.08 ? 'no stripes' : '');
      };

      let sinceStats = 0, governor = 1, slow = 0;
      const update = (dt) => {
        clock += dt;
        // Ease off the physics rate on graphics cards that cannot keep up.
        slow = slow * 0.95 + (dt > 0.024 ? 0.05 : 0);
        if (slow > 0.6) governor = Math.max(0.35, governor * 0.985);
        else if (slow < 0.1) governor = Math.min(1, governor * 1.01);
        if (!S.playing || !dt) return;
        const steps = M.clamp(Math.round(30 * S.speed * governor * dt * 60), 1, 64);
        const fading = S.source === 'single' && shot && shot.state === 'fade';
        if (fading) {
          sim.step(steps, null, 0.7);
          if (--shot.left <= 0) { sim.clear(); shot.state = 'idle'; shot.idleAt = clock; }
          return;
        }
        if (S.source === 'single' && (!shot || shot.state === 'idle')) {
          if (S.auto && shot && clock - shot.idleAt > 0.25) fire(shot.byUser);
          return;
        }
        sim.step(steps, drive);
        const line = sim.readColumn(SCR);
        let flux = 0;
        for (let y = PAD; y < NY - PAD; y++) {
          const a = Math.max(0, line[y * 4]), b = Math.max(0, line[y * 4 + 1]);
          fluxA[y] = a; fluxB[y] = b; both[y] = a + b; flux += a + b;
        }
        if (S.source === 'single') {
          for (let y = PAD; y < NY - PAD; y++) pattern[y] += both[y] * steps * sim.dt;
          if (watching() && shot.path == null && sim.t >= shot.tPath) {
            shot.path = Math.random() < 0.5 ? 0 : 1;
            vis = shot.path ? [0, 1] : [1, 0];
            sensor[shot.path] = 1;
          }
          if (sim.t >= shot.tDet) {
            const table = M.cdf(watching() ? (shot.path ? fluxB : fluxA) : both, PAD, NY - PAD);
            if (table.total > 1e-10 || sim.t > shot.tGiveUp) {
              if (table.total > 1e-10) { addHit(M.sample(table), 'big'); if (shot.byUser) seen.userShot = true; }
              shot.state = 'fade'; shot.left = 8;
            }
          }
        } else if (flux > 0) {
          for (let y = PAD; y < NY - PAD; y++) pattern[y] = pattern[y] * 0.97 + both[y] * 0.03;
          beam.fmax = Math.max(beam.fmax * 0.9995, flux);
          const n = M.poisson(S.rate * dt * (flux / beam.fmax));
          if (n) { const table = M.cdf(both, PAD, NY - PAD); for (let i = 0; i < n; i++) addHit(M.sample(table), i < 2); }
        }
        sinceStats += dt;
        if (sinceStats > 0.3) { sinceStats = 0; stats = S.slits === 2 || S.slits === 1 ? analyse() : stats; }
      };

      lab.frame((dt) => { update(dt); draw(dt); });
      lab.note('Drag a slit to change the spacing');
      syncControls();
      buildMask();
      layout();
      fire(false);

      return { get state() { return { S, sim, shot, beam, total, counts, pattern, stats, seen, hits }; }, fire, reconfigure };
    },
  });
})();
