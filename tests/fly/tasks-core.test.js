import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FEATURE_NAMES, createTaskPolicy, validateTaskPolicy, validateWorkspace, validateDataset,
  createTaskRun, taskCandidates, stepTaskRun, runTask, collectDemonstrations, trainEpoch,
  evaluateTaskPolicy, evaluateDemonstrations, summarizeTaskRuns, createArtifact, validateArtifact,
  canonicalJSON, sha256, taskPolicyHash, parseCSV, extractFile } from '../../src/fly/tasks/core.js';
import { createStarterDataset } from '../../src/fly/tasks/fixtures.js';

const tinyWorkspace = (extra = {}) => ({ id: 'tiny', name: 'Tiny project',
  files: [{ path: 'data.csv', content: 'run,success,duration\nalpha,true,12\n' }],
  task: { query: 'data', fields: ['run', 'success', 'duration'], maxReads: 4 }, ...extra });
const resign = value => { const payload = { ...value }; delete payload.integrity;
  value.integrity = { algorithm: 'SHA-256', digest: sha256(canonicalJSON(payload)) }; return value; };

test('one cross-entropy decision has an independently calculable weight update', () => {
  const policy = createTaskPolicy(), a = Array(FEATURE_NAMES.length).fill(0), b = a.slice();
  a[0] = 1; b[0] = 1; a[1] = 1;
  const examples = [{ features: [a, b], chosen: 0 }];
  assert.equal(evaluateDemonstrations(policy, examples).loss, Math.log(2));
  trainEpoch(policy, examples, { learningRate: .2, seed: 4 });
  assert.equal(policy.weights[0], 0); // common feature cancels exactly
  assert.equal(policy.weights[1], .1); // .2 × (1 − softmax([0,0])[0])
  assert.equal(policy.trainedEpochs, 1);
  assert.ok(evaluateDemonstrations(policy, examples).loss < Math.log(2));
});

test('candidate features expose metadata, never unread contents or teacher labels', () => {
  const source = tinyWorkspace({ files: [{ path: 'records.json', content: '{"good":1}' }], task: { fields: ['good'], query: 'records', maxReads: 1 } });
  const alternate = structuredClone(source); alternate.files[0].content = '{"nope":0}'; // equal UTF-8 length
  const a = taskCandidates(createTaskRun(source)), b = taskCandidates(createTaskRun(alternate));
  assert.deepEqual(a, b);
  assert.equal(collectDemonstrations(source).length, 1);
  assert.equal(collectDemonstrations(alternate).length, 0);
  assert.deepEqual(Object.keys(a[0]).sort(), ['features', 'id', 'path', 'probability', 'score']);
});

test('CSV parser preserves quoted delimiters, newlines, escapes and scalar meaning', () => {
  const rows = parseCSV('run,note,success,duration\r\n"alpha,beta","line 1\nline ""2""",true,12.5\r\n0012,plain,false,0\r\n');
  assert.deepEqual(rows, [{ run: 'alpha,beta', note: 'line 1\nline "2"', success: true, duration: 12.5 },
    { run: '0012', note: 'plain', success: false, duration: 0 }]);
  assert.throws(() => parseCSV('a,b\n"unclosed,b'), /Unclosed/);
  assert.throws(() => parseCSV('a,a\n1,2'), /unique/);
  assert.throws(() => parseCSV('a,b\n1'), /column count/);
  assert.throws(() => parseCSV('a\n1e999'), /non-finite/);
});

test('JSON objects, row arrays and pointers produce source-grounded values', () => {
  const task = { fields: ['id', '/metrics/time'] };
  const result = extractFile({ path: 'nested.json', content: '{"id":"a","metrics":{"time":0}}' }, task);
  assert.deepEqual(result.records[0].values, { id: 'a', '/metrics/time': 0 });
  assert.equal(result.records[0].source.location, '$');
  const array = extractFile({ path: 'rows.json', content: '{"rows":[{"id":"b","metrics":{"time":12}}]}' }, task);
  assert.equal(array.records[0].source.location, '$.rows[0]');
  assert.throws(() => extractFile({ path: 'bad.json', content: '{"duration":1e999}' }, task), /non-finite/);
});

test('reports stay partial under a read budget and expose parse errors without invented facts', () => {
  const workspace = tinyWorkspace({ files: [
    { path: 'a.csv', content: 'run,success,duration\nfirst,true,12\n' },
    { path: 'b.json', content: '{bad' },
    { path: 'c.json', content: '{"run":"TOPSECRET-C","success":true,"duration":99}' },
  ], task: { fields: ['run', 'success', 'duration'], query: 'a', maxReads: 2 } });
  const run = createTaskRun(workspace); stepTaskRun(run, 'a.csv');
  assert.throws(() => stepTaskRun(run, 'a.csv'), /eligible/);
  stepTaskRun(run, 'b.json');
  assert.equal(run.done, true); assert.equal(run.report.status, 'partial');
  assert.equal(run.report.scope.inspectedFiles, 2); assert.deepEqual(run.report.scope.unreadPaths, ['c.json']);
  assert.equal(run.report.records.length, 1); assert.equal(run.report.records[0].values.run, 'first');
  assert.equal(run.report.errors[0].path, 'b.json');
  assert.equal(JSON.stringify(run.report).includes('TOPSECRET-C'), false);
  const full = runTask(tinyWorkspace()); assert.equal(full.report.status, 'complete');
  assert.equal(full.summary.complete, true);
  const broken = runTask(tinyWorkspace({ files: [{ path: 'broken.csv', content: 'a,a\n1,2' }] }));
  assert.equal(broken.report.status, 'partial'); assert.match(broken.report.reason, /could not be parsed/);
});

