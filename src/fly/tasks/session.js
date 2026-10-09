import { listRecords, putRecord, downloadJSON, recordId } from '../records/store.js';
import { createTaskPolicy, validateTaskPolicy, validateWorkspace, validateDataset, createTaskRun,
  taskCandidates, stepTaskRun, collectDemonstrations, createArtifact, validateArtifact,
  taskPolicyHash, datasetDigest, canonicalJSON, sha256, FEATURE_NAMES, TASK_LIMITS } from './core.js';
import { createStarterDataset } from './fixtures.js';

const copy = value => structuredClone(value);
const steps = new Set(['create', 'data', 'teach', 'train', 'test', 'export']);
const timestamp = () => new Date().toISOString();
const DATASET_FILE_LIMIT = 32_000_000;
const datasetCache = new WeakMap();
const allWorkspaces = dataset => [...dataset.train, ...dataset.validation, ...dataset.test];
const workspaceKey = workspace => sha256(canonicalJSON(validateWorkspace(workspace)));
const workspaceContentKey = workspace => sha256(canonicalJSON(workspace.files.map(file => file.content).sort()));
function datasetInfo(dataset) {
  if (!datasetCache.has(dataset)) datasetCache.set(dataset, {
    digest: datasetDigest(dataset), trainingKeys: new Map(dataset.train.map(w => [w.id, workspaceKey(w)])),
    examples: dataset.train.flatMap(collectDemonstrations),
  });
  return datasetCache.get(dataset);
}
const matchingEvaluation = (fly, dataset) => fly.evaluationPolicyHash === taskPolicyHash(fly.policy)
  && fly.evaluation?.datasetDigest === datasetInfo(dataset).digest ? fly.evaluation : null;
const validHistory = history => Array.isArray(history) && history.length <= 500
  && history.every(row => Number.isInteger(row.epoch) && Number.isFinite(row.loss) && Number.isFinite(row.accuracy));
const validDemo = demo => demo && typeof demo.workspaceId === 'string' && typeof demo.workspaceDigest === 'string'
  && demo.source === 'human' && Array.isArray(demo.features) && demo.features.length > 0 && demo.features.length <= TASK_LIMITS.files
  && demo.features.every(row => Array.isArray(row) && row.length === FEATURE_NAMES.length && row.every(n => Number.isFinite(n) && Math.abs(n) <= 10))
  && Number.isInteger(demo.chosen) && demo.chosen >= 0 && demo.chosen < demo.features.length;
const activeDemonstrations = (dataset, demonstrations) => {
  const keys = datasetInfo(dataset).trainingKeys;
  return demonstrations.filter(demo => keys.get(demo.workspaceId) === demo.workspaceDigest);
};
function datasetBundle(dataset, demonstrations) {
  const bundle = { format: 'fly-task-dataset', schemaVersion: 1, dataset, demonstrations: activeDemonstrations(dataset, demonstrations) };
  if (new TextEncoder().encode(JSON.stringify(bundle)).length > DATASET_FILE_LIMIT) throw new Error('Dataset package exceeds 32 MB. Use a smaller collection of sample files or demonstrations.');
  return bundle;
}

function specimen(name = 'Fern', policy = createTaskPolicy()) {
  return { id: recordId('fly'), name: String(name).trim().slice(0, 60) || 'Fern', policy,
    createdAt: timestamp(), history: [], training: null, evaluation: null, evaluationPolicyHash: null, revision: 1 };
}

