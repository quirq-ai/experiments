// Station 7: the hydrogen atom. Exact orbitals sampled as clouds of
// position measurements, and the light the atom gives off when it drops
// from one level to another.
(() => {
  const QL = (globalThis.QL ||= {});
  const M = QL.math;

  // ----------------------------------------------------------------- physics
  // Lengths in Bohr radii, energies in electronvolts.
  const A0 = 0.0529177, RY = 13.6057, LYMAN_LIMIT = 91.127;
  const laguerre = (k, alpha, x) => {
    if (k === 0) return 1;
    let a = 1, b = 1 + alpha - x;
    for (let j = 1; j < k; j++) { const c = ((2 * j + 1 + alpha - x) * b - (j + alpha) * a) / (j + 1); a = b; b = c; }
    return b;
  };
  const radialRaw = (n, l, r) => { const rho = (2 * r) / n; return Math.exp(-rho / 2) * Math.pow(rho, l) * laguerre(n - l - 1, 2 * l + 1, rho); };
  const legendre = (l, m, u) => {
    let pmm = 1;
    if (m > 0) { const s = Math.sqrt(Math.max(0, 1 - u * u)); let f = 1; for (let i = 1; i <= m; i++) { pmm *= -f * s; f += 2; } }
    if (l === m) return pmm;
    let pm1 = u * (2 * m + 1) * pmm;
    if (l === m + 1) return pm1;
    let pl = 0;
    for (let k = m + 2; k <= l; k++) { pl = ((2 * k - 1) * u * pm1 - (k + m - 1) * pmm) / (k - m); pmm = pm1; pm1 = pl; }
    return pl;
  };
  const reach = (n) => 3 * n * n + 12 * n;        // radius beyond which the orbital is negligible
  const NR = 1600;
  const tables = new Map();
  // Normalised radial function on a grid: sum(R^2 r^2) dr = 1.
  const radialTable = (n, l, rmax = reach(n)) => {
    const key = `${n},${l},${rmax}`;
    if (tables.has(key)) return tables.get(key);
    const dr = rmax / NR, R = new Float64Array(NR + 1);
    let s = 0;
    for (let i = 0; i <= NR; i++) { const r = i * dr; R[i] = radialRaw(n, l, r); s += R[i] * R[i] * r * r * dr; }
    const k = 1 / Math.sqrt(s);
    for (let i = 0; i <= NR; i++) R[i] *= k;
    const t = { R, dr, rmax };
    tables.set(key, t);
    return t;
  };
  const energy = (n) => -RY / (n * n);
  const wavelength = (hi, lo) => LYMAN_LIMIT / (1 / (lo * lo) - 1 / (hi * hi));
  // Relative rates of the allowed (electric dipole) decays of the state n, l.
  const decays = (n, l) => {
    const out = [];
    for (let n2 = 1; n2 < n; n2++) for (const l2 of [l - 1, l + 1]) {
      if (l2 < 0 || l2 >= n2) continue;
      const rmax = reach(n), a = radialTable(n, l, rmax), b = radialTable(n2, l2, rmax);
      let I = 0;
      for (let i = 0; i <= NR; i++) { const r = i * a.dr; I += a.R[i] * b.R[i] * r * r * r * a.dr; }
      const dE = 1 / (n2 * n2) - 1 / (n * n);
      out.push({ n: n2, l: l2, rate: dE ** 3 * (Math.max(l, l2) / (2 * l + 1)) * I * I });
    }
    const total = out.reduce((s, d) => s + d.rate, 0);
    for (const d of out) d.share = total ? d.rate / total : 0;
    return out;
  };

  // N position measurements drawn from |psi_nlm|^2. Returns xyz, a phase per
  // point, and the radius of each. `standing` gives the real, chemistry-style
  // combinations instead of the travelling e^(i m phi) ones.
  const sampleOrbital = (n, l, m, N, standing) => {
    const { R, dr } = radialTable(n, l), am = Math.abs(m), NU = 800;
    const wr = new Float64Array(NR + 1), wu = new Float64Array(NU + 1), P = new Float64Array(NU + 1);
    for (let i = 0; i <= NR; i++) { const r = i * dr; wr[i] = R[i] * R[i] * r * r; }
    for (let j = 0; j <= NU; j++) { P[j] = legendre(l, am, -1 + (2 * j) / NU); wu[j] = P[j] * P[j]; }
    const cr = M.cdf(wr), cu = M.cdf(wu);
    const pos = new Float32Array(N * 3), ph = new Float32Array(N), rad = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const fi = M.sample(cr), fj = M.sample(cu);
      const r = fi * dr, u = M.clamp(-1 + (2 * fj) / NU, -1, 1), st = Math.sqrt(1 - u * u);
      let phi = Math.random() * M.TAU, sign = R[Math.min(NR, Math.round(fi))] * P[Math.min(NU, Math.round(fj))] < 0 ? Math.PI : 0;
      if (standing && am > 0) {
        const f = m > 0 ? Math.cos : Math.sin;
        while (Math.random() > f(am * phi) ** 2) phi = Math.random() * M.TAU;
        if (f(am * phi) < 0) sign += Math.PI;
        ph[k] = sign;
      } else ph[k] = m * phi + sign;
      pos[k * 3] = r * st * Math.cos(phi);
      pos[k * 3 + 1] = r * u;
      pos[k * 3 + 2] = r * st * Math.sin(phi);
      rad[k] = r;
    }
    return { pos, ph, rad };
  };

  QL.hydrogen = { A0, RY, radialTable, legendre, laguerre, energy, wavelength, decays, sampleOrbital, reach };
  if (!QL.register) return; // loaded outside the lab, for tests

  const { el, segmented, toggle, button, buttons } = QL.ui;
  const { draw: D, color: C } = QL;
  const LETTER = ['s', 'p', 'd', 'f'];
  const SERIES = ['', 'Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund'];
  const N = 90000;

  const VS = `#version 300 es
in vec3 aFrom;
in vec3 aTo;
in vec2 aPhase;
in float aSeed;
uniform mat3 uRot;
uniform float uMix, uScale, uAspect, uSize, uSlice;
uniform vec2 uCenter;
out float vPhase;
out float vFade;
void main() {
  float m = smoothstep(0.0, 1.0, clamp(uMix * 1.35 - aSeed * 0.35, 0.0, 1.0));
  vec3 p = mix(aFrom, aTo, m);
  vPhase = mix(aPhase.x, aPhase.y, step(0.5, m));
  vec3 q = uRot * p * uScale;
  float persp = 1.0 / (1.0 - 0.28 * q.z);
  gl_Position = vec4(uCenter.x + q.x * persp / uAspect, uCenter.y + q.y * persp, 0.0, 1.0);
  gl_PointSize = uSize * persp * (0.75 + 0.5 * aSeed);
  float cut = uSlice > 0.0 ? 1.0 - smoothstep(uSlice * 0.6, uSlice, abs(q.z)) : 1.0;
  vFade = cut * (0.62 + 0.38 * clamp(q.z + 0.5, 0.0, 1.0));
}`;
  const FS = `#version 300 es
precision highp float;
in float vPhase;
in float vFade;
uniform float uTime, uAlpha;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = exp(-r2 * 13.0) * uAlpha * vFade;
  vec3 col = 0.1 + 0.9 * (0.5 + 0.5 * cos(vPhase - uTime - vec3(0.0, 2.0944, 4.1888)));
  o = vec4(col * a, a);
}`;

  QL.register({
    id: 'atom',
    title: 'The atom',
    short: 'Hydrogen',
    kicker: 'Orbitals and spectra',
    idea: 'Put everything together: a wave, trapped by the pull of a proton, with only certain energies allowed. This is hydrogen, and the same picture underlies all of chemistry.',

    create(lab) {
      const G = lab.layer('webgl2', { antialias: true });
      const L = lab.layer('2d');
      const gl = G.gl;
      if (!gl) { lab.fallback('This station draws the atom with WebGL2, which this browser does not provide.'); return {}; }
      const zones = new QL.Zones(L.canvas);
      lab.onDestroy(() => zones.destroy());

      const S = { n: 1, l: 0, m: 0, standing: false, slice: false, auto: true, playing: true };
      const view = { yaw: 0.6, pitch: 0.28, scale: 0.17, drag: false, idle: 0 };
      let shown = 0, target = 5000, mix = 1, clock = 0, rad = new Float32Array(N), fallAt = 0;
      const photons = [], arrows = [], lines = new Map();
      const seen = { orbitals: new Set(), slice: false, emitted: 0, last: null };

      // ----------------------------------------------------------------- GL
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const U = {};
      for (const name of ['uRot', 'uMix', 'uScale', 'uAspect', 'uSize', 'uSlice', 'uCenter', 'uTime', 'uAlpha']) U[name] = gl.getUniformLocation(prog, name);
      const STRIDE = 9, data = new Float32Array(N * STRIDE);
      for (let k = 0; k < N; k++) data[k * STRIDE + 8] = Math.random();
      const vao = gl.createVertexArray(), vbo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const attr = (name, size, offset) => { const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4); };
      attr('aFrom', 3, 0); attr('aTo', 3, 3); attr('aPhase', 2, 6); attr('aSeed', 1, 8);

      const fit = () => 0.9 / (2.6 * S.n * S.n + 2.4 * S.n);
      // Load a new orbital: wherever each dot is now becomes its starting point.
      const load = (instant) => {
        const s = sampleOrbital(S.n, S.l, S.m, N, S.standing);
        for (let k = 0; k < N; k++) {
          const o = k * STRIDE, t = M.clamp(mix * 1.35 - data[o + 8] * 0.35, 0, 1), m = t * t * (3 - 2 * t);
          for (let c = 0; c < 3; c++) { data[o + c] = instant ? s.pos[k * 3 + c] : data[o + c] + (data[o + 3 + c] - data[o + c]) * m; data[o + 3 + c] = s.pos[k * 3 + c]; }
          data[o + 6] = instant ? s.ph[k] : data[o + 7];
          data[o + 7] = s.ph[k];
        }
        rad = s.rad;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
        mix = instant ? 1 : 0;
        seen.orbitals.add(`${S.n}${S.l}${Math.abs(S.m)}`);
        refreshRadial();
        paintChips();
      };
      const setOrbital = (n, l, m, instant) => {
        S.n = n; S.l = Math.min(l, n - 1, 3); S.m = M.clamp(m, -S.l, S.l);
        fallAt = 0;
        load(instant);
      };

      // ----------------------------------------------------------- emission
      const fall = () => {
        const options = decays(S.n, S.l);
        if (!options.length) {
          lab.toast(S.n === 1 ? 'Already in the ground state: nowhere lower to go' : `${S.n}${LETTER[S.l]} is metastable: no allowed jump (l must change by one)`);
          return false;
        }
        let u = Math.random(), pick = options[options.length - 1];
        for (const o of options) { if (u < o.share) { pick = o; break; } u -= o.share; }
        const nm = wavelength(S.n, pick.n), key = `${S.n}-${pick.n}`, ang = Math.random() * M.TAU;
        photons.push({ nm, ang, age: 0, from: S.n, to: pick.n });
        arrows.push({ from: S.n, to: pick.n, nm, age: 0 });
        const e = lines.get(key) || { nm, from: S.n, to: pick.n, count: 0 };
        e.count++; e.age = 0;
        lines.set(key, e);
        seen.emitted++; seen.last = e;
        setOrbital(pick.n, pick.l, M.clamp(S.m, -pick.l, pick.l));
        fallAt = clock + 1.5;
        return true;
      };
      const excite = (n) => {
        const ls = [];
        for (let l = 0; l < Math.min(n, 4); l++) for (let k = 0; k < 2 * l + 1; k++) ls.push(l);
        const l = ls[(Math.random() * ls.length) | 0];
        setOrbital(n, l, 0);
        fallAt = clock + 1.7;
      };

      // ------------------------------------------------------------ controls
      const nRow = el('div', { class: 'chips' }), lRow = el('div', { class: 'chips' }), mRow = el('div', { class: 'chips' });
      const chip = (label, on, fn, disabled) => { const b = el('button', { class: `chip ${on ? 'on' : ''}`, type: 'button', text: label, onclick: fn }); if (disabled) b.disabled = true; return b; };
      const paintChips = () => {
        nRow.replaceChildren(...[1, 2, 3, 4, 5, 6].map((n) => chip(String(n), n === S.n, () => setOrbital(n, S.l, S.m))));
        lRow.replaceChildren(...[0, 1, 2, 3].map((l) => chip(`${LETTER[l]}  (l = ${l})`, l === S.l, () => setOrbital(S.n, l, S.m), l >= S.n)));
        const ms = [];
        for (let m = -S.l; m <= S.l; m++) ms.push(chip((m > 0 ? '+' : '') + m, m === S.m, () => setOrbital(S.n, S.l, m)));
        mRow.replaceChildren(...ms);
      };
      const group = (label, row, hint) => el('div', { class: 'ctl' }, el('div', { class: 'row' }, el('span', { class: 'lab', text: label })), row, hint ? el('div', { class: 'hint', text: hint }) : null);
      lab.control(
        group('Energy level n', nRow),
        group('Shape l', lRow),
        group('Orientation m', mRow),
        toggle({ label: 'Standing-wave form, as drawn in chemistry', value: S.standing, onChange: (v) => { S.standing = v; load(); }, hint: 'Off: the phase circulates around the axis. On: fixed lobes such as p-x and d-xy.' }),
        toggle({ label: 'Cut the cloud open', value: S.slice, onChange: (v) => { S.slice = v; if (v) seen.slice = true; }, hint: 'Shows only a thin slice through the middle, so inner shells are visible.' }),
        el('div', { class: 'ctl' }, el('div', { class: 'row' }, el('span', { class: 'lab', text: 'Detect the electron' }))),
        buttons(button({ label: '+ 1', onClick: () => { target = Math.min(N, Math.max(target, shown) + 1); } }), button({ label: '+ 100', onClick: () => { target = Math.min(N, Math.max(target, shown) + 100); } }),
          button({ label: '+ 30,000', kind: 'primary', onClick: () => { target = Math.min(N, Math.max(target, shown) + 30000); } }), button({ label: 'Clear', onClick: () => { target = shown = 0; refreshRadial(); } })),
        buttons(button({ label: 'Let it fall', icon: 'bolt', onClick: fall, kbd: 'F' })),
        toggle({ label: 'Fall by itself after being excited', value: S.auto, onChange: (v) => { S.auto = v; } }));
      lab.keys.f = fall;

      const stE = lab.stat({ label: 'Energy' });
      const stR = lab.stat({ label: 'Most likely distance', tip: 'Peak of the radial chart below the bench.' });
      const stL = lab.stat({ label: 'Angular momentum', tip: 'Total size, and the part along the vertical axis.' });
      const stN = lab.stat({ label: 'Detections shown' });

      lab.physics(`
        <p>The electron is held by the proton's 1/r attraction. Solving the Schrödinger equation for that well gives the allowed energies</p>
        <div class="eq">E<sub>n</sub> = &minus;13.6 eV / n<sup>2</sup></div>
        <p>and a family of wave shapes labelled by three whole numbers: n sets the energy and size, l the number of angular nodes, m how the phase winds around the axis.
        Each dot on the bench is one position measurement on a fresh atom, drawn from the exact |&psi;|&sup2;.</p>
        <p>Falling from level n to a lower level n&prime; releases a photon carrying the difference, so hydrogen can only emit the wavelengths</p>
        <div class="eq">1 / &lambda; = R (1 / n&prime;<sup>2</sup> &minus; 1 / n<sup>2</sup>)</div>
        <p>Which jumps happen, and how often, follows from the overlap of the two wave shapes: l must change by exactly one.</p>`);

      // ---------------------------------------------------------------- dock
      const radial = lab.plot({ title: 'Distance from the nucleus', sub: 'how often the electron is found at each radius' }, {
        height: 132,
        aria: 'Radial probability distribution',
        x: { min: 0, max: 1, label: 'distance from the proton (nm)', name: 'Distance', tipFmt: (v) => M.fix(v, 3) + ' nm' },
        y: { min: 0, max: 1, ticks: [0], fmt: () => '' },
        series: [
          { id: 'hist', label: 'Your detections', type: 'bars', color: C.data, width: 1, gap: 1 },
          { id: 'theory', label: 'Quantum theory', type: 'line', color: C.theory },
        ],
      });
      let peakR = 1;
      const refreshRadial = () => {
        const { R, dr, rmax } = radialTable(S.n, S.l), lim = rmax * 0.62;
        const pts = [];
        let top = 0, at = 0;
        for (let i = 0; i <= NR; i += 4) { const r = i * dr; if (r > lim) break; const p = R[i] * R[i] * r * r; pts.push([r * A0, p]); if (p > top) { top = p; at = r; } }
        peakR = at;
        const bins = 44, bw = lim / bins, h = new Float64Array(bins);
        for (let k = 0; k < shown; k++) { const b = Math.floor(rad[k] / bw); if (b < bins) h[b]++; }
        const hist = [];
        if (shown > 20) for (let b = 0; b < bins; b++) hist.push([(b + 0.5) * bw * A0, h[b] / (shown * bw)]);
        radial.series[0].width = bw * A0;
        radial.setX(0, lim * A0); radial.setY(0, top * 1.25);
        radial.set('theory', pts); radial.set('hist', hist);
        radial.marker('peak', { x: at * A0, label: `${M.fix(at * A0, 3)} nm` });
        radial.draw();
      };

      const scard = lab.card({ title: 'Light given off', sub: 'every photon lands on its own line' });
      const spec = el('canvas', { style: { width: '100%', height: '112px', display: 'block' }, role: 'img', 'aria-label': 'Emission spectrum of hydrogen' });
      const specNote = el('div', { class: 'sub', style: { marginTop: '2px', whiteSpace: 'normal' }, text: 'No photons yet. Click a level on the ladder to excite the atom.' });
      scard.body.append(spec, specNote);
      const sfit = QL.ui.fitCanvas(spec, 112), sctx = sfit.ctx;
      const drawSpectrum = (dt) => {
        if (!sfit.fit()) return;
        const sw = sfit.w;
        const ctx = sctx, l = 6, r = sw - 6, y0 = 22, y1 = 78, lo = Math.log(85), hi = Math.log(2400);
        const X = (nm) => l + ((Math.log(nm) - lo) / (hi - lo)) * (r - l);
        ctx.clearRect(0, 0, sw, 112);
        D.rr(ctx, l, y0, r - l, y1 - y0, 5); ctx.fillStyle = '#07090d'; ctx.fill();
        for (let x = Math.ceil(X(380)); x < X(750); x++) {
          const nm = Math.exp(lo + ((x - l) / (r - l)) * (hi - lo));
          ctx.fillStyle = C.css(C.light(nm), 0.2); ctx.fillRect(x, y0, 1.2, y1 - y0);
        }
        for (const [name, a, b] of [['ultraviolet', 85, 380], ['visible', 380, 750], ['infrared', 750, 2400]]) D.text(ctx, name, (X(a) + X(b)) / 2, 14, { size: 10, align: 'center', color: C.ink3 });
        for (const nm of [100, 200, 400, 700, 1000, 2000]) { D.line(ctx, X(nm), y1, X(nm), y1 + 4, C.axis); D.text(ctx, String(nm), X(nm), y1 + 15, { size: 10, align: 'center', color: C.ink3 }); }
        D.text(ctx, 'wavelength (nm)', r, 108, { size: 10, align: 'right', color: C.ink3 });
        for (const e of lines.values()) {
          e.age += dt;
          const x = X(e.nm), col = C.light(e.nm), f = Math.max(0, 1 - e.age / 1.2);
          D.glow(ctx, x, (y0 + y1) / 2, 14 + 30 * f, col, 0.45 + 0.5 * f);
          D.line(ctx, x, y0 + 1, x, y1 - 1, C.css(col.map((c) => Math.min(255, c + 60))), 2);
        }
        if (seen.last) {
          const e = seen.last, vis = e.nm >= 380 && e.nm <= 750;
          const txt = `Last photon: ${M.fix(e.nm, 1)} nm, ${vis ? 'visible' : e.nm < 380 ? 'ultraviolet' : 'infrared'}, from the jump ${e.from} to ${e.to} (${SERIES[e.to] || ''} series). ${lines.size} line${lines.size === 1 ? '' : 's'} found.`;
          if (specNote.textContent !== txt) specNote.textContent = txt;
        }
      };

      // -------------------------------------------------------------- guide
      const balmer = () => [3, 4, 5, 6].filter((n) => lines.has(`${n}-2`)).length;
      lab.guide([
        {
          id: 'cloud', title: 'Where is the electron?',
          body: 'This is hydrogen in its lowest state. Each dot is one detection of the electron, on a fresh atom each time. Press <b>+ 30,000</b> to make many more.',
          check: () => shown >= 30000,
          progress: () => `${M.int(Math.min(30000, shown))} / 30,000 detections`,
          show: () => { setOrbital(1, 0, 0); target = 36000; },
          insight: 'There is no orbit. The electron is found here, then there, with no path in between, and the detections build a <b>cloud</b>: the |&psi;|&sup2; of the ground state. It is densest at the centre, but the chart below shows where the electron is most often found: one Bohr radius out, 0.053 nm. Your orange counts match the blue prediction.',
        },
        {
          id: 'shapes', title: 'Change the shape',
          body: 'Look at some higher states: try <b>n = 2 with p</b>, <b>n = 3 with d</b>, and different values of m. Drag the cloud to turn it.',
          check: () => seen.orbitals.size >= 4 && [...seen.orbitals].some((k) => k[1] === '1') && [...seen.orbitals].some((k) => k[1] === '2'),
          progress: () => `${Math.min(4, seen.orbitals.size)} / 4 orbitals seen`,
          show: () => { seen.orbitals.add('210').add('211'); setOrbital(3, 2, 0); target = Math.max(target, 40000); },
          insight: 'The number l counts the nodal surfaces that pass through the nucleus: one for p, which splits the cloud into two lobes, and two for d. Colors on opposite sides of a node are opposite: the wave changes sign there. For m other than zero the color <b>winds around the axis</b>. Nothing is orbiting, yet that winding phase is the electron’s angular momentum, in whole units of &#295;.',
        },
        {
          id: 'slice', title: 'Look inside',
          body: 'Choose <b>n = 2</b> or <b>3</b> with the round <b>s</b> shape, then switch on <b>Cut the cloud open</b>.',
          check: () => S.slice && S.l === 0 && S.n >= 2,
          show: () => { setOrbital(3, 0, 0); S.slice = true; seen.slice = true; target = Math.max(target, 60000); },
          insight: 'Hidden inside the ball are empty shells: radii where the electron is <b>never</b> found, although it turns up on both sides of them. These are the nodes of a standing wave in three dimensions, the same idea as the nodes of the waves in the box. A state has n &minus; 1 nodes in all, shared between spheres and the surfaces counted by l.',
        },
        {
          id: 'photon', title: 'Make it glow',
          body: 'Click <b>level 3</b> on the energy ladder at the left to excite the atom, and watch it fall back.',
          check: () => seen.emitted >= 1,
          show: () => { excite(3); },
          insight: 'The atom cannot shed energy gradually. It drops from one allowed level to another and the difference leaves as a single <b>photon</b>, whose color is set by that difference: E = hf. The cloud you watched collapse inward is the electron’s wave changing shape. Dropping from level 3 to level 2 gives red light at 656 nm.',
        },
        {
          id: 'balmer', title: 'Collect the visible lines',
          body: 'Only jumps that end on <b>level 2</b> give visible light. Excite the atom to levels 3, 4, 5 and 6 (several tries each) until you have all <b>four visible lines</b>.',
          check: () => balmer() >= 4,
          progress: () => `${balmer()} / 4 visible lines`,
          show: () => { for (const n of [3, 4, 5, 6]) { const nm = wavelength(n, 2); if (!lines.has(`${n}-2`)) lines.set(`${n}-2`, { nm, from: n, to: 2, count: 1, age: 0 }); } seen.last = lines.get('3-2'); },
          insight: 'Red, blue-green and two violets: the Balmer series. No other element has this barcode, so finding it in starlight means finding hydrogen. That is how we know what the Sun is made of, and the shift of these same lines toward the red in distant galaxies is how we know the universe is expanding. Bohr&rsquo;s explanation of these four numbers, in 1913, was the first quantum theory of the atom.',
        },
      ]);

      // ------------------------------------------------------------ drawing
      const rot = () => {
        const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
        // column-major mat3 for Rx(pitch) * Ry(yaw)
        return [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
      };
      const ladder = () => {
        const { h } = L, top = 70, bottom = h - 120, x0 = 26, x1 = 118;
        return { top, bottom, x0, x1, y: (n) => bottom - (1 - 1 / n) * (bottom - top) };
      };
      let dragStart = null;

      const draw = (dt) => {
        const { ctx, w, h } = L;
        const dpr = G.dpr, centerX = Math.min(0.12, 70 / w);
        // cloud
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0.0235, 0.0275, 0.043, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(prog);
        gl.bindVertexArray(vao);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        const R = rot(), count = Math.floor(shown);
        gl.uniformMatrix3fv(U.uRot, false, R);
        gl.uniform1f(U.uMix, mix);
        gl.uniform1f(U.uScale, view.scale);
        gl.uniform1f(U.uAspect, w / h);
        gl.uniform1f(U.uSize, (count < 400 ? 9 : count < 5000 ? 6 : 4.2) * dpr);
        gl.uniform1f(U.uSlice, S.slice ? 0.06 : 0);
        gl.uniform2f(U.uCenter, centerX * 2, 0.06);
        gl.uniform1f(U.uTime, clock * (0.5 + 2.2 / (S.n * S.n)));
        gl.uniform1f(U.uAlpha, M.clamp(0.62 * Math.sqrt(2500 / Math.max(count, 1)) * (S.slice ? 2.4 : 1), 0.075, 0.95));
        if (count > 0) gl.drawArrays(gl.POINTS, 0, count);
        gl.disable(gl.BLEND);

        ctx.clearRect(0, 0, w, h);
        zones.begin();
        const ox = w / 2 + centerX * w, oy = h / 2 - 0.03 * h;
        // rotate by dragging anywhere on the cloud
        zones.add({
          id: 'orbit', x: 150, y: 40, w: w - 170, h: h - 120, cursor: 'grab',
          down: () => { dragStart = { yaw: view.yaw, pitch: view.pitch }; },
          drag: (p) => { view.yaw = dragStart.yaw + p.dx * 0.008; view.pitch = M.clamp(dragStart.pitch + p.dy * 0.008, -1.45, 1.45); view.idle = 0; },
        });
        // nucleus and quantisation axis
        const axis = (v) => { const q = [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]].map((c) => c * view.scale); const p = 1 / (1 - 0.28 * q[2]); return [ox + (q[0] * p * h) / 2, oy - (q[1] * p * h) / 2]; };
        const span = 0.82 / view.scale, a = axis([0, -span, 0]), b = axis([0, span, 0]);
        D.line(ctx, a[0], a[1], b[0], b[1], 'rgba(240,239,236,0.13)', 1, [2, 5]);
        D.glow(ctx, ox, oy, 7, [255, 255, 255], 0.9);
        // scale bar
        const pxPerNm = (view.scale * h) / 2 / A0;
        const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5].find((v) => v * pxPerNm > 56) || 5;
        D.dimension(ctx, w - 40 - nice * pxPerNm, h - 84, w - 40, h - 84, `${nice} nm`, { side: -1 });
        D.text(ctx, `${S.n}${LETTER[S.l]}`, ox, 82, { size: 30, weight: 500, family: 'serif', align: 'center', color: C.ink });
        D.text(ctx, `n = ${S.n}, l = ${S.l}, m = ${S.m}`, ox, 102, { size: 11, align: 'center', color: C.ink3, family: 'mono' });

        // energy ladder
        const g = ladder();
        D.text(ctx, 'ENERGY LEVELS', g.x0, g.top - 26, { size: 10, weight: 600, color: C.ink3 });
        D.text(ctx, 'click one to excite', g.x0, g.top - 13, { size: 10, color: C.ink4 });
        D.line(ctx, g.x0, g.top - 2, g.x1, g.top - 2, 'rgba(240,239,236,0.18)', 1, [2, 3]);
        D.text(ctx, 'free: 0 eV', g.x1 + 8, g.top - 2, { size: 9.5, base: 'middle', color: C.ink4, family: 'mono' });
        for (let n = 1; n <= 6; n++) {
          const y = Math.round(g.y(n)) + 0.5, id = 'lvl' + n, hot = zones.isHot(id), on = n === S.n;
          D.line(ctx, g.x0, y, g.x1, y, on ? C.ink : hot ? 'rgba(240,239,236,0.8)' : 'rgba(240,239,236,0.32)', on ? 2 : 1.25);
          D.text(ctx, String(n), g.x0 - 8, y, { size: 10.5, align: 'right', base: 'middle', color: on || hot ? C.ink : C.ink3, family: 'mono', weight: on ? 600 : 400 });
          if (n <= 4 || on || hot) D.text(ctx, M.fix(energy(n), n < 3 ? 1 : 2) + ' eV', g.x1 + 8, y, { size: 9.5, base: 'middle', color: on || hot ? C.ink2 : C.ink4, family: 'mono' });
          zones.add({ id, x: g.x0 - 16, y: y - (n > 4 ? 4 : 8), w: g.x1 - g.x0 + 70, h: n > 4 ? 8 : 16, cursor: 'pointer', click: () => excite(n) });
        }
        const ey = g.y(S.n);
        D.glow(ctx, (g.x0 + g.x1) / 2, ey, 14, C.hit, 0.9);
        ctx.beginPath(); ctx.arc((g.x0 + g.x1) / 2, ey, 3.5, 0, M.TAU); ctx.fillStyle = '#fff'; ctx.fill();
        for (const ar of arrows) {
          ar.age += dt;
          const f = Math.max(0, 1 - ar.age / 3), x = g.x0 + 18 + ((ar.from * 13 + ar.to * 7) % 60);
          if (f > 0) D.arrow(ctx, x, g.y(ar.from) + 2, x, g.y(ar.to) - 3, C.css(C.light(ar.nm), f), 1.6, 6);
        }
        while (arrows.length && arrows[0].age > 3) arrows.shift();

        // photons leaving the atom
        for (const p of photons) {
          p.age += dt;
          const t = p.age / 1.5, dist = 30 + t * Math.max(w, h) * 0.6, col = C.light(p.nm);
          const cxp = ox + Math.cos(p.ang) * dist, cyp = oy + Math.sin(p.ang) * dist, nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
          const wl = M.clamp(p.nm / 40, 5, 26);
          ctx.beginPath();
          for (let s = -34; s <= 34; s += 2) {
            const env = Math.exp(-(s * s) / 320), off = Math.sin((s / wl) * M.TAU - p.age * 14) * 7 * env;
            const x = cxp + Math.cos(p.ang) * s + nx * off, y = cyp + Math.sin(p.ang) * s + ny * off;
            s === -34 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = C.css(col.map((c) => Math.min(255, c + 50)), Math.min(1, 2.4 * (1 - t)));
          ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
          D.glow(ctx, cxp, cyp, 22, col, 0.5 * (1 - t));
          if (t < 0.75) D.text(ctx, `${M.fix(p.nm, 0)} nm`, cxp + nx * 20, cyp + ny * 20, { size: 10.5, align: 'center', color: C.ink2, halo: true });
        }
        while (photons.length && photons[0].age > 1.5) photons.shift();
        zones.end();

        drawSpectrum(dt);
        stE.set(M.fix(energy(S.n), 2), 'eV');
        stR.set(M.fix(peakR * A0, 3), 'nm');
        stL.set(`${M.fix(Math.sqrt(S.l * (S.l + 1)), 2)} ħ`, `along axis ${S.m} ħ`);
        stN.set(M.int(count));
      };

      let lastShown = -1;
      lab.frame((dt) => {
        if (S.playing) {
          clock += dt;
          mix = Math.min(1, mix + dt / 1.25);
          if (shown < target) shown = Math.min(target, shown + Math.max(1, (target - shown) * Math.min(1, dt * 3.2)));
          if (Math.abs(Math.floor(shown) - lastShown) > Math.max(20, lastShown * 0.04) || (shown === target && lastShown !== Math.floor(shown))) { lastShown = Math.floor(shown); refreshRadial(); }
          view.idle += dt;
          if (view.idle > 1.2 && !zones.isActive('orbit')) view.yaw += dt * 0.14;
          view.scale += (fit() - view.scale) * Math.min(1, dt * 3);
          if (S.auto && S.n > 1 && clock > fallAt && mix >= 1 && fallAt > 0) { if (!fall()) fallAt = 0; }
        }
        draw(dt);
      });

      const tp = lab.transport({ playing: true, onToggle: (p) => { S.playing = p; } });
      void tp;
      lab.note('Drag to turn the atom');
      view.scale = fit();
      setOrbital(1, 0, 0, true);
      seen.orbitals.clear();
      return { get state() { return { S, shown, lines, seen, view }; }, setOrbital, excite, fall, more: (n) => { target = Math.min(N, target + n); } };
    },
  });
})();