test('paths, policy dimensions, duplicate projects and split shapes are validated', () => {
  for (const path of ['../escape.csv', '/etc/private.json', 'C:\\file.csv', 'a/../b.json', './b.json']) {
    assert.throws(() => validateWorkspace(tinyWorkspace({ files: [{ path, content: '{}' }] })), /path/);
  }
  assert.throws(() => validateTaskPolicy({ ...createTaskPolicy(), weights: [0] }), /weights/);
  assert.throws(() => validateTaskPolicy({ ...createTaskPolicy(), script: 'run()' }), /Unknown/);
  assert.throws(() => validateDataset({ id: 'duplicates', name: 'duplicates', train: [tinyWorkspace()],
    validation: [tinyWorkspace({ id: 'copy' })], test: [] }), /Duplicate workspace content/);
  const single = validateDataset({ id: 'single', name: 'Single project', train: [tinyWorkspace()], validation: [], test: [] });
  assert.equal(single.train.length, 1); assert.equal(single.test.length, 0);
});

test('learned weights improve held-out metadata search and all evaluation is frozen', () => {
  const dataset = createStarterDataset(), examples = dataset.train.flatMap(collectDemonstrations), policy = createTaskPolicy();
  const ids = [...dataset.train, ...dataset.validation, ...dataset.test].map(w => w.id);
  assert.equal(new Set(ids).size, 48);
  const beforeLoss = evaluateDemonstrations(policy, examples).loss;
  for (let epoch = 0; epoch < 40; epoch++) trainEpoch(policy, examples, { learningRate: .05, seed: 17 + epoch });
  assert.ok(evaluateDemonstrations(policy, examples).loss < beforeLoss * .5);
  const saved = structuredClone(policy);
  const learned = evaluateTaskPolicy(policy, dataset.test), filename = evaluateTaskPolicy(policy, dataset.test, { controller: 'filename' });
  assert.ok(learned.summary.coverage >= .9);
  assert.ok(learned.summary.coverage - filename.summary.coverage >= .4);
  assert.equal(learned.summary.meanReads, 4);
  assert.equal(learned.summary.completeRate, 0); // recall is not an exhaustive audit
  assert.equal(learned.summary.allRelevantFoundRate, 1);
  assert.deepEqual(policy, saved);
  assert.deepEqual(learned.summary, summarizeTaskRuns(learned.runs));
});

test('manual stepping and JSON state restore match complete inference including random choices', () => {
  const workspace = createStarterDataset().test[0], policy = createTaskPolicy(81);
  for (const controller of ['learned', 'filename', 'random']) {
    const run = createTaskRun(workspace, policy, { controller, seed: 52 }); stepTaskRun(run);
    const restored = JSON.parse(JSON.stringify(run)); while (!restored.done) stepTaskRun(restored);
    const complete = runTask(workspace, policy, { controller, seed: 52 });
    assert.deepEqual(restored.trace, complete.trace); assert.deepEqual(restored.report, complete.report);
  }
});

test('portable SHA-256 agrees with Node and canonical object key order is stable', () => {
  for (const value of ['', 'abc', '🍊', 'a'.repeat(200)]) {
    assert.equal(sha256(value), createHash('sha256').update(value).digest('hex'));
  }
  assert.equal(canonicalJSON({ b: 2, a: [1, 3] }), canonicalJSON({ a: [1, 3], b: 2 }));
});

test('portable artifacts are compact, self-contained, versioned and reject altered capabilities', () => {
  const policy = createTaskPolicy(), workspace = tinyWorkspace(), evaluation = evaluateTaskPolicy(policy, [workspace]);
  const artifact = createArtifact({ id: 'fern', name: 'Fern', revision: 3, policy,
    training: { epochs: 0, seed: 17, files: workspace.files }, evaluation: { learned: evaluation, policyHash: taskPolicyHash(policy) }, task: workspace.task });
  assert.equal(artifact.fly.revision, 3);
  assert.equal(artifact.policy.weights.length, FEATURE_NAMES.length);
  assert.equal(artifact.training.files, undefined); assert.equal(artifact.evaluation.learned.runs, undefined);
  assert.equal(JSON.stringify(artifact).includes('alpha'), false);
  assert.deepEqual(validateArtifact(JSON.parse(JSON.stringify(artifact))), artifact);
  const changed = structuredClone(artifact); changed.policy.weights[0] = 1;
  assert.throws(() => validateArtifact(changed), /different policy|digest mismatch/);
  const badCapability = structuredClone(artifact); badCapability.requestedCapabilities.push('shell.exec');
  assert.throws(() => validateArtifact(resign(badCapability)), /capability/);
  const script = structuredClone(artifact); script.execute = 'arbitrary code';
  assert.throws(() => validateArtifact(resign(script)), /Unknown artifact/);
  const skill = structuredClone(artifact); skill.contracts.skills.shell = 'bash';
  assert.throws(() => validateArtifact(resign(skill)), /skill/);
  const lineage = [{ datasetDigest: sha256('dataset'), policyHash: taskPolicyHash(policy), epochs: 1,
    seed: 17, learningRate: .05, workspaceDigests: [sha256('workspace')] }];
  const continued = createArtifact({ id: 'fern', name: 'Fern', policy, task: workspace.task,
    training: { lineage, unknownPriorTraining: false } });
  assert.deepEqual(continued.training.lineage, lineage);
  const invalidLineage = structuredClone(continued); invalidLineage.training.lineage[0].workspaceDigests[0] = 'forged';
  assert.throws(() => validateArtifact(resign(invalidLineage)), /lineage workspace/);
});
