// The lab shell: page chrome, station lifecycle, the frame loop, persistence.
// A station is registered with QL.register({ id, title, kicker, idea, create(lab) })
// and builds itself out of the helpers on the Lab instance it is handed.
(() => {
  const QL = (globalThis.QL ||= {});
  const { el, icon, icons, button } = QL.ui;

  QL.stations = [];
  QL.register = (def) => QL.stations.push(def);

  const store = {
    key: 'quantum-lab:v1',
    data: {},
    load() { try { this.data = JSON.parse(localStorage.getItem(this.key)) || {}; } catch { this.data = {}; } },
    get(k) { return this.data[k]; },
    set(k, v) { this.data[k] = v; try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch { /* private mode */ } },
    clear() { this.data = {}; try { localStorage.removeItem(this.key); } catch { /* ignore */ } },
  };
  QL.store = store;

  class Lab {
    constructor(shell, def, index) {
      this.shell = shell;
      this.def = def;
      this.index = index;
      this.stage = shell.stage;
      this.dock = shell.dock;
      this.layers = [];
      this.cleanup = [];
      this.resizers = [];
      this.frameFn = null;
      this.plots = [];
      this.keys = {};
      this.safe = { top: 36, bottom: 62, left: 18, right: 18 };
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.stage);
    }

    // ----- stage layers
    layer(kind = '2d', attrs) {
      const canvas = el('canvas', { role: 'img', 'aria-label': `${this.def.title}: interactive simulation. The guide and readouts beside it describe what it shows.` });
      this.stage.append(canvas);
      const layer = { canvas, w: 0, h: 0, dpr: 1 };
      if (kind === '2d') layer.ctx = canvas.getContext('2d');
      else layer.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance', ...attrs });
      this.layers.push(layer);
      this.sizeLayer(layer);
      return layer;
    }
    sizeLayer(layer) {
      const w = this.stage.clientWidth, h = this.stage.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      layer.w = w; layer.h = h; layer.dpr = dpr;
      layer.canvas.width = Math.max(1, Math.round(w * dpr));
      layer.canvas.height = Math.max(1, Math.round(h * dpr));
      layer.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize() {
      for (const layer of this.layers) this.sizeLayer(layer);
      for (const fn of this.resizers) fn();
      // Resizing clears a canvas; repaint now instead of waiting a frame.
      try { this.frameFn?.(0, this.shell.clock || 0); } catch (e) { console.error(e); }
    }
    onResize(fn) { this.resizers.push(fn); }
    fallback(html) { this.stage.append(el('div', { class: 'fallback', html })); }

    // ----- panel
    control(...items) { for (const it of items.flat()) if (it) this.shell.controls.append(it.el || it); }
    heading(text) { this.shell.controls.append(el('div', { class: 'sec-h', text, style: { marginTop: '18px' } })); }
    stat(opts) { const s = QL.ui.stat(opts); this.shell.stats.append(s.el); this.shell.statsSec.hidden = false; return s; }
    physics(html) { this.shell.physics.innerHTML = html; this.shell.physicsSec.hidden = false; }
    guide(missions) {
      const next = QL.stations[this.index + 1];
      this.guideUI = new QL.Guide(this.shell.guide, {
        id: this.def.id, missions, store,
        toast: (h) => this.toast(h),
        next: next
          ? { label: next.short || next.title, blurb: ` Next: ${next.kicker.toLowerCase()}.`, go: () => this.shell.go(next.id) }
          : { label: 'Back to the start', blurb: ' You have finished the lab.', go: () => this.shell.go(QL.stations[0].id) },
      });
      this.guideUI.onProgress = () => this.shell.paintRail();
      return this.guideUI;
    }

    // ----- dock
    card({ title, sub, fit, width }) {
      const header = el('header', {}, el('h3', { text: title }), sub ? el('span', { class: 'sub', text: sub }) : null);
      const legend = el('div', { class: 'legend-slot' });
      const body = el('div');
      const root = el('div', { class: `card ${fit ? 'fit' : ''}`, style: width ? { width: width + 'px', flex: 'none' } : null }, header, legend, body);
      this.dock.append(root);
      return { el: root, header, legend, body };
    }
    plot(card, opts) {
      const c = this.card(card);
      const p = new QL.Plot(c.body, opts);
      const lg = p.legend();
      if (lg) c.legend.append(lg);
      this.plots.push(p);
      p.card = c;
      return p;
    }

    // ----- time
    frame(fn) { this.frameFn = fn; }
    transport({ playing = true, onToggle, onReset, speeds, speed = 1, onSpeed, clock }) {
      const state = { playing, speed };
      const main = el('button', { class: 'icon-btn lead', type: 'button', title: 'Play or pause (space)' });
      const paint = () => { main.innerHTML = state.playing ? icons.pause : icons.play; main.setAttribute('aria-label', state.playing ? 'Pause' : 'Play'); };
      const toggle = () => { state.playing = !state.playing; paint(); onToggle?.(state.playing); };
      main.addEventListener('click', toggle);
      const bar = el('div', { class: 'transport' }, main);
      if (onReset) bar.append(el('button', { class: 'icon-btn', type: 'button', title: 'Restart (R)', 'aria-label': 'Restart', html: icons.reset, onclick: () => onReset() }));
      let speedBtns = [];
      if (speeds) {
        bar.append(el('div', { class: 'div' }));
        speedBtns = speeds.map((s) => el('button', { type: 'button', text: s + 'x', title: `Speed ${s}x`, onclick: () => { state.speed = s; paintSpeed(); onSpeed?.(s); } }));
        bar.append(el('div', { class: 'speed' }, speedBtns));
      }
      const paintSpeed = () => speedBtns.forEach((b, i) => b.classList.toggle('on', speeds[i] === state.speed));
      let clockEl = null;
      if (clock) { clockEl = el('span', { class: 'clock' }); bar.append(el('div', { class: 'div' }), clockEl); }
      paint(); paintSpeed();
      this.stage.append(bar);
      this.keys[' '] = toggle;
      if (onReset) this.keys.r = onReset;
      state.set = (p) => { state.playing = p; paint(); };
      state.clock = (text) => { if (clockEl && clockEl.textContent !== text) clockEl.textContent = text; };
      state.el = bar;
      return state;
    }
    tools(...items) {
      const box = el('div', { class: 'stage-tools' }, items.map((i) => i.el || i));
      this.stage.append(box);
      return box;
    }
    note(text) {
      if (!this.noteEl) { this.noteEl = el('div', { class: 'stage-note' }); this.stage.append(this.noteEl); }
      this.noteEl.textContent = text;
    }
    toast(html, ms = 2600) {
      if (!this.toastEl) { this.toastEl = el('div', { class: 'toast', role: 'status' }); this.stage.append(this.toastEl); }
      this.toastEl.innerHTML = html;
      this.toastEl.classList.add('on');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toastEl.classList.remove('on'), ms);
    }

    onDestroy(fn) { this.cleanup.push(fn); }
    destroy() {
      this.frameFn = null;
      clearTimeout(this.toastTimer);
      this.ro.disconnect();
      for (const fn of this.cleanup) { try { fn(); } catch (e) { console.error(e); } }
      for (const p of this.plots) p.destroy();
      for (const layer of this.layers) layer.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }

  // ------------------------------------------------------------------ shell
  const shell = {
    lab: null,
    instance: null,

    build() {
      const root = document.getElementById('app');
      this.rail = el('nav', { class: 'rail', 'aria-label': 'Stations' });
      this.railBtns = QL.stations.map((s, i) => {
        const b = el('button', { type: 'button', title: s.kicker, onclick: () => this.go(s.id) },
          el('span', { class: 'n', text: String(i + 1).padStart(2, '0') }), s.short || s.title);
        if (i) this.rail.append(el('span', { class: 'sep' }));
        this.rail.append(b);
        return b;
      });
      const top = el('header', { class: 'top' },
        el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'name', text: 'Quantum Lab' })),
        this.rail,
        el('div', { class: 'tools' },
          el('button', { class: 'icon-btn', type: 'button', title: 'Keys and color legend (?)', 'aria-label': 'Help', html: icons.help, onclick: () => this.help() })));

      this.stage = el('div', { class: 'stage' });
      this.dock = el('div', { class: 'dock' });
      this.kicker = el('div', { class: 'st-kicker' });
      this.title = el('h1', { class: 'st-title' });
      this.idea = el('p', { class: 'st-idea' });
      this.guide = el('section', { class: 'guide' });
      this.controls = el('section', { class: 'controls' });
      this.stats = el('div', { class: 'stats' });
      this.statsSec = el('section', {}, el('div', { class: 'sec-h', text: 'Readouts' }), this.stats);
      this.physics = el('div', { class: 'physics' });
      this.physicsSec = el('section', {},
        el('details', { class: 'physics' },
          el('summary', {}, el('div', { class: 'sec-h' }, 'The physics', el('span', { class: 'chev', html: icons.chev }))),
          this.physics));
      this.foot = el('section', { class: 'nav-foot' });
      this.panel = el('aside', { class: 'panel' },
        el('section', {}, this.kicker, this.title, this.idea),
        this.guide, this.controls, this.statsSec, this.physicsSec, this.foot);
      root.append(el('div', { class: 'app' }, top,
        el('div', { class: 'main' }, el('main', { class: 'stagecol' }, this.stage, this.dock), this.panel)));
      this.veil = el('div', { class: 'veil', onclick: (e) => { if (e.target === this.veil) this.closeVeil(); } });
      document.body.append(this.veil);
    },

    paintRail() {
      QL.stations.forEach((s, i) => {
        const g = store.get('guide:' + s.id);
        this.railBtns[i].classList.toggle('done', !!g && !!g.total && (g.done || []).length >= g.total);
        this.railBtns[i].classList.toggle('on', this.lab?.def === s);
      });
    },

    go(id) {
      if (location.hash !== '#/' + id) { location.hash = '#/' + id; return; }
      this.open(id);
    },

    open(id) {
      const index = Math.max(0, QL.stations.findIndex((s) => s.id === id));
      const def = QL.stations[index];
      if (this.lab) {
        try { this.instance?.destroy?.(); } catch (e) { console.error(e); }
        this.lab.destroy();
      }
      this.stage.replaceChildren();
      this.dock.replaceChildren();
      this.controls.replaceChildren(el('div', { class: 'sec-h', text: 'Controls' }));
      this.stats.replaceChildren();
      this.statsSec.hidden = true;
      this.physicsSec.hidden = true;
      this.physicsSec.querySelector('details').open = false;
      this.guide.replaceChildren();
      this.kicker.replaceChildren(el('b', { text: String(index + 1).padStart(2, '0') }), def.kicker);
      this.title.textContent = def.title;
      this.idea.textContent = def.idea;
      const prev = QL.stations[index - 1], next = QL.stations[index + 1];
      this.foot.replaceChildren(
        prev ? el('button', { class: 'btn', type: 'button', onclick: () => this.go(prev.id) }, el('span', { html: icons.back, style: { display: 'inline-grid' } }), prev.short || prev.title) : el('span', { style: { flex: '1' } }),
        next ? el('button', { class: 'btn', type: 'button', onclick: () => this.go(next.id) }, next.short || next.title, el('span', { html: icons.chev, style: { display: 'inline-grid' } })) : el('span', { style: { flex: '1' } }));
      this.panel.scrollTop = 0;
      document.title = `${def.title} | Quantum Lab`;
      store.set('last', def.id);
      this.lab = new Lab(this, def, index);
      try {
        this.instance = def.create(this.lab) || {};
      } catch (e) {
        console.error(e);
        this.instance = {};
        this.lab.fallback(`This station could not start.<br><span style="color:var(--ink-3)">${String(e.message || e)}</span>`);
      }
      this.paintRail();
      this.railBtns[index].scrollIntoView({ block: 'nearest', inline: 'center' });
    },

    sheet(...kids) {
      this.veil.replaceChildren(el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, kids));
      this.veil.classList.add('on');
    },
    closeVeil() { this.veil.classList.remove('on'); },

    welcome() {
      this.sheet(
        el('div', { class: 'eyebrow', text: 'Seven hands-on experiments' }),
        el('h1', { text: 'Quantum Lab' }),
        el('p', { class: 'lede', text: 'Quantum mechanics stops being strange once you have run the experiments yourself. Every wave on these benches is the real Schrödinger equation, solved live as you drag, fire and measure.' }),
        el('div', { class: 'steps' }, QL.stations.map((s, i) => el('div', {}, el('b', { text: String(i + 1).padStart(2, '0') }), el('span', {}, s.short || s.title, el('em', { text: s.kicker }))))),
        el('div', { class: 'foot' },
          el('span', { text: 'Each station has a short guide. Do what it asks, then read what you saw.' }),
          button({ label: 'Start with the double slit', kind: 'primary', onClick: () => { store.set('welcomed', true); this.closeVeil(); } })));
    },

    help() {
      const wheel = el('div', { class: 'wheel' });
      wheel.style.background = QL.color.wheel();
      this.sheet(
        el('h2', { text: 'Reading the lab' }),
        el('div', { class: 'legend-row' }, wheel,
          el('div', { html: '<b style="color:var(--ink)">Color is phase, brightness is probability.</b><br>A wavefunction is a complex number at each point. Its angle is drawn as a hue from this wheel, and its squared size as height or brightness. Where two waves meet with the same color they add; opposite colors cancel.' })),
        el('div', { class: 'keys' },
          el('kbd', { text: 'Space' }), el('span', { text: 'Play or pause the running experiment' }),
          el('kbd', { text: 'R' }), el('span', { text: 'Restart it' }),
          el('kbd', { text: '1 ... 7' }), el('span', { text: 'Jump to a station' }),
          el('kbd', { text: '[  ]' }), el('span', { text: 'Previous or next station' }),
          el('kbd', { text: '?' }), el('span', { text: 'Open this sheet' })),
        el('div', { class: 'foot' },
          button({ label: 'Reset all guide progress', onClick: () => { store.clear(); store.set('welcomed', true); this.closeVeil(); this.open(this.lab.def.id); } }),
          button({ label: 'Done', kind: 'primary', onClick: () => this.closeVeil() })));
    },

    start() {
      store.load();
      this.build();
      const fromHash = () => (location.hash.match(/^#\/([\w-]+)/) || [])[1];
      window.addEventListener('hashchange', () => this.open(fromHash() || QL.stations[0].id));
      // No hash: pick up at the station the visitor last had open.
      this.open(fromHash() || store.get('last') || QL.stations[0].id);
      if (!store.get('welcomed') && !fromHash()) this.welcome();

      window.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Escape') { this.closeVeil(); return; }
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
        const idx = this.lab ? this.lab.index : 0;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === ' ' && t && t.tagName === 'BUTTON') return; // let buttons click
        if (key === '?') { this.help(); return; }
        if (key >= '1' && key <= '9' && QL.stations[+key - 1]) { this.go(QL.stations[+key - 1].id); return; }
        if (key === ']' && QL.stations[idx + 1]) { this.go(QL.stations[idx + 1].id); return; }
        if (key === '[' && QL.stations[idx - 1]) { this.go(QL.stations[idx - 1].id); return; }
        const fn = this.lab?.keys[key];
        if (fn) { e.preventDefault(); fn(); }
      });

      let last = performance.now(), clock = 0;
      const tick = (now) => {
        requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (document.hidden) return;
        clock += dt;
        this.clock = clock;
        try { this.lab?.frameFn?.(dt, clock); } catch (e) { console.error(e); this.lab.frameFn = null; }
      };
      requestAnimationFrame(tick);
      setInterval(() => this.lab?.guideUI?.poll(), 250);

      // Lets tests and headless previews advance the lab without a display.
      QL.debug = {
        tick: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { clock += dt; this.lab?.frameFn?.(dt, clock); } this.lab?.guideUI?.poll(); },
        get lab() { return shell.lab; },
        get station() { return shell.instance; },
      };
    },
  };

  QL.shell = shell;
})();
