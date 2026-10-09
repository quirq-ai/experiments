import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskTrainingSession } from '../../src/fly/tasks/session.js';
import { createTaskWorker } from '../../src/fly/tasks/worker.js';
import { taskPolicyHash, validateArtifact } from '../../src/fly/tasks/core.js';

function fixture() {
  const records = new Map(), downloads = [], pending = [], sent = [];
  const storage = {
    async listRecords(kind) { return [...records.values()].filter(row => row.kind === kind).map(row => structuredClone(row.value)); },
    async putRecord(kind, value) { records.set(`${kind}:${value.id}`, { kind, value: structuredClone(value) }); },
  };
  const options = { storage, download: (data, name) => downloads.push({ data: structuredClone(data), name }),
    workerFactory() {
      const worker = { onmessage: null, onerror: null };
      const protocol = createTaskWorker(data => worker.onmessage?.({ data }), fn => pending.push(fn));
      worker.postMessage = message => { sent.push(structuredClone(message)); protocol.handleMessage(message); };
      worker.terminate = protocol.dispose;
      return worker;
    } };
  const session = new TaskTrainingSession(options);
  const flush = () => { let count = 0; while (pending.length) { assert.ok(++count < 5000); pending.shift()(); } };
  return { session, options, records, downloads, pending, sent, flush };
}
const file = data => ({ size: JSON.stringify(data).length, text: async () => JSON.stringify(data) });

test('task studio trains, evaluates and exports the exact checkpoint without including workspace contents', async () => {
  const { session, flush, downloads } = fixture(); await session.ready;
  const original = taskPolicyHash(session.state.specimen.policy);
  assert.equal(session.artifactPreview(), null);
  session.train({ epochs: 12, seed: 17, learningRate: .08 }); flush();
  assert.equal(session.state.error, null);
  assert.equal(session.state.job, null);
  assert.equal(session.state.specimen.policy.trainedEpochs, 12);
  assert.notEqual(taskPolicyHash(session.state.specimen.policy), original);
  assert.equal(session.artifactPreview(), null, 'A trained policy needs its own evaluation before export');
  session.evaluate(); flush();
  assert.equal(session.state.error, null);
  const frozen = taskPolicyHash(session.state.specimen.policy);
  assert.equal(session.state.evaluation.policyHash, frozen);
  assert.equal(session.state.evaluation.learned.runs.length, session.state.dataset.test.length);
  const exported = session.exportArtifact(); validateArtifact(exported);
  assert.equal(downloads.at(-1).name, 'fern.fly.json');
  assert.equal(taskPolicyHash(exported.policy), frozen);
  assert.equal(exported.evaluation.learned.runs, undefined);
  assert.equal(exported.fly.revision, session.state.specimen.revision);
  assert.equal(JSON.stringify(exported).includes(session.state.dataset.train[0].files[0].content), false);
  session.state.specimen.policy.weights[1] += .01;
  assert.equal(session.artifactPreview(), null, 'A changed policy cannot reuse an old evaluation');
});

test('human teaching stays in the training split and persists exact pre-action features', async () => {
  const { session, options } = fixture(); await session.ready;
  session.selectWorkspace(session.state.dataset.test[0].id); session.startTeaching();
  assert.match(session.state.error, /only available for training/);
  session.selectWorkspace(session.state.dataset.train[0].id); session.startTeaching();
  const candidates = structuredClone(session.state.candidates);
  session.teach(candidates[1].id);
  const example = session.state.demonstrations[0];
  assert.equal(example.chosen, 1); assert.equal(example.source, 'human');
  assert.deepEqual(example.features, candidates.map(row => row.features));
  assert.equal(session.state.run.trace[0].path, candidates[1].path);
  assert.equal(session.state.humanExampleCount, 1);
  const examples = session.trainingExamples();
  assert.ok(examples.some(row => row.source === 'human'));
  assert.ok(examples.every(row => session.state.dataset.train.some(w => w.id === row.workspaceId)));
  await session.writeQueue;
  const reloaded = new TaskTrainingSession(options); await reloaded.ready;
  assert.equal(reloaded.state.demonstrations.length, 1);
  assert.equal(reloaded.state.workspace.id, session.state.workspace.id);
});

test('cancelling a partial training job leaves the last completed policy untouched and ignores late messages', async () => {
  const { session, pending, flush } = fixture(); await session.ready;
  const original = taskPolicyHash(session.state.specimen.policy);
  session.train({ epochs: 80 });
  const jobId = session.state.job.id;
  pending.shift()(); assert.equal(session.state.history.length, 1);
  session.cancel(); flush();
  assert.equal(session.state.job, null); assert.equal(taskPolicyHash(session.state.specimen.policy), original);
  session.handleMessage({ type: 'trained', jobId, policy: null, history: [] });
  assert.equal(session.state.error, null); assert.equal(taskPolicyHash(session.state.specimen.policy), original);
  session.train({ epochs: 2 }); flush(); assert.equal(session.state.specimen.policy.trainedEpochs, 2);
});

