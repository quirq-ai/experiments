// Tesseract Lab panel: hypercube / scanner / artifact destinations + live controls.

import { makePanelDraggable } from './dragPanel.js';

function fmt(n, d = 3) {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  if (Math.abs(n) > 0 && Math.abs(n) < 1e-3) return n.toExponential(2);
  if (Math.abs(n) >= 1e4) return n.toExponential(2);
  return n.toFixed(d);
}

const FAMILY_LABEL = {
  hypercube: 'Interstellar lattice',
  scanner: 'Optical scanner',
  artifact: 'Sci-fi artifact',
};

export class TesseractPanel {
  constructor(lab, hooks) {
    this.lab = lab;
    this.h = hooks;
    this.el = document.getElementById('tesseract-panel');
    this.liveAcc = 0;
    this.build();
    makePanelDraggable(this.el, {
      handleSelector: '.list-title',
      storageKey: 'observatory-tesseract-panel-pos',
    });
    lab.onScan = () => this.renderAll();
  }

  build() {
    this.el.innerHTML = `
      <div class="list-title tess-hero-title">Tesseract Lab</div>
      <p class="lab-note">One word, three instruments: an Interstellar-style open lattice
      (time as rooms), an optical text scanner (Tesseract OCR lineage), and a sci-fi magic cube.</p>

      <div class="fractal-family-row" id="tess-families">
        <button class="btn tiny" data-fam="hypercube">Lattice</button>
        <button class="btn tiny" data-fam="scanner">Scanner</button>
        <button class="btn tiny" data-fam="artifact">Artifact</button>
      </div>

      <div class="section-title">Destinations</div>
      <div class="preset-grid fractal-presets" id="tess-presets"></div>

      <div class="fractal-blurb" id="tess-blurb"></div>

      <div class="section-title">Live view</div>
      <div class="state-block" id="tess-live"></div>

      <div class="section-title">Parameters</div>
      <div class="spm-params" id="tess-params"></div>

      <div class="kick-row eq-actions">
        <button class="btn tiny" id="tess-pause">Pause</button>
        <button class="btn tiny" id="tess-reset">Reset destination</button>
        <button class="btn tiny" id="tess-frame">Frame view</button>
        <button class="btn tiny hidden" id="tess-rescan">Rescan</button>
      </div>

      <div class="section-title">Analysis</div>
      <div class="state-block" id="tess-analysis"></div>

      <div class="section-title">Guide</div>
      <div class="fractal-guide" id="tess-guide"></div>
    `;

    this.el.querySelector('#tess-families').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fam]');
      if (!b) return;
      this.lab.setFamily(b.dataset.fam);
      this.renderAll();
      this.h.frameView?.();
    });

    this.el.querySelector('#tess-pause').addEventListener('click', () => this.togglePause());
    this.el.querySelector('#tess-reset').addEventListener('click', () => {
      if (this.lab.preset) {
        this.lab.loadPreset(this.lab.preset.id);
        this.renderAll();
      }
    });
    this.el.querySelector('#tess-frame').addEventListener('click', () => this.h.frameView?.());
    this.el.querySelector('#tess-rescan').addEventListener('click', () => {
      this.lab.runScan();
      this.lab.paintPlate();
      this.lab.paintBoxes();
      this.renderAll();
    });

    this.renderAll();
  }

  togglePause() {
    this.lab.playing = !this.lab.playing;
    this.lab.params.auto = this.lab.playing;
    this.syncPause();
  }

  syncPause() {
    const b = this.el.querySelector('#tess-pause');
    if (b) b.textContent = this.lab.playing ? 'Pause' : 'Resume';
  }

  renderAll() {
    this.syncFamilies();
    this.renderPresets();
    this.renderBlurb();
    this.renderParams();
    this.renderLive();
    this.renderAnalysis();
    this.renderGuide();
    this.syncPause();
    const rescan = this.el.querySelector('#tess-rescan');
    if (rescan) rescan.classList.toggle('hidden', this.lab.family !== 'scanner');
  }

  syncFamilies() {
    this.el.querySelectorAll('#tess-families [data-fam]').forEach((b) => {
      b.classList.toggle('active', b.dataset.fam === this.lab.family);
    });
  }

  renderPresets() {
    const root = this.el.querySelector('#tess-presets');
    root.innerHTML = '';
    for (const p of this.lab.listPresets().filter((x) => x.family === this.lab.family)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset-chip' + (this.lab.preset?.id === p.id ? ' active' : '');
      b.textContent = p.name;
      b.addEventListener('click', () => {
        this.lab.loadPreset(p.id);
        this.renderAll();
        this.h.frameView?.();
      });
      root.appendChild(b);
    }
  }

  renderBlurb() {
    const el = this.el.querySelector('#tess-blurb');
    const p = this.lab.preset;
    el.innerHTML = p
      ? `<b>${FAMILY_LABEL[p.family] || p.family}</b> · ${p.blurb}`
      : '';
  }

  renderParams() {
    const root = this.el.querySelector('#tess-params');
    root.innerHTML = '';
    const fam = this.lab.family;

    if (fam === 'hypercube') {
      root.appendChild(this.sliderRow('Drift speed', 'speed', 0, 2, 0.05, this.lab.params.speed ?? 0.55));
      root.appendChild(this.sliderRow('World-line pulse', 'pulse', 0, 2.5, 0.05, this.lab.params.pulse ?? 1));
      root.appendChild(this.sliderRow('Lattice extent', 'extent', 2, 7, 1, this.lab.params.extent ?? 5));
      root.appendChild(this.sliderRow('Room spacing', 'spacing', 5, 10, 0.1, this.lab.params.spacing ?? 7.2));
      root.appendChild(this.checkRow('Auto-fly (Cooper drift)', 'fly', this.lab.params.fly !== false));
    } else if (fam === 'scanner') {
      root.appendChild(this.textRow('Text to scan', 'text', this.lab.params.text || 'TESSERACT'));
      root.appendChild(this.sliderRow('Binarize threshold', 'threshold', 60, 200, 1, this.lab.params.threshold ?? 128));
      root.appendChild(this.sliderRow('Sweep speed', 'scanSpeed', 0.2, 2.5, 0.05, this.lab.params.scanSpeed ?? 1));
    } else {
      root.appendChild(this.sliderRow('Nest depth', 'nest', 2, 6, 1, this.lab.params.nest ?? 4));
      root.appendChild(this.sliderRow('Pulse', 'pulse', 0, 2.5, 0.05, this.lab.params.pulse ?? 1));
      root.appendChild(this.sliderRow('Energy', 'energy', 0.2, 2.5, 0.05, this.lab.params.energy ?? 1));
      root.appendChild(this.sliderRow('Fold', 'fold', 0, 2, 0.05, this.lab.params.fold ?? 1));
      root.appendChild(this.sliderRow('Speed', 'speed', 0, 2, 0.05, this.lab.params.speed ?? 0.5));
    }
  }

  sliderRow(label, key, min, max, step, value) {
    const row = document.createElement('div');
    row.className = 'spm-row';
    row.innerHTML = `
      <label>${label}</label>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
      <span class="spm-val">${fmt(Number(value), step < 0.1 ? 2 : 1)}</span>`;
    const input = row.querySelector('input');
    const val = row.querySelector('.spm-val');
    input.addEventListener('input', () => {
      const v = Number(input.value);
      val.textContent = fmt(v, step < 0.1 ? 2 : 1);
      this.lab.setParam(key, v);
      if (key === 'highlightCell' || key.startsWith('angle_') || key.startsWith('rate_')) this.renderLive();
    });
    return row;
  }

  selectRow(label, key, options, value, coerce = (v) => v) {
    const row = document.createElement('div');
    row.className = 'spm-row';
    const opts = options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`).join('');
    row.innerHTML = `<label>${label}</label><select>${opts}</select>`;
    row.querySelector('select').addEventListener('change', (e) => {
      this.lab.setParam(key, coerce(e.target.value));
      this.renderLive();
      this.renderAnalysis();
    });
    return row;
  }

  checkRow(label, key, checked) {
    const row = document.createElement('div');
    row.className = 'check-row';
    row.innerHTML = `<label><input type="checkbox" ${checked ? 'checked' : ''}/> ${label}</label>`;
    row.querySelector('input').addEventListener('change', (e) => {
      this.lab.setParam(key, e.target.checked);
      this.renderLive();
    });
    return row;
  }

  textRow(label, key, value) {
    const row = document.createElement('div');
    row.className = 'spm-row tess-text-row';
    row.innerHTML = `
      <label>${label}</label>
      <input type="text" maxlength="24" value="${String(value).replace(/"/g, '&quot;')}" spellcheck="false" />`;
    const input = row.querySelector('input');
    let timer = null;
    const apply = () => {
      this.lab.setParam(key, input.value.toUpperCase());
      this.renderLive();
      this.renderAnalysis();
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 280);
    });
    input.addEventListener('change', apply);
    return row;
  }

  renderLive() {
    const el = this.el.querySelector('#tess-live');
    const fam = this.lab.family;
    if (fam === 'hypercube') {
      const n = this.lab.lattice?.rooms?.length ?? 0;
      el.innerHTML = `
        <div class="kv"><b>Rooms</b><span>${n} moments</span></div>
        <div class="kv"><b>Spacing</b><span>${fmt(this.lab.lattice?.spacing ?? 7.2, 1)}</span></div>
        <div class="kv"><b>Drift</b><span>${fmt(this.lab.drift, 1)}</span></div>
        <div class="kv"><b>Fly</b><span>${this.lab.params.fly !== false ? 'on' : 'off'}</span></div>
        <div class="kv"><b>Pulse</b><span>${fmt(this.lab.params.pulse ?? 1, 2)}</span></div>
        <div class="kv"><b>Mode</b><span>${this.lab.playing ? 'drifting' : 'held'}</span></div>`;
    } else if (fam === 'scanner') {
      const s = this.lab.scan;
      el.innerHTML = s ? `
        <div class="kv"><b>Expected</b><span>${s.expected}</span></div>
        <div class="kv"><b>Recognized</b><span>${s.recognized}</span></div>
        <div class="kv"><b>Confidence</b><span>${(s.meanConfidence * 100).toFixed(1)}%</span></div>
        <div class="kv"><b>Accuracy</b><span>${(s.accuracy * 100).toFixed(0)}%</span></div>
        <div class="kv"><b>Glyphs</b><span>${s.glyphs.length}</span></div>
        <div class="kv"><b>Sweep</b><span>${Math.min(100, Math.round(this.lab.scanProgress * 100))}%</span></div>`
        : '<p class="lab-note">No scan yet.</p>';
    } else {
      el.innerHTML = `
        <div class="kv"><b>Nest</b><span>${this.lab.params.nest ?? 4}</span></div>
        <div class="kv"><b>Energy</b><span>${fmt(this.lab.params.energy ?? 1, 2)}</span></div>
        <div class="kv"><b>Fold</b><span>${fmt(this.lab.params.fold ?? 1, 2)}</span></div>
        <div class="kv"><b>Pulse</b><span>${fmt(this.lab.params.pulse ?? 1, 2)}</span></div>`;
    }
  }

  renderAnalysis() {
    const el = this.el.querySelector('#tess-analysis');
    const a = this.lab.analysis();
    if (a.kind === 'hypercube') {
      el.innerHTML = `
        <p class="lab-note">${a.note}</p>
        <div class="kv"><b>Schläfli</b><span>${a.facts.schlafli}</span></div>
        <div class="kv"><b>Rooms</b><span>${a.rooms}</span></div>
        <div class="kv"><b>Spacing</b><span>${fmt(a.spacing, 1)}</span></div>
        <div class="kv"><b>Drift</b><span>${fmt(a.drift, 2)}</span></div>
        <div class="kv"><b>Dual</b><span>${a.facts.dual}</span></div>`;
    } else if (a.kind === 'scanner') {
      const rows = (a.glyphs || []).map((g) =>
        `<div class="kv"><b>${g.expected} → ${g.ch}</b><span>${(g.score * 100).toFixed(0)}% ${g.correct ? '✓' : '✗'}</span></div>`
      ).join('');
      el.innerHTML = `
        <p class="lab-note">Template match per glyph (pedagogical OCR, not the real Tesseract engine).</p>
        ${rows || '<p class="lab-note">No glyphs segmented.</p>'}`;
    } else {
      el.innerHTML = `
        <p class="lab-note">Nested cages fold on independent axes while energy ribbons orbit the core.
        A visual cousin of the Cosmic Cube / Space Stone, not a physical model.</p>
        <div class="kv"><b>Layers</b><span>${a.nest}</span></div>
        <div class="kv"><b>Energy</b><span>${fmt(a.energy, 2)}</span></div>`;
    }
  }

  renderGuide() {
    const el = this.el.querySelector('#tess-guide');
    const fam = this.lab.family;
    if (fam === 'hypercube') {
      el.innerHTML = `
        <div class="fg-row"><kbd>auto-fly</kbd> Cooper drift through the void</div>
        <div class="fg-row"><kbd>rooms</kbd> bedroom moments along time</div>
        <div class="fg-row"><kbd>beams</kbd> world-lines (time extruded)</div>
        <div class="fg-row"><kbd>drag</kbd> look around (fly off)</div>
        <div class="fg-row"><kbd>Space</kbd> pause / resume drift</div>`;
    } else if (fam === 'scanner') {
      el.innerHTML = `
        <div class="fg-row"><kbd>text</kbd> type A-Z / 0-9</div>
        <div class="fg-row"><kbd>pipeline</kbd> render → binary → segment → match</div>
        <div class="fg-row"><kbd>green box</kbd> correct guess</div>
        <div class="fg-row"><kbd>red box</kbd> mismatch</div>
        <div class="fg-row"><kbd>Space</kbd> pause sweep</div>`;
    } else {
      el.innerHTML = `
        <div class="fg-row"><kbd>drag</kbd> orbit the relic</div>
        <div class="fg-row"><kbd>nest</kbd> stacked cages</div>
        <div class="fg-row"><kbd>energy</kbd> ribbon density + glow</div>
        <div class="fg-row"><kbd>fold</kbd> cross-axis twist</div>
        <div class="fg-row"><kbd>Space</kbd> pause / resume</div>`;
    }
  }

  tick(dt) {
    this.liveAcc += dt;
    if (this.liveAcc < 0.2) return;
    this.liveAcc = 0;
    this.renderLive();
    if (this.lab.family === 'hypercube') this.renderAnalysis();
  }
}
