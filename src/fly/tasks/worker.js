import {
  FEATURE_NAMES,
  validateTaskPolicy,
  validateWorkspace,
  trainEpoch,
  evaluateDemonstrations,
  runTask,
  summarizeTaskRuns,
} from './core.js';

const CONTROLLERS = ['learned', 'filename', 'random'];

function validateExamples(examples, label, allowEmpty = false) {
  if (!Array.isArray(examples) || (!allowEmpty && !examples.length)) {
    throw new Error(`${label} must contain demonstration examples.`);
  }
  for (const example of examples) {
    if (!example || !Array.isArray(example.features) || !example.features.length
      || !Number.isInteger(example.chosen) || example.chosen < 0
      || example.chosen >= example.features.length) {
      throw new Error(`${label} contains an invalid demonstrated choice.`);
    }
    if (example.features.some(features => !Array.isArray(features)
      || features.length !== FEATURE_NAMES.length
      || features.some(value => typeof value !== 'number' || !Number.isFinite(value)))) {
      throw new Error(`${label} contains invalid feature vectors.`);
    }
  }
}

function makeJob(message) {
  const policy = structuredClone(message.policy);
  validateTaskPolicy(policy);
  const seed = message.seed ?? 17;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Seed must be an unsigned 32-bit integer.');
  }
  const base = { type: message.type, jobId: message.jobId, policy, seed };
  if (message.type === 'train') {
    const epochs = message.epochs ?? 40;
    const learningRate = message.learningRate ?? .08;
    if (!Number.isInteger(epochs) || epochs < 1 || epochs > 1000) {
      throw new Error('Choose between 1 and 1000 training epochs.');
    }
    if (typeof learningRate !== 'number' || !Number.isFinite(learningRate)
      || learningRate <= 0 || learningRate > 1) {
      throw new Error('Learning rate must be greater than zero and at most one.');
    }
    const examples = structuredClone(message.examples);
    const validation = structuredClone(message.validation ?? []);
    validateExamples(examples, 'Training data');
    validateExamples(validation, 'Validation data', true);
    return { ...base, epochs, learningRate, examples, validation, history: [] };
  }
  if (!Array.isArray(message.workspaces) || !message.workspaces.length) {
    throw new Error('Evaluation needs at least one workspace.');
  }
  const workspaces = message.workspaces.map(workspace => validateWorkspace(structuredClone(workspace)));
  return { ...base, workspaces, controllerIndex: 0, index: 0,
    runs: [], evaluation: {}, completed: 0 };
}

/** Injectable transport and scheduler let Node exercise the actual worker loop. */
export function createTaskWorker(post, schedule = callback => setTimeout(callback, 0)) {
  let job = null;
  let disposed = false;
  const send = message => { if (!disposed) post(structuredClone(message)); };

  function enqueue(current) {
    schedule(() => {
      // A cancelled callback must never advance a replacement job.
      if (disposed || job !== current) return;
      try {
        if (current.type === 'train') train(current);
        else evaluate(current);
        if (job === current) enqueue(current);
      } catch (error) {
        if (job === current) job = null;
        send({ type: 'error', jobId: current.jobId, error: error.message || String(error) });
      }
    });
  }

  function train(current) {
    const epoch = current.history.length + 1;
    const metrics = trainEpoch(current.policy, current.examples, {
      learningRate: current.learningRate,
      seed: (current.seed + epoch - 1) >>> 0,
    });
    const row = { epoch, loss: metrics.loss, accuracy: metrics.accuracy };
    if (current.validation.length) {
      const validation = evaluateDemonstrations(current.policy, current.validation);
      row.validationLoss = validation.loss;
      row.validationAccuracy = validation.accuracy;
    }
    current.history.push(row);
    send({ type: 'progress', jobId: current.jobId, mode: 'train', epoch,
      epochs: current.epochs, completed: epoch, total: current.epochs, history: current.history });
    // Transport callbacks may synchronously cancel in an embedded host/test.
    if (job !== current || disposed) return;
    if (epoch === current.epochs) {
      job = null;
      send({ type: 'trained', jobId: current.jobId, policy: current.policy, history: current.history });
    }
  }

  function evaluate(current) {
    const controller = CONTROLLERS[current.controllerIndex];
    current.runs.push(runTask(current.workspaces[current.index], current.policy, {
      controller, seed: current.seed + current.index,
    }));
    current.index++;
    current.completed++;
    send({ type: 'progress', jobId: current.jobId, mode: 'evaluate', controller,
      completed: current.completed, total: current.workspaces.length * CONTROLLERS.length });
    if (job !== current || disposed) return;
    if (current.index === current.workspaces.length) {
      current.evaluation[controller] = { summary: summarizeTaskRuns(current.runs), runs: current.runs };
      current.controllerIndex++;
      current.index = 0;
      current.runs = [];
      if (current.controllerIndex === CONTROLLERS.length) {
        job = null;
        send({ type: 'evaluated', jobId: current.jobId, evaluation: current.evaluation });
      }
    }
  }

  function handleMessage(message) {
    if (disposed) return;
    try {
      if (!message || typeof message !== 'object'
        || typeof message.jobId !== 'string' || !message.jobId.trim()) {
        throw new Error('A nonempty jobId is required.');
      }
      if (message.type === 'cancel') {
        if (job?.jobId === message.jobId) job = null;
        return;
      }
      if (message.type !== 'train' && message.type !== 'evaluate') {
        throw new Error(`Unsupported task worker message: ${String(message.type)}.`);
      }
      if (job) throw new Error('A task job is already running. Cancel it before starting another.');
      job = makeJob(message);
      enqueue(job);
    } catch (error) {
      send({ type: 'error', jobId: message?.jobId ?? null, error: error.message || String(error) });
    }
  }

  return { handleMessage, dispose() { disposed = true; job = null; } };
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  const worker = createTaskWorker(message => globalThis.postMessage(message));
  globalThis.onmessage = event => worker.handleMessage(event.data);
}
