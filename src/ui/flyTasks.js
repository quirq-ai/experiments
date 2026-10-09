import '../fly/tasks/tasks.css';

const STEPS = [
  ['create', 'Create', 'Give your scout a purpose.', 'A small, trainable file reader. Teach it where useful evidence lives, then measure what it finds.'],
  ['data', 'Data', 'A workspace to explore.', 'Choose a synthetic practice collection or bring your own files. Keep learning examples separate from evaluation.'],
  ['teach', 'Teach', 'Show it where to look.', 'Choose the next file you would read. Your demonstrations become examples of useful decisions.'],
  ['train', 'Train', 'Turn examples into a skill.', 'Fit a compact file-ranking policy to training decisions. Follow the actual learning record as it runs.'],
  ['test', 'Test', 'Let the evidence decide.', 'Compare your learned scout with filename matching and random reads under the same read budget.'],
  ['export', 'Export', 'A skill you can take with you.', 'Inspect and export the JSON artifact. The planned xo-space adapter will be a separate runtime integration.'],
];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (value, digits = 2) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
const percent = value => value != null && Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : '—';
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const truncate = (value, length = 100) => String(value ?? '').length > length ? String(value).slice(0, length - 1) + '…' : String(value ?? '');
const arrow = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg>';
const fileIcon = '<svg viewBox="0 0 20 24" aria-hidden="true"><path d="M3 1h9l5 5v17H3zM12 1v6h5M6 12h8M6 16h8"/></svg>';
const scoutIcon = `<svg viewBox="0 0 160 140" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".7"><ellipse cx="80" cy="80" rx="10" ry="25"/><ellipse cx="80" cy="48" rx="13" ry="13"/><ellipse cx="54" cy="49" rx="15" ry="35" transform="rotate(-42 54 49)"/><ellipse cx="106" cy="49" rx="15" ry="35" transform="rotate(42 106 49)"/><path d="m71 73-22 9-15 24m55-33 22 9 15 24M70 85l-15 19 3 18m32-37 15 19-3 18M74 40l-8-12m20 12 8-12M48 28l29 34m35-34L83 62M80 66v38"/></g><g fill="currentColor"><circle cx="75" cy="46" r="2"/><circle cx="85" cy="46" r="2"/><circle cx="80" cy="74" r="1.7"/><circle cx="80" cy="83" r="1.7"/><circle cx="80" cy="92" r="1.7"/></g></svg>`;

/** Workspace-skill UI. All decisions, learning, evaluation and exports belong to the task session. */
export class FlyTasks {
  constructor(session) {
    this.session = session;
    this.state = session.state || {};
    this.local = { query: 'experiment metrics', fields: 'run, success, duration', maxReads: 4, epochs: 120, learningRate: .08, seed: 7301, filePath: null };
    this.keys = {};
    this.step = '';
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'fly-tasks';
    this.dialog.setAttribute('aria-labelledby', 'fly-tasks-title');
    this.dialog.innerHTML = `
      <header class="fts-header"><div class="fts-brand"><span class="fts-brand-mark">${scoutIcon}</span><div><span class="fts-overline">FLY EXPEDITION LAB / WORKSPACE SKILLS</span><h1 id="fly-tasks-title">Report Scout</h1></div></div><div class="fts-portability"><span>Train here</span><i>→</i><span>Export JSON</span><i>→</i><span class="fts-portability-future">Run there</span></div><button class="fts-close" type="button" data-fts-action="close" aria-label="Close workspace skills">×</button></header>
      <div class="fts-layout"><aside class="fts-sidebar"><div class="fts-side-label">THE LEARNING JOURNEY</div><nav class="fts-nav" aria-label="Workspace skill stages">${STEPS.map(([id, name], i) => `<button type="button" data-fts-step="${id}"><span class="fts-nav-number">0${i + 1}</span><span>${name}</span><i>↗</i></button>`).join('')}</nav><div class="fts-specimen"><label for="fts-specimen">YOUR SCOUTS</label><select id="fts-specimen" aria-label="Select workspace scout"></select><span data-fts="specimen-state"></span></div><div class="fts-side-note"><span class="fts-status-dot"></span><strong>Local training</strong><p>A focused file-reading skill. Learning and evaluation run in this browser.</p><span class="fts-adapter">xo-space adapter planned</span></div></aside>
      <main class="fts-main"><div class="fts-step-header"><div class="fts-kicker" data-fts="step-kicker"></div><h2 data-fts="step-title"></h2><p data-fts="step-description"></p></div><div class="fts-content"></div></main></div>
      <footer class="fts-footer"><p data-fts="notice" role="status"></p><div class="fts-job" hidden><span data-fts="job-label"></span><progress max="1" value="0" aria-label="Workspace job progress"></progress><button class="fts-text-button" data-fts-action="cancel">Cancel</button></div><span class="fts-footer-label">REPORT SCOUT / LOCAL MODEL</span></footer>
      <input id="fts-dataset-input" type="file" accept="application/json,.json" hidden><input id="fts-files-input" type="file" accept="application/json,text/csv,.json,.csv" multiple hidden><input id="fts-folder-input" type="file" webkitdirectory directory multiple hidden><input id="fts-artifact-input" type="file" accept="application/json,.json" hidden>
    `;
    document.body.append(this.dialog);
    this.dialog.addEventListener('click', event => this.onClick(event));
    this.dialog.addEventListener('change', event => this.onChange(event));
    this.dialog.addEventListener('input', event => this.onInput(event));
    this.dialog.addEventListener('submit', event => this.onSubmit(event));
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('close', () => this.opener?.isConnected && this.opener.focus());
    this.dialog.addEventListener('keydown', event => {
      // Keep global Observatory shortcuts from acting on the scene underneath the modal.
      event.stopPropagation();
      if (event.target.matches('[data-fts-step]') && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const buttons = [...this.dialog.querySelectorAll('[data-fts-step]')];
        const current = buttons.indexOf(event.target);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        event.preventDefault(); buttons[index].focus();
      }
    });
    this.unsubscribe = session.subscribe(state => this.render(state || session.state));
  }