test('new flies have fresh weights and cannot inherit another fly evaluation; training survives reload', async () => {
  const { session, options, flush } = fixture(); await session.ready;
  const firstId = session.state.selectedId;
  session.train({ epochs: 3 }); flush(); session.evaluate(); flush();
  const hash = taskPolicyHash(session.state.specimen.policy);
  session.createSpecimen({ name: 'Clover' });
  assert.equal(session.state.specimen.name, 'Clover'); assert.equal(session.state.specimen.policy.trainedEpochs, 0);
  assert.equal(session.state.evaluation, null); assert.equal(session.artifactPreview(), null);
  session.selectSpecimen(firstId); assert.equal(session.state.evaluation.policyHash, hash);
  await session.writeQueue;
  const restored = new TaskTrainingSession(options); await restored.ready;
  assert.equal(restored.state.selectedId, firstId);
  assert.equal(taskPolicyHash(restored.state.specimen.policy), hash);
  assert.equal(restored.state.evaluation.policyHash, hash);
});

test('custom files only enter training; unsafe paths and invalid JSON imports leave the dataset unchanged', async () => {
  const { session } = fixture(); await session.ready;
  const testIds = session.state.dataset.test.map(w => w.id), count = session.state.dataset.train.length;
  await session.importFiles([{ name: 'measurements.json', size: 55,
    text: async () => JSON.stringify([{ run: 'custom-local', success: true, duration: 12 }]) }]);
  assert.equal(session.state.error, null); assert.equal(session.state.dataset.train.length, count + 1);
  assert.deepEqual(session.state.dataset.test.map(w => w.id), testIds);
  const dataset = structuredClone(session.state.dataset);
  await session.importFiles([{ name: '../escape.json', size: 2, text: async () => '{}' }]);
  assert.match(session.state.error, /Unsafe/); assert.deepEqual(session.state.dataset, dataset);
  await session.importDataset({ size: 1, text: async () => '{' });
  assert.match(session.state.error, /not valid JSON/); assert.deepEqual(session.state.dataset, dataset);
});

test('artifact import verifies integrity before changing the collection and requires a new local evaluation', async () => {
  const { session, flush } = fixture(); await session.ready;
  session.train({ epochs: 3 }); flush(); session.evaluate(); flush();
  const artifact = session.exportArtifact(), tampered = structuredClone(artifact);
  tampered.policy.weights[0] += .1;
  const count = session.state.specimens.length;
  await session.importArtifact(file(tampered));
  assert.match(session.state.error, /digest|different policy/); assert.equal(session.state.specimens.length, count);
  await session.importArtifact(file(artifact));
  assert.equal(session.state.error, null); assert.equal(session.state.specimens.length, count + 1);
  assert.notEqual(session.state.selectedId, artifact.fly.id);
  assert.equal(taskPolicyHash(session.state.specimen.policy), taskPolicyHash(artifact.policy));
  assert.equal(session.artifactPreview(), null);
});

test('single-workspace datasets can train but cannot claim held-out evaluation', async () => {
  const { session, flush } = fixture(); await session.ready;
  const workspace = structuredClone(session.state.dataset.train[0]);
  await session.importDataset(file(workspace));
  assert.equal(session.state.error, null); assert.equal(session.state.dataset.test.length, 0);
  session.train({ epochs: 2 }); flush();
  assert.equal(session.state.specimen.policy.trainedEpochs, 2);
  session.evaluate(); assert.match(session.state.error, /separate test workspaces/);
});

test('export task is pinned to training and changing a dataset requires new matching evaluation', async () => {
  const { session, flush } = fixture(); await session.ready;
  const task = structuredClone(session.state.workspace.task);
  session.train({ epochs: 2 }); flush(); session.evaluate(); flush();
  session.selectWorkspace(session.state.dataset.test[0].id);
  assert.deepEqual(session.artifactPreview().task, task, 'Inspecting another workspace must not change the exported task');
  const updated = structuredClone(session.state.dataset); updated.id = 'renamed-suite';
  await session.importDataset(file(updated));
  assert.equal(session.state.evaluation, null); assert.equal(session.artifactPreview(), null);
  session.selectSpecimen(session.state.selectedId);
  assert.equal(session.state.evaluation, null, 'Selecting the fly cannot restore stale dataset evidence');
});

test('continued training retains lineage and rejects tests previously used for training', async () => {
  const { session, flush, downloads } = fixture(); await session.ready;
  session.train({ epochs: 2 }); flush();
  session.startTeaching(); session.teach(session.state.candidates[0].id);
  const first = structuredClone(session.state.dataset);
  const swapped = { ...first, id: 'swapped-suite', train: first.test, test: first.train };
  await session.importDataset(file(swapped));
  assert.equal(session.state.demonstrations.length, 0, 'Old collection demonstrations are removed from the new bundle');
  session.exportDataset(); assert.equal(downloads.at(-1).data.demonstrations.length, 0);
  session.train({ epochs: 2 }); flush();
  assert.equal(session.state.specimen.training.lineage.length, 2);
  assert.equal(session.state.specimen.policy.trainedEpochs, 4);
  session.evaluate(); assert.match(session.state.error, /earlier training/);
});
