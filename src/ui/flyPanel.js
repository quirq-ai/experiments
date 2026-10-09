import { FlyLearn } from './flyLearn.js';

const STAGES = [
  { id: 'create', title: 'Create', eyebrow: '01 / THE SPECIMEN', heading: 'Small wings.\nOpen possibilities.', description: 'Meet your explorer. Shape its inherited traits, then give it a world to learn.' },
  { id: 'train', title: 'Train', eyebrow: '02 / THE LEARNING CHAMBER', heading: 'Experience becomes\ninstinct.', description: 'Pair scent with reward. Watch a real learning process unfold, one flight at a time.' },
  { id: 'expedition', title: 'Expedition', eyebrow: '03 / SCENT SEEKERS', heading: 'Into the\nunknown.', description: 'Release a frozen policy into unseen worlds. Every flight is a new test.' },
  { id: 'compare', title: 'Compare', eyebrow: '04 / THE FIELD NOTES', heading: 'Follow the evidence.', description: 'Read the outcomes. Retrace a flight. Discover what experience changed.' },
];
const TRAITS = [
  { key: 'sensitivity', title: 'Scent sensitivity', min: .5, max: 2, step: .05, value: 1, unit: '×', help: 'Gain applied to the two odor channels.' },
  { key: 'memory', title: 'Sensory memory', min: .2, max: 5, step: .1, value: 1.4, unit: ' s', help: 'How long recent scent remains in sensory memory.' },
  { key: 'exploration', title: 'Exploration', min: .02, max: .4, step: .01, value: .12, unit: '', help: 'Initial probability of exploring a training action.' },
  { key: 'speed', title: 'Flight speed', min: .012, max: .035, step: .001, value: .023, unit: ' mm/s', help: 'Maximum self-propelled speed in the reduced body model.' },
];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = (value, places = 1) => Number.isFinite(Number(value)) && value !== null && value !== undefined ? Number(value).toFixed(places) : '—';
const pct = value => Number.isFinite(Number(value)) && value !== null && value !== undefined ? `${Math.round(Number(value) * 100)}%` : '—';
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const arrow = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>';
const icon = name => ({
  frame: '<path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M7 10h6m-3-3v6"/>',
  scent: '<path d="M3 6c3-5 5 5 8 0s5 0 6 0M3 11c3-5 5 5 8 0s5 0 6 0M3 16c3-5 5 5 8 0s5 0 6 0"/>',
  anatomy: '<circle cx="6" cy="5" r="2"/><circle cx="14" cy="7" r="2"/><circle cx="7" cy="15" r="2"/><path d="m7.5 6.4 5 0M7 7l0 6m1.5 1 4-5"/>',
  camera: '<path d="M3 6h4l1-2h4l1 2h4v11H3Z"/><circle cx="10" cy="11" r="3"/>',
}[name] || '');

/** DOM-only presentation. Authoritative learning, simulation and records live in FlySession. */
export class FlyPanel {
  constructor(session, { frameView, snapshot } = {}) {
    this.session = session;
    this.hooks = { frameView, snapshot };
    this.el = document.getElementById('fly-panel');
    if (!this.el) throw new Error('FlyPanel requires #fly-panel');
    this.state = session.state || {};
    this.local = { curriculum: 'varied', episodes: 200, scenario: 'orchard', seed: 41001, count: 12, benchmark: true };
    this.stageKey = '';
    this.chartKey = '';
    this.reportKey = '';
    this.liveAccumulator = 0;
    this.build();
    this.unsubscribe = session.subscribe(state => this.render(state || session.state));
  }