  open(opener) {
    this.opener = opener instanceof HTMLElement ? opener : document.activeElement;
    this.render(this.session.state);
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector(`[data-fts-step="${this.step || 'data'}"]`)?.focus();
  }
  close() { if (this.dialog.open) this.dialog.close(); }
  dispose() { this.unsubscribe?.(); this.close(); this.dialog.remove(); }
  find(key) { return this.dialog.querySelector(`[data-fts="${key}"]`); }
  text(key, value) { const node = this.find(key); if (node && node.textContent !== String(value)) node.textContent = value; }
  invoke(method, ...args) {
    if (typeof this.session[method] !== 'function') return this.error(new Error('This action is not available in the current session.'));
    try { const result = this.session[method](...args); if (result?.catch) result.catch(error => this.error(error)); return result; }
    catch (error) { this.error(error); }
  }
  error(error) { this.text('notice', error?.message || String(error)); this.find('notice').classList.add('is-error'); }
  setStep(step) { this.invoke('setStep', step); }

  onClick(event) {
    const step = event.target.closest('button[data-fts-step]');
    if (step && !step.disabled) return this.setStep(step.dataset.ftsStep);
    const candidate = event.target.closest('button[data-fts-candidate]');
    if (candidate && !candidate.disabled) return this.invoke('teach', candidate.dataset.ftsCandidate);
    const file = event.target.closest('button[data-fts-file]');
    if (file) { this.local.filePath = file.dataset.ftsFile; this.renderFiles(); return; }
    const button = event.target.closest('button[data-fts-action]');
    if (!button || button.disabled) return;
    switch (button.dataset.ftsAction) {
      case 'close': this.close(); break;
      case 'starter': this.invoke('loadStarter'); break;
      case 'import-dataset': this.dialog.querySelector('#fts-dataset-input').click(); break;
      case 'export-dataset': this.invoke('exportDataset'); break;
      case 'import-files': this.dialog.querySelector('#fts-files-input').click(); break;
      case 'import-folder': this.dialog.querySelector('#fts-folder-input').click(); break;
      case 'start-teaching': this.invoke('startTeaching'); break;
      case 'reset-teaching': this.invoke('resetTeaching'); break;
      case 'preview': this.invoke('runPreview'); break;
      case 'train': this.invoke('train', { epochs: this.local.epochs, learningRate: this.local.learningRate, seed: this.local.seed }); break;
      case 'cancel': this.invoke('cancel'); break;
      case 'evaluate': this.invoke('evaluate'); break;
      case 'export-artifact': this.invoke('exportArtifact'); break;
      case 'import-artifact': this.dialog.querySelector('#fts-artifact-input').click(); break;
    }
  }
  onInput(event) {
    const input = event.target;
    if (!input.dataset.ftsLocal) return;
    const key = input.dataset.ftsLocal;
    this.local[key] = ['maxReads', 'epochs', 'learningRate', 'seed'].includes(key) ? Number(input.value) : input.value;
  }
  onChange(event) {
    const input = event.target;
    if (input.id === 'fts-specimen') this.invoke('selectSpecimen', input.value);
    if (input.id === 'fts-workspace' || input.id === 'fts-teach-workspace' || input.id === 'fts-test-workspace') { this.local.filePath = null; this.invoke('selectWorkspace', input.value); }
    if (input.id === 'fts-dataset-input' && input.files[0]) this.invoke('importDataset', input.files[0]);
    if (input.id === 'fts-artifact-input' && input.files[0]) this.invoke('importArtifact', input.files[0]);
    if ((input.id === 'fts-files-input' || input.id === 'fts-folder-input') && input.files.length) {
      const fields = this.local.fields.split(',').map(value => value.trim()).filter(Boolean);
      if (!this.local.query.trim() || !fields.length || !Number.isInteger(this.local.maxReads) || this.local.maxReads < 1) { this.error(new Error('Add a query, at least one report field, and a positive whole-number read budget before importing files.')); input.value = ''; return; }
      this.invoke('importFiles', [...input.files], { query: this.local.query.trim(), fields, maxReads: this.local.maxReads });
    }
    if (input.type === 'file') input.value = '';
  }
  onSubmit(event) {
    if (event.target.id !== 'fts-create-form') return;
    event.preventDefault();
    const name = new FormData(event.target).get('name');
    this.invoke('createSpecimen', { name: String(name || '').trim() || 'Report Scout' });
  }

