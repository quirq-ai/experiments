import { createEpisode, createGenome, createPolicy, stepEpisode, snapshotEpisode, summarizeEpisode, restoreEpisode } from '../core/engine.js';
import { validatePolicy } from '../policies/sarsa.js';
import { aggregate, manifestFor } from '../experiments/runner.js';

// The worker is an orchestrator around the same pure core used by Node verification.
// Every yield occurs between fixed ticks; wall time never enters model state.
let job = null;
let scheduled = false;
const copy = value => structuredClone(value);
const send = message => self.postMessage(message);
function schedule() {
  if (scheduled || !job || job.paused) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; if (job && !job.paused) pump(); }, 0);
}
function makeJob(message) {
  const { type, jobId, seed = 1, curriculum = 'varied', scenario = 'orchard' } = message;
  const policy = copy(message.policy || createPolicy()), genome = createGenome(message.genome);
  validatePolicy(policy);
  const count = Math.min(200, Math.max(1, Math.floor(message.count || 12)));
  const conditions = [{ id: 'trained', label: 'Selected checkpoint', controller: 'learned' }];
  if (message.benchmark) conditions.push({ id: 'untrained', label: 'Untrained', controller: 'learned' },
    { id: 'reactive', label: 'Reactive scent follower', controller: 'reactive' });
  return { schemaVersion: 1, jobVersion: 'fly-job-v1', type, jobId, seed, curriculum, scenario,
    policy, genome, episodes: Math.min(1000, Math.max(1, Math.floor(message.episodes || 180))), count,
    conditions, conditionIndex: 0, index: 0, history: [], summaries: [], comparisons: [], runs: [],
    active: null, frames: [], paused: false, completed: 0 };
}
function beginEpisode() {
  if (job.type === 'train') {
    job.active = createEpisode({ genome: job.genome, policy: job.policy, training: true,
      seed: 100000 + job.seed * 10007 + job.index * 101, curriculum: job.curriculum,
      scenario: job.curriculum === 'steady' ? 'chamber' : 'orchard',
      epsilon: Math.max(.025, job.genome.exploration * (1 - job.index / job.episodes)) });
  } else {
    const condition = job.conditions[job.conditionIndex];
    job.active = createEpisode({ genome: job.genome, policy: condition.id === 'trained' ? job.policy : createPolicy(job.policy.seed),
      seed: job.seed + job.index * 137, scenario: job.scenario, controller: condition.controller, training: false });
    job.manifest = manifestFor(job.active);
    job.frames = job.conditionIndex === 0 && job.index < 12 ? [snapshotEpisode(job.active)] : [];
  }
}
function progress(snapshot) {
  const condition = job.type === 'evaluate' ? job.conditions[job.conditionIndex] : null;
  send({ type: 'progress', jobId: job.jobId, mode: job.type, completed: job.completed,
    total: job.type === 'train' ? job.episodes : job.count * job.conditions.length,
    condition: condition?.id || 'training', controller: condition?.controller || 'learned',
    trial: job.index + 1, ...(job.type === 'train' ? { history: job.history } : {}), snapshot });
}
function finishEpisode() {
  const snapshot = snapshotEpisode(job.active), summary = summarizeEpisode(job.active);
  job.completed++;
  if (job.type === 'train') {
    job.policy = job.active.policy; job.policy.trainedEpisodes++;
    job.history.push({ episode: job.index + 1, ...summary });
    progress(snapshot); job.index++; job.active = null;
    if (job.index >= job.episodes) {
      job.policy.trainingSeeds = [...(job.policy.trainingSeeds || []), job.seed];
      send({ type: 'trained', jobId: job.jobId, policy: job.policy, history: job.history, summary: aggregate(job.history) });
      job = null;
    }
  } else {
    if (job.conditionIndex === 0 && job.index < 12) job.runs.push({ manifest: job.manifest, summary, frames: job.frames });
    job.summaries.push(summary); progress(snapshot); job.index++; job.active = null; job.frames = [];
    if (job.index >= job.count) {
      const condition = job.conditions[job.conditionIndex], statistics = aggregate(job.summaries);
      job.comparisons.push({ ...condition, ...statistics, summary: statistics });
      if (job.conditionIndex === 0) job.primarySummary = statistics;
      job.conditionIndex++; job.index = 0; job.summaries = [];
      if (job.conditionIndex >= job.conditions.length) {
        send({ type: 'evaluated', jobId: job.jobId, runs: job.runs, summary: job.primarySummary, comparisons: job.comparisons });
        job = null;
      }
    }
  }
}
function pump() {
  try {
    if (!job.active) beginEpisode();
    const steps = job.type === 'train' ? 24 : 4;
    stepEpisode(job.active, steps);
    if (job.type === 'evaluate' && job.conditionIndex === 0 && job.index < 12) job.frames.push(snapshotEpisode(job.active));
    if (job.active.done) finishEpisode();
    else if (job.active.tick % 48 === 0) progress(snapshotEpisode(job.active));
    schedule();
  } catch (error) { send({ type: 'error', jobId: job?.jobId, message: error.message }); job = null; }
}
self.onmessage = ({ data: message }) => {
  try {
    if (message.type === 'train' || message.type === 'evaluate') {
      if (job) send({ type: 'cancelled', jobId: job.jobId });
      job = makeJob(message); schedule();
    } else if (message.type === 'cancel') {
      if (job && (!message.jobId || message.jobId === job.jobId)) {
        const jobId = job.jobId; job = null; send({ type: 'cancelled', jobId });
      }
    } else if (message.type === 'pause' && job) {
      job.paused = true; send({ type: 'paused', jobId: job.jobId, checkpoint: copy(job) });
    } else if (message.type === 'checkpoint' && job) {
      send({ type: 'checkpoint', jobId: job.jobId, checkpoint: copy(job) });
    } else if (message.type === 'resume') {
      if (message.checkpoint) {
        const checkpoint = message.checkpoint;
        if (checkpoint.schemaVersion !== 1 || checkpoint.jobVersion !== 'fly-job-v1') throw new Error('Unsupported job checkpoint.');
        validatePolicy(checkpoint.policy);
        if (checkpoint.active) checkpoint.active = restoreEpisode(checkpoint.active);
        job = copy(checkpoint); if (message.jobId) job.jobId = message.jobId;
      }
      if (job) { job.paused = false; send({ type: 'resumed', jobId: job.jobId }); schedule(); }
    }
  } catch (error) { send({ type: 'error', jobId: message.jobId, message: error.message }); }
};
