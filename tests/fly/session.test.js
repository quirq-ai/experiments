import test from 'node:test';
import assert from 'node:assert/strict';
import { FlySession } from '../../src/fly/runtime/session.js';
import { evaluatePolicy, hashPolicy as runnerHash } from '../../src/fly/experiments/runner.js';
import { hashPolicy } from '../../src/fly/records/store.js';

function fixture() {
  const records = new Map(), sent = [], downloads = [];
  const storage = {
    async listRecords(kind) { return [...records.values()].filter(r => r.kind === kind).map(r => structuredClone(r.value)); },
    async putRecord(kind, value) { records.set(`${kind}:${value.id}`, { kind, value: structuredClone(value) }); },
    async removeRecord(kind, id) { records.delete(`${kind}:${id}`); },
  };
  const options = { storage, workerFactory: () => ({ postMessage: value => sent.push(value) }),
    download: value => downloads.push(structuredClone(value)) };
  return { session: new FlySession(options), options, records, sent, downloads };
}
function evaluateSession(session) {
  session.launch({ count: 1, benchmark: false });
  const jobId = session.state.job.id;
  const result = evaluatePolicy({ policy: session.state.specimen.policy, genome: session.state.specimen.genome, seed: 2049, count: 1, record: true });
  session.handleMessage({ type: 'evaluated', jobId, ...result });
}
const file = value => ({ size: JSON.stringify(value).length, text: async () => JSON.stringify(value) });

test('results and export stay attached to their original specimen and exact policy', async () => {
  const { session, downloads } = fixture(); await session.ready;
  const first = session.state.specimen.id;
  evaluateSession(session);
  assert.equal(session.state.report.specimenId, first);
  assert.equal(session.state.runs[0].manifest.policyHash, session.state.report.policyHash);
  assert.equal(runnerHash(session.state.specimen.policy), hashPolicy(session.state.specimen.policy));
  session.createSpecimen({ name: 'Second specimen' });
  assert.equal(session.state.report, null); assert.deepEqual(session.state.runs, []);
  session.exportData(); assert.equal(downloads.at(-1).report, null);
  session.selectSpecimen(first); assert.equal(session.state.report.specimenId, first);
  session.state.specimen.policy.weights[0] += .1;
  session.showMatchingResult(); assert.equal(session.state.report, null);
});

test('result import validates whole replay before changing collection and persists valid replays', async () => {
  const { session, downloads, options } = fixture(); await session.ready;
  evaluateSession(session); session.exportData();
  const exported = downloads[0], corrupt = structuredClone(exported), originalId = session.state.specimen.id;
  delete corrupt.runs[0].frames[0].sources;
  await session.importData(file(corrupt));
  assert.equal(session.state.specimen.id, originalId);
  assert.match(session.state.error, /snapshot/);
  await session.importData(file(exported));
  assert.notEqual(session.state.specimen.id, originalId);
  const importedId = session.state.specimen.id;
  assert.equal(session.state.report.specimenId, importedId);
  assert.equal(session.state.result.manifest.specimenId, importedId);
  const reloaded = new FlySession(options); await reloaded.ready;
  reloaded.selectSpecimen(importedId);
  assert.equal(reloaded.state.report.specimenId, importedId);
  assert.ok(reloaded.state.runs[0].frames.length > 1);
});

test('saved evaluation resumes as evaluation with its retained progress', async () => {
  const { session, sent } = fixture(); await session.ready;
  const specimen = session.state.specimen;
  session.state.savedJobs = [{ id: 'saved-eval', schemaVersion: 1, specimenId: specimen.id,
    manifest: { specimenId: specimen.id, initialPolicyHash: hashPolicy(specimen.policy), genome: specimen.genome, count: 12 },
    checkpoint: { schemaVersion: 1, jobVersion: 'fly-job-v1', type: 'evaluate', completed: 3,
      policy: specimen.policy, count: 12, conditions: [{ id: 'trained' }], active: null } }];
  session.resumeSavedJob('saved-eval');
  assert.equal(session.state.job.type, 'evaluate'); assert.equal(session.state.stage, 'expedition');
  assert.equal(session.state.job.completed, 3); assert.equal(session.state.job.total, 12);
  assert.equal(sent.at(-1).type, 'resume'); assert.equal(sent.at(-1).checkpoint.type, 'evaluate');
});

test('malformed worker snapshot becomes a visible error and cannot reach the renderer', async () => {
  const { session, sent } = fixture(); await session.ready;
  const snapshot = session.state.snapshot;
  session.train({ episodes: 10 });
  session.handleMessage({ type: 'progress', jobId: session.state.job.id, snapshot: { t: 0, flies: [] } });
  assert.equal(session.state.snapshot, snapshot); assert.equal(session.state.job, null);
  assert.match(session.state.error, /snapshot/); assert.equal(sent.at(-1).type, 'cancel');
});

test('collection initialization cannot be overwritten by early actions', async () => {
  let release;
  const loaded = new Promise(resolve => { release = resolve; });
  const session = new FlySession({ storage: { async listRecords() { await loaded; return []; },
    async putRecord() {}, async removeRecord() {} } });
  session.createSpecimen({ name: 'Too early' }); session.train();
  assert.equal(session.state.specimens.length, 1); assert.equal(session.state.job, null);
  release(); await session.ready;
  session.createSpecimen({ name: 'Ready' }); assert.equal(session.state.specimens.length, 2);
});