  render(state) {
    this.state = state || {};
    const step = STEPS.find(([id]) => id === this.state.step) || STEPS[1];
    this.dialog.dataset.step = step[0];
    this.dialog.querySelectorAll('[data-fts-step]').forEach(button => {
      const active = button.dataset.ftsStep === step[0];
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    this.text('step-kicker', `0${STEPS.indexOf(step) + 1} / ${step[1].toUpperCase()}`);
    this.text('step-title', step[2]);
    this.text('step-description', step[3]);
    const specimens = this.state.specimens || [];
    const roster = this.dialog.querySelector('#fts-specimen');
    const rosterKey = JSON.stringify(specimens.map(item => [item.id, item.name]));
    if (this.keys.roster !== rosterKey) { this.keys.roster = rosterKey; roster.innerHTML = specimens.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('') || '<option value="">Create a scout</option>'; }
    roster.value = this.state.selectedId || this.state.specimen?.id || '';
    roster.disabled = Boolean(this.state.job);
    const training = this.state.specimen?.training;
    this.text('specimen-state', this.state.specimen?.policy?.trainedEpochs ? `${this.state.specimen.policy.trainedEpochs} total training epochs` : 'A focused workspace policy');
    if (this.step !== step[0]) {
      this.step = step[0]; this.keys = { roster: this.keys.roster };
      this.renderStep(); this.dialog.querySelector('.fts-main').scrollTop = 0;
    }
    this.renderWorkspaceSelects();
    this.renderDataset();
    this.renderFiles();
    this.renderTeaching();
    this.renderTraining();
    this.renderEvaluation();
    this.renderArtifact();
    this.renderDossier();
    this.renderJob();
    this.dialog.querySelectorAll('[data-fts-local]').forEach(input => { input.disabled = Boolean(this.state.job); });
    const notice = this.state.error || this.state.notice || (this.state.ready === false ? 'Loading your local collection…' : 'Train here. Export JSON. The xo-space runtime adapter is planned.');
    this.text('notice', typeof notice === 'string' ? notice : notice?.message || '');
    this.find('notice').classList.toggle('is-error', Boolean(this.state.error));
    this.dialog.querySelectorAll('[data-fts-lock]').forEach(el => {
      const requires = el.dataset.ftsRequires;
      el.disabled = this.state.ready === false || Boolean(this.state.job) || (requires === 'specimen' && !this.state.specimen) || (requires === 'dataset' && !this.state.dataset) || (requires === 'workspace' && !this.state.workspace) || (requires === 'test' && !this.state.dataset?.test?.length) || (requires === 'artifact' && !this.artifactAvailable);
    });
  }

  renderStep() {
    const content = this.dialog.querySelector('.fts-content');
    if (this.step === 'create') content.innerHTML = `
      <div class="fts-create-grid"><section class="fts-create-form"><div class="fts-section-kicker">01 / IDENTITY</div><h3>A name for your reader.</h3><p>Your scout learns which file to open next. A fixed extractor gathers requested fields from the files it actually reads.</p><form id="fts-create-form"><label for="fts-name">Scout name</label><input id="fts-name" name="name" maxlength="48" required placeholder="e.g. Juniper / Report Scout" value="Scout ${String((this.state.specimens?.length || 0) + 1).padStart(2, '0')}" autocomplete="off"><button class="fts-primary" data-fts-lock type="submit">Create a scout ${arrow}</button></form><button class="fts-text-button" data-fts-action="import-artifact" data-fts-lock>Already have a skill? Import its artifact ↗</button><div class="fts-small-note">Workspace skills have their own learned policy. They do not replace your fly's scent-navigation training.</div></section><section class="fts-scout-portrait"><div class="fts-orbit"><div class="fts-orbit-inner">${scoutIcon}</div><span class="fts-orbit-node node-a">FILES</span><span class="fts-orbit-node node-b">EVIDENCE</span><span class="fts-orbit-node node-c">REPORT</span></div><div class="fts-portrait-caption"><span>REPORT SCOUT</span><strong>A small reader.<br>A measurable skill.</strong></div></section></div><div class="fts-capabilities"><div><span>01</span><strong>Choose</strong><p>Rank candidate paths with a learned policy.</p></div><div><span>02</span><strong>Read</strong><p>Spend a limited budget on actual files.</p></div><div><span>03</span><strong>Report</strong><p>Return extracted fields with source evidence.</p></div></div><div class="fts-next-row"><span data-fts="create-status"></span><button class="fts-secondary" data-fts-step="data">Build the practice collection ${arrow}</button></div>`;
    if (this.step === 'data') content.innerHTML = `
      <div class="fts-data-bar"><div><span class="fts-section-kicker">PRACTICE COLLECTION</span><h3 data-fts="dataset-name">No dataset loaded</h3></div><div class="fts-button-row"><button class="fts-secondary" data-fts-action="starter" data-fts-lock>Load synthetic examples</button><button class="fts-secondary" data-fts-action="import-dataset" data-fts-lock>Import dataset JSON</button><button class="fts-text-button" data-fts-action="export-dataset" data-fts-lock data-fts-requires="dataset">Download dataset ↗</button></div></div><div class="fts-splits" data-fts="splits"></div><div class="fts-data-columns"><section class="fts-import-panel"><div class="fts-section-kicker">BRING YOUR OWN / TRAINING ONLY</div><h3>A task worth learning.</h3><label for="fts-query">What should this scout look for?</label><textarea id="fts-query" data-fts-local="query" rows="2">${esc(this.local.query)}</textarea><label for="fts-fields">Report fields <span>comma separated</span></label><input id="fts-fields" data-fts-local="fields" value="${esc(this.local.fields)}"><label for="fts-max-reads">Maximum file reads</label><input id="fts-max-reads" data-fts-local="maxReads" type="number" min="1" max="64" step="1" value="${this.local.maxReads}"><div class="fts-button-row"><button class="fts-primary" data-fts-action="import-files" data-fts-lock>Add JSON / CSV files ${arrow}</button><button class="fts-secondary" data-fts-action="import-folder" data-fts-lock>Add folder</button></div><p class="fts-small-note">Custom files become a training workspace. They are not silently added to validation or test. Import a dataset package to supply explicit separate splits.</p></section><section class="fts-workspace-panel"><div class="fts-workspace-title"><div><span class="fts-section-kicker">WORKSPACE INSPECTOR</span><h3>Paths are the landscape.</h3></div><span data-fts="file-count"></span></div><label class="fts-sr-only" for="fts-workspace">Inspect a workspace</label><select id="fts-workspace" data-fts-workspace-select></select><div class="fts-file-explorer"><div class="fts-file-list" data-fts="files"></div><div class="fts-file-preview"><div class="fts-file-preview-title" data-fts="file-title">Choose a file</div><pre data-fts="file-content">File content will appear here.</pre></div></div><div class="fts-workspace-task" data-fts="workspace-task"></div></section></div><div class="fts-next-row"><span>Starter workspaces are synthetic report fixtures.</span><button class="fts-secondary" data-fts-step="teach">Teach a reading path ${arrow}</button></div>`;
    if (this.step === 'teach') content.innerHTML = `
      <div class="fts-teach-grid"><aside class="fts-teach-brief"><div class="fts-section-kicker">THE READING ASSIGNMENT</div><label for="fts-teach-workspace">Training workspace</label><select id="fts-teach-workspace" data-fts-workspace-select="train"></select><div data-fts="teach-task"></div><div class="fts-demo-count"><b data-fts="demo-count">0</b><span>recorded demonstrations</span></div><button class="fts-primary" data-fts-action="start-teaching" data-fts-lock data-fts-requires="workspace">Start a demonstration ${arrow}</button><div class="fts-button-row"><button class="fts-text-button" data-fts-action="reset-teaching" data-fts-lock>Reset teaching</button><button class="fts-text-button" data-fts-action="preview" data-fts-lock data-fts-requires="workspace">Run learned scout ↗</button></div><p class="fts-small-note">Teaching records your selected next reads in training workspaces. Scores show the current model's preference; a high score is not proof of relevance.</p></aside><section class="fts-teach-stage"><div class="fts-stage-heading"><div><span class="fts-section-kicker">NEXT READ</span><h3>Which path holds the evidence?</h3></div><span data-fts="read-budget"></span></div><div class="fts-reading-map" data-fts="reading-map"></div><div class="fts-candidates" data-fts="candidates"></div><div class="fts-evidence-grid"><section><div class="fts-section-kicker">READ TRACE</div><div data-fts="trace"></div></section><section><div class="fts-section-kicker">EXTRACTED REPORT</div><div data-fts="report"></div></section></div></section></div>`;
    if (this.step === 'train') content.innerHTML = `
      <div class="fts-training-grid"><section class="fts-training-settings"><div class="fts-section-kicker">CONTROLLED EXPERIENCE</div><h3>Fit the reading policy.</h3><p>Each update learns from training examples. The loss curve is measured from this job.</p><div data-fts="training-data" class="fts-training-data"></div><label for="fts-epochs">Training epochs</label><input id="fts-epochs" data-fts-local="epochs" type="number" min="1" max="300" step="1" value="${this.local.epochs}"><label for="fts-rate">Learning rate</label><input id="fts-rate" data-fts-local="learningRate" type="number" min="0.0001" max="1" step="0.01" value="${this.local.learningRate}"><label for="fts-seed">Training seed</label><input id="fts-seed" data-fts-local="seed" type="number" min="1" max="2147483647" step="1" value="${this.local.seed}"><button class="fts-primary" data-fts-action="train" data-fts-lock data-fts-requires="dataset">Train the scout ${arrow}</button><p class="fts-small-note">Training combines automatic labels from the training files with your saved demonstrations; your decisions take precedence for the same visible choice. The test split is evaluated only when you request a test.</p></section><section class="fts-learning-panel"><div class="fts-stage-heading"><div><span class="fts-section-kicker">LAST JOB / ACTUAL OPTIMIZATION HISTORY</span><h3>Experience leaves a trace.</h3></div><span data-fts="epoch-count">NO UPDATES YET</span></div><div class="fts-loss-chart" data-fts="loss-chart"></div><div class="fts-chart-key"><span><i></i>Training loss</span><span class="fts-validation-key"><i></i>Validation loss, when recorded</span></div><div class="fts-training-metrics" data-fts="training-metrics"></div><div class="fts-model-note"><strong>What is changing?</strong><p>The scout learns how to rank available files. Field extraction remains deterministic. This is a focused local model, not a general assistant or an emulation of a fly brain.</p></div></section></div><div class="fts-next-row"><span>Test the resulting policy against simple baselines.</span><button class="fts-secondary" data-fts-step="test">Run a held-out evaluation ${arrow}</button></div>`;
    if (this.step === 'test') content.innerHTML = `
      <div class="fts-test-launch"><div><span class="fts-section-kicker">MATCHED READ BUDGETS</span><h3>Three readers. The same workspaces.</h3><p data-fts="test-count">Load a dataset with a test split to evaluate.</p></div><button class="fts-primary" data-fts-action="evaluate" data-fts-lock data-fts-requires="test">Evaluate held-out cases ${arrow}</button></div><div data-fts="evaluation"></div><section class="fts-test-replay"><div class="fts-stage-heading"><div><span class="fts-section-kicker">INSPECT A READING SESSION</span><h3>Evidence behind the report.</h3></div><div class="fts-button-row"><label class="fts-sr-only" for="fts-test-workspace">Workspace for preview</label><select id="fts-test-workspace" data-fts-workspace-select></select><button class="fts-secondary" data-fts-action="preview" data-fts-lock data-fts-requires="workspace">Run this workspace ${arrow}</button></div></div><div class="fts-evidence-grid"><section><div class="fts-section-kicker">READ TRACE</div><div data-fts="trace"></div></section><section><div class="fts-section-kicker">EXTRACTED REPORT</div><div data-fts="report"></div></section></div></section><div class="fts-next-row"><span>Report results from these fixtures; broader performance is untested.</span><button class="fts-secondary" data-fts-step="export">Inspect the export ${arrow}</button></div>`;
    if (this.step === 'export') content.innerHTML = `
      <div class="fts-export-grid"><section class="fts-export-brief"><div class="fts-section-kicker">A PORTABLE MODEL RECORD</div><h3>Pack what it learned.</h3><p>The artifact contains the actual policy and its declared interface, with training and evaluation metadata when available.</p><div class="fts-export-route"><div><span>01</span><strong>Train here</strong><small>Local Report Scout</small></div><i>↓</i><div><span>02</span><strong>Export JSON</strong><small>Inspectable policy artifact</small></div><i>↓</i><div class="is-planned"><span>03</span><strong>Run in xo-space</strong><small>Adapter planned · not available yet</small></div></div><button class="fts-primary" data-fts-action="export-artifact" data-fts-lock data-fts-requires="artifact">Export skill artifact ${arrow}</button><button class="fts-secondary fts-full" data-fts-action="import-artifact" data-fts-lock>Import an existing artifact</button><p class="fts-small-note">Exporting does not install or execute a skill in xo-space. A compatible adapter must supply the same features, actions, and extraction behavior.</p></section><section class="fts-artifact-panel"><div class="fts-stage-heading"><div><span class="fts-section-kicker">ARTIFACT INSPECTOR</span><h3 data-fts="artifact-name">Your scout's record.</h3></div><span class="fts-json-label">JSON</span></div><div class="fts-artifact-summary" data-fts="artifact-summary"></div><pre class="fts-artifact-code" data-fts="artifact-code">Create a scout to inspect its artifact.</pre></section></div>`;
  }

  workspaces() { return ['train', 'validation', 'test'].flatMap(split => (this.state.dataset?.[split] || []).map(workspace => ({ ...workspace, split }))); }
  renderWorkspaceSelects() {
    const workspaces = this.workspaces();
    const key = JSON.stringify(workspaces.map(item => [item.id, item.name, item.split]));
    this.dialog.querySelectorAll('[data-fts-workspace-select]').forEach(select => {
      const onlyTrain = select.dataset.ftsWorkspaceSelect === 'train';
      if (select.dataset.optionsKey !== key) {
        select.dataset.optionsKey = key;
        select.innerHTML = ['train', 'validation', 'test'].filter(split => !onlyTrain || split === 'train').map(split => {
          const rows = workspaces.filter(item => item.split === split);
          return rows.length ? `<optgroup label="${split === 'train' ? 'Training' : split === 'test' ? 'Test' : 'Validation'}">${rows.map(item => `<option value="${esc(item.id)}">${esc(item.name || item.id)}</option>`).join('')}</optgroup>` : '';
        }).join('') || '<option value="">No workspaces loaded</option>';
      }
      if ([...select.options].some(option => option.value === this.state.workspace?.id)) select.value = this.state.workspace.id;
      else select.selectedIndex = -1;
      select.disabled = Boolean(this.state.job) || !workspaces.length;
    });
  }
  renderDataset() {
    if (this.step !== 'data') return;
    const dataset = this.state.dataset;
    this.text('dataset-name', dataset?.name || 'No dataset loaded');
    const key = JSON.stringify(dataset ? [dataset.id, dataset.train?.length, dataset.validation?.length, dataset.test?.length] : null);
    if (this.keys.splits !== key) {
      this.keys.splits = key;
      this.find('splits').innerHTML = [['train', 'Training', 'Policy updates & demonstrations'], ['validation', 'Validation', 'Development comparison'], ['test', 'Test', 'Evaluation on request']].map(([id, title, desc], index) => `<div><span class="fts-split-index">0${index + 1}</span><b>${dataset?.[id]?.length || 0}</b><div><strong>${title} workspaces</strong><small>${desc}</small></div></div>`).join('');
    }
  }
  renderFiles() {
    if (this.step !== 'data') return;
    const workspace = this.state.workspace;
    const files = workspace?.files || [];
    if (!files.some(file => file.path === this.local.filePath)) this.local.filePath = files[0]?.path || null;
    const key = JSON.stringify([workspace?.id, this.local.filePath, files.map(file => [file.path, String(file.content).length])]);
    if (key === this.keys.files) return;
    this.keys.files = key;
    this.text('file-count', `${files.length} files`);
    this.find('files').innerHTML = files.length ? files.map(file => `<button type="button" class="fts-file ${file.path === this.local.filePath ? 'is-selected' : ''}" data-fts-file="${esc(file.path)}">${fileIcon}<span>${esc(file.path)}</span><small>${esc(file.path.split('.').at(-1).toUpperCase())}</small></button>`).join('') : '<div class="fts-empty-inline">Load a collection to inspect real file paths and content.</div>';
    const file = files.find(item => item.path === this.local.filePath);
    this.text('file-title', file?.path || 'Choose a file');
    this.text('file-content', file ? (typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2)) : 'File content will appear here.');
    const split = this.workspaces().find(item => item.id === workspace?.id)?.split;
    this.find('workspace-task').innerHTML = workspace ? `<span>${esc(split || 'training')} WORKSPACE</span><strong>${esc(workspace.task?.query || 'No task query')}</strong><p>Extract: ${esc((workspace.task?.fields || []).join(', '))} <i>·</i> Read budget: ${workspace.task?.maxReads ?? '—'}</p>` : '';
  }

  renderTeaching() {
    if (!['teach', 'test'].includes(this.step)) return;
    const workspace = this.state.workspace;
    const run = this.state.run;
    const trace = run?.trace || [];
    const key = JSON.stringify([workspace?.id, run, this.state.candidates, this.state.demonstrations?.length, Boolean(this.state.job)]);
    if (this.keys.teaching === key) return;
    this.keys.teaching = key;
    if (this.step === 'teach') {
      const task = workspace?.task;
      const trainIds = (this.state.dataset?.train || []).map(item => item.id);
      const inTraining = trainIds.includes(workspace?.id);
      this.find('teach-task').innerHTML = task ? `<div class="fts-task-query">${esc(task.query)}</div><div class="fts-requested-fields">${(task.fields || []).map(field => `<span>${esc(field)}</span>`).join('')}</div><p class="fts-small-note">${task.maxReads} file reads available. ${inTraining ? 'This workspace belongs to the training split.' : 'Select a training workspace before recording a demonstration.'}</p>` : '<p class="fts-empty-inline">Add a training workspace to begin.</p>';
      this.text('demo-count', this.state.humanExampleCount ?? this.state.demonstrations?.length ?? 0);
      this.text('read-budget', workspace ? `${trace.length} / ${task?.maxReads ?? '—'} READS` : '');
      const candidates = this.state.candidates || [];
      this.find('reading-map').innerHTML = this.readingMap(trace, candidates, Boolean(run?.done));
      this.find('candidates').innerHTML = candidates.length && !run?.done ? candidates.map((candidate, i) => `<button class="fts-candidate" type="button" data-fts-candidate="${esc(candidate.id)}" ${this.state.job || !inTraining || !this.state.teaching ? 'disabled' : ''}><span class="fts-candidate-index">${String(i + 1).padStart(2, '0')}</span>${fileIcon}<span class="fts-candidate-path">${esc(candidate.path || candidate.id)}<small>${candidate.probability != null ? `${percent(candidate.probability)} model probability` : candidate.score != null ? `Model score ${fmt(candidate.score, 3)}` : 'Candidate file'}</small></span><span class="fts-candidate-action">Read ${arrow}</span></button>`).join('') : `<div class="fts-teach-empty">${run?.done ? '<strong>Reading complete.</strong><p>Inspect the extracted evidence below. Start another demonstration to teach a different path.</p>' : '<strong>Every path is a decision.</strong><p>Start a demonstration to see the available next reads.</p>'}</div>`;
    }
    this.find('trace').innerHTML = trace.length ? `<ol class="fts-trace">${trace.map((entry, index) => this.traceEntry(entry, index)).join('')}</ol>` : '<p class="fts-empty-inline">Files actually opened will appear here.</p>';
    this.find('report').innerHTML = this.reportHTML(run?.report, workspace?.task?.fields || []);
  }
  traceEntry(entry, index) {
    const path = entry.path || entry.file || entry.candidateId || `Read ${index + 1}`;
    const file = this.state.workspace?.files?.find(item => item.path === path);
    const content = entry.content ?? file?.content;
    return `<li><span class="fts-trace-index">${String(index + 1).padStart(2, '0')}</span><div><strong>${esc(path)}</strong><small>${entry.error ? esc(entry.error) : `${entry.matchedRows ?? 0} matching records extracted`}${entry.probability != null ? ` · ${percent(entry.probability)} model probability` : ''}</small>${content !== undefined ? `<details><summary>Read content</summary><pre>${esc(typeof content === 'string' ? content : JSON.stringify(content, null, 2))}</pre></details>` : ''}</div></li>`;
  }
  reportHTML(report, fields) {
    if (!report) return '<p class="fts-empty-inline">Extracted values and source paths will appear after a read.</p>';
    const columns = report.fields || fields;
    const records = report.records || [];
    const rows = records.slice(0, 200);
    const status = report.status === 'complete' ? 'Complete inspection' : 'Partial report';
    return `<div class="fts-report-status"><strong>${status}</strong><p>${esc(report.reason || '')}</p><small>${report.scope?.inspectedFiles ?? 0} / ${report.scope?.eligibleFiles ?? 0} eligible files inspected · ${records.length} extracted records</small></div>${rows.length ? `<div class="fts-report-table-wrap"><table class="fts-report-table"><thead><tr>${columns.map(field => `<th scope="col">${esc(field)}</th>`).join('')}<th scope="col">Source evidence</th></tr></thead><tbody>${rows.map(record => `<tr>${columns.map(field => `<td>${esc(typeof record.values?.[field] === 'object' ? JSON.stringify(record.values[field]) : record.values?.[field] ?? '—')}</td>`).join('')}<td><strong>${esc(record.source?.path || '')}</strong><small>${esc(record.source?.location || '')}</small>${record.source?.contentHash ? `<small title="Content SHA-256">${esc(record.source.contentHash.slice(0, 12))}…</small>` : ''}</td></tr>`).join('')}</tbody></table></div>${records.length > rows.length ? `<p class="fts-small-note">Showing the first ${rows.length} of ${records.length} extracted records.</p>` : ''}` : '<p class="fts-empty-inline">No records with all requested fields have been extracted yet.</p>'}${report.missingFields?.length ? `<p class="fts-small-note">Fields not observed: ${esc(report.missingFields.join(', '))}</p>` : ''}${report.errors?.length ? `<details class="fts-report-errors"><summary>${report.errors.length} file parsing errors</summary>${report.errors.map(error => `<p><strong>${esc(error.path)}</strong> ${esc(error.message)}</p>`).join('')}</details>` : ''}`;
  }
  readingMap(trace, candidates, done) {
    const slots = Math.min(5, Math.max(1, trace.length + Math.min(candidates.length, 2)));
    const nodes = Array.from({ length: slots }, (_, index) => {
      const read = index < trace.length;
      const x = 118 + index * (400 / Math.max(1, slots - 1));
      return `<path d="M60 46H${x}" stroke="#adc49b" stroke-opacity="${read ? '.45' : '.15'}" stroke-dasharray="${read ? '0' : '3 5'}"/><circle cx="${x}" cy="46" r="${read ? 9 : 6}" fill="${read ? '#b6cca1' : '#1c2e20'}" stroke="#8aab77" stroke-opacity=".6"/><text x="${x}" y="73" text-anchor="middle">${read ? `READ ${index + 1}` : 'NEXT'}</text>`;
    }).join('');
    return `<svg viewBox="0 0 570 94" role="img" aria-label="Reading path: ${trace.length} files opened, ${done ? 'complete' : candidates.length + ' candidates available'}"><defs><pattern id="fts-map-grid" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#94b085" opacity=".21"/></pattern></defs><rect width="570" height="94" fill="url(#fts-map-grid)"/><circle cx="48" cy="46" r="20" fill="#162a1a" stroke="#8bab78" stroke-opacity=".4"/><path d="m40 47 8-12 8 12-8 10Z" fill="none" stroke="#baceaa"/>${nodes}</svg>`;
  }

  renderTraining() {
    if (this.step !== 'train') return;
    const history = this.state.history || [];
    const data = this.state.dataset;
    const examples = (this.state.demonstrations || []).length;
    this.find('training-data').innerHTML = `<div><b>${data?.train?.length || 0}</b><span>training workspaces</span></div><div><b>${this.state.trainingExampleCount ?? examples}</b><span>total teaching decisions</span></div><div><b>${this.state.humanExampleCount ?? examples}</b><span>human decisions</span></div><div><b>${Math.max(0, (this.state.trainingExampleCount ?? examples) - (this.state.humanExampleCount ?? examples))}</b><span>automatic teacher decisions</span></div>`;
    const key = JSON.stringify([history, this.state.specimen?.id]);
    if (this.keys.history === key) return;
    this.keys.history = key;
    const records = history.map((entry, i) => ({ epoch: entry.epoch ?? entry.iteration ?? i + 1, loss: entry.loss ?? entry.trainLoss ?? entry.trainingLoss, validation: entry.validationLoss ?? entry.valLoss, accuracy: entry.accuracy ?? entry.trainAccuracy })).filter(entry => Number.isFinite(Number(entry.loss)) && entry.loss != null);
    this.text('epoch-count', records.length ? `${records.at(-1).epoch} EPOCHS RECORDED` : 'NO UPDATES YET');
    this.find('loss-chart').innerHTML = records.length ? this.lossSVG(records) : '<div class="fts-empty-chart"><div class="fts-empty-chart-lines"></div><span>No learning curve is drawn in advance.</span><p>Start a training job to see its measured loss.</p></div>';
    const last = records.at(-1);
    this.find('training-metrics').innerHTML = [['Training loss', fmt(last?.loss, 4)], ['Validation loss', fmt(last?.validation, 4)], ['Recorded epochs', last ? fmt(last.epoch, 0) : '—']].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
    this.dialog.querySelector('.fts-validation-key').hidden = !records.some(entry => Number.isFinite(Number(entry.validation)) && entry.validation != null);
  }
  lossSVG(records) {
    const sampled = records.filter((_, i) => i % Math.max(1, Math.ceil(records.length / 180)) === 0 || i === records.length - 1);
    const all = sampled.flatMap(record => [record.loss, record.validation]).filter(value => value != null && Number.isFinite(Number(value))).map(Number);
    const max = Math.max(.001, ...all) * 1.08;
    const x = epoch => 42 + (epoch - (records[0]?.epoch || 0)) / Math.max(1, records.at(-1).epoch - records[0].epoch) * 548;
    const y = value => 220 - Number(value) / max * 190;
    const path = name => sampled.filter(record => record[name] != null && Number.isFinite(Number(record[name]))).map((record, i) => `${i ? 'L' : 'M'}${x(record.epoch).toFixed(2)},${y(record[name]).toFixed(2)}`).join(' ');
    const trainPath = path('loss');
    const validationPath = path('validation');
    return `<svg viewBox="0 0 620 260" role="img" aria-label="Recorded training loss by epoch"><defs><linearGradient id="fts-loss-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b7d29c" stop-opacity=".18"/><stop offset="100%" stop-color="#b7d29c" stop-opacity=".01"/></linearGradient></defs>${[0, .25, .5, .75, 1].map(t => `<path d="M42 ${y(t * max)}H590" stroke="#9aaf8b" stroke-opacity=".12"/><text x="28" y="${y(t * max) + 3}" text-anchor="end">${fmt(t * max, 2)}</text>`).join('')}<path d="${trainPath}L590 220H42Z" fill="url(#fts-loss-fill)"/><path d="${trainPath}" fill="none" stroke="#c3d7ab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${validationPath ? `<path d="${validationPath}" fill="none" stroke="#c5a778" stroke-width="1.6" stroke-dasharray="5 4"/>` : ''}<circle cx="${x(records.at(-1).epoch)}" cy="${y(records.at(-1).loss)}" r="3.2" fill="#dfebc7"/><text x="42" y="246">Epoch ${records[0].epoch}</text><text x="590" y="246" text-anchor="end">${records.at(-1).epoch}</text></svg>`;
  }

  renderEvaluation() {
    if (this.step !== 'test') return;
    const evaluation = this.state.evaluation;
    this.text('test-count', `${this.state.dataset?.test?.length || 0} test workspaces. Policies are frozen during evaluation.`);
    const key = JSON.stringify(evaluation);
    if (this.keys.evaluation === key) return;
    this.keys.evaluation = key;
    const container = this.find('evaluation');
    if (!evaluation) {
      container.innerHTML = '<div class="fts-empty-evaluation"><span class="fts-measure-lines"><i></i><i></i><i></i></span><h3>A score has to be earned.</h3><p>Run the evaluation to compare real outcomes. No test scores are assumed.</p></div>';
      return;
    }
    const metrics = [
      ['coverage', 'Useful-file coverage', percent], ['precision', 'Useful reads', percent], ['meanReads', 'Mean file reads', value => fmt(value, 1)], ['completeRate', 'Entire workspace inspected', percent], ['allRelevantFoundRate', 'All targets found', percent],
    ];
    const conditions = [['learned', 'Learned scout', 'Your trained file-ranking policy'], ['filename', 'Filename match', 'A simple path-based baseline'], ['random', 'Random reads', 'A seeded random baseline']];
    container.innerHTML = `<div class="fts-evaluation-cards">${conditions.map(([id, name, desc], index) => {
      const result = evaluation[id];
      const summary = result?.summary || result || {};
      return `<section class="fts-evaluation-card ${index === 0 ? 'is-learned' : ''}"><div class="fts-condition-name"><span>0${index + 1}</span><h3>${name}</h3></div><p>${desc}</p><div class="fts-evaluation-main"><strong>${percent(summary.coverage)}</strong><span>useful-file coverage</span></div><div class="fts-score-track"><span style="width:${clamp(summary.coverage) * 100}%"></span></div><dl>${metrics.slice(1).map(([metric, label, format]) => `<div><dt>${label}</dt><dd>${format(summary[metric])}</dd></div>`).join('')}</dl><div class="fts-condition-n">${result?.runs?.length ?? summary.count ?? this.state.dataset?.test?.length ?? 0} evaluated workspaces</div></section>`;
    }).join('')}</div>${this.state.specimen?.training?.unknownPriorTraining ? '<p class="fts-small-note">Earlier training data unknown; historical independence unverified.</p>' : ''}<p class="fts-evaluation-note">All conditions use the same workspace cases and read limits. Coverage is the share of relevant files found. Useful reads is the fraction of reads that produced matching records. All targets found counts cases where every relevant file was found. A report stays partial while any eligible file remains unread.</p>`;
  }

  renderArtifact() {
    if (this.step !== 'export') return;
    let artifact;
    try { artifact = this.session.artifactPreview?.(); } catch (error) { this.error(error); return; }
    const key = JSON.stringify(artifact);
    if (this.keys.artifact === key) return;
    this.keys.artifact = key;
    this.text('artifact-name', this.state.specimen?.name || 'Your scout\'s record.');
    this.artifactAvailable = Boolean(artifact);
    if (!artifact) {
      this.find('artifact-summary').innerHTML = '<p class="fts-empty-inline">Train this scout, then evaluate its current checkpoint on the current test collection before exporting.</p>';
      this.text('artifact-code', 'Train → Test → Export\n\nA current trained and evaluated checkpoint is required.');
      return;
    }
    const policy = artifact.policy || artifact.specimen?.policy || {};
    const weights = policy.weights || [];
    const version = artifact.schemaVersion ?? artifact.version ?? policy.version ?? '—';
    const bytes = new TextEncoder().encode(key).length;
    const count = Array.isArray(weights) ? weights.flat(Infinity).length : weights && typeof weights === 'object' ? Object.keys(weights).length : 0;
    this.find('artifact-summary').innerHTML = [['Schema', String(version)], ['Parameters', count ? String(count) : 'Declared in JSON'], ['Artifact size', `${fmt(bytes / 1024, 1)} KB`]].map(([label, value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('');
    this.text('artifact-code', JSON.stringify(artifact, null, 2));
  }
  renderDossier() {
    if (this.step !== 'create') return;
    this.text('create-status', this.state.specimen ? `Selected: ${this.state.specimen.name}` : 'Create your first workspace scout to begin.');
  }
  renderJob() {
    const job = this.state.job;
    const box = this.dialog.querySelector('.fts-job');
    box.hidden = !job;
    if (!job) return;
    const progress = job.progress ?? (job.epochs ? (job.epoch || 0) / job.epochs : 0);
    box.querySelector('progress').value = clamp(progress > 1 ? progress / 100 : progress);
    this.text('job-label', `${job.type === 'train' ? 'Training' : job.type === 'evaluate' ? 'Evaluating' : job.type || 'Working'}${job.epoch != null && job.epochs ? ` · ${job.epoch} / ${job.epochs}` : ''}`);
  }
}
