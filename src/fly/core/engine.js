import { angle, clamp, random, stream } from './random.js';
import { ACTIONS, FEATURE_COUNT, createPolicy, encode, chooseAction, updateSarsa, validatePolicy, values } from '../policies/sarsa.js';
export { createPolicy } from '../policies/sarsa.js';
export { validatePolicy } from '../policies/sarsa.js';

export const DT = .12;
export const MODEL_VERSION = 'fly-kinematic-puff-v1';
const BOUNDS = { min: [-.15, .008, -.105], max: [.15, .075, .105] };
const clone = value => JSON.parse(JSON.stringify(value));
const numeric = (value, fallback, min, max) => clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max);
export function createGenome(overrides = {}) {
  return { schemaVersion: 1, sensitivity: numeric(overrides.sensitivity ?? 1, 1, .5, 2),
    speed: numeric(overrides.speed ?? .023, .023, .012, .035),
    turnRate: numeric(overrides.turnRate ?? 3.2, 3.2, 1.5, 5),
    memory: numeric(overrides.memory ?? 1.4, 1.4, .2, 5),
    exploration: numeric(overrides.exploration ?? .12, .12, .02, .4),
    learningRate: numeric(overrides.learningRate ?? .025, .025, .005, .1),
    energyBudget: numeric(overrides.energyBudget ?? 1, 1, .5, 2) };
}

