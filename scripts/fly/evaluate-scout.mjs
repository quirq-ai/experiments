import { createStarterDataset } from '../../src/fly/tasks/fixtures.js';
import { createTaskPolicy, collectDemonstrations, trainEpoch, evaluateTaskPolicy, evaluateDemonstrations,
  createArtifact, validateArtifact, taskPolicyHash, datasetDigest } from '../../src/fly/tasks/core.js';

const dataset = createStarterDataset();
const examples = dataset.train.flatMap(collectDemonstrations);
const validation = dataset.validation.flatMap(collectDemonstrations);
const seeds = [17, 29, 47], epochs = 60, learningRate = .05;
const models = seeds.map(seed => {
  const policy = createTaskPolicy(seed);
  const before = evaluateDemonstrations(policy, examples);
  for (let i = 0; i < epochs; i++) trainEpoch(policy, examples, { learningRate, seed: seed + i });
  const evaluation = Object.fromEntries(['learned', 'filename', 'random'].map(controller =>
    [controller, evaluateTaskPolicy(policy, dataset.test, { controller, seed: 17 })]));
  const artifact = createArtifact({ id: `audit-scout-${seed}`, name: 'Audit scout', policy, task: dataset.train[0].task,
    training: { epochs, examples: examples.length, learningRate, seed, datasetDigest: datasetDigest(dataset), policyHash: taskPolicyHash(policy) },
    evaluation: { ...evaluation, policyHash: taskPolicyHash(policy) } });
  validateArtifact(JSON.parse(JSON.stringify(artifact)));
  return { seed, initialLoss: before.loss, finalTraining: evaluateDemonstrations(policy, examples),
    validation: evaluateDemonstrations(policy, validation), policyHash: taskPolicyHash(policy),
    evaluation: Object.fromEntries(Object.entries(evaluation).map(([key, result]) => [key, result.summary])),
    artifactBytes: new TextEncoder().encode(JSON.stringify(artifact)).length };
});
console.log(JSON.stringify({ schemaVersion: 1, taskFamily: 'report-scout-v1',
  scope: 'Synthetic structured-file discovery curriculum. No claim about arbitrary real workspaces or general assistant ability.',
  datasetDigest: datasetDigest(dataset), splits: Object.fromEntries(['train', 'validation', 'test'].map(key => [key, dataset[key].map(w => w.id)])),
  epochs, learningRate, examples: examples.length, models }, null, 2));