  build() {
    this.el.classList.add('fly-shell');
    this.el.innerHTML = `
      <nav class="fly-steps" aria-label="Fly lab workflow">${STAGES.map((stage, i) => `<button type="button" data-stage="${stage.id}"><span class="fly-step-index">0${i + 1}</span>${stage.title}<span class="fly-step-line"></span></button>`).join('')}</nav>
      <header class="fly-heading"><div class="fly-eyebrow" data-fly="eyebrow"></div><h1 data-fly="heading"></h1><p data-fly="description"></p></header>
      <section class="fly-console" aria-label="Experiment controls">
        <div class="fly-console-brand"><span class="fly-lab-mark"><i></i><i></i><i></i></span><span>FLY EXPEDITION LAB</span><span class="fly-version">01</span></div>
        <button type="button" class="fly-workspace-entry" data-action="tasks" aria-haspopup="dialog"><span><small>NEW / WORKSPACE SKILLS</small><strong>Train a working fly</strong><em>Teach with files. Test. Export its brain.</em></span><b aria-hidden="true">↗</b></button>
        <div class="fly-specimen-select"><label for="fly-specimen">YOUR COLLECTION</label><div class="fly-roster-row"><select id="fly-specimen" aria-label="Select specimen"></select><button class="fly-icon-button" data-action="clone" title="Clone the selected specimen" aria-label="Clone specimen">⧉</button></div><div class="fly-checkpoint" hidden><label for="fly-checkpoint">SAVED CHECKPOINT</label><select id="fly-checkpoint" aria-label="Restore saved checkpoint"></select></div><div class="fly-specimen-meta"><span data-fly="specimen-id"></span><span data-fly="specimen-status"></span></div></div>
        <div class="fly-stage-content"></div><div class="fly-saved-jobs" data-fly="saved-jobs" hidden></div>
        <div class="fly-job" hidden aria-live="polite"><div class="fly-job-heading"><span data-fly="job-label"></span><span data-fly="job-count"></span></div><progress max="100" value="0" aria-label="Experiment progress"></progress><div class="fly-job-actions"><button class="fly-text-button" data-action="pause">Pause</button><button class="fly-text-button fly-muted" data-action="cancel">Cancel run</button></div></div>
        <p class="fly-message" data-fly="message" role="status" hidden></p>
        <div class="fly-console-footer"><span><i class="fly-status-dot"></i> LOCAL EXPERIMENT</span><button class="fly-text-button" data-action="export">Export</button><button class="fly-text-button" data-action="import">Import</button><input type="file" id="fly-import" accept="application/json,.json" hidden></div>
      </section>
      <aside class="fly-telemetry" aria-label="Live sensory readings">
        <div class="fly-instrument-title"><i class="fly-status-dot"></i><span data-fly="telemetry-title">SPECIMEN OBSERVATORY</span></div>
        <div class="fly-specimen-name" data-fly="specimen-name"></div><div class="fly-latin">Drosophila melanogaster</div>
        <div class="fly-sensor-group"><div class="fly-readout-label"><span>Reward scent</span><b data-fly="odor-a">—</b></div><div class="fly-sensor-track"><span data-fly="odor-a-bar"></span></div><div class="fly-readout-label"><span>Distractor scent</span><b data-fly="odor-b">—</b></div><div class="fly-sensor-track fly-amber"><span data-fly="odor-b-bar"></span></div></div>
        <dl class="fly-live-values"><div><dt>Flight time</dt><dd data-fly="time">—</dd></div><div><dt>Energy reserve</dt><dd data-fly="energy">—</dd></div><div><dt>Model action</dt><dd data-fly="action">—</dd></div></dl>
        <div class="fly-sensor-footnote">Live model observations<br>Odor shown in relative units</div>
      </aside>
      <div class="fly-world-caption"><span class="fly-crosshair">+</span><span data-fly="world-caption">SPECIMEN  /  MACRO VIEW</span></div>
      <div class="fly-bottom"><div class="fly-replay" hidden><div class="fly-replay-label"><span>FLIGHT RECORDER</span><span data-fly="replay-time">0 / 0</span></div><input id="fly-replay" type="range" min="0" max="0" value="0" aria-label="Replay frame"><div class="fly-replay-controls"><button class="fly-text-button" data-action="replay-play">Play replay</button><span>Recorded simulation samples</span></div></div><div class="fly-viewport-toolbar" aria-label="Viewport controls"><button data-action="frame" aria-label="Frame view"><svg viewBox="0 0 20 20" aria-hidden="true">${icon('frame')}</svg><span>Frame view</span></button><button data-action="overlay" aria-label="Scent field" aria-pressed="true"><svg viewBox="0 0 20 20" aria-hidden="true">${icon('scent')}</svg><span>Scent field</span></button><button data-action="anatomy" aria-label="Anatomy" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true">${icon('anatomy')}</svg><span>Anatomy</span></button><button data-action="snapshot" aria-label="Snapshot"><svg viewBox="0 0 20 20" aria-hidden="true">${icon('camera')}</svg><span>Snapshot</span></button></div></div>
      <details class="fly-provenance"><summary>Inspired by a complete connectome <span>↗</span></summary><div><strong>Measured anatomy. A reduced behavior model.</strong><p>Expeditions use a simplified learned controller and flight model. The anatomy view contains two measured descending neurons from MaleCNS v1.0 (DNge104 left/right, CC BY). It does not drive these flights or show neural activity. The SARSA controller uses engineered local odor and wind features; training also rewards distance progress. Expedition bodies are enlarged 2.6× for visibility.</p><a href="https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/" target="_blank" rel="noopener noreferrer">Read the research ↗</a><a href="https://male-cns.janelia.org/download/" target="_blank" rel="noopener noreferrer">MaleCNS data & provenance ↗</a></div></details>
    `;
    this.el.addEventListener('click', event => this.handleClick(event));
    this.el.addEventListener('change', event => this.handleChange(event));
    this.el.addEventListener('input', event => this.handleInput(event));
    this.el.addEventListener('submit', event => {
      if (event.target.id !== 'fly-create-form') return;
      event.preventDefault();
      const form = new FormData(event.target);
      const genome = Object.fromEntries(TRAITS.map(trait => [trait.key, Number(form.get(trait.key))]));
      this.invoke('createSpecimen', { name: String(form.get('name') || '').trim() || 'Aster', genome });
    });
  }

