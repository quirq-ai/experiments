import test from 'node:test';
import assert from 'node:assert/strict';
import { createEpisode, createPolicy, createGenome, stepEpisode, snapshotEpisode, summarizeEpisode,
  checkpointEpisode, restoreEpisode, observe, DT, validatePolicy } from '../../src/fly/core/engine.js';
import { FEATURE_COUNT, updateSarsa, encode } from '../../src/fly/policies/sarsa.js';
import { trainPolicy, evaluatePolicy, hashPolicy, aggregate } from '../../src/fly/experiments/runner.js';

test('SARSA has an independently calculable terminal and bootstrapped update', () => {
  const policy = createPolicy(), traces = Array(FEATURE_COUNT * 3).fill(0);
  updateSarsa(policy, traces, [0], 1, 2, [1], 2, true, { alpha: .4, gamma: .9, lambda: .5 });
  assert.equal(policy.weights[FEATURE_COUNT], .8); // alpha × (reward − zero estimate)
  policy.weights[2 * FEATURE_COUNT + 1] = 1;
  updateSarsa(policy, traces, [0], 1, .2, [1], 2, false, { alpha: .4, gamma: .9, lambda: .5 });
  assert.ok(Math.abs(policy.weights[FEATURE_COUNT] - .92) < 1e-12); // .8 + .4 × (.2 + .9 − .8)
  assert.equal(policy.weights[0], 0);
});

test('render-independent tick batches and JSON resume reproduce exact state, including learner traces', () => {
  const options = { seed: 18, training: true, scenario: 'wind-shift' };
  const a = createEpisode(options), b = createEpisode(options);
  stepEpisode(a, 160);
  for (const count of [3, 7, 31, 1, 28]) stepEpisode(b, count);
  const restored = restoreEpisode(JSON.parse(JSON.stringify(checkpointEpisode(b))));
  stepEpisode(restored, 90);
  assert.deepEqual(checkpointEpisode(restored), checkpointEpisode(a));
  assert.ok(a.events.some(e => e.type === 'wind-shift' && e.tick === 90));
  assert.equal(a.t, a.tick * DT);
});

test('evaluation leaves its source checkpoint immutable and sensor state independent', () => {
  const { policy } = trainPolicy({ episodes: 40, seed: 1 });
  const before = hashPolicy(policy), a = createEpisode({ policy, seed: 8001 }), b = createEpisode({ policy, seed: 8001 });
  stepEpisode(a, 30);
  assert.equal(hashPolicy(a.policy), before);
  assert.equal(hashPolicy(policy), before);
  assert.equal(b.tick, 0);
  assert.notDeepEqual(a.fly.sensorMemory, b.fly.sensorMemory);
  assert.equal(observe(a).target, undefined);
  assert.equal(observe(a).sources, undefined);
});

test('both scent channels and inherited sensory memory influence permitted observations', () => {
  const slow = createEpisode({ seed: 21, genome: createGenome({ memory: 5 }) });
  const fast = createEpisode({ seed: 21, genome: createGenome({ memory: .2 }) });
  stepEpisode(slow, 30); stepEpisode(fast, 30);
  assert.notDeepEqual(slow.fly.sensorMemory, fast.fly.sensorMemory);
  const observation = observe(fast);
  assert.notDeepEqual(encode({ ...observation, odor: [.1, 0] }), encode({ ...observation, odor: [.1, 2] }));
});

test('arrival is credited once; evaluation rewards do not use privileged shaping', () => {
  const ep = createEpisode({ seed: 19 });
  const target = ep.sources.find(s => s.rewarded);
  Object.assign(ep.fly, { x: target.x, y: target.y, z: target.z });
  stepEpisode(ep, 1);
  assert.equal(ep.fly.success, true);
  assert.equal(ep.reward, 8 - .015);
  const total = ep.totalReward; stepEpisode(ep, 100);
  assert.equal(ep.totalReward, total);
  assert.equal(ep.events.filter(e => e.type === 'arrival').length, 1);
});

test('incompatible policies fail explicitly and seeded worlds differ', () => {
  assert.throws(() => validatePolicy({ ...createPolicy(), encoderVersion: 'unrecognized' }));
  assert.throws(() => validatePolicy({ ...createPolicy(), weights: [NaN] }));
  assert.throws(() => restoreEpisode({ schemaVersion: 99 }));
  assert.notDeepEqual(createEpisode({ seed: 1 }).sources, createEpisode({ seed: 2 }).sources);
});

test('fixed training budget improves held-out validation success across independent training seeds', () => {
  const baseline = evaluatePolicy({ seed: 500000, count: 50 });
  for (const seed of [1, 2, 3]) {
    const result = trainPolicy({ seed, episodes: 180 });
    assert.ok(result.policy.weights.some(v => v !== 0));
    const validation = evaluatePolicy({ policy: result.policy, seed: 500000, count: 50 });
    assert.ok(validation.summary.successRate - baseline.summary.successRate >= .25,
      `training seed ${seed}: ${validation.summary.successRate} versus ${baseline.summary.successRate}`);
  }
});

test('cohort metrics retain failures and report Wilson uncertainty', () => {
  const result = aggregate([{ success: true, timeout: false, duration: 10, timeToSource: 10,
    reward: 8, pathLength: 1, energyUsed: .25, collisions: 0, wrongSourceVisits: 0 },
  { success: false, timeout: true, duration: 30, timeToSource: null,
    reward: -1, pathLength: 2, energyUsed: .75, collisions: 2, wrongSourceVisits: 1 }]);
  assert.equal(result.meanDuration, 20); assert.equal(result.meanTimeToSource, 10);
  assert.equal(result.timeouts, 1); assert.equal(result.successRate, .5);
  assert.ok(result.confidence95[0] < .5 && result.confidence95[1] > .5);
});

test('worker evaluation matches the headless runner and pause/resume preserves training', async () => {
  const messages = [];
  globalThis.self = { postMessage: message => messages.push(structuredClone(message)) };
  await import('../../src/fly/runtime/worker.js');
  const waitFor = async type => {
    for (let i = 0; i < 2000; i++) {
      const message = messages.find(m => m.type === type);
      if (message) return message;
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    throw new Error(`Worker did not return ${type}`);
  };
  self.onmessage({ data: { type: 'evaluate', jobId: 'eval', seed: 9100, count: 2 } });
  const evaluated = await waitFor('evaluated');
  assert.deepEqual(evaluated.summary, evaluatePolicy({ seed: 9100, count: 2 }).summary);
  messages.length = 0;
  self.onmessage({ data: { type: 'train', jobId: 'train', seed: 33, episodes: 3 } });
  await waitFor('progress');
  self.onmessage({ data: { type: 'pause', jobId: 'train' } });
  const paused = await waitFor('paused');
  self.onmessage({ data: { type: 'cancel', jobId: 'train' } });
  self.onmessage({ data: { type: 'resume', jobId: 'restored', checkpoint: paused.checkpoint } });
  const trained = await waitFor('trained');
  assert.deepEqual(trained.policy, trainPolicy({ seed: 33, episodes: 3 }).policy);
  delete globalThis.self;
});