/** Browser-owned training collection. The deployable artifact contains no workspace files. */
export class TaskTrainingSession {
  constructor({ storage = { listRecords, putRecord }, download = downloadJSON,
    workerFactory = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) } = {}) {
    this.storage = storage; this.download = download; this.workerFactory = workerFactory;
    this.listeners = new Set(); this.writeQueue = Promise.resolve(); this.worker = null;
    const first = specimen(), dataset = validateDataset(createStarterDataset());
    this.state = { ready: false, step: 'create', specimens: [first], specimen: first, selectedId: first.id,
      dataset, workspace: dataset.train[0], run: null, candidates: [], demonstrations: [],
      history: [], evaluation: null, job: null, error: null, notice: 'Start with a fly. Teach it to find the useful files.', teaching: false };
    this.ready = this.load();
  }
  subscribe(fn) { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.state); }
  fail(error) { this.state.error = error?.message || String(error); this.emit(); return false; }
  guard() {
    if (!this.state.ready) return this.fail('Your saved collection is still loading.');
    if (this.state.job) return this.fail('Finish or cancel the current job first.');
    this.state.error = null; return true;
  }
  async load() {
    try {
      const saved = (await this.storage.listRecords('task-studio')).find(row => row.id === 'studio');
      if (saved) {
        if (saved.schemaVersion !== 1 || !Array.isArray(saved.specimens) || !saved.specimens.length || saved.specimens.length > 100) throw new Error('Saved task collection is incompatible.');
        const dataset = validateDataset(saved.dataset);
        for (const fly of saved.specimens) {
          if (typeof fly.id !== 'string' || typeof fly.name !== 'string' || !fly.name.trim() || fly.name.length > 80 || !validHistory(fly.history || [])) throw new Error('Invalid saved fly.');
          validateTaskPolicy(fly.policy);
        }
        const fly = saved.specimens.find(row => row.id === saved.selectedId) || saved.specimens[0];
        Object.assign(this.state, { specimens: saved.specimens, specimen: fly, selectedId: fly.id, dataset,
          workspace: allWorkspaces(dataset).find(row => row.id === saved.workspaceId) || dataset.train[0],
          demonstrations: (saved.demonstrations || []).filter(validDemo), step: steps.has(saved.step) ? saved.step : 'data',
          history: fly.history || [], evaluation: matchingEvaluation(fly, dataset),
          notice: 'Your training collection is restored. All data stays in this browser.' });
      }
    } catch (error) { this.state.notice = `Using a fresh training collection: ${error.message}`; }
    this.state.ready = true; this.refreshTrainingInfo(); this.emit();
  }
  persist() {
    const record = copy({ id: 'studio', schemaVersion: 1, specimens: this.state.specimens,
      selectedId: this.state.selectedId, dataset: this.state.dataset, workspaceId: this.state.workspace?.id,
      demonstrations: this.state.demonstrations, step: this.state.step });
    this.writeQueue = this.writeQueue.catch(() => {}).then(() => this.storage.putRecord('task-studio', record)).catch(error => {
      this.state.notice = `Browser saving unavailable: ${error.message}. Download your dataset and trained fly before closing.`; this.emit();
    });
    return this.writeQueue;
  }
  refreshTrainingInfo() {
    this.state.humanExampleCount = activeDemonstrations(this.state.dataset, this.state.demonstrations).length;
    this.state.trainingExampleCount = this.trainingExamples().length;
  }
  setStep(step) {
    if (!steps.has(step)) return;
    this.state.step = step;
    if (step === 'teach' && !this.state.dataset.train.some(row => row.id === this.state.workspace?.id)) {
      this.state.workspace = this.state.dataset.train[0]; this.state.run = null; this.state.candidates = []; this.state.teaching = false;
    }
    this.emit(); this.persist();
  }
  createSpecimen({ name = 'Fern' } = {}) {
    if (!this.guard()) return;
    if (this.state.specimens.length >= 100) return this.fail('This collection already has 100 flies.');
    const fly = specimen(name); this.state.specimens.push(fly); this.selectSpecimen(fly.id);
    this.state.step = 'data'; this.state.notice = `${fly.name} starts with fresh weights. Choose its examples.`; this.emit(); this.persist();
    return fly;
  }
  selectSpecimen(id) {
    if (!this.guard()) return;
    const fly = this.state.specimens.find(row => row.id === id); if (!fly) return;
    Object.assign(this.state, { specimen: fly, selectedId: id, history: fly.history || [],
      evaluation: matchingEvaluation(fly, this.state.dataset),
      run: null, candidates: [], teaching: false }); this.emit(); this.persist();
  }
  loadStarter() {
    if (!this.guard()) return;
    this.setDataset(createStarterDataset(), 'Synthetic starter workspaces loaded. Train, validation, and test projects are separate.');
  }
  setDataset(raw, notice, demonstrations = this.state.demonstrations) {
    const dataset = validateDataset(raw);
    const bundle = datasetBundle(dataset, demonstrations);
    Object.assign(this.state, { dataset, demonstrations: bundle.demonstrations, workspace: dataset.train[0], run: null, candidates: [], teaching: false, notice });
    this.state.evaluation = matchingEvaluation(this.state.specimen, dataset);
    this.refreshTrainingInfo(); this.emit(); this.persist();
  }
  async readJSON(file, limit = DATASET_FILE_LIMIT) {
    if (!file || file.size > limit) throw new Error(`Choose a JSON file smaller than ${limit / 1_000_000} MB.`);
    try { return JSON.parse(await file.text()); } catch { throw new Error('The file is not valid JSON.'); }
  }
  async importDataset(file) {
    if (!this.guard()) return;
    try {
      const raw = await this.readJSON(file);
      if (!this.guard()) return;
      const data = raw.dataset || raw;
      const workspace = data.files ? validateWorkspace(data) : null;
      if (raw.demonstrations !== undefined && (!Array.isArray(raw.demonstrations) || raw.demonstrations.length > 5000 || !raw.demonstrations.every(validDemo))) throw new Error('Dataset contains invalid teaching decisions.');
      this.setDataset(workspace ? { id: recordId('dataset'), name: workspace.name, train: [workspace], validation: [], test: [] } : data,
        'Dataset validated and imported. Only training workspaces contribute demonstrations.', raw.demonstrations || []);
    } catch (error) { this.fail(error); }
  }
  async importFiles(fileList, { query = 'experiment metrics', fields = ['run', 'success', 'duration'], maxReads = 4 } = {}) {
    if (!this.guard()) return;
    try {
      const files = Array.from(fileList || []);
      if (!files.length || files.length > TASK_LIMITS.files) throw new Error(`Choose between 1 and ${TASK_LIMITS.files} JSON/CSV files.`);
      if (files.reduce((sum, file) => sum + file.size, 0) > 4_000_000) throw new Error('A sample workspace must be smaller than 4 MB.');
      const contents = await Promise.all(files.map(async file => ({ path: file.webkitRelativePath || file.name, content: await file.text() })));
      const workspace = validateWorkspace({ id: recordId('workspace'), name: files[0].webkitRelativePath?.split('/')[0] || 'Imported workspace',
        files: contents, task: { query, fields: Array.isArray(fields) ? fields : String(fields).split(',').map(s => s.trim()).filter(Boolean), maxReads: Number(maxReads) } });
      if (!this.guard()) return;
      const dataset = { ...this.state.dataset, id: recordId('dataset'), name: 'Custom training collection', train: [...this.state.dataset.train, workspace] };
      this.setDataset(dataset, 'Your files were added to training only. Existing test workspaces remain separate.');
      this.selectWorkspace(workspace.id);
    } catch (error) { this.fail(error); }
  }
  exportDataset() {
    if (!this.state.ready) return;
    try { this.download(copy(datasetBundle(this.state.dataset, this.state.demonstrations)), 'fly-training-dataset.json'); }
    catch (error) { return this.fail(error); }
    this.state.notice = 'Dataset exported, including workspace file contents and your teaching decisions.'; this.emit();
  }
  selectWorkspace(id) {
    if (!this.guard()) return;
    const workspace = allWorkspaces(this.state.dataset).find(row => row.id === id); if (!workspace) return;
    Object.assign(this.state, { workspace, run: null, candidates: [], teaching: false }); this.emit(); this.persist();
  }
  startTeaching() {
    if (!this.guard()) return;
    const workspace = this.state.workspace;
    if (!this.state.dataset.train.some(row => row.id === workspace?.id)) return this.fail('Teaching is only available for training workspaces. Keep test projects unseen by the learner.');
    this.state.run = createTaskRun(workspace, this.state.specimen.policy);
    this.state.candidates = taskCandidates(this.state.run); this.state.teaching = true;
    this.state.notice = 'Choose the next file to inspect. Each choice becomes a labeled training decision.'; this.emit();
  }
  teach(candidateId) {
    if (!this.guard()) return;
    if (!this.state.teaching || !this.state.run || this.state.run.done) return;
    const candidates = taskCandidates(this.state.run), chosen = candidates.findIndex(row => row.id === candidateId);
    if (chosen < 0) return this.fail('This candidate is no longer available.');
    if (this.state.demonstrations.length >= 5000) return this.fail('This collection has reached its 5,000 teaching-decision limit.');
    const demo = { workspaceId: this.state.workspace.id, workspaceDigest: workspaceKey(this.state.workspace),
      source: 'human', features: candidates.map(row => [...row.features]), chosen, path: candidates[chosen].path, createdAt: timestamp() };
    try { datasetBundle(this.state.dataset, [...this.state.demonstrations, demo]); } catch (error) { return this.fail(error); }
    try { stepTaskRun(this.state.run, candidateId); } catch (error) { return this.fail(error); }
    this.state.demonstrations.push(demo); this.state.candidates = taskCandidates(this.state.run);
    this.state.notice = this.state.run.done ? 'Teaching run complete. Your decisions are ready for training.' : 'Decision recorded. Choose the next file.';
    this.refreshTrainingInfo(); this.emit(); this.persist();
  }
  resetTeaching() { this.startTeaching(); }
  runPreview() {
    if (!this.guard()) return;
    try {
      const run = createTaskRun(this.state.workspace, this.state.specimen.policy);
      while (!run.done) stepTaskRun(run);
      this.state.run = run; this.state.candidates = []; this.state.teaching = false;
      this.state.notice = 'Frozen-policy preview. No weights or teaching decisions changed.'; this.emit();
    } catch (error) { this.fail(error); }
  }
  trainingExamples() {
    const human = activeDemonstrations(this.state.dataset, this.state.demonstrations);
    const teacher = datasetInfo(this.state.dataset).examples;
    // A human demonstration takes precedence over a bootstrap label for the same visible decision.
    const keys = new Set(human.map(row => `${row.workspaceId}:${JSON.stringify(row.features)}`));
    return [...teacher.filter(row => !keys.has(`${row.workspaceId}:${JSON.stringify(row.features)}`)), ...human];
  }
  getWorker() {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.onmessage = event => this.handleMessage(event.data);
      this.worker.onerror = event => { this.state.job = null; this.worker?.terminate?.(); this.worker = null; this.fail(event.message || 'The training worker stopped unexpectedly.'); };
    }
    return this.worker;
  }
  train({ epochs = 60, learningRate = .05, seed = 17 } = {}) {
    if (!this.guard()) return;
    epochs = Number(epochs); learningRate = Number(learningRate); seed = Number(seed);
    if (!Number.isInteger(epochs) || epochs < 1 || epochs > 300 || !Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 1
      || !Number.isInteger(seed) || seed < 1 || seed > 2147483647) return this.fail('Use 1–300 epochs, learning rate above 0 and at most 1, and a positive integer seed.');
    const examples = this.trainingExamples();
    if (!examples.length) return this.fail('No teaching examples yet. Use the Teach section or add files containing the requested fields.');
    const id = recordId('train'), fly = this.state.specimen;
    if ((fly.training?.lineage?.length || 0) >= 100) return this.fail('This fly has 100 training revisions. Create a fresh scout for another training lineage.');
    this.state.job = { id, type: 'train', specimenId: fly.id, epoch: 0, epochs, progress: 0,
      task: copy((this.state.dataset.train.find(w => w.id === this.state.workspace?.id) || this.state.dataset.train[0]).task),
      workspaceDigests: this.state.dataset.train.map(workspaceContentKey),
      training: { epochs, examples: examples.length, humanExamples: examples.filter(row => row.source === 'human').length,
        seed, learningRate, datasetId: this.state.dataset.id, datasetDigest: datasetInfo(this.state.dataset).digest,
        trainingWorkspaceIds: this.state.dataset.train.map(w => w.id), source: 'teacher-and-human-demonstrations',
        trainerVersion: 'report-scout-cross-entropy-v1', codeVersion: 'report-scout-runtime-v1',
        splitDigest: sha256(canonicalJSON(Object.fromEntries(['train', 'validation', 'test'].map(key => [key, this.state.dataset[key].map(w => w.id)])))),
        startedAt: timestamp() } };
    this.state.history = []; this.state.error = null; this.state.notice = 'Learning from demonstrated file choices. Test workspaces stay out of training.';
    try { this.getWorker().postMessage({ type: 'train', jobId: id, policy: copy(fly.policy), examples: copy(examples),
      validation: this.state.dataset.validation.flatMap(collectDemonstrations), epochs, learningRate, seed }); }
    catch (error) { this.state.job = null; return this.fail(error); }
    this.emit();
  }
  evaluate() {
    if (!this.guard()) return;
    if (!this.state.dataset.test.length) return this.fail('Import a dataset with separate test workspaces before evaluating.');
    const id = recordId('test'), fly = this.state.specimen;
    const learnedWorkspaces = new Set((fly.training?.lineage || []).flatMap(entry => entry.workspaceDigests));
    if (this.state.dataset.test.some(w => learnedWorkspaces.has(workspaceContentKey(w)))) return this.fail('A test workspace was used in this fly’s earlier training. Use unseen test projects or create a fresh scout.');
    this.state.job = { id, type: 'evaluate', specimenId: fly.id, policyHash: taskPolicyHash(fly.policy), progress: 0,
      datasetDigest: datasetInfo(this.state.dataset).digest, testWorkspaceIds: this.state.dataset.test.map(w => w.id) };
    this.state.notice = 'Testing frozen policies on the same held-out workspaces.';
    try { this.getWorker().postMessage({ type: 'evaluate', jobId: id, policy: copy(fly.policy), workspaces: copy(this.state.dataset.test) }); }
    catch (error) { this.state.job = null; return this.fail(error); }
    this.emit();
  }
  handleMessage(message) {
    const job = this.state.job; if (!job || message?.jobId !== job.id) return;
    try {
      if (message.type === 'error') throw new Error(message.error || 'The worker could not complete this job.');
      if (message.type === 'progress') {
        job.epoch = message.epoch || 0;
        job.progress = Math.min(1, Math.max(0, message.completed && message.total ? message.completed / message.total : job.epoch / (job.epochs || 1)));
        if (message.history) { if (!validHistory(message.history)) throw new Error('Invalid learning history.'); this.state.history = message.history; }
      }
      const fly = this.state.specimens.find(row => row.id === job.specimenId);
      if (message.type === 'trained') {
        validateTaskPolicy(message.policy); if (!validHistory(message.history)) throw new Error('Invalid learning history.');
        const previous = fly.training;
        fly.policy = copy(message.policy); fly.history = copy(message.history); fly.task = job.task;
        const policyHash = taskPolicyHash(fly.policy);
        fly.training = { ...job.training, completedAt: timestamp(), policyHash,
          unknownPriorTraining: Boolean(previous?.unknownPriorTraining),
          lineage: [...(previous?.lineage || []), { datasetDigest: job.training.datasetDigest, policyHash, epochs: job.epochs,
            seed: job.training.seed, learningRate: job.training.learningRate, workspaceDigests: job.workspaceDigests }] };
        fly.revision++; fly.evaluation = null; fly.evaluationPolicyHash = null;
        this.state.history = fly.history; this.state.evaluation = null; this.state.job = null;
        this.state.notice = `${fly.name} finished ${job.epochs} epochs. Test this checkpoint before exporting.`;
        this.persist();
      }
      if (message.type === 'evaluated') {
        const evaluation = message.evaluation;
        if (!evaluation || !['learned', 'filename', 'random'].every(key => evaluation[key]?.summary
          && Number.isFinite(evaluation[key].summary.coverage) && Array.isArray(evaluation[key].runs))) throw new Error('Invalid evaluation result.');
        fly.evaluation = { ...copy(evaluation), datasetDigest: job.datasetDigest, testWorkspaceIds: job.testWorkspaceIds,
          policyHash: job.policyHash, completedAt: timestamp() };
        fly.evaluationPolicyHash = job.policyHash; this.state.evaluation = fly.evaluation; this.state.job = null;
        this.state.notice = 'Evaluation complete. Compare coverage, useful reads, and source-linked reports.';
        this.persist();
      }
      this.emit();
    } catch (error) { this.worker?.postMessage({ type: 'cancel', jobId: job.id }); this.state.job = null; this.fail(error); }
  }
  cancel() {
    if (!this.state.job) return;
    this.worker?.postMessage({ type: 'cancel', jobId: this.state.job.id }); this.state.job = null;
    this.state.history = this.state.specimen.history || [];
    this.state.notice = 'Job cancelled. The last completed checkpoint is unchanged.'; this.emit();
  }
  artifactPreview() {
    const fly = this.state.specimen;
    if (!fly.policy.trainedEpochs || !fly.training || !this.state.evaluation || !matchingEvaluation(fly, this.state.dataset)) return null;
    return createArtifact({ id: fly.id, name: fly.name, revision: fly.revision, policy: copy(fly.policy),
      training: copy(fly.training), evaluation: copy(this.state.evaluation), task: copy(fly.task || this.state.dataset.train[0].task) });
  }
  exportArtifact() {
    if (!this.guard()) return;
    try {
      const artifact = this.artifactPreview();
      if (!artifact) return this.fail('Train this fly, then evaluate its current checkpoint before exporting.');
      validateArtifact(artifact);
      this.download(artifact, `${this.state.specimen.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fly'}.fly.json`);
      this.state.notice = 'Trained fly exported. The xo-space adapter will be built in the next stage; no deployment has occurred.'; this.emit();
      return artifact;
    } catch (error) { this.fail(error); }
  }
  async importArtifact(file) {
    if (!this.guard()) return;
    try {
      const artifact = validateArtifact(await this.readJSON(file, 2_000_000)); if (!this.guard()) return;
      if (this.state.specimens.length >= 100) return this.fail('This collection already has 100 flies.');
      const fly = specimen(`${artifact.fly.name} · imported`, copy(artifact.policy));
      fly.training = { ...artifact.training, unknownPriorTraining: artifact.training.unknownPriorTraining || !artifact.training.lineage?.length };
      fly.task = artifact.task; fly.importedFrom = artifact.fly.id; fly.revision = artifact.fly.revision || 1;
      this.state.specimens.push(fly); this.selectSpecimen(fly.id);
      this.state.notice = 'Artifact validated and imported as a new fly. Evaluate it on your test suite before re-exporting.'; this.emit(); this.persist();
    } catch (error) { this.fail(error); }
  }
  dispose() { this.cancel(); this.worker?.terminate?.(); this.worker = null; this.listeners.clear(); }
}