  invoke(method, ...args) {
    try {
      const result = this.session[method]?.(...args);
      if (result?.catch) result.catch(error => this.showError(error));
      return result;
    } catch (error) { this.showError(error); }
  }
  showError(error) {
    const el = this.find('message');
    el.hidden = false;
    el.classList.add('fly-is-error');
    el.textContent = error?.message || String(error);
  }
  find(key) { return this.el.querySelector(`[data-fly="${key}"]`); }
  text(key, value) { const el = this.find(key); if (el && el.textContent !== String(value)) el.textContent = value; }

  handleClick(event) {
    const stage = event.target.closest('button[data-stage]');
    if (stage) { this.replayPlaying = false; this.invoke('setStage', stage.dataset.stage); return; }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case 'learn':
        this.learn ||= new FlyLearn();
        this.learn.open(button);
        break;
      case 'tasks': this.openTasks(button); break;
      case 'clone': this.invoke('cloneSpecimen'); break;
      case 'train': this.invoke('train', { curriculum: this.local.curriculum, episodes: this.local.episodes }); break;
      case 'launch': this.invoke('launch', { scenario: this.local.scenario, seed: this.local.seed, count: this.local.count, benchmark: this.local.benchmark }); break;
      case 'pause': this.invoke('pause'); break;
      case 'cancel': this.invoke('cancel'); break;
      case 'frame': this.hooks.frameView?.(); break;
      case 'overlay': this.invoke('toggleOverlay'); break;
      case 'anatomy': this.invoke('toggleAnatomy'); break;
      case 'snapshot': this.hooks.snapshot?.(); break;
      case 'export': this.invoke('exportData'); break;
      case 'import': this.el.querySelector('#fly-import').click(); break;
      case 'replay-play': if ((this.state.replayIndex || 0) >= this.replayFrames().length - 1) this.invoke('setReplay', 0); this.invoke('pause'); break;
      case 'resume-saved': this.invoke('resumeSavedJob', button.dataset.jobId); break;
    }
    const curriculum = button.dataset.curriculum;
    if (curriculum) {
      this.local.curriculum = curriculum;
      this.el.querySelectorAll('[data-curriculum]').forEach(el => { el.classList.toggle('is-selected', el.dataset.curriculum === curriculum); el.setAttribute('aria-pressed', String(el.dataset.curriculum === curriculum)); });
    }
  }

  async openTasks(opener) {
    if (opener) opener.disabled = true;
    try {
      if (!this.tasks) {
        this.tasksLoading ||= Promise.all([import('./flyTasks.js'), import('../fly/tasks/session.js')]);
        const [{ FlyTasks }, { TaskTrainingSession }] = await this.tasksLoading;
        if (!this.tasks) { this.taskSession = new TaskTrainingSession(); this.tasks = new FlyTasks(this.taskSession); }
      }
      if (!this.el.classList.contains('hidden')) this.tasks.open(opener);
    } catch (error) { this.tasksLoading = null; this.showError(error); }
    finally { if (opener) opener.disabled = false; }
  }

  handleChange(event) {
    const input = event.target;
    if (input.id === 'fly-specimen') this.invoke('selectSpecimen', input.value);
    if (input.id === 'fly-checkpoint') this.invoke('selectCheckpoint', input.value);
    if (input.id === 'fly-run') this.invoke('selectRun', Number(input.value));
    if (input.id === 'fly-import' && input.files[0]) { this.invoke('importData', input.files[0]); input.value = ''; }
    if (input.id === 'fly-curriculum') this.local.curriculum = input.value;
    if (input.id === 'fly-episodes') this.local.episodes = Number(input.value);
    if (input.id === 'fly-scenario') this.local.scenario = input.value;
    if (input.id === 'fly-seed') this.local.seed = Math.max(1, Math.min(2147483647, Math.round(Number(input.value) || 41001)));
    if (input.id === 'fly-count') this.local.count = Number(input.value);
    if (input.id === 'fly-benchmark') this.local.benchmark = input.checked;
  }

  handleInput(event) {
    const input = event.target;
    if (input.dataset.trait) {
      const trait = TRAITS.find(t => t.key === input.dataset.trait);
      const output = this.el.querySelector(`[data-trait-output="${trait.key}"]`);
      output.textContent = this.formatTrait(trait, Number(input.value));
      this.fillRange(input);
    }
    if (input.id === 'fly-replay') { this.replayPlaying = false; this.invoke('setReplay', Number(input.value)); }
  }

  formatTrait(trait, value) {
    return (trait.key === 'speed' ? number(value * 1000, 0) : number(value, trait.key === 'exploration' ? 2 : 1)) + trait.unit;
  }
  fillRange(input) { input.style.setProperty('--range-fill', `${(Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min) || 1) * 100}%`); }

  render(state) {
    this.state = state || {};
    const stageId = this.state.stage || 'create';
    const stage = STAGES.find(item => item.id === stageId) || STAGES[0];
    const specimen = this.state.specimen || this.state.specimens?.find(item => item.id === this.state.selectedId);
    this.el.dataset.stage = stage.id;
    this.el.querySelectorAll('[data-stage]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.stage === stage.id);
      if (button.dataset.stage === stage.id) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    this.text('eyebrow', stage.eyebrow);
    this.text('heading', stage.heading);
    this.text('description', stage.description);
    this.text('specimen-name', (stage.id === 'compare' ? this.state.report?.specimenName : null) || specimen?.name || 'Your next explorer');
    this.text('specimen-id', specimen?.id ? `ID ${String(specimen.id).slice(-8).toUpperCase()}` : 'NO SPECIMEN SELECTED');
    const episodes = specimen?.training?.episodes || 0;
    this.text('specimen-status', episodes ? `${episodes.toLocaleString()} trials learned` : 'Naive controller');
    const roster = this.el.querySelector('#fly-specimen');
    const rosterKey = JSON.stringify((this.state.specimens || []).map(s => [s.id, s.name]));
    if (rosterKey !== this.rosterKey) {
      this.rosterKey = rosterKey;
      roster.innerHTML = (this.state.specimens || []).map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('') || '<option value="">Create your first specimen</option>';
    }
    roster.value = this.state.selectedId || specimen?.id || '';
    roster.disabled = Boolean(this.state.job);
    this.el.querySelector('[data-action="clone"]').disabled = !specimen || Boolean(this.state.job);
    const stageKey = `${stage.id}:${specimen?.id || ''}`;
    if (stageKey !== this.stageKey) {
      this.stageKey = stageKey;
      this.chartKey = '';
      this.reportKey = '';
      this.renderStage(stage.id, specimen);
    }
    this.el.querySelectorAll('[data-job-lock]').forEach(button => { button.disabled = Boolean(this.state.job) || (button.dataset.requiresSpecimen !== undefined && !specimen); });
    this.renderCheckpoints(specimen);
    this.renderSavedJobs();
    this.renderJob();
    this.renderHistory();
    this.renderReport();
    this.renderRunPicker();
    this.renderReplay();
    const message = this.find('message');
    const messageText = this.state.error || this.state.notice;
    message.hidden = !messageText;
    message.classList.toggle('fly-is-error', Boolean(this.state.error));
    message.textContent = typeof messageText === 'string' ? messageText : messageText?.message || '';
    this.el.querySelector('[data-action="overlay"]').setAttribute('aria-pressed', String(this.state.overlays !== false));
    this.el.querySelector('[data-action="anatomy"]').setAttribute('aria-pressed', String(Boolean(this.state.anatomy)));
    this.text('world-caption', this.state.anatomy ? 'MALECNS / MEASURED ANATOMY SAMPLE' : ({ create: 'SPECIMEN / MACRO VIEW', train: 'REWARD CHAMBER / ACCELERATED TRIALS', expedition: this.state.snapshot?.scenario === 'wind-shift' ? 'CHANGING WORLD / WIND SHIFT' : 'ORCHARD / UNSEEN TERRAIN', compare: 'FLIGHT RECORDER / OBSERVED TRAJECTORY' })[stage.id]);
    this.renderLive();
  }

  renderStage(stage, specimen) {
    this.el.querySelector('.fly-console').scrollTop = 0;
    const content = this.el.querySelector('.fly-stage-content');
    if (stage === 'create') {
      content.innerHTML = `<div class="fly-section-heading"><h2>Create a specimen</h2><span>INHERITED TRAITS</span></div><p class="fly-section-note">Every explorer starts with a different disposition.</p><form id="fly-create-form"><label class="fly-field-label" for="fly-name">Specimen name</label><input id="fly-name" name="name" type="text" maxlength="40" value="${esc(this.nextName())}" placeholder="Give your explorer a name" required autocomplete="off">${TRAITS.map(trait => { const value = specimen?.genome?.[trait.key] ?? trait.value; return `<div class="fly-trait"><div><label for="fly-trait-${trait.key}">${trait.title}</label><output data-trait-output="${trait.key}" for="fly-trait-${trait.key}">${this.formatTrait(trait, value)}</output></div><input id="fly-trait-${trait.key}" data-trait="${trait.key}" name="${trait.key}" type="range" min="${trait.min}" max="${trait.max}" step="${trait.step}" value="${value}" title="${trait.help}"><div class="fly-trait-scale"><span>${this.formatTrait(trait, trait.min)}</span><span>${this.formatTrait(trait, trait.max)}</span></div></div>`; }).join('')}<button class="fly-primary" type="submit" data-job-lock>Create specimen ${arrow}</button></form><button class="fly-secondary fly-full" data-stage="train" data-job-lock data-requires-specimen>Continue with ${esc(specimen?.name || 'selected specimen')} ${arrow}</button><p class="fly-fine-print">Traits are model parameters. Creating a specimen starts fresh learned weights.</p>`;
      content.querySelectorAll('input[type="range"]').forEach(input => this.fillRange(input));
    }
    if (stage === 'train') {
      content.innerHTML = `<button type="button" class="fly-learn-entry" data-action="learn" aria-label="Learn how the fly works" aria-haspopup="dialog"><span><strong>Learn</strong><small>The fly, its control loop, and how to teach it.<br>Explore the model & commands.</small></span><span aria-hidden="true">↗</span></button><div class="fly-section-heading"><h2>A little experience</h2><span>TRAINING CURRICULUM</span></div><p class="fly-section-note">Food arrivals and progress toward the source reinforce useful actions. Flight costs reward efficiency.</p><div class="fly-curricula" role="group" aria-label="Training curriculum"><button class="fly-curriculum ${this.local.curriculum === 'steady' ? 'is-selected' : ''}" data-action="curriculum" data-curriculum="steady" aria-pressed="${this.local.curriculum === 'steady'}"><span class="fly-curriculum-symbol">↗</span><span><strong>Steady wind</strong><small>A predictable scent trail</small></span><i></i></button><button class="fly-curriculum ${this.local.curriculum === 'varied' ? 'is-selected' : ''}" data-action="curriculum" data-curriculum="varied" aria-pressed="${this.local.curriculum === 'varied'}"><span class="fly-curriculum-symbol">⌁</span><span><strong>Variable wind</strong><small>Learn across changing conditions</small></span><i></i></button></div><label class="fly-field-label" for="fly-episodes">Training budget</label><select id="fly-episodes">${[100, 200, 500, 1000].map(n => `<option value="${n}" ${this.local.episodes === n ? 'selected' : ''}>${n.toLocaleString()} episodes</option>`).join('')}</select><button class="fly-primary" data-action="train" data-job-lock data-requires-specimen>Begin training ${arrow}</button><div class="fly-chart-section"><div class="fly-section-heading"><h3>Last training record</h3><span data-fly="history-count">NO TRIALS YET</span></div><div data-fly="learning-chart" class="fly-learning-chart"></div><div class="fly-chart-legend"><span><i></i>Mean reward / trial window</span><b data-fly="reward-latest">—</b></div></div><button class="fly-secondary fly-full" data-stage="expedition" data-job-lock data-requires-specimen>Prepare an expedition ${arrow}</button><p class="fly-fine-print">Training seeds and expedition seeds are separate. Acquired weights are saved with this specimen.</p>`;
    }
    if (stage === 'expedition') {
      content.innerHTML = `<div class="fly-section-heading"><h2>Beyond the chamber</h2><span>MISSION PARAMETERS</span></div><p class="fly-section-note">Find the rewarding fruit. Ignore the distractor. Make the energy last.</p><label class="fly-field-label" for="fly-scenario">Expedition habitat</label><select id="fly-scenario"><option value="orchard" ${this.local.scenario === 'orchard' ? 'selected' : ''}>Scent Seekers · the orchard</option><option value="wind-shift" ${this.local.scenario === 'wind-shift' ? 'selected' : ''}>Changing World · wind shift</option></select><div class="fly-mission-map" aria-hidden="true"><svg viewBox="0 0 244 78"><defs><pattern id="fly-map-grid" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#869d87" opacity=".3"/></pattern></defs><rect width="244" height="78" fill="url(#fly-map-grid)"/><path d="M16 58c32-55 45 22 81-15s51 17 70-21 34 0 57-11" fill="none" stroke="#aec1a2" stroke-width="1.2" stroke-dasharray="3 4"/><circle cx="18" cy="57" r="4" fill="#e9dfc9"/><circle cx="171" cy="20" r="5" fill="#b4c59a"/><circle cx="171" cy="20" r="13" fill="none" stroke="#b4c59a" opacity=".25"/><circle cx="211" cy="57" r="4" fill="#cba270"/></svg><span>Unseen worlds. Matched conditions.</span></div><div class="fly-field-pair"><div><label class="fly-field-label" for="fly-seed">World seed</label><input id="fly-seed" type="number" min="1" max="2147483647" step="1" value="${this.local.seed}"></div><div><label class="fly-field-label" for="fly-count">Trials</label><select id="fly-count">${[12, 24, 50, 100].map(n => `<option value="${n}" ${this.local.count === n ? 'selected' : ''}>${n} flights</option>`).join('')}</select></div></div><label class="fly-checkbox"><input id="fly-benchmark" type="checkbox" ${this.local.benchmark ? 'checked' : ''}><span><strong>Include matched controls</strong><small>Untrained & reactive scent followers</small></span></label><button class="fly-primary" data-action="launch" data-job-lock data-requires-specimen>Launch expedition ${arrow}</button><div class="fly-mission-rules"><div><span>LEARNING</span><b>Frozen during evaluation</b></div><div><span>CONDITIONS</span><b>Independent matched worlds</b></div><div><span>OBJECTIVE</span><b>Arrive at the rewarding source</b></div></div><p class="fly-fine-print">Changing World rotates the wind during a flight. The same controller and experiment engine handle both habitats.</p>`;
    }
    if (stage === 'compare') {
      content.innerHTML = `<div class="fly-section-heading"><h2>What the flights reveal</h2><span>EXPEDITION RESULTS</span></div><div data-fly="report"></div><div class="fly-run-picker" hidden><label class="fly-field-label" for="fly-run">Inspect a recorded flight</label><select id="fly-run"></select></div><button class="fly-secondary fly-full" data-stage="expedition" data-job-lock data-requires-specimen>Run another expedition ${arrow}</button><button class="fly-text-button fly-export-result" data-action="export">Export specimens & results ↗</button><p class="fly-fine-print">Results describe this reduced simulation. Paths and sensory readings come from recorded flights.</p>`;
    }
  }

  nextName() {
    const names = ['Aster', 'Fern', 'Moss', 'Clover', 'Juniper', 'Sage', 'Willow', 'Basil', 'Iris', 'Cedar'];
    const count = this.state.specimens?.length || 0;
    return names[count % names.length] + (count >= names.length ? ` ${Math.floor(count / names.length) + 1}` : '');
  }

  renderCheckpoints(specimen) {
    const checkpoints = specimen?.checkpoints || [];
    const box = this.el.querySelector('.fly-checkpoint');
    box.hidden = !checkpoints.length;
    const select = box.querySelector('select');
    const key = checkpoints.map(item => item.id).join(':');
    if (key !== this.checkpointKey) {
      this.checkpointKey = key;
      select.innerHTML = checkpoints.map(item => `<option value="${esc(item.id)}">${number(item.episodes, 0)} trials · ${esc(item.curriculum === 'varied' ? 'variable wind' : 'steady wind')}</option>`).join('');
    }
    select.value = checkpoints.findLast(item => item.episodes === specimen?.training?.episodes && item.curriculum === specimen?.training?.curriculum)?.id || checkpoints.at(-1)?.id || '';
    select.disabled = Boolean(this.state.job);
  }

  renderSavedJobs() {
    const jobs = this.state.savedJobs || [];
    const box = this.find('saved-jobs');
    box.hidden = !jobs.length || Boolean(this.state.job);
    const key = jobs.map(job => job.id).join(':');
    if (key === this.savedJobKey) return;
    this.savedJobKey = key;
    box.innerHTML = jobs.map(job => `<div><span>Saved training session</span><button class="fly-text-button" data-action="resume-saved" data-job-id="${esc(job.id)}">Resume ↗</button></div>`).join('');
  }

  renderRunPicker() {
    const select = this.el.querySelector('#fly-run');
    if (!select) return;
    const runs = this.state.runs || [];
    select.parentElement.hidden = !runs.length;
    const key = runs.map(run => `${run.manifest?.seed}:${run.summary?.success}`).join('|');
    if (key !== this.runPickerKey || !select.options.length) {
      this.runPickerKey = key;
      select.innerHTML = runs.map((run, i) => `<option value="${i}">Flight ${i + 1} · ${run.summary?.success ? 'arrived' : 'incomplete'} · ${number(run.summary?.duration, 1)} s</option>`).join('');
    }
    select.value = String(this.state.runIndex || 0);
  }

  renderJob() {
    const job = this.state.job;
    const box = this.el.querySelector('.fly-job');
    box.hidden = !job;
    if (!job) return;
    this.text('job-label', this.state.paused ? 'Experiment paused' : String(job.type || '').includes('train') ? 'Learning in progress' : 'Flights in progress');
    this.text('job-count', `${job.completed || 0} / ${job.total || '—'}`);
    box.querySelector('progress').value = job.total ? clamp(job.completed / job.total) * 100 : 0;
    box.querySelector('[data-action="pause"]').textContent = this.state.paused ? 'Resume' : 'Pause';
  }

  renderHistory() {
    const chart = this.find('learning-chart');
    if (!chart) return;
    const history = this.state.history || [];
    const key = `${history.length}:${history.at(-1)?.episode}:${history.at(-1)?.reward}`;
    if (key === this.chartKey) return;
    this.chartKey = key;
    this.text('history-count', history.length ? `${number(history.at(-1)?.episode ?? history.length, 0)} EPISODES` : 'NO TRIALS YET');
    if (!history.length) {
      chart.innerHTML = '<div class="fly-chart-empty"><span>Experience leaves a trace.</span><small>Your learning curve will appear here.</small></div>';
      this.text('reward-latest', '—');
      return;
    }
    const finite = history.filter(point => Number.isFinite(Number(point.reward)));
    if (!finite.length) return;
    const stride = Math.max(1, Math.ceil(finite.length / 45));
    const points = [];
    for (let i = 0; i < finite.length; i += stride) {
      const slice = finite.slice(i, i + stride);
      points.push({ x: slice.at(-1).episode ?? i + slice.length, y: slice.reduce((sum, p) => sum + Number(p.reward), 0) / slice.length });
    }
    const min = Math.min(0, ...points.map(p => p.y));
    const max = Math.max(1, ...points.map(p => p.y));
    const xMax = points.at(-1).x || points.length;
    const y = value => 80 - (value - min) / (max - min) * 64;
    const coords = points.map((p, i) => `${points.length === 1 ? 18 : 18 + (p.x / xMax) * 214},${y(p.y)}`);
    const line = `M${coords.join('L')}`;
    chart.innerHTML = `<svg viewBox="0 0 250 108" role="img" aria-label="Mean training rewards from ${history.length} recorded trials"><defs><linearGradient id="fly-reward-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#b4c79d" stop-opacity=".22"/><stop offset="100%" stop-color="#b4c79d" stop-opacity="0"/></linearGradient></defs><path d="M18 16H232M18 48H232M18 80H232" stroke="#e8e0c8" stroke-opacity=".09" stroke-width="1"/><text x="0" y="19">${number(max, 0)}</text><text x="0" y="83">${number(min, 0)}</text><path d="${line}L${coords.at(-1).split(',')[0]},84L${coords[0].split(',')[0]},84Z" fill="url(#fly-reward-fill)"/><path d="${line}" fill="none" stroke="#c0cfae" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${coords.at(-1).split(',')[0]}" cy="${coords.at(-1).split(',')[1]}" r="3" fill="#d5dfbe"/><text x="18" y="102">0</text><text x="232" y="102" text-anchor="end">${number(xMax, 0)} trials</text></svg>`;
    this.text('reward-latest', number(points.at(-1).y, 2));
  }

  renderReport() {
    const container = this.find('report');
    if (!container) return;
    const report = this.state.report;
    const key = JSON.stringify(report);
    if (key === this.reportKey) return;
    this.reportKey = key;
    if (!report) {
      container.innerHTML = '<div class="fly-empty-report"><span class="fly-empty-orbit"></span><h3>A world of questions.</h3><p>Launch an expedition to collect your first field notes.</p></div>';
      return;
    }
    const summary = report.summary || report;
    const count = summary.count ?? summary.total ?? 0;
    const successes = summary.successes ?? Math.round((summary.successRate || 0) * count);
    const successRate = summary.successRate ?? (count ? successes / count : 0);
    const comparisons = summary.comparisons || report.comparisons || [];
    const comparisonRows = Array.isArray(comparisons) ? comparisons : Object.entries(comparisons).map(([name, data]) => ({ name, ...(typeof data === 'object' ? data : { successRate: data }) }));
    const outcomes = this.state.runs || [];
    const flights = outcomes.filter(run => run.summary).slice(-50);
    const failureCount = count - successes;
    container.innerHTML = `<div class="fly-report-source">${esc(report.specimenName || this.state.specimen?.name || 'Specimen')} · ${report.scenario === 'wind-shift' ? 'Wind shift' : 'Orchard'} · seed ${esc(report.seed ?? '—')}</div><div class="fly-result-hero"><span class="fly-result-value">${pct(successRate)}</span><div><strong>found the source</strong><span>${successes} arrivals / ${count} flights</span>${summary.confidence95 ? `<span class="fly-confidence">95% CI ${pct(summary.confidence95[0])}–${pct(summary.confidence95[1])}</span>` : ''}</div></div><div class="fly-outcome-bar" aria-label="${successes} successes and ${failureCount} unsuccessful flights"><span style="width:${clamp(successRate) * 100}%"></span></div><div class="fly-outcome-key"><span><i></i>${successes} arrived</span><span>${failureCount} incomplete</span></div><dl class="fly-result-metrics"><div><dt>Mean flight time</dt><dd>${number((summary.meanDuration ?? summary.meanTime))} <small>s</small></dd></div><div><dt>Mean path length</dt><dd>${number(Number(summary.meanPathLength ?? summary.meanDistance) * 1000, 0)} <small>mm</small></dd></div><div><dt>Mean energy used</dt><dd>${pct(summary.meanEnergyUsed ?? summary.meanEnergy)}</dd></div><div><dt>Mean collisions</dt><dd>${number(summary.meanCollisions ?? summary.collisions, 1)}</dd></div></dl>${comparisonRows.length ? `<div class="fly-comparisons"><div class="fly-section-heading"><h3>Matched conditions</h3><span>ARRIVAL RATE</span></div>${comparisonRows.map((row, i) => { const data = row.summary || row; const rate = data.successRate ?? (data.count ? data.successes / data.count : 0); return `<div class="fly-comparison"><div><span>${esc(row.name || row.label || row.condition || ['Trained', 'Untrained', 'Reactive'][i] || 'Control')}</span><b>${pct(rate)}</b></div><div class="fly-comparison-caption">${data.successes ?? Math.round(rate * (data.count || 0))} / ${data.count || 0} arrived${data.confidence95 ? ` · CI ${pct(data.confidence95[0])}–${pct(data.confidence95[1])}` : ''}</div><div class="fly-comparison-track"><span style="width:${clamp(rate) * 100}%"></span></div></div>`; }).join('')}</div>` : ''}${flights.length ? `<div class="fly-flight-record-label">${flights.length} RECORDED FLIGHT SAMPLES</div><div class="fly-flight-dots" aria-label="Recorded flight outcomes">${flights.map((run, i) => `<span class="${run.summary.success || run.summary.successes > 0 ? 'is-success' : ''}" title="Flight ${i + 1}: ${run.summary.success || run.summary.successes > 0 ? 'arrived' : 'incomplete'}"></span>`).join('')}</div>` : ''}<p class="fly-fine-print">${count < 50 ? 'Exploratory batch. Increase to 50 or more trials for a stronger comparison. ' : ''}Flight time and distance include unsuccessful trials. Energy is a normalized model budget. Interval: 95% Wilson.</p>`;
  }

  replayFrames() {
    if (Array.isArray(this.state.replayFrames)) return this.state.replayFrames;
    const run = this.state.runs?.[this.state.runIndex || 0];
    return run?.frames || this.state.report?.frames || [];
  }
  renderReplay() {
    const frames = this.replayFrames();
    const box = this.el.querySelector('.fly-replay');
    box.hidden = this.state.stage !== 'compare' || !frames.length;
    const range = this.el.querySelector('#fly-replay');
    range.max = Math.max(0, frames.length - 1);
    range.value = Math.min(this.state.replayIndex || 0, frames.length - 1);
    this.fillRange(range);
    const frame = frames[this.state.replayIndex || 0];
    this.text('replay-time', `${number(frame?.time ?? frame?.t ?? (this.state.replayIndex || 0), 1)} ${frame?.time != null || frame?.t != null ? 's' : '/ ' + Math.max(0, frames.length - 1)}`);
    box.querySelector('[data-action="replay-play"]').textContent = this.state.paused ? 'Play replay' : 'Pause replay';
  }

  renderLive() {
    const snapshot = this.state.snapshot;
    const fly = snapshot?.agent || snapshot?.fly || snapshot?.agents?.[0] || snapshot?.flies?.[0] || snapshot?.body || {};
    const observations = fly.observation || fly.sensors || snapshot?.observation || snapshot?.sensors || {};
    const odor = observations.odor || observations.odors || fly.odor || [];
    const odorA = observations.odorA ?? observations.rewardOdor ?? odor[0] ?? snapshot?.odorA;
    const odorB = observations.odorB ?? observations.distractorOdor ?? odor[1] ?? snapshot?.odorB;
    this.text('odor-a', number(odorA, 2));
    this.text('odor-b', number(odorB, 2));
    this.find('odor-a-bar').style.width = `${clamp(odorA) * 100}%`;
    this.find('odor-b-bar').style.width = `${clamp(odorB) * 100}%`;
    this.text('energy', pct(fly.energy ?? snapshot?.energy));
    this.text('time', snapshot ? `${number(snapshot.time ?? snapshot.t ?? fly.time, 1)} s` : '—');
    const action = fly.action ?? observations.action ?? snapshot?.action;
    this.text('action', typeof action === 'string' ? action.replaceAll('-', ' ') : Number.isFinite(action) ? ['Turn left', 'Straight', 'Turn right'][action] || `Action ${action}` : '—');
    this.text('telemetry-title', this.state.job ? this.state.paused ? 'EXPERIMENT PAUSED' : 'LIVE MODEL TELEMETRY' : this.state.stage === 'compare' ? 'RECORDED OBSERVATIONS' : 'SPECIMEN OBSERVATORY');
  }

  tick(dt) {
    this.liveAccumulator += Math.min(dt || 0, .1);
    if (this.liveAccumulator < .08) return;
    this.liveAccumulator = 0;
    this.renderLive();
  }
  show() {
    this.el.classList.remove('hidden'); this.render(this.session.state);
    if (!this.taskDeepLinkOpened && new URLSearchParams(window.location.search).get('studio') === 'workspace') {
      this.taskDeepLinkOpened = true; this.openTasks(this.el.querySelector('[data-action="tasks"]'));
    }
  }
  hide() { this.tasks?.close(); this.learn?.close(); this.el.classList.add('hidden'); this.replayPlaying = false; }
  dispose() { this.tasks?.dispose(); this.taskSession?.dispose(); this.learn?.dispose(); this.unsubscribe?.(); this.el.innerHTML = ''; }
}