function setWind(ep) {
  const gust = ep.curriculum === 'steady' || ep.scenario === 'chamber' ? 0 : .24 * Math.sin(ep.tick * .025 + ep.windPhase);
  const theta = ep.windAngle + gust;
  ep.wind = [-.008 * Math.cos(theta), 0, -.008 * Math.sin(theta)];
}
function newPuff(ep, source, age = 0) {
  const jitter = () => (random(ep.worldRng) - .5) * .002;
  return { x: source.x + ep.wind[0] * age + jitter(), y: source.y + jitter(),
    z: source.z + ep.wind[2] * age + jitter(), age, channel: source.channel,
    radius: .012 + Math.sqrt(age) * .0045, concentration: Math.exp(-age / 34) };
}
function advanceField(ep) {
  if (ep.tick % 4 === 0) for (const source of ep.sources) if (source.active) ep.puffs.push(newPuff(ep, source));
  for (const puff of ep.puffs) {
    puff.age += DT; puff.x += ep.wind[0] * DT; puff.z += ep.wind[2] * DT;
    puff.radius = .012 + Math.sqrt(puff.age) * .0045;
    puff.concentration = Math.exp(-puff.age / 34);
  }
  ep.puffs = ep.puffs.filter(p => p.age < 38 && p.x > -.24 && Math.abs(p.z) < .2);
}
export function sampleOdor(ep, x, y, z) {
  const odor = [0, 0];
  for (const p of ep.puffs) {
    const d2 = (x - p.x) ** 2 + (z - p.z) ** 2 + (y - p.y) ** 2 * .4;
    odor[p.channel] += Math.exp(-d2 / (2 * p.radius ** 2)) * p.concentration * .085;
  }
  return odor.map(v => v * ep.genome.sensitivity);
}
function rawSensors(ep) {
  const f = ep.fly, span = .004;
  const odor = sampleOdor(ep, f.x, f.y, f.z);
  const dx = sampleOdor(ep, f.x + span, f.y, f.z)[0] - sampleOdor(ep, f.x - span, f.y, f.z)[0];
  const dz = sampleOdor(ep, f.x, f.y, f.z + span)[0] - sampleOdor(ep, f.x, f.y, f.z - span)[0];
  return { odor, dx, dz };
}
function updateSensors(ep) {
  const raw = rawSensors(ep), previous = ep.fly.sensorMemory;
  const alpha = 1 - Math.exp(-DT / ep.genome.memory);
  ep.fly.sensorMemory = previous ? { odor: raw.odor.map((v, i) => previous.odor[i] + (v - previous.odor[i]) * alpha),
    dx: previous.dx + (raw.dx - previous.dx) * alpha, dz: previous.dz + (raw.dz - previous.dz) * alpha } : raw;
}
export function observe(ep) {
  const f = ep.fly;
  const { odor, dx, dz } = f.sensorMemory || rawSensors(ep);
  const windNorm = Math.hypot(ep.wind[0], ep.wind[2]);
  const ux = -ep.wind[0] / windNorm, uz = -ep.wind[2] / windNorm;
  // Crosswind concentration gradient keeps the animal in a plume; upwind direction
  // comes from its local wind sensor. This is a declared sensor encoder, not a hidden goal vector.
  const across = dx * -uz + dz * ux;
  const gradientLength = Math.hypot(dx, dz) + 1e-9;
  const cross = clamp(across / gradientLength * 2.6, -2.5, 2.5);
  let targetX = ux - uz * cross, targetZ = uz + ux * cross;
  if (odor[0] < .003) { targetX = ux * .4; targetZ = uz * .4 + (f.lastCross || 1) * 1.2; }
  const wall = Math.max(Math.abs(f.x) / .15, Math.abs(f.z) / .105);
  if (wall > .85) { targetX -= f.x / .15 * Math.max(0, (Math.abs(f.x) / .15 - .85)) * 25; targetZ -= f.z / .105 * Math.max(0, (Math.abs(f.z) / .105 - .85)) * 25; }
  return { version: 'odor-wind-v1', odor, stereo: [dx, dz], desiredBearing: angle(Math.atan2(targetZ, targetX) - f.yaw),
    wind: ep.wind.slice(), energy: f.energy, wall, speed: ep.genome.speed, timeSinceOdor: f.timeSinceOdor };
}
function targetDistance(ep) {
  return Math.min(...ep.sources.filter(s => s.rewarded && s.active).map(s => Math.hypot(ep.fly.x - s.x, ep.fly.z - s.z, ep.fly.y - s.y)));
}
export function createEpisode({ seed = 1, genome = createGenome(), policy = createPolicy(), controller = 'learned',
  scenario = 'orchard', curriculum = 'varied', maxTicks = 240, training = false, epsilon } = {}) {
  validatePolicy(policy);
  if (!Number.isFinite(seed) || !Number.isInteger(maxTicks) || maxTicks < 1 || maxTicks > 100000) throw new Error('Invalid episode seed or horizon.');
  if (!['learned', 'reactive', 'random'].includes(controller)) throw new Error('Unknown fly controller.');
  if (!['orchard', 'chamber', 'wind-shift'].includes(scenario)) throw new Error('Unknown fly habitat.');
  const worldRng = stream(seed, 3), actionRng = stream(seed ^ policy.seed, 7);
  const ep = { schemaVersion: 1, modelVersion: MODEL_VERSION, seed, tick: 0, t: 0, maxTicks, genome: createGenome(genome),
    policy: clone(policy), controller, scenario, curriculum, training, epsilon: epsilon ?? (training ? genome.exploration : 0),
    worldRng, actionRng, windAngle: (curriculum === 'steady' || scenario === 'chamber') ? 0 : (random(worldRng) - .5) * .65,
    windPhase: random(worldRng) * 6.28, wind: [-.008, 0, 0],
    sources: [{ id: 'nectar', x: .095 + (random(worldRng) - .5) * .016, y: .027,
      z: scenario === 'chamber' ? 0 : .028 + (random(worldRng) - .5) * .03, channel: 0, rewarded: true, active: true },
      { id: 'decoy', x: .035 + (random(worldRng) - .5) * .02, y: .027,
        z: -.065 + (random(worldRng) - .5) * .018, channel: 1, rewarded: false, active: true }],
    fly: { id: 'fly-1', x: -.108, y: .027 + (random(worldRng) - .5) * .008, z: (random(worldRng) - .5) * (scenario === 'chamber' ? .03 : .12),
      yaw: (random(worldRng) - .5) * Math.PI * 1.7, energy: 1, odor: [0, 0], action: 1, success: false, collisions: 0,
      lastCross: random(worldRng) > .5 ? 1 : -1, timeSinceOdor: 0 },
    puffs: [], events: [], eventCursor: 0, scheduledEvents: scenario === 'wind-shift' ? [{ tick: 90, type: 'wind-shift', angle: .85 }] : [],
    totalReward: 0, pathLength: 0, wrongSourceVisits: 0, decoyInside: false, done: false,
    traces: Array(FEATURE_COUNT * 3).fill(0), observations: null, features: null, action: 1, reward: 0 };
  setWind(ep);
  for (const source of ep.sources) for (let i = 0; i < 72; i++) ep.puffs.push(newPuff(ep, source, i * .48));
  updateSensors(ep);
  ep.observations = observe(ep); ep.features = encode(ep.observations); ep.action = act(ep);
  return ep;
}
function act(ep) {
  if (ep.controller === 'random') return Math.floor(random(ep.actionRng) * 3);
  if (ep.controller === 'reactive') return ep.observations.desiredBearing > .15 ? 2 : ep.observations.desiredBearing < -.15 ? 0 : 1;
  return chooseAction(ep.policy, ep.features, ep.actionRng, ep.epsilon);
}
export function stepEpisode(ep, count = 1) {
  for (let i = 0; i < count && !ep.done; i++) {
    for (const event of ep.scheduledEvents) if (event.tick === ep.tick && ep.eventCursor < ep.scheduledEvents.length) {
      if (event.type === 'wind-shift') ep.windAngle += event.angle;
      ep.events.push({ ...event, t: ep.tick * DT }); ep.eventCursor++;
    }
    setWind(ep); advanceField(ep);
    const f = ep.fly, prevDistance = targetDistance(ep), previous = [f.x, f.y, f.z];
    f.action = ep.action; f.yaw = angle(f.yaw + ACTIONS[ep.action] * ep.genome.turnRate * DT);
    f.x += (Math.cos(f.yaw) * ep.genome.speed + ep.wind[0] * .12) * DT;
    f.z += (Math.sin(f.yaw) * ep.genome.speed + ep.wind[2] * .12) * DT;
    // Altitude is stabilized by a separate fixed reflex, not a learned 6-DOF flight controller.
    f.y += clamp((.027 - f.y) * 2, -.008, .008) * DT;
    let collision = false;
    for (let axis = 0; axis < 3; axis++) {
      const key = ['x', 'y', 'z'][axis], bounded = clamp(f[key], BOUNDS.min[axis] + .002, BOUNDS.max[axis] - .002);
      if (bounded !== f[key]) { f[key] = bounded; collision = true; }
    }
    if (collision) { f.collisions++; ep.events.push({ type: 'collision', tick: ep.tick + 1 }); }
    ep.pathLength += Math.hypot(f.x - previous[0], f.y - previous[1], f.z - previous[2]);
    f.energy = Math.max(0, f.energy - DT / (40 * ep.genome.energyBudget));
    const dist = targetDistance(ep);
    f.success = dist < .014;
    const decoy = ep.sources.find(s => !s.rewarded);
    const inside = decoy && Math.hypot(f.x - decoy.x, f.z - decoy.z) < .018;
    if (inside && !ep.decoyInside) ep.wrongSourceVisits++;
    ep.decoyInside = Boolean(inside);
    ep.tick++; ep.t = ep.tick * DT;
    ep.done = f.success || f.energy <= 0 || ep.tick >= ep.maxTicks;
    // Privileged potential shaping is TRAINING ONLY and is recorded in every manifest.
    ep.reward = -.015 - (collision ? .12 : 0) + (f.success ? 8 : 0)
      + (ep.training ? (prevDistance - dist) * 100 : 0);
    ep.totalReward += ep.reward;
    updateSensors(ep); ep.observations = observe(ep); f.odor = ep.observations.odor.slice();
    f.timeSinceOdor = f.odor[0] > .003 ? 0 : f.timeSinceOdor + DT;
    if (Math.abs(ep.observations.stereo[1]) > 1e-6) f.lastCross = Math.sign(ep.observations.stereo[1]);
    const nextFeatures = encode(ep.observations), previousFeatures = ep.features, previousAction = ep.action;
    ep.features = nextFeatures; ep.action = act(ep);
    if (ep.training && ep.controller === 'learned') updateSarsa(ep.policy, ep.traces, previousFeatures, previousAction,
      ep.reward, nextFeatures, ep.action, ep.done, { alpha: ep.genome.learningRate, gamma: .97, lambda: .72 });
    if (f.success) ep.events.push({ type: 'arrival', tick: ep.tick, sourceId: 'nectar' });
  }
  return ep;
}
export function snapshotEpisode(ep) {
  return { schemaVersion: 1, tick: ep.tick, t: ep.t, flies: [{ ...ep.fly, odor: ep.fly.odor.slice(),
    sensorMemory: clone(ep.fly.sensorMemory),
    reward: ep.reward, qValues: values(ep.policy, ep.features), sensoryBearing: ep.observations.desiredBearing }],
    sources: clone(ep.sources), puffs: ep.puffs.filter((_, i) => i % 2 === 0).map(p => ({ ...p })),
    wind: ep.wind.slice(), events: clone(ep.events), bounds: clone(BOUNDS), done: ep.done,
    scenario: ep.scenario, training: ep.training, reward: ep.totalReward };
}
export function summarizeEpisode(ep) {
  return { success: ep.fly.success, ticks: ep.tick, duration: ep.t, timeToSource: ep.fly.success ? ep.t : null,
    horizon: ep.maxTicks * DT, timeout: !ep.fly.success && ep.tick >= ep.maxTicks,
    exhausted: !ep.fly.success && ep.fly.energy <= 0, reward: ep.totalReward,
    pathLength: ep.pathLength, collisions: ep.fly.collisions, wrongSourceVisits: ep.wrongSourceVisits,
    energyUsed: 1 - ep.fly.energy, distanceRemaining: targetDistance(ep), seed: ep.seed, controller: ep.controller };
}
export function checkpointEpisode(ep) { return clone(ep); }
export function restoreEpisode(data) {
  if (data?.schemaVersion !== 1 || data.modelVersion !== MODEL_VERSION || !Number.isInteger(data.tick)
    || data.tick < 0 || !data.fly || !data.worldRng || !data.actionRng) throw new Error('Incompatible episode checkpoint.');
  validatePolicy(data.policy);
  if (!['x', 'y', 'z', 'yaw', 'energy'].every(key => Number.isFinite(data.fly[key]))
    || !Array.isArray(data.puffs) || data.puffs.length > 4096
    || !data.puffs.every(puff => ['x', 'y', 'z', 'radius', 'concentration', 'age'].every(key => Number.isFinite(puff[key])))
    || !Array.isArray(data.traces) || data.traces.length !== FEATURE_COUNT * 3 || !data.traces.every(Number.isFinite)) {
    throw new Error('Invalid episode checkpoint state.');
  }
  return clone(data);
}
