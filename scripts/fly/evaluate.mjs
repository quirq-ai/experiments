import { performance } from 'node:perf_hooks';
import { createGenome, createPolicy } from '../../src/fly/core/engine.js';
import { trainPolicy, evaluatePolicy, hashPolicy } from '../../src/fly/experiments/runner.js';

// Development validation used world base 500000. This separate audit suite must not
// be used to choose controller settings. All conditions use identical held-out worlds.
const count = Number(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] || 50);
const episodes = Number(process.argv.find(a => a.startsWith('--episodes='))?.split('=')[1] || 200);
const auditSeed = 9000000;
const trainingSeeds = [11, 29, 47];
const genome = createGenome(), start = performance.now();
const report = { schemaVersion: 1, suite: 'release-audit-v1', auditSeed, trainingSeeds, count, episodes,
  target: 'Mean held-out success improvement ≥25 percentage points over untrained across three independent training seeds.',
  conditions: [], model: 'Reduced kinematic fly with filtered local odor/wind encoder and tile-coded SARSA(λ).',
  caveats: ['Training uses privileged distance-progress shaping; evaluation is frozen with no shaping.',
    'Reactive comparator shares the hand-engineered local odor/wind heading encoder.',
    'Performance concerns this synthetic plume task, not biological flies or whole-brain emulation.',
    'Success CIs are Wilson intervals per matched 50-world condition; failures remain in mean duration.'] };
const untrained = evaluatePolicy({ count, seed: auditSeed, genome });
report.conditions.push({ condition: 'untrained', ...untrained.summary });
report.conditions.push({ condition: 'reactive', ...evaluatePolicy({ count, seed: auditSeed, genome, controller: 'reactive' }).summary });
for (const curriculum of ['steady', 'varied']) for (const seed of trainingSeeds) {
  const trained = trainPolicy({ episodes, seed, curriculum, genome, policy: createPolicy(seed) });
  const frozenHash = hashPolicy(trained.policy);
  const evaluation = evaluatePolicy({ count, seed: auditSeed, genome, policy: trained.policy });
  if (hashPolicy(trained.policy) !== frozenHash) throw new Error('Evaluation mutated the checkpoint.');
  report.conditions.push({ condition: curriculum, trainingSeed: seed, policyHash: frozenHash,
    trainingSuccessRate: trained.summary.successRate, ...evaluation.summary });
}
const trainedConditions = report.conditions.filter(c => c.condition === 'varied');
report.meanVariedSuccess = trainedConditions.reduce((s, c) => s + c.successRate, 0) / trainingSeeds.length;
report.observedImprovement = report.meanVariedSuccess - untrained.summary.successRate;
report.passesTarget = report.observedImprovement >= .25;
report.wallTimeMs = performance.now() - start;
console.log(JSON.stringify(report, null, 2));
if (!report.passesTarget) process.exitCode = 1;
