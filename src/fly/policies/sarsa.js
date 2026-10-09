import { angle, clamp, random } from '../core/random.js';

export const POLICY_VERSION = 'sarsa-tile-v1';
export const FEATURE_COUNT = 90;
export const ACTIONS = [-1, 0, 1];
export function createPolicy(seed = 1) {
  return { schemaVersion: 1, modelVersion: POLICY_VERSION, encoderVersion: 'odor-wind-v1', seed,
    weights: Array(FEATURE_COUNT * ACTIONS.length).fill(0), trainedEpisodes: 0, trainingSeeds: [] };
}
export function validatePolicy(policy) {
  if (policy?.schemaVersion !== 1 || policy.modelVersion !== POLICY_VERSION || policy.encoderVersion !== 'odor-wind-v1'
    || !Number.isFinite(policy.seed) || !Number.isInteger(policy.trainedEpisodes) || policy.trainedEpisodes < 0
    || !Array.isArray(policy.trainingSeeds) || !policy.trainingSeeds.every(Number.isFinite)
    || !Array.isArray(policy.weights) || policy.weights.length !== FEATURE_COUNT * 3
    || !policy.weights.every(value => Number.isFinite(value) && Math.abs(value) <= 1e6)) throw new Error('Unsupported or invalid Fly Lab policy checkpoint.');
}
// Two overlapping heading tilings plus scent-contact, intensity and wall features.
// desiredBearing is computed from local odor gradients and local wind, never target coordinates.
export function encode(observation) {
  const bearing = angle(observation.desiredBearing);
  const unit = (bearing + Math.PI) / (Math.PI * 2);
  const binA = Math.floor(unit * 16) % 16;
  const binB = Math.floor((unit * 16 + .5) % 16);
  const contact = observation.odor[0] > .003 ? 0 : 1;
  const intensity = clamp(Math.floor(observation.odor[0] * 8), 0, 3);
  const wall = observation.wall > .7 ? 1 : 0;
  const distractor = clamp(Math.floor(observation.odor[1] * 8), 0, 3);
  const mixture = clamp(Math.floor(observation.odor[1] / (observation.odor[0] + observation.odor[1] + 1e-9) * 3), 0, 2);
  return [0, 1 + binA + contact * 16, 33 + binB + contact * 16, 65 + intensity, 69 + binA % 8, 77 + wall,
    79 + Math.min(3, Math.floor(observation.energy * 4)), 83 + distractor, 87 + mixture];
}
export function values(policy, features) {
  return ACTIONS.map((_, action) => features.reduce((sum, feature) => sum + policy.weights[action * FEATURE_COUNT + feature], 0));
}
export function chooseAction(policy, features, rng, epsilon = 0) {
  if (random(rng) < epsilon) return Math.floor(random(rng) * 3);
  const q = values(policy, features);
  const best = Math.max(...q);
  const ties = q.map((v, i) => Math.abs(v - best) < 1e-10 ? i : -1).filter(i => i >= 0);
  return ties[Math.floor(random(rng) * ties.length)];
}
export function updateSarsa(policy, traces, features, action, reward, nextFeatures, nextAction, terminal,
  { alpha = .025, gamma = .97, lambda = .72 } = {}) {
  const q = values(policy, features)[action];
  const nextQ = terminal ? 0 : values(policy, nextFeatures)[nextAction];
  const delta = reward + gamma * nextQ - q;
  for (let i = 0; i < traces.length; i++) traces[i] *= gamma * lambda;
  for (const feature of features) traces[action * FEATURE_COUNT + feature] = 1;
  const rate = alpha / features.length;
  for (let i = 0; i < traces.length; i++) policy.weights[i] += rate * delta * traces[i];
  return delta;
}
