import { createGenome, createPolicy, createEpisode, snapshotEpisode, restoreEpisode } from '../core/engine.js';
import { validatePolicy } from '../policies/sarsa.js';
import { listRecords, putRecord, removeRecord, recordId, hashPolicy, downloadJSON } from '../records/store.js';

const copy = value => JSON.parse(JSON.stringify(value));
const stages = new Set(['create', 'train', 'expedition', 'compare']);
const finite = (value, keys) => value && keys.every(key => Number.isFinite(value[key]));
const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const validHistory = history => Array.isArray(history) && history.length <= 1000
  && history.every(entry => finite(entry, ['episode', 'reward']) && typeof entry.success === 'boolean');

function validateSnapshot(frame) {
  if (!finite(frame, ['t', 'tick']) || !Number.isInteger(frame.tick) || frame.tick < 0
    || !Array.isArray(frame.flies) || !frame.flies.length || frame.flies.length > 32
    || !frame.flies.every(fly => finite(fly, ['x', 'y', 'z', 'yaw', 'energy'])
      && Array.isArray(fly.odor) && fly.odor.length === 2 && fly.odor.every(Number.isFinite))
    || !Array.isArray(frame.sources) || frame.sources.length > 32
    || !frame.sources.every(source => finite(source, ['x', 'y', 'z', 'channel']) && [0, 1].includes(source.channel))
    || !Array.isArray(frame.puffs) || frame.puffs.length > 4096
    || !frame.puffs.every(puff => finite(puff, ['x', 'y', 'z', 'radius', 'concentration', 'channel'])
      && puff.radius > 0 && [0, 1].includes(puff.channel))
    || !vector(frame.wind) || !vector(frame.bounds?.min) || !vector(frame.bounds?.max)
    || !Array.isArray(frame.events) || frame.events.length > 10000) throw new Error('Invalid expedition replay snapshot.');
}

function validateRuns(runs) {
  if (!Array.isArray(runs) || runs.length > 12) throw new Error('An export can contain at most 12 recorded flights.');
  for (const run of runs) {
    if (!run.manifest || !Number.isFinite(run.manifest.seed) || typeof run.summary?.success !== 'boolean'
      || !Array.isArray(run.frames) || !run.frames.length || run.frames.length > 5000) throw new Error('Invalid recorded flight.');
    let previous = -1;
    for (const frame of run.frames) {
      validateSnapshot(frame);
      if (frame.tick < previous) throw new Error('Replay frames must be ordered by simulation tick.');
      previous = frame.tick;
    }
  }
}

function validateReport(report) {
  if (!report || !finite(report, ['count', 'successes', 'successRate']) || report.count < 1
    || report.successes < 0 || report.successes > report.count || report.successRate < 0 || report.successRate > 1) {
    throw new Error('Invalid expedition statistics.');
  }
}

function makeSpecimen({ name = 'Juniper 01', genome, policy, parentId = null } = {}) {
  return { schemaVersion: 1, id: recordId(), name: String(name).trim().slice(0, 40) || 'Untitled specimen',
    genome: createGenome(genome), policy: policy || createPolicy(17), parentId,
    training: { episodes: policy?.trainedEpisodes || 0, curriculum: null }, createdAt: new Date().toISOString(), checkpoints: [] };
}

export class FlySession {
  constructor({ storage = { listRecords, putRecord, removeRecord },
    workerFactory = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
    download = downloadJSON } = {}) {
    this.storage = storage; this.workerFactory = workerFactory; this.download = download;
    this.results = [];
    this.listeners = new Set();
    const specimen = makeSpecimen();
    this.state = { stage: 'create', specimens: [specimen], selectedId: specimen.id, specimen,
      job: null, paused: false, error: null, notice: 'Begin with a specimen. Every flight starts with a question.',
      history: [], runs: [], report: null, result: null, snapshot: null, replayIndex: 0, runIndex: 0,
      overlays: true, anatomy: false, savedJobs: [], ready: false };
    this.worker = null;
    this.playClock = 0;
    this.preview();
    this.ready = this.load();
  }

