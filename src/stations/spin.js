// Station 5: spin and measurement. Stern-Gerlach analyzers in a row. Each
// one asks an atom a yes or no question about its spin along some axis, and
// the answer it gets depends on which questions were asked before.
(() => {
  const QL = globalThis.QL;
  const { el, slider, segmented, toggle, button, buttons } = QL.ui;
  const { math: M, draw: D, color: C } = QL;

  const RAD = Math.PI / 180;
  const axisName = (a) => { a = ((a % 360) + 360) % 360; return a === 0 ? 'Z' : a === 90 ? 'X' : a === 180 ? '-Z' : a === 270 ? '-X' : a + '°'; };
  const fold = (a) => { a = ((a % 360) + 360) % 360; return a > 180 ? 360 - a : a; };

  QL.register({
    id: 'spin',
    title: 'Asking a yes or no question',
    short: 'Spin',
    kicker: 'Measurement and spin',
    idea: 'An atom sent through an uneven magnetic field goes up or down, never in between. Line up several such analyzers and you can watch a measurement erase what an earlier one found.',

    create(lab) {
      const S = {
        n: 1, rate: 14, stream: true, speed: 1, playing: true, classical: false,
        an: [{ angle: 0, out: 'up' }, { angle: 0, out: 'up' }, { angle: 0, out: 'up' }],
      };
      const atoms = [], sparks = [];
      const count = { sent: 0, up: 0, down: 0, blocked: [0, 0, 0] };
      const sweep = new Map();     // relative angle -> { up, n }, for the chart
      const seen = { firstRun: 0 };
      let emitAcc = 0, flashUp = 0, flashDown = 0;

      const L = lab.layer('2d');
      const zones = new QL.Zones(L.canvas);
      lab.onDestroy(() => zones.destroy());

      // -------------------------------------------------------- the physics
      // Spin state entering analyzer i, given the filters before it: an angle,
      // or null for an unpolarized beam straight from the oven.
      const incoming = (i) => {
        for (let k = i - 1; k >= 0; k--) {
          if (S.an[k].out === 'both') continue;
          return S.an[k].angle + (S.an[k].out === 'down' ? 180 : 0);
        }
        return null;
      };
      const pUp = (dir, angle) => (dir == null ? 0.5 : Math.cos(((angle - dir) * RAD) / 2) ** 2);
      const expected = () => pUp(incoming(S.n - 1), S.an[S.n - 1].angle);
      // One atom meets analyzer i. Returns what happens to it.
      const meet = (dir, i) => {
        const a = S.an[i], last = i === S.n - 1;
        if (!last && a.out === 'both') return { branch: 0, fate: 'pass', dir };
        const up = Math.random() < pUp(dir, a.angle);
        const out = { branch: up ? 1 : -1, dir: a.angle + (up ? 0 : 180), dirIn: dir };
        out.fate = last ? 'detect' : (a.out === 'up') === up ? 'pass' : 'block';
        return out;
      };
      const record = (r) => {
        r.branch > 0 ? count.up++ : count.down++;
        if (S.n >= 2 && r.dirIn != null) {
          const key = Math.round(fold(S.an[S.n - 1].angle - r.dirIn) / 5) * 5;
          const e = sweep.get(key) || { up: 0, n: 0 };
          e.n++; if (r.branch > 0) e.up++;
          sweep.set(key, e);
        }
      };
      const runFast = (n) => {
        for (let k = 0; k < n; k++) {
          let dir = null;
          count.sent++;
          for (let i = 0; i < S.n; i++) {
            const r = meet(dir, i);
            if (r.fate === 'block') { count.blocked[i]++; break; }
            if (r.fate === 'detect') { record(r); break; }
            dir = r.dir;
          }
        }
        refreshChart();
      };
      const reset = (keepSweep) => {
        atoms.length = 0; sparks.length = 0;
        count.sent = count.up = count.down = 0; count.blocked.fill(0);
        if (!keepSweep) sweep.clear();
        refreshChart();
      };

      // ------------------------------------------------------------ controls
      const nSeg = segmented({
        label: 'Analyzers in the chain', options: [1, 2, 3].map((v) => ({ value: v, label: String(v) })), value: S.n,
        onChange: (v) => { S.n = v; reset(); paintRows(); },
      });
      const rows = el('div');
      const paintRows = () => {
        rows.replaceChildren(...S.an.slice(0, S.n).map((a, i) => {
          const ang = slider({
            label: `Analyzer ${i + 1} axis`, min: 0, max: 355, step: 5, value: a.angle, fmt: (v) => axisName(v) + (v % 90 ? '' : ` (${v}°)`),
            onInput: (v) => { a.angle = v; reset(true); },
          });
          const kids = [ang.el];
          if (i < S.n - 1) {
            kids.push(segmented({
              label: 'Which beam goes on',
              options: [{ value: 'up', label: 'Up only' }, { value: 'down', label: 'Down only' }, { value: 'both', label: 'Both, rejoined' }],
              value: a.out, onChange: (v) => { a.out = v; reset(); },
            }).el);
          }
          a.ui = ang;
          return el('div', { style: { marginBottom: '14px', paddingBottom: i < S.n - 1 ? '4px' : '0', borderBottom: i < S.n - 1 ? '1px solid var(--line)' : '0' } }, kids);
        }));
      };
      const streamT = toggle({ label: 'Stream of atoms', value: S.stream, onChange: (v) => { S.stream = v; } });
      lab.control(nSeg, rows, streamT,
        slider({ label: 'Atoms per second', min: 2, max: 80, step: 1, log: true, value: S.rate, fmt: (v) => M.int(v), onInput: (v) => { S.rate = v; } }),
        buttons(button({ label: 'Send one', icon: 'bolt', onClick: () => emit(), kbd: 'F' }), button({ label: 'Send 1,000', kind: 'primary', onClick: () => runFast(1000) })),
        toggle({ label: 'Show the classical expectation', value: false, onChange: (v) => { S.classical = v; }, hint: 'Tiny bar magnets pointing every which way would smear out between the two spots.' }),
        buttons(button({ label: 'Reset counts', icon: 'trash', onClick: () => reset() })));
      lab.keys.f = () => emit();

      const stU = lab.stat({ label: 'Up at the last analyzer', swatch: C.data });
      const stE = lab.stat({ label: 'Predicted', swatch: C.theory });
      const stS = lab.stat({ label: 'Atoms sent' });
      const stD = lab.stat({ label: 'Reached the end' });

      lab.physics(`
        <p>A spin-&frac12; particle has only two possible answers along any axis you choose to measure: up or down. If it is known to be up along one axis,
        the chance of finding it up along another axis tilted by &theta; is</p>
        <div class="eq">P(up) = cos<sup>2</sup>(&theta; / 2)</div>
        <p>So "up along Z" is an equal blend of "up along X" and "down along X". A measurement along X picks one, and the atom then really is in that state:
        the old Z answer is gone. If both X beams are rejoined without anything recording which one the atom took, the blend survives and so does the Z answer.</p>`);

      // ---------------------------------------------------------------- dock
      const chart = lab.plot({ title: 'Chance of "up" against the tilt', sub: 'needs two or more analyzers' }, {
        height: 132,
        aria: 'Probability of spin up against the angle between analyzers',
        x: { min: 0, max: 180, ticks: [0, 45, 90, 135, 180], label: 'tilt of the last analyzer away from the incoming spin (degrees)', name: 'Tilt', tipFmt: (v) => Math.round(v) + '°' },
        y: { min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v) => Math.round(v * 100) + '%', tipFmt: (v) => M.fix(v * 100, 1) + '%' },
        series: [
          { id: 'theory', label: 'Quantum theory', type: 'line', color: C.theory, fill: true },
          { id: 'data', label: 'Your atoms', type: 'dots', color: C.data },
        ],
      });
      const theory = [];
      for (let a = 0; a <= 180; a += 2) theory.push([a, Math.cos((a * RAD) / 2) ** 2]);
      const refreshChart = () => {
        chart.set('theory', theory);
        chart.set('data', [...sweep].filter(([, e]) => e.n >= 20).map(([a, e]) => { const f = e.up / e.n; return [a, f, Math.sqrt((f * (1 - f)) / e.n)]; }));
        const inc = incoming(S.n - 1);
        chart.marker('now', S.n >= 2 && inc != null ? { x: fold(S.an[S.n - 1].angle - inc), label: 'now' } : null);
        chart.draw();
      };

      const tp = lab.transport({ playing: true, speeds: [0.5, 1, 3], speed: 1, onToggle: (p) => { S.playing = p; }, onReset: () => reset(), onSpeed: (v) => { S.speed = v; } });

      // -------------------------------------------------------------- guide
      const chain = (n, list) => { S.n = n; list.forEach((a, i) => Object.assign(S.an[i], a)); nSeg.value = n; paintRows(); reset(); };
      const ended = () => count.up + count.down;
      const upShare = () => (ended() ? count.up / ended() : 0);
      lab.guide([
        {
          id: 'two', title: 'Up or down, nothing between',
          body: 'One analyzer, set along <b>Z</b>. Atoms leave the oven with their spins pointing in random directions. Let at least 40 through.',
          predict: { q: 'Each atom is a tiny magnet pointing in a random direction. In the uneven field the beam should:', options: ['Fan out into a continuous smear', 'Split into exactly two beams', 'Pass straight through as one beam'], answer: 1 },
          check: () => S.n === 1 && ended() >= 40,
          progress: () => `${Math.min(40, ended())} / 40 atoms`,
          show: () => { chain(1, [{ angle: 0 }]); S.stream = true; streamT.value = true; },
          insight: 'Classical magnets pointing every which way would be deflected by every amount in between, leaving a smear. Stern and Gerlach found <b>two spots</b> in 1922, and so did you. Ask an atom how much of its spin lies along an axis and there are only two possible answers. Which one a given atom gives is pure chance.',
        },
        {
          id: 'repeat', title: 'Ask the same question twice',
          body: 'Add a <b>second analyzer</b>, also along Z, fed by the up beam of the first. Send at least 40 atoms to the end.',
          check: () => S.n === 2 && S.an[0].out !== 'both' && fold(S.an[1].angle - incoming(1)) === 0 && ended() >= 40,
          progress: () => `${Math.min(40, ended())} / 40 atoms at the end`,
          show: () => { chain(2, [{ angle: 0, out: 'up' }, { angle: 0 }]); runFast(120); },
          insight: 'Every atom that came out "up" the first time came out "up" again. The first answer was random, but once given it <b>sticks</b>: the measurement left the atom in a definite state, up along Z. A measurement does not just report. It prepares.',
        },
        {
          id: 'cross', title: 'Now ask a different question',
          body: 'Turn the second analyzer to <b>X</b> (90 degrees). Drag its dial on the bench or use the slider, then send a hundred atoms or so.',
          predict: { q: 'These atoms are all definitely "up along Z". Measured along X instead, they will come out:', options: ['All up', 'All down', 'Half up and half down, at random'], answer: 2 },
          check: () => S.n === 2 && S.an[0].out !== 'both' && fold(S.an[1].angle - incoming(1)) === 90 && ended() >= 100,
          progress: () => `${Math.min(100, ended())} / 100 atoms at the end`,
          show: () => { chain(2, [{ angle: 0, out: 'up' }, { angle: 90 }]); runFast(400); },
          insight: 'Half and half. Being certain about Z means being completely undecided about X. The two questions are <b>incompatible</b>, in the same way as position and momentum: a state that answers one sharply cannot answer the other at all.',
        },
        {
          id: 'erase', title: 'A measurement that erases',
          body: 'Use <b>three analyzers</b>: Z, then X, then Z again, each passing on its up beam. Send a few hundred atoms.',
          predict: { q: 'The atoms were sorted to be up along Z, then passed through X. The third analyzer asks about Z again. They come out:', options: ['All up: they were already sorted', 'Half up, half down', 'All down'], answer: 1 },
          check: () => S.n === 3 && S.an[0].angle % 180 === 0 && S.an[1].angle % 180 === 90 && S.an[2].angle % 180 === 0 && S.an[0].out !== 'both' && S.an[1].out !== 'both' && ended() >= 100,
          progress: () => `${Math.min(100, ended())} / 100 atoms at the end`,
          show: () => { chain(3, [{ angle: 0, out: 'up' }, { angle: 90, out: 'up' }, { angle: 0 }]); runFast(800); },
          insight: 'Half of them come out <b>down along Z</b>, even though every one had been filtered to be up. Measuring X did not read some hidden X value and leave Z alone. It replaced the state "up along Z" with "up along X", which knows nothing about Z. Take the middle analyzer away and the down beam is empty again.',
        },
        {
          id: 'rejoin', title: 'Bring both beams back together',
          body: 'Keep Z, X, Z, but set the middle analyzer to pass on <b>Both, rejoined</b>. The atoms still go through the X magnet, but nothing records which way each went.',
          check: () => S.n === 3 && S.an[1].out === 'both' && S.an[0].out !== 'both' && fold(S.an[2].angle - incoming(2)) === 0 && ended() >= 100,
          progress: () => `${Math.min(100, ended())} / 100 atoms at the end`,
          show: () => { chain(3, [{ angle: 0, out: 'up' }, { angle: 90, out: 'both' }, { angle: 0 }]); runFast(400); },
          insight: 'All up again. The magnet was never the culprit: the atoms passed through the very same field. What scrambled Z before was the <b>record</b> of an X result, made by blocking one beam. With both paths open and rejoined there is no X result anywhere in the world, the two paths add back together, and the original state returns. It is the which-slit detector all over again.',
        },
        {
          id: 'angle', title: 'Map the rule',
          body: 'Go back to <b>two analyzers</b> and try the second one at four or more different angles, with a few hundred atoms at each. Your points appear on the chart.',
          check: () => [...sweep.values()].filter((e) => e.n >= 100).length >= 4,
          progress: () => `${Math.min(4, [...sweep.values()].filter((e) => e.n >= 100).length)} / 4 angles measured`,
          show: () => { chain(2, [{ angle: 0, out: 'up' }, { angle: 0 }]); for (const a of [0, 30, 60, 120, 150]) { S.an[1].angle = a; runFast(600); } S.an[1].angle = 60; paintRows(); reset(true); runFast(600); },
          insight: 'The points trace cos&sup2;(&theta;/2). At 60 degrees three quarters come out up, at 90 degrees half, at 120 degrees a quarter. The amplitude is cos(&theta;/2): the <b>half angle</b> is the signature of spin one-half. Turn the analyzer a full 180 degrees and "up" has become "down".',
        },
      ]);

      // ----------------------------------------------------------- geometry
      const geo = () => {
        const { w, h } = L;
        const yc = Math.round(M.clamp(h * 0.47, 150, h - 170));
        const ovenX = 54, detX = w - 112;
        const start = ovenX + 44, slot = (detX - 22 - start) / S.n;
        const bw = M.clamp(slot - 80, 58, 132), bh = M.clamp(h * 0.36, 120, 170);
        const xs = [];
        for (let i = 0; i < S.n; i++) xs.push(S.n === 1 ? start + slot / 2 : start + slot * i + bw / 2 + 6);
        const dy = M.clamp(bh * 0.3, 34, 50), gap = slot - bw;
        return { w, h, yc, ovenX, detX, xs, bw, bh, dy, gap, stop: M.clamp(gap * 0.42, 22, 36), speed: Math.max(180, (detX - ovenX) / 2.6) };
      };
      const ease = (t) => M.smooth(M.clamp(t, 0, 1));
      // Vertical offset of an atom on branch b at position x, around analyzer i.
      const offset = (g, x, i, b, fate) => {
        const entry = g.xs[i] - g.bw / 2, exit = g.xs[i] + g.bw / 2;
        if (x < entry) return 0;
        if (x <= exit) return b * g.dy * ease((x - entry) / g.bw);
        if (fate !== 'pass') return b * g.dy;
        const nextEntry = g.xs[i + 1] - g.bw / 2, hold = exit + g.stop + 10, back = nextEntry - 14;
        return b * g.dy * (1 - ease((x - hold) / Math.max(1, back - hold)));
      };

      const emit = () => {
        const g = geo();
        atoms.push({ x: g.ovenX + 22, i: 0, dir: null, cur: null, v: 0.93 + 0.14 * Math.random() });
        count.sent++;
      };

      // ------------------------------------------------------------ drawing
      const drawArrow = (ctx, x, y, deg, len, color, width = 1.6) => {
        const a = deg * RAD, dx = Math.sin(a) * len, dy = -Math.cos(a) * len;
        D.arrow(ctx, x - dx * 0.5, y - dy * 0.5, x + dx * 0.5, y + dy * 0.5, color, width, Math.max(4, len * 0.34));
      };
      const stateText = (dir, compact) => {
        if (dir == null) return 'random spins';
        const a = ((dir % 360) + 360) % 360, base = a % 180 === a ? a : a - 180, down = a >= 180;
        return `${down ? 'down' : 'up'} ${compact ? '' : 'along '}${axisName(base)}`;
      };

      const draw = (dt) => {
        const { ctx } = L;
        const g = geo(), { w, h, yc } = g;
        ctx.clearRect(0, 0, w, h);
        zones.begin();

        // beam guides
        ctx.lineCap = 'round';
        const guide = (x1, y1, x2, y2, a = 0.1) => D.line(ctx, x1, y1, x2, y2, `rgba(240,239,236,${a})`, 1);
        guide(g.ovenX + 20, yc, g.xs[0] - g.bw / 2, yc);
        for (let i = 0; i < S.n; i++) {
          const exit = g.xs[i] + g.bw / 2, last = i === S.n - 1, a = S.an[i];
          for (const b of [1, -1]) {
            const open = last || a.out === 'both' || (a.out === 'up') === (b > 0);
            const endX = last ? g.detX : open ? g.xs[i + 1] - g.bw / 2 : exit + g.stop;
            ctx.beginPath();
            for (let x = g.xs[i] - g.bw / 2; x <= endX; x += 4) {
              const y = yc - offset(g, x, i, b, open && !last ? 'pass' : 'stay');
              x === g.xs[i] - g.bw / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(240,239,236,${open ? 0.12 : 0.06})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // oven
        D.rr(ctx, g.ovenX - 34, yc - 30, 56, 60, 10);
        const og = ctx.createLinearGradient(0, yc - 30, 0, yc + 30);
        og.addColorStop(0, '#2a2f3d'); og.addColorStop(1, '#171b25');
        ctx.fillStyle = og; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
        D.glow(ctx, g.ovenX + 18, yc, 20, [255, 170, 90], 0.55);
        ctx.fillStyle = '#ffcf9a'; ctx.fillRect(g.ovenX + 17, yc - 5, 5, 10);
        D.text(ctx, 'oven', g.ovenX - 6, yc + 48, { size: 11, align: 'center', color: C.ink2 });
        if (g.xs[0] - g.bw / 2 - g.ovenX > 100) D.text(ctx, stateText(null), (g.ovenX + 22 + g.xs[0] - g.bw / 2) / 2, yc - 14, { size: 10.5, align: 'center', color: C.ink3 });

        // analyzers
        for (let i = 0; i < S.n; i++) {
          const a = S.an[i], x = g.xs[i], last = i === S.n - 1, id = 'dial' + i, hot = zones.isHot(id);
          D.rr(ctx, x - g.bw / 2, yc - g.bh / 2, g.bw, g.bh, 14);
          const bg = ctx.createLinearGradient(0, yc - g.bh / 2, 0, yc + g.bh / 2);
          bg.addColorStop(0, 'rgba(46,52,68,0.92)'); bg.addColorStop(1, 'rgba(22,26,36,0.92)');
          ctx.fillStyle = bg; ctx.fill();
          ctx.strokeStyle = hot ? 'rgba(240,239,236,0.55)' : 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
          // pole pieces
          ctx.fillStyle = 'rgba(160,178,230,0.16)';
          D.rr(ctx, x - g.bw / 2 + 10, yc - g.bh / 2 + 8, g.bw - 20, 9, 3); ctx.fill();
          D.rr(ctx, x - g.bw / 2 + 10, yc + g.bh / 2 - 17, g.bw - 20, 9, 3); ctx.fill();
          // dial
          const r = Math.min(26, g.bw * 0.27);
          ctx.beginPath(); ctx.arc(x, yc, r, 0, M.TAU);
          ctx.fillStyle = 'rgba(8,10,15,0.75)'; ctx.fill();
          ctx.strokeStyle = hot ? C.ink : 'rgba(240,239,236,0.4)'; ctx.lineWidth = 1.25; ctx.stroke();
          for (let t = 0; t < 360; t += 45) {
            const s = Math.sin(t * RAD), c = -Math.cos(t * RAD);
            D.line(ctx, x + s * (r - 3), yc + c * (r - 3), x + s * r, yc + c * r, 'rgba(240,239,236,0.4)');
          }
          drawArrow(ctx, x, yc, a.angle, r * 1.5, hot ? '#fff' : C.ink, 2);
          D.text(ctx, `measures ${axisName(a.angle)}`, x, yc + g.bh / 2 + 18, { size: 11.5, weight: 600, align: 'center', color: C.ink });
          D.text(ctx, `analyzer ${i + 1}`, x, yc - g.bh / 2 - 9, { size: 10.5, align: 'center', color: C.ink3 });
          zones.add({
            id, x, y: yc, r: r + 12, cursor: 'grab',
            drag: (p) => {
              let deg = Math.atan2(p.x - x, -(p.y - yc)) / RAD;
              deg = (((Math.round(deg / 15) * 15) % 360) + 360) % 360;
              if (deg !== a.angle) { a.angle = deg; if (a.ui) a.ui.value = deg; reset(true); }
            },
          });
          // exits
          const exit = x + g.bw / 2;
          for (const b of [1, -1]) {
            const y = yc - b * g.dy;
            D.text(ctx, b > 0 ? 'up' : 'down', exit - 8, y + (b > 0 ? -7 : 14), { size: 9.5, align: 'right', color: C.ink3 });
            if (last) continue;
            const open = a.out === 'both' || (a.out === 'up') === (b > 0), zid = `port${i}${b}`, zh = zones.isHot(zid);
            const sx = exit + g.stop;
            if (!open) {
              D.rr(ctx, sx - 3, y - 13, 7, 26, 3);
              ctx.fillStyle = zh ? '#8f98b0' : '#5d6680'; ctx.fill();
            } else if (zh) {
              ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(240,239,236,0.5)'; ctx.strokeRect(sx - 3, y - 13, 7, 26); ctx.setLineDash([]);
            }
            zones.add({
              id: zid, x: exit + 6, y: y - 16, w: g.stop + 14, h: 32, cursor: 'pointer',
              click: () => {
                const upOpen = a.out !== 'down', downOpen = a.out !== 'up';
                const nu = b > 0 ? !upOpen : upOpen, nd = b > 0 ? downOpen : !downOpen;
                a.out = nu && nd ? 'both' : nu ? 'up' : nd ? 'down' : b > 0 ? 'down' : 'up';
                paintRows(); reset();
              },
            });
          }
          if (!last) {
            const mid = (exit + g.xs[i + 1] - g.bw / 2) / 2, tight = g.gap < 120;
            const dir = incoming(i + 1);
            D.text(ctx, a.out === 'both' ? (tight ? 'rejoined' : 'rejoined, no record') : stateText(dir, tight), mid, yc - g.bh / 2 - 9, { size: 10.5, align: 'center', color: C.ink2, halo: true });
            if (dir != null && a.out !== 'both') drawArrow(ctx, mid, yc - g.bh / 2 - 30, dir, 16, C.ink2, 1.5);
          }
        }

        // detectors at the end
        flashUp = Math.max(0, flashUp - dt * 4); flashDown = Math.max(0, flashDown - dt * 4);
        const total = count.up + count.down, exp = expected();
        if (S.classical && S.n === 1) {
          const cg = ctx.createLinearGradient(0, yc - g.dy - 6, 0, yc + g.dy + 6);
          cg.addColorStop(0, 'rgba(240,239,236,0)'); cg.addColorStop(0.15, 'rgba(240,239,236,0.22)');
          cg.addColorStop(0.85, 'rgba(240,239,236,0.22)'); cg.addColorStop(1, 'rgba(240,239,236,0)');
          ctx.fillStyle = cg; ctx.fillRect(g.detX - 16, yc - g.dy - 6, 8, 2 * g.dy + 12);
          D.text(ctx, 'classical smear', g.detX - 22, yc + 4, { size: 10, align: 'right', color: C.ink3, halo: true });
        }
        for (const [b, n, fl, col, name] of [[1, count.up, flashUp, C.up, 'up'], [-1, count.down, flashDown, C.down, 'down']]) {
          const y = yc - b * g.dy;
          D.rr(ctx, g.detX, y - 15, 12, 30, 4);
          ctx.fillStyle = C.css(col, 0.35 + 0.65 * fl); ctx.fill();
          if (fl > 0) D.glow(ctx, g.detX + 6, y, 16 + 26 * fl, col, 0.8 * fl);
          D.text(ctx, M.int(n), g.detX + 22, y - 2, { size: 19, weight: 500, color: C.ink, base: 'middle' });
          D.text(ctx, `${name}  ${total ? M.fix((100 * n) / total, 1) + '%' : ''}`, g.detX + 22, y + 15, { size: 10.5, color: C.ink2, base: 'middle' });
        }
        D.text(ctx, `expected ${M.fix(100 * exp, 0)}% : ${M.fix(100 * (1 - exp), 0)}%`, w - 12, yc + g.dy + 50, { size: 10.5, align: 'right', color: C.ink3 });
        for (let i = 0; i < S.n - 1; i++) {
          if (S.an[i].out === 'both') continue;
          const below = S.an[i].out === 'up';
          D.text(ctx, `${M.int(count.blocked[i])} blocked`, g.xs[i] + g.bw / 2 + g.stop, yc + (below ? g.dy + 30 : -g.dy - 22), { size: 10, align: 'center', color: C.ink3, halo: true });
        }

        // atoms
        for (const a of atoms) {
          const ys = a.cur && a.cur.branch === 0 ? [1, -1] : [a.cur ? a.cur.branch : 0];
          for (const b of ys) {
            const y = yc - (a.cur ? offset(g, a.x, a.i, b, a.cur.fate) : 0);
            const col = a.dir == null ? [255, 244, 220] : a.cur && a.cur.branch === 0 ? [255, 244, 220] : a.lastUp ? C.up : C.down;
            const alpha = ys.length === 2 ? 0.55 : 1;
            D.glow(ctx, a.x, y, 9, col, 0.75 * alpha);
            ctx.beginPath(); ctx.arc(a.x, y, 2.6, 0, M.TAU); ctx.fillStyle = C.css([255, 255, 255], alpha); ctx.fill();
            if (a.dir != null && ys.length === 1) drawArrow(ctx, a.x, y, a.dir, 15, C.css(col, 0.95), 1.4);
          }
        }
        for (const s of sparks) {
          s.age += dt;
          const f = Math.max(0, 1 - s.age / 0.35);
          if (f > 0) D.glow(ctx, s.x, s.y, 6 + 14 * (1 - f), s.col, 0.8 * f);
        }
        while (sparks.length && sparks[0].age > 0.4) sparks.shift();
        zones.end();

        stU.set(total ? M.fix((100 * count.up) / total, 1) : 'no atoms yet', total ? '%' : '');
        stE.set(M.fix(100 * exp, 1), '%');
        stS.set(M.int(count.sent));
        stD.set(M.int(total));
      };

      const update = (dt) => {
        if (!S.playing) return;
        const g = geo(), step = g.speed * S.speed * dt;
        if (S.stream) {
          emitAcc += S.rate * S.speed * dt;
          while (emitAcc >= 1) { emitAcc -= 1; emit(); }
        }
        for (let k = atoms.length - 1; k >= 0; k--) {
          const a = atoms[k];
          a.x += step * a.v;
          const entry = g.xs[a.i] - g.bw / 2, exit = g.xs[a.i] + g.bw / 2;
          if (!a.cur && a.x >= entry) {
            a.cur = meet(a.dir, a.i);
            if (a.cur.branch !== 0) { a.dir = a.cur.dir; a.lastUp = a.cur.branch > 0; }
          }
          if (!a.cur) continue;
          const y = g.yc - offset(g, a.x, a.i, a.cur.branch || 1, a.cur.fate);
          if (a.cur.fate === 'block' && a.x >= exit + g.stop - 2) {
            count.blocked[a.i]++; sparks.push({ x: exit + g.stop, y, col: [200, 205, 225], age: 0 }); atoms.splice(k, 1);
          } else if (a.cur.fate === 'detect' && a.x >= g.detX) {
            record(a.cur); dirty = true;
            if (a.cur.branch > 0) flashUp = 1; else flashDown = 1;
            atoms.splice(k, 1);
          } else if (a.cur.fate === 'pass' && a.x >= g.xs[a.i + 1] - g.bw / 2 - 1) { a.i++; a.cur = null; }
        }
        sinceChart += dt;
        if (dirty && sinceChart > 0.4) { sinceChart = 0; dirty = false; refreshChart(); }
      };
      let sinceChart = 0, dirty = false;

      lab.frame((dt) => { update(dt); draw(dt); });
      lab.note('Drag a dial to turn an analyzer. Click an exit to block it.');
      paintRows();
      refreshChart();
      return { get state() { return { S, count, sweep, atoms }; }, runFast, chain };
    },
  });
})();
