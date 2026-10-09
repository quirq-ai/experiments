import { createEpisode, createGenome, createPolicy, stepEpisode, snapshotEpisode, summarizeEpisode, DT, MODEL_VERSION } from '../core/engine.js';

export function hashPolicy(policy) {
  const text = JSON.stringify(policy); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function aggregate(summaries) {
  const count = summaries.length, successes = summaries.filter(s => s.success).length;
  const p = count ? successes / count : 0, z = 1.96, d = 1 + z * z / (count || 1);
  const center = (p + z * z / (2 * (count || 1))) / d;
  const half = z * Math.sqrt(p * (1 - p) / (count || 1) + z * z / (4 * (count || 1) ** 2)) / d;
  const mean = key => count ? summaries.reduce((s, r) => s + r[key], 0) / count : 0;
  const arrivals = summaries.filter(s => s.success);
  return { count, successes, successRate: p, confidence95: [Math.max(0, center - half), Math.min(1, center + half)],
    timeouts: summaries.filter(s => s.timeout).length, meanDuration: mean('duration'),
    meanTimeToSource: arrivals.length ? arrivals.reduce((s, r) => s + r.timeToSource, 0) / arrivals.length : null,
    meanReward: mean('reward'), meanPathLength: mean('pathLength'), meanEnergyUsed: mean('energyUsed'),
    meanCollisions: mean('collisions'), meanWrongSourceVisits: mean('wrongSourceVisits') };
}
export function manifestFor(ep) {
  return { schemaVersion: 1, simulatorBuild: 'fly-lab-1.0', modelVersion: MODEL_VERSION,
    scenario: ep.scenario, scenarioVersion: 1, seed: ep.seed, timestep: DT, maxTicks: ep.maxTicks,
    controller: ep.controller, policyVersion: ep.policy.modelVersion, encoderVersion: ep.policy.encoderVersion,
    policyHash: hashPolicy(ep.policy), policySeed: ep.policy.seed, trainedEpisodes: ep.policy.trainedEpisodes,
    trainingSeeds: [...ep.policy.trainingSeeds], genome: { ...ep.genome }, training: ep.training, curriculum: ep.curriculum,
    reward: { arrival: 8, tickCost: -.015, collision: -.12,
      trainingShaping: ep.training ? '100 × decrease in Euclidean distance to food; privileged, training only' : 'none' },
    assumptions: ['Kinematic flight; fixed altitude reflex; no aerodynamic solver.',
      'Advected Gaussian odor puffs; no obstacle turbulence.', 'Independent worlds; no competition.',
      'Tile-coded SARSA software controller, not a connectome simulation.'] };
}
export function trainPolicy({ policy = createPolicy(), genome = createGenome(), episodes = 120, curriculum = 'varied', seed = 1 } = {}) {
  let learned = structuredClone(policy); const history = [];
  for (let i = 0; i < episodes; i++) {
    const ep = createEpisode({ policy: learned, genome, seed: 100000 + seed * 10007 + i * 101,
      scenario: curriculum === 'steady' ? 'chamber' : 'orchard', curriculum,
      training: true, epsilon: Math.max(.025, genome.exploration * (1 - i / episodes)) });
    stepEpisode(ep, ep.maxTicks); learned = ep.policy;
    const summary = summarizeEpisode(ep); history.push({ episode: i + 1, ...summary });
  }
  learned.trainedEpisodes += episodes; learned.trainingSeeds = [...(learned.trainingSeeds || []), seed];
  return { policy: learned, history, summary: aggregate(history) };
}
export function evaluatePolicy({ policy = createPolicy(), genome = createGenome(), count = 50, seed = 500000,
  scenario = 'orchard', controller = 'learned', record = false } = {}) {
  const summaries = [], runs = [];
  for (let i = 0; i < count; i++) {
    const ep = createEpisode({ policy, genome, seed: seed + i * 137, scenario, controller, training: false });
    const manifest = manifestFor(ep), frames = record && i < 12 ? [snapshotEpisode(ep)] : null;
    while (!ep.done) { stepEpisode(ep, 4); if (frames) frames.push(snapshotEpisode(ep)); }
    const summary = summarizeEpisode(ep); summaries.push(summary);
    if (frames) runs.push({ manifest, summary, frames });
  }
  return { summary: aggregate(summaries), summaries, runs };
}
