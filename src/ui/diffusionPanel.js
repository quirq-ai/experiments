// Diffusion Lab panel: gas/liquid medium, enclosed reflection, leak holes.

import { makePanelDraggable } from './dragPanel.js';

function fmt(n, d = 3) {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  if (Math.abs(n) > 0 && Math.abs(n) < 1e-3) return n.toExponential(2);
  if (Math.abs(n) >= 1e4) return n.toExponential(2);
  return n.toFixed(d);
}

const PRESETS = [
  {
    id: 'gas-enclosed',
    name: 'Gas · enclosed room',
    blurb: 'Sealed room. High-D vapor hits reflective walls and fills the volume.',
    params: {
      medium: 'gas', sourceRate: 0, sourceX: 0.5, sourceY: 0.3,
      leaks: false, showReflection: true, contour: false, speed: 1, DScale: 1,
      injectAmount: 1.3,
    },
  },
  {
    id: 'gas-leak',
    name: 'Gas · wall leak',
    blurb: 'Same plume with an open hole. Mass escapes; reflection weakens near the gap.',
    params: {
      medium: 'gas', sourceRate: 0.45, sourceX: 0.3, sourceY: 0.25,
      leaks: true, holeSize: 0.16, holeCenter: 0.5, holeWalls: ['right'],
      showReflection: true, contour: true, speed: 1, DScale: 1.1,
    },
  },
  {
    id: 'liquid-enclosed',
    name: 'Liquid · enclosed spill',
    blurb: 'Slow liquid diffusion with settling. Watch the stain reflect off floor and walls.',
    params: {
      medium: 'liquid', sourceRate: 0, sourceX: 0.5, sourceY: 0.55,
      leaks: false, showReflection: true, contour: false, speed: 1.5, DScale: 1,
      injectAmount: 1.5,
    },
  },
  {
    id: 'liquid-drain',
    name: 'Liquid · floor drain',
    blurb: 'Liquid spill with a floor hole. Compare hole size: small drip vs wide drain.',
    params: {
      medium: 'liquid', sourceRate: 0.6, sourceX: 0.45, sourceY: 0.4,
      leaks: true, holeSize: 0.12, holeCenter: 0.45, holeWalls: ['bottom'],
      showReflection: true, contour: true, speed: 1.6, DScale: 1.1,
    },
  },
];

export class DiffusionPanel {
  constructor(lab, hooks) {
    this.lab = lab;
    this.h = hooks;
    this.el = document.getElementById('diffusion-panel');
    this.liveAcc = 0;
    this.presetId = PRESETS[0].id;
    this.build();
    makePanelDraggable(this.el, {
      handleSelector: '.list-title',
      storageKey: 'observatory-diffusion-panel-pos',
    });
  }

