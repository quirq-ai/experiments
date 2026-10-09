import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskWorker } from '../../src/fly/tasks/worker.js';
import {
  FEATURE_NAMES, createTaskPolicy, trainEpoch, evaluateDemonstrations,
  evaluateTaskPolicy,
} from '../../src/fly/tasks/core.js';

function harness() {
  const messages = [], pending = [];
  const worker = createTaskWorker(message => messages.push(message), callback => pending.push(callback));
  const next = () => pending.shift()?.();
  const flush = () => {
    let remaining = 5000;
    while (pending.length && remaining-- > 0) next();
    assert.ok(remaining > 0, 'Worker must finish in a bounded number of scheduled chunks.');
  };
  return { worker, messages, pending, next, flush };
}

function examples() {
  const vector = value => FEATURE_NAMES.map((_, index) => index === 0 ? value : 0);
  return [
    { features: [vector(0), vector(1)], chosen: 1, workspaceId: 'train-a', source: 'teacher' },
    { features: [vector(.8), vector(.1)], chosen: 0, workspaceId: 'train-b', source: 'teacher' },
  ];
}

function training(jobId, overrides = {}) {
  return { type: 'train', jobId, policy: createTaskPolicy(17), examples: examples(),
    validation: examples(), epochs: 4, learningRate: .08, seed: 23, ...overrides };
}

function workspaces() {
  return [0, 1].map(index => ({ id: `heldout-${index}`, name: `Held-out workspace ${index}`,
    task: { fields: ['run', 'success', 'duration'], query: 'experiment metrics', maxReads: 2 },
    files: [
      { path: 'notes.json', content: JSON.stringify({ notes: 'A plan without measured results.' }) },
      { path: 'metrics/measurements.csv', content: `run,success,duration\n${index},true,${12 + index}\n` },
      { path: 'archive/old.json', content: JSON.stringify({ run: `old-${index}`, success: false, duration: 80 }) },
      { path: 'draft.json', content: JSON.stringify({ run: 'unfinished' }) },
    ] }));
}

test('task worker training matches headless epochs and preserves caller-owned inputs', () => {
  const h = harness(), message = training('train-parity');
  const original = structuredClone(message), expected = structuredClone(message.policy), history = [];
  for (let i = 0; i < message.epochs; i++) {
    const metrics = trainEpoch(expected, original.examples, {
      learningRate: message.learningRate, seed: message.seed + i,
    });
    const validation = evaluateDemonstrations(expected, original.validation);
    history.push({ epoch: i + 1, loss: metrics.loss, accuracy: metrics.accuracy,
      validationLoss: validation.loss, validationAccuracy: validation.accuracy });
  }
  h.worker.handleMessage(message);
  assert.equal(h.messages.length, 0, 'Starting a job schedules work instead of running synchronously.');
  h.next();
  assert.equal(h.messages[0].epoch, 1);
  assert.equal(h.messages[0].history.length, 1);
  h.flush();
  const result = h.messages.find(item => item.type === 'trained');
  assert.deepEqual(result.policy, expected);
  assert.deepEqual(result.history, history);
  assert.deepEqual(message, original);
  assert.equal(h.messages[0].history.length, 1, 'Earlier progress is an immutable transport snapshot.');
  assert.equal(h.messages.filter(item => item.type === 'trained').length, 1);
});

test('cancelled task jobs cannot emit results or advance a replacement job', () => {
  const h = harness();
  h.worker.handleMessage(training('old'));
  h.next();
  assert.equal(h.messages.length, 1);
  h.worker.handleMessage({ type: 'cancel', jobId: 'old' });
  h.worker.handleMessage(training('new', { epochs: 2 }));
  h.next(); // The previously queued callback belongs to the cancelled job.
  assert.equal(h.messages.length, 1);
  h.flush();
  assert.equal(h.messages.filter(item => item.jobId === 'old').length, 1);
  assert.deepEqual(h.messages.filter(item => item.jobId === 'new' && item.type === 'progress')
    .map(item => item.epoch), [1, 2]);
  assert.deepEqual(h.messages.filter(item => item.type === 'trained').map(item => item.jobId), ['new']);
});

test('a busy task worker rejects a second job while finishing the original', () => {
  const h = harness();
  h.worker.handleMessage(training('accepted', { epochs: 2 }));
  h.worker.handleMessage(training('rejected'));
  h.worker.handleMessage({ type: 'cancel', jobId: 'unrelated' });
  h.flush();
  assert.match(h.messages.find(item => item.jobId === 'rejected').error, /already running/);
  assert.deepEqual(h.messages.filter(item => item.type === 'trained').map(item => item.jobId), ['accepted']);
});

test('chunked task evaluation matches headless learned and baseline runs without changing weights', () => {
  const h = harness(), policy = createTaskPolicy(29), fixtures = workspaces();
  policy.weights[FEATURE_NAMES.indexOf('measurement_name')] = 2;
  const original = structuredClone({ policy, fixtures });
  const expected = Object.fromEntries(['learned', 'filename', 'random'].map(controller =>
    [controller, evaluateTaskPolicy(policy, fixtures, { controller, seed: 71 })]));
  h.worker.handleMessage({ type: 'evaluate', jobId: 'evaluate-parity', policy, workspaces: fixtures, seed: 71 });
  assert.equal(h.messages.length, 0);
  h.next();
  assert.equal(h.messages[0].completed, 1);
  assert.equal(h.messages[0].total, 6);
  h.flush();
  const result = h.messages.find(item => item.type === 'evaluated');
  assert.deepEqual(result.evaluation, expected);
  assert.deepEqual({ policy, fixtures }, original);
  assert.equal(h.messages.filter(item => item.type === 'progress').length, 6);
  assert.equal(h.messages.filter(item => item.type === 'evaluated').length, 1);
});

test('task evaluation yields between workspaces so cancellation suppresses remaining results', () => {
  const h = harness();
  h.worker.handleMessage({ type: 'evaluate', jobId: 'cancel-evaluation',
    policy: createTaskPolicy(), workspaces: workspaces() });
  h.next();
  h.worker.handleMessage({ type: 'cancel', jobId: 'cancel-evaluation' });
  h.flush();
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].completed, 1);
});

test('invalid task jobs fail before scheduling and do not poison the worker', () => {
  const h = harness();
  const invalid = [
    { type: 'train' },
    training('epochs', { epochs: 0 }),
    training('rate', { learningRate: NaN }),
    training('seed', { seed: -1 }),
    training('policy', { policy: { ...createTaskPolicy(), family: 'unknown' } }),
    training('empty', { examples: [] }),
    training('features', { examples: [{ features: [[NaN]], chosen: 0 }] }),
    { type: 'evaluate', jobId: 'no-workspaces', policy: createTaskPolicy(), workspaces: [] },
    { type: 'unknown', jobId: 'unknown' },
  ];
  for (const message of invalid) h.worker.handleMessage(message);
  assert.equal(h.messages.length, invalid.length);
  assert.ok(h.messages.every(item => item.type === 'error' && typeof item.error === 'string'));
  assert.equal(h.pending.length, 0);
  h.worker.handleMessage(training('recovered', { epochs: 1 }));
  h.flush();
  assert.ok(h.messages.some(item => item.type === 'trained' && item.jobId === 'recovered'));
});

test('disposing a task worker suppresses queued work and subsequent messages', () => {
  const h = harness();
  h.worker.handleMessage(training('disposed'));
  h.worker.dispose();
  h.worker.handleMessage(training('after-dispose'));
  h.flush();
  assert.deepEqual(h.messages, []);
});