  subscribe(fn) { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.state); }
  fail(error) { this.state.error = error?.message || String(error); this.emit(); }
  async persist(kind, record) {
    try { await this.storage.putRecord(kind, copy(record)); }
    catch (error) { this.state.notice = `Local saving unavailable: ${error.message}. Export your results before closing.`; this.emit(); }
  }

  async load() {
    try {
      const [specimens, results, jobs] = await Promise.all([this.storage.listRecords('specimen'), this.storage.listRecords('result'), this.storage.listRecords('job')]);
      const valid = specimens.filter(s => { try { this.validateSpecimen(s); return true; } catch { return false; } });
      if (valid.length) {
        this.state.specimens = valid.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        this.state.specimen = this.state.specimens.at(-1);
        this.state.selectedId = this.state.specimen.id;
        this.state.history = this.state.specimen.history || [];
      } else await this.storage.putRecord('specimen', this.state.specimen);
      this.results = results.filter(result => { try { this.validateResult(result); return true; } catch { return false; } });
      this.showMatchingResult();
      this.state.savedJobs = jobs.filter(saved => { try { this.validateSavedJob(saved); return true; } catch { return false; } });
      if (this.state.savedJobs.length) this.state.notice = 'A saved experiment is available to resume.';
      this.preview();
    } catch (error) { this.state.notice = `Using a temporary collection. ${error.message}`; }
    this.state.ready = true;
    this.emit();
  }

  validateSpecimen(specimen) {
    if (specimen?.schemaVersion !== 1 || typeof specimen.id !== 'string' || typeof specimen.name !== 'string'
      || !specimen.name.trim() || specimen.name.length > 80 || !Number.isFinite(Date.parse(specimen.createdAt))
      || !specimen.genome || !Number.isInteger(specimen.training?.episodes) || specimen.training.episodes < 0
      || specimen.training.episodes !== specimen.policy?.trainedEpisodes) throw new Error('Unsupported specimen format.');
    validatePolicy(specimen.policy);
    const canonical = createGenome(specimen.genome);
    for (const key of ['sensitivity', 'memory', 'exploration', 'speed']) {
      if (!Number.isFinite(specimen.genome[key]) || canonical[key] !== specimen.genome[key]) throw new Error(`Invalid ${key} parameter.`);
    }
    for (const key of ['turnRate', 'learningRate', 'energyBudget']) if (key in specimen.genome
      && (!Number.isFinite(specimen.genome[key]) || canonical[key] !== specimen.genome[key])) throw new Error(`Invalid ${key} parameter.`);
    if (specimen.history && !validHistory(specimen.history)) throw new Error('Invalid learning history.');
    if (!Array.isArray(specimen.checkpoints) || specimen.checkpoints.length > 12) throw new Error('Invalid checkpoint collection.');
    for (const checkpoint of specimen.checkpoints) {
      validatePolicy(checkpoint.policy);
      if (typeof checkpoint.id !== 'string' || checkpoint.episodes !== checkpoint.policy.trainedEpisodes
        || checkpoint.hash !== hashPolicy(checkpoint.policy)) throw new Error('Invalid saved policy checkpoint.');
      if (checkpoint.history && !validHistory(checkpoint.history)) throw new Error('Invalid checkpoint learning record.');
    }
  }

  validateResult(result) {
    if (result?.schemaVersion !== 1 || typeof result.id !== 'string' || !Number.isFinite(Date.parse(result.createdAt))
      || typeof result.manifest?.specimenId !== 'string' || typeof result.manifest?.initialPolicyHash !== 'string') throw new Error('Invalid expedition record.');
    validateRuns(result.runs); validateReport(result.report);
    if (result.report.policyHash !== result.manifest.initialPolicyHash) throw new Error('Expedition checkpoint identity does not match.');
    if (result.specimen) {
      this.validateSpecimen(result.specimen);
      if (result.specimen.id !== result.manifest.specimenId || hashPolicy(result.specimen.policy) !== result.manifest.initialPolicyHash) throw new Error('Expedition belongs to a different specimen.');
    }
  }

  validateSavedJob(saved) {
    const checkpoint = saved?.checkpoint;
    if (saved?.schemaVersion !== 1 || !this.state.specimens.some(s => s.id === saved.specimenId)
      || saved.manifest?.specimenId !== saved.specimenId || checkpoint?.schemaVersion !== 1
      || checkpoint.jobVersion !== 'fly-job-v1' || !['train', 'evaluate'].includes(checkpoint.type)
      || !Number.isInteger(checkpoint.completed) || checkpoint.completed < 0) throw new Error('Invalid saved experiment.');
    validatePolicy(checkpoint.policy);
    if (checkpoint.active) restoreEpisode(checkpoint.active);
    if (checkpoint.type === 'train' && (!validHistory(checkpoint.history) || !Number.isInteger(checkpoint.episodes))) throw new Error('Invalid saved training job.');
    if (checkpoint.type === 'evaluate' && (!Array.isArray(checkpoint.conditions) || !Number.isInteger(checkpoint.count))) throw new Error('Invalid saved evaluation job.');
  }

  showMatchingResult() {
    const specimen = this.state.specimen, policyHash = hashPolicy(specimen.policy);
    const result = this.results.filter(value => value.manifest.specimenId === specimen.id
      && value.manifest.initialPolicyHash === policyHash
      && JSON.stringify(value.manifest.genome || value.specimen?.genome) === JSON.stringify(specimen.genome))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    this.state.result = result || null; this.state.runs = result?.runs || []; this.state.report = result?.report || null;
    this.state.runIndex = 0; this.state.replayIndex = 0; this.playClock = 0;
  }

  preview() {
    const { specimen, stage } = this.state;
    if (!specimen) return;
    this.state.snapshot = snapshotEpisode(createEpisode({ seed: 2049, genome: specimen.genome, policy: specimen.policy,
      scenario: stage === 'train' ? 'chamber' : 'orchard' }));
  }

  setStage(stage) {
    if (!stages.has(stage)) return;
    this.state.stage = stage; this.state.anatomy = false;
    if (!this.state.job) {
      if ((stage === 'compare' || stage === 'expedition') && this.state.runs.length) this.setReplay(this.state.replayIndex, false);
      else this.preview();
    }
    this.emit();
  }

  createSpecimen(options = {}) {
    if (!this.state.ready) return this.fail('The saved collection is still loading. Try again in a moment.');
    if (this.state.job) return this.fail('Finish or cancel the current job before changing specimens.');
    const specimen = makeSpecimen(options);
    try { this.validateSpecimen(specimen); } catch (error) { return this.fail(error); }
    this.state.specimens.push(specimen);
    this.state.specimen = specimen; this.state.selectedId = specimen.id;
    this.state.history = []; this.state.error = null; this.showMatchingResult();
    this.state.notice = `${specimen.name} added to your collection.`;
    this.persist('specimen', specimen); this.preview(); this.emit();
    return specimen;
  }

  selectSpecimen(id) {
    if (!this.state.ready) return;
    if (this.state.job) return this.fail('Finish or cancel the current job before changing specimens.');
    const specimen = this.state.specimens.find(s => s.id === id);
    if (!specimen) return;
    this.state.specimen = specimen; this.state.selectedId = id;
    this.state.history = specimen.history || []; this.state.error = null;
    this.showMatchingResult();
    this.preview(); this.emit();
  }

  cloneSpecimen() {
    const source = this.state.specimen;
    const clone = this.createSpecimen({ name: `${source.name.slice(0, 30)} · twin`, genome: copy(source.genome),
      policy: copy(source.policy), parentId: source.id });
    if (clone) {
      clone.training = copy(source.training); clone.history = copy(source.history || []);
      clone.checkpoints = copy(source.checkpoints || []);
      this.state.history = clone.history;
      this.persist('specimen', clone); this.emit();
    }
  }

  updateGenome(partial) {
    if (!this.state.ready || this.state.job) return;
    if (this.state.specimen.training.episodes > 0) {
      this.state.notice = 'Create a fresh specimen to change inherited traits. This preserves your trained checkpoint.';
      return this.emit();
    }
    this.state.specimen.genome = createGenome({ ...this.state.specimen.genome, ...partial });
    // A genome change invalidates comparisons even when zero policy weights match.
    this.results = this.results.filter(result => result.manifest.specimenId !== this.state.specimen.id);
    this.showMatchingResult();
    this.persist('specimen', this.state.specimen); this.preview(); this.emit();
  }

  ensureWorker() {
    if (this.worker) return;
    this.worker = this.workerFactory();
    this.worker.onmessage = e => this.handleMessage(e.data);
    this.worker.onerror = e => {
      this.state.job = null; this.state.paused = false;
      this.fail(new Error(e.message || 'The experiment worker stopped unexpectedly.'));
    };
  }

  start(type, options) {
    if (!this.state.ready) return this.fail('The saved collection is still loading. Try again in a moment.');
    if (this.state.job) return this.fail('A job is already running. Pause or cancel it first.');
    this.ensureWorker();
    const jobId = recordId('job');
    this.state.job = { id: jobId, type, completed: 0, total: options.episodes || options.count || 12 };
    this.state.paused = false; this.state.error = null; this.state.anatomy = false;
    this.activeSpecimen = copy(this.state.specimen);
    this.activeManifest = { specimenId: this.state.specimen.id, name: this.state.specimen.name,
      genome: copy(this.state.specimen.genome),
      initialPolicyHash: hashPolicy(this.state.specimen.policy), ...copy(options) };
    this.worker.postMessage({ type, jobId, ...copy(options), policy: copy(this.state.specimen.policy), genome: copy(this.state.specimen.genome) });
    this.emit();
  }

  train({ curriculum = 'varied', episodes = 200 } = {}) {
    if (!this.state.ready) return this.fail('The saved collection is still loading. Try again in a moment.');
    if (this.state.job) return this.fail('A job is already running. Pause or cancel it first.');
    this.state.stage = 'train';
    this.state.history = [];
    this.state.notice = 'Learning from food rewards and steering experience. Training uses distance-based reward shaping.';
    this.start('train', { curriculum: curriculum === 'steady' ? 'steady' : 'varied',
      episodes: Math.max(10, Math.min(1000, Math.round(Number(episodes) || 200))), seed: 7301 + this.state.specimen.training.episodes });
  }

  launch({ scenario = 'orchard', seed = 2049, count = 12, benchmark = true } = {}) {
    if (!this.state.ready) return this.fail('The saved collection is still loading. Try again in a moment.');
    if (this.state.job) return this.fail('A job is already running. Pause or cancel it first.');
    this.state.stage = 'expedition';
    this.state.notice = 'Testing frozen policies in matched, independent worlds. Learned weights stay unchanged.';
    this.start('evaluate', { scenario: scenario === 'wind-shift' ? 'wind-shift' : 'orchard',
      seed: Math.min(2147483647, Math.max(1, Math.floor(Number(seed) || 2049))),
      count: Math.max(1, Math.min(100, Math.round(Number(count) || 12))), benchmark: Boolean(benchmark) });
  }

  handleMessage(message) {
    try { this.receiveMessage(message); }
    catch (error) {
      if (this.state.job) this.worker?.postMessage({ type: 'cancel', jobId: this.state.job.id });
      this.completeJob(); this.fail(error);
    }
  }

  receiveMessage(message) {
    const job = this.state.job;
    if (!job || !message || message.jobId !== job.id) return;
    if (message.type === 'progress') {
      job.completed = message.completed ?? job.completed;
      job.total = message.total ?? job.total;
      job.controller = message.condition || message.controller;
      if (message.history) {
        if (!validHistory(message.history)) throw new Error('Invalid training progress.');
        this.state.history = message.history;
      }
      if (message.snapshot) { validateSnapshot(message.snapshot); this.state.snapshot = message.snapshot; }
      // Save an exact orchestration checkpoint periodically, not rendered frames.
      if (job.completed && job.completed % 25 === 0 && this.lastCheckpointEpisode !== job.completed) {
        this.lastCheckpointEpisode = job.completed;
        this.worker.postMessage({ type: 'checkpoint', jobId: job.id });
      }
    } else if (message.type === 'checkpoint' || message.type === 'paused') {
      const value = { id: job.id, schemaVersion: 1, specimenId: this.state.specimen.id,
        manifest: this.activeManifest, specimen: this.activeSpecimen,
        createdAt: new Date().toISOString(), checkpoint: message.checkpoint };
      if (value.checkpoint) {
        this.validateSavedJob(value);
        this.state.savedJobs = [...this.state.savedJobs.filter(saved => saved.id !== value.id), value];
        this.persist('job', value);
      }
    } else if (message.type === 'trained') {
      const specimen = this.state.specimen;
      validatePolicy(message.policy);
      const history = message.history || this.state.history;
      if (!validHistory(history)) throw new Error('Invalid learning record.');
      const checkpoint = { id: recordId('checkpoint'), createdAt: new Date().toISOString(),
        policy: copy(message.policy), hash: hashPolicy(message.policy), curriculum: this.activeManifest.curriculum,
        history: copy(history),
        episodes: message.policy.trainedEpisodes || specimen.training.episodes + job.total };
      specimen.checkpoints = [...(specimen.checkpoints || []), checkpoint].slice(-12);
      specimen.policy = copy(message.policy);
      specimen.training = { episodes: checkpoint.episodes, curriculum: checkpoint.curriculum };
      specimen.history = history;
      this.state.history = specimen.history;
      this.state.notice = `Checkpoint saved. ${checkpoint.episodes} training episodes; ready for an unseen expedition.`;
      this.persist('specimen', specimen);
      this.showMatchingResult();
      this.completeJob();
    } else if (message.type === 'evaluated') {
      if (hashPolicy(this.state.specimen.policy) !== this.activeManifest.initialPolicyHash) throw new Error('Policy changed during frozen evaluation.');
      validateRuns(message.runs); validateReport(message.summary);
      this.state.runs = message.runs || [];
      this.state.report = { ...message.summary, comparisons: message.comparisons || message.summary?.comparisons,
        specimenId: this.activeManifest.specimenId, specimenName: this.activeManifest.name, policyHash: this.activeManifest.initialPolicyHash,
        seed: this.activeManifest.seed, scenario: this.activeManifest.scenario };
      this.state.runIndex = 0; this.state.replayIndex = 0;
      this.state.notice = 'Expedition complete. Watch the recorded flight or open Compare for the full cohort.';
      const result = { id: recordId('result'), schemaVersion: 1, createdAt: new Date().toISOString(),
        specimen: this.activeSpecimen, manifest: copy(this.activeManifest), report: this.state.report, runs: this.state.runs };
      this.validateResult(result); this.results.push(result); this.state.result = result;
      this.persist('result', result).then(() => this.pruneResults());
      this.completeJob();
      this.setReplay(0, false);
    } else if (message.type === 'error') {
      this.completeJob(); this.fail(new Error(message.message || message.error || 'Experiment failed.'));
    } else if (message.type === 'cancelled') {
      this.completeJob(); this.state.notice = 'Job cancelled. Your last saved policy is unchanged.';
    }
    this.emit();
  }

  async pruneResults() {
    try {
      const records = await this.storage.listRecords('result');
      const obsolete = records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(5);
      for (const record of obsolete) await this.storage.removeRecord('result', record.id);
      const removed = new Set(obsolete.map(record => record.id));
      this.results = this.results.filter(result => !removed.has(result.id));
    } catch { /* Current results remain available for export. */ }
  }

  completeJob() {
    const id = this.state.job?.id;
    if (id) this.storage.removeRecord('job', id).catch(() => {});
    this.state.savedJobs = this.state.savedJobs.filter(job => job.id !== id);
    this.state.job = null; this.state.paused = false; this.lastCheckpointEpisode = null;
  }

  pause() {
    this.state.paused = !this.state.paused;
    if (this.state.job) {
      this.worker.postMessage({ type: this.state.paused ? 'pause' : 'resume', jobId: this.state.job.id });
      if (this.state.paused) this.worker.postMessage({ type: 'checkpoint', jobId: this.state.job.id });
    }
    this.emit();
  }

  cancel() {
    if (!this.state.job) return;
    this.worker.postMessage({ type: 'cancel', jobId: this.state.job.id });
  }

  resumeSavedJob(id) {
    const saved = this.state.savedJobs.find(j => j.id === id);
    if (!saved || this.state.job) return;
    try {
      this.validateSavedJob(saved);
      const specimen = this.state.specimens.find(value => value.id === saved.specimenId);
      if (hashPolicy(specimen.policy) !== saved.manifest.initialPolicyHash
        || (saved.manifest.genome && JSON.stringify(specimen.genome) !== JSON.stringify(saved.manifest.genome))) {
        throw new Error('This specimen changed after the job was saved. Restore its original checkpoint before resuming.');
      }
      this.selectSpecimen(saved.specimenId); this.ensureWorker();
      this.activeManifest = copy(saved.manifest); this.activeSpecimen = copy(saved.specimen || specimen);
      const checkpoint = saved.checkpoint, type = checkpoint.type;
      this.state.job = { id: saved.id, type, completed: checkpoint.completed,
        total: type === 'train' ? checkpoint.episodes : checkpoint.count * checkpoint.conditions.length };
      this.state.stage = type === 'train' ? 'train' : 'expedition'; this.state.paused = false; this.state.error = null;
      if (type === 'train') this.state.history = copy(checkpoint.history);
      if (checkpoint.active) this.state.snapshot = snapshotEpisode(restoreEpisode(checkpoint.active));
      this.worker.postMessage({ type: 'resume', jobId: saved.id, checkpoint: copy(checkpoint) });
      this.emit();
    } catch (error) { this.fail(error); }
  }

  selectCheckpoint(id) {
    if (!this.state.ready || this.state.job) return;
    const specimen = this.state.specimen, checkpoint = specimen.checkpoints?.find(c => c.id === id);
    if (!checkpoint) return;
    specimen.policy = copy(checkpoint.policy);
    specimen.training = { episodes: checkpoint.episodes, curriculum: checkpoint.curriculum };
    specimen.history = copy(checkpoint.history || []); this.state.history = specimen.history;
    this.showMatchingResult();
    this.state.notice = `Restored checkpoint ${checkpoint.hash}.`;
    this.persist('specimen', specimen); this.preview(); this.emit();
  }

  selectRun(index) {
    this.state.runIndex = Math.max(0, Math.min(this.state.runs.length - 1, Number(index) || 0));
    this.setReplay(0);
  }

  setReplay(index, emit = true) {
    const frames = this.state.runs[this.state.runIndex]?.frames || [];
    this.state.replayIndex = Math.max(0, Math.min(frames.length - 1, Math.floor(Number(index) || 0)));
    if (frames[this.state.replayIndex]) {
      try { validateSnapshot(frames[this.state.replayIndex]); this.state.snapshot = frames[this.state.replayIndex]; }
      catch (error) { this.state.paused = true; return this.fail(error); }
    }
    if (emit) { this.state.paused = true; this.emit(); }
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt < 0 || this.state.job || this.state.paused || !['expedition', 'compare'].includes(this.state.stage)) return;
    const frames = this.state.runs[this.state.runIndex]?.frames || [];
    if (frames.length < 2) return;
    this.playClock += dt * 2;
    const spacing = Math.max(.05, (frames[1].t || .36) - (frames[0].t || 0));
    if (this.playClock >= spacing) {
      const steps = Math.floor(this.playClock / spacing); this.playClock %= spacing;
      const next = Math.min(this.state.replayIndex + steps, frames.length - 1);
      this.setReplay(next, false);
      if (next === frames.length - 1) this.state.paused = true;
      this.emit();
    }
  }

  toggleOverlay() { this.state.overlays = !this.state.overlays; this.emit(); }
  toggleAnatomy() { this.state.anatomy = !this.state.anatomy; this.emit(); }

  exportData() {
    if (!this.state.ready) return this.fail('The saved collection is still loading. Try again in a moment.');
    const result = this.state.result;
    this.download({ schemaVersion: 1, format: 'observatory-fly', exportedAt: new Date().toISOString(),
      specimen: copy(this.state.specimen), report: result?.report || null, runs: result?.runs || [],
      result: result ? { schemaVersion: 1, id: result.id, createdAt: result.createdAt, manifest: result.manifest } : null }, 'fly-expedition.json');
    this.state.notice = 'Specimen, learned policy, metrics and replay exported.'; this.emit();
  }

  async importData(file) {
    try {
      await this.ready;
      if (this.state.job) throw new Error('Finish or cancel the current job before importing.');
      if (!file || file.size > 30_000_000) throw new Error('Choose a Fly Lab export smaller than 30 MB.');
      const data = JSON.parse(await file.text());
      if (data.schemaVersion !== 1 || data.format !== 'observatory-fly') throw new Error('This file is not a compatible Fly Lab export.');
      this.validateSpecimen(data.specimen);
      const runs = data.runs || [];
      validateRuns(runs);
      if (data.report) {
        validateReport(data.report);
        if (data.report.policyHash !== hashPolicy(data.specimen.policy)
          || data.report.specimenName !== data.specimen.name) throw new Error('The exported results belong to a different specimen or checkpoint.');
      } else if (runs.length) throw new Error('Recorded flights require their original expedition report.');
      let result = null;
      if (data.report) {
        const metadata = data.result || { id: recordId('result'), schemaVersion: 1, createdAt: data.exportedAt,
          manifest: { specimenId: data.specimen.id, name: data.specimen.name,
            genome: copy(data.specimen.genome), initialPolicyHash: data.report.policyHash,
            seed: data.report.seed, scenario: data.report.scenario } };
        result = { ...copy(metadata), runs: copy(runs), report: copy(data.report), specimen: copy(data.specimen) };
        this.validateResult(result);
      }
      const specimen = copy(data.specimen); specimen.id = recordId(); specimen.createdAt = new Date().toISOString();
      if (result) {
        result.id = recordId('result'); result.specimen = copy(specimen);
        result.manifest.specimenId = specimen.id; result.manifest.genome = copy(specimen.genome);
        result.report.specimenId = specimen.id;
      }
      this.state.specimens.push(specimen); this.state.specimen = specimen; this.state.selectedId = specimen.id;
      this.state.history = specimen.history || [];
      if (result) { this.results.push(result); await this.persist('result', result); }
      this.showMatchingResult();
      await this.persist('specimen', specimen);
      this.state.error = null; this.state.notice = `${specimen.name} imported.`;
      this.preview(); this.emit();
    } catch (error) { this.fail(error); }
  }
}