  build() {
    this.el.innerHTML = `
      <div class="list-title">Diffusion Lab</div>
      <p class="lab-note">How gas and liquid spread in an enclosed room: reflective
      walls bounce the plume; optional holes leak mass out. Click / drag to inject.</p>

      <div class="section-title">Medium</div>
      <div class="photo-modes diffusion-modes" id="diff-medium">
        <button data-m="gas" class="active">Gas</button>
        <button data-m="liquid">Liquid</button>
      </div>

      <div class="section-title">Destinations</div>
      <div class="preset-grid" id="diff-presets"></div>

      <div class="fractal-blurb" id="diff-blurb"></div>

      <div class="section-title">Live view</div>
      <div class="state-block" id="diff-live"></div>

      <div class="section-title">Parameters</div>
      <div class="spm-params" id="diff-params"></div>

      <div class="section-title">Leaks</div>
      <div class="spm-params" id="diff-leaks"></div>

      <div class="kick-row eq-actions">
        <button class="btn tiny" id="diff-pause">Pause</button>
        <button class="btn tiny" id="diff-reset">Reset plume</button>
        <button class="btn tiny" id="diff-frame">Frame view</button>
      </div>

      <div class="section-title">Analysis</div>
      <div class="state-block" id="diff-analysis"></div>

      <div class="section-title">Guide</div>
      <div class="fractal-guide">
        <div class="fg-row"><kbd>click / drag</kbd> inject medium</div>
        <div class="fg-row"><kbd>Gas</kbd> high D · buoyant rise</div>
        <div class="fg-row"><kbd>Liquid</kbd> low D · settling</div>
        <div class="fg-row"><kbd>Reflection</kbd> wall bounce glow</div>
        <div class="fg-row"><kbd>Leaks</kbd> holes drain mass · size the opening</div>
        <div class="fg-row"><kbd>Space</kbd> pause / resume</div>
      </div>
    `;

    this.el.querySelector('#diff-medium').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      this.lab.setParam('medium', b.dataset.m);
      this.syncMedium();
      this.renderAll();
    });

    this.el.querySelector('#diff-pause').addEventListener('click', () => this.togglePause());
    this.el.querySelector('#diff-reset').addEventListener('click', () => {
      this.lab.reset({ seed: true });
      this.renderAll();
    });
    this.el.querySelector('#diff-frame').addEventListener('click', () => this.h.frameView?.());

    this.renderPresets();
    this.loadPreset(PRESETS[0].id);
  }

  loadPreset(id) {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
    this.presetId = p.id;
    Object.assign(this.lab.params, p.params);
    this.lab.reset({ seed: true });
    this.renderAll();
  }

  togglePause() {
    this.lab.togglePause();
    this.syncPause();
    this.renderLive();
    return this.lab.params.paused;
  }

  syncMedium() {
    this.el.querySelectorAll('#diff-medium [data-m]').forEach((b) => {
      b.classList.toggle('active', b.dataset.m === this.lab.params.medium);
    });
  }

  syncPause() {
    const b = this.el.querySelector('#diff-pause');
    if (!b) return;
    if (this.lab.params.paused) {
      b.textContent = 'Resume';
      b.classList.add('active');
    } else {
      b.textContent = 'Pause';
      b.classList.remove('active');
    }
  }

  renderAll() {
    this.renderPresets();
    this.renderBlurb();
    this.renderParams();
    this.renderLeaks();
    this.renderLive();
    this.renderAnalysis();
    this.syncMedium();
    this.syncPause();
  }

  renderPresets() {
    const grid = this.el.querySelector('#diff-presets');
    grid.innerHTML = '';
    for (const p of PRESETS) {
      const b = document.createElement('button');
      b.className = 'preset-chip' + (this.presetId === p.id ? ' active' : '');
      b.innerHTML = `<span class="pc-name">${p.name}</span>`;
      b.title = p.blurb;
      b.addEventListener('click', () => this.loadPreset(p.id));
      grid.appendChild(b);
    }
  }

  renderBlurb() {
    const p = PRESETS.find((x) => x.id === this.presetId);
    const el = this.el.querySelector('#diff-blurb');
    if (!p) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="fb-head">
        <span class="fb-fam">${this.lab.params.medium === 'liquid' ? 'Liquid' : 'Gas'}</span>
        <span class="fb-kind">enclosed</span>
      </div>
      <p>${p.blurb}</p>
    `;
  }

  _addRange(box, key, label, val, min, max, step) {
    const row = document.createElement('div');
    row.className = 'spm-row';
    row.innerHTML = `
      <label>${label}</label>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-k="${key}" />
      <span class="spm-val" data-v="${key}">${Number.isInteger(step) ? Math.round(val) : fmt(val, 3)}</span>
    `;
    const input = row.querySelector('input');
    input.addEventListener('input', () => {
      let v = Number(input.value);
      if (key === 'gridSize') v = Math.round(v);
      this.lab.setParam(key, v);
      row.querySelector(`[data-v="${key}"]`).textContent =
        Number.isInteger(step) ? Math.round(v) : fmt(v, 3);
      this.renderLive();
      this.renderAnalysis();
      if (key === 'holeSize' || key === 'holeCenter') this.renderAnalysis();
    });
    box.appendChild(row);
  }

  _addCheck(box, key, label) {
    const row = document.createElement('div');
    row.className = 'spm-row check-row';
    row.innerHTML = `<label><input type="checkbox" ${this.lab.params[key] ? 'checked' : ''}/> ${label}</label>`;
    row.querySelector('input').addEventListener('change', (e) => {
      this.lab.setParam(key, e.target.checked);
      this.renderLive();
      this.renderAnalysis();
      if (key === 'leaks') this.renderLeaks();
    });
    box.appendChild(row);
  }

  renderParams() {
    const box = this.el.querySelector('#diff-params');
    box.innerHTML = '';
    const p = this.lab.params;
    this._addRange(box, 'DScale', 'D multiplier', p.DScale ?? 1, 0.25, 3, 0.01);
    this._addRange(box, 'speed', 'Sim speed', p.speed ?? 1, 0.2, 3, 0.05);
    this._addRange(box, 'sourceRate', 'Source rate', p.sourceRate ?? 0, 0, 1.5, 0.01);
    this._addRange(box, 'sourceX', 'Source X', p.sourceX ?? 0.5, 0.08, 0.92, 0.01);
    this._addRange(box, 'sourceY', 'Source Y', p.sourceY ?? 0.35, 0.08, 0.92, 0.01);
    this._addRange(box, 'injectAmount', 'Click inject', p.injectAmount ?? 1, 0.2, 3, 0.05);
    this._addCheck(box, 'showReflection', 'Show wall reflections');
    this._addCheck(box, 'contour', 'Concentration contours');
  }

  renderLeaks() {
    const box = this.el.querySelector('#diff-leaks');
    box.innerHTML = '';
    const p = this.lab.params;
    this._addCheck(box, 'leaks', 'Enable leaks (open holes)');

    if (!p.leaks) {
      const note = document.createElement('p');
      note.className = 'lab-note';
      note.textContent = 'Room is fully enclosed. Enable leaks to open a hole and drain mass.';
      box.appendChild(note);
      return;
    }

    this._addRange(box, 'holeSize', 'Hole size', p.holeSize ?? 0.14, 0.04, 0.5, 0.01);
    this._addRange(box, 'holeCenter', 'Hole position', p.holeCenter ?? 0.5, 0.15, 0.85, 0.01);

    const wallRow = document.createElement('div');
    wallRow.className = 'spm-row';
    const walls = ['right', 'left', 'bottom', 'top'];
    const cur = (p.holeWalls || ['right'])[0];
    wallRow.innerHTML = `
      <label>Hole wall</label>
      <select>${walls.map((w) =>
        `<option value="${w}" ${w === cur ? 'selected' : ''}>${w}</option>`).join('')}</select>`;
    wallRow.querySelector('select').addEventListener('change', (e) => {
      this.lab.setParam('holeWalls', [e.target.value]);
      this.renderLive();
      this.renderAnalysis();
    });
    box.appendChild(wallRow);

    const multi = document.createElement('div');
    multi.className = 'spm-row check-row';
    const isMulti = (p.holeWalls || []).length > 1;
    multi.innerHTML = `<label><input type="checkbox" ${isMulti ? 'checked' : ''}/> Opposite wall too</label>`;
    multi.querySelector('input').addEventListener('change', (e) => {
      const primary = (p.holeWalls || ['right'])[0];
      const opposite = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' }[primary];
      this.lab.setParam('holeWalls', e.target.checked ? [primary, opposite] : [primary]);
      this.renderLive();
      this.renderAnalysis();
    });
    box.appendChild(multi);
  }

  renderLive() {
    const a = this.lab.analysis();
    const el = this.el.querySelector('#diff-live');
    el.innerHTML = `
      <div class="kv"><span>Medium</span><b>${a.mediumLabel}</b></div>
      <div class="kv"><span>Diffusivity D</span><b>${fmt(a.D)}</b></div>
      <div class="kv"><span>Time</span><b>${fmt(a.time, 2)} s</b></div>
      <div class="kv"><span>Spread (RMS)</span><b>${fmt(a.spread)}</b></div>
      <div class="kv"><span>Total mass</span><b>${fmt(a.total, 1)}</b></div>
      <div class="kv"><span>Mass lost</span><b>${fmt(a.massLost, 1)}</b></div>
      <div class="kv"><span>State</span><b>${a.paused ? 'paused' : 'running'}</b></div>
    `;
  }

  renderAnalysis() {
    const a = this.lab.analysis();
    const el = this.el.querySelector('#diff-analysis');
    const walls = (a.holeWalls || []).join(', ') || 'none';
    el.innerHTML = `
      <div class="kv"><span>Model</span><b>Fick · ∂c/∂t = D ∇²c</b></div>
      <div class="kv"><span>Boundaries</span><b>reflective walls (Neumann)</b></div>
      <div class="kv"><span>Advection</span><b>${a.driftY >= 0 ? 'buoyant rise' : 'settling'}</b></div>
      <div class="kv"><span>Leaks</span><b>${a.leaks ? `on · ${walls} · Ø${(a.holeSize * 100).toFixed(0)}%` : 'sealed'}</b></div>
      <div class="kv"><span>Leak rate</span><b>${fmt(a.leakRate, 2)} / s</b></div>
      <div class="kv"><span>Wall pressure</span><b>${fmt(a.wallHits, 2)}</b></div>
      <p class="lab-note" style="margin-top:8px">In a sealed room the plume reflects: concentration
      piles at walls and redistributes. Open a hole to vent; larger holes drain faster and
      weaken reflected buildup nearby.</p>
    `;
  }

  tick(dt) {
    this.liveAcc += dt;
    if (this.liveAcc < 0.2) return;
    this.liveAcc = 0;
    if (this.el.classList.contains('hidden')) return;
    this.renderLive();
  }
}
