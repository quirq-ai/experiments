import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  FEATURE_NAMES, canonicalJSON, collectDemonstrations, createTaskPolicy, datasetDigest,
  evaluateDemonstrations, evaluateTaskPolicy, sha256, taskPolicyHash, trainEpoch, validateDataset,
} from '../../src/fly/tasks/core.js';

// An intentionally small, synthetic structured-file discovery curriculum.
// Policy selection sees metadata; record contents are revealed only after a read.
// No live workspace, credentials, model service, or xo-space runtime is used.
const fields = ['run', 'job', 'status', 'error_code', 'message', 'observed_at', 'attempts'];
const cases = [
  {
    name: 'nightly workspace sync',
    jobs: ['connector-sync', 'search-index', 'daily-report'],
    codes: ['AUTH_EXPIRED', 'AUTH_EXPIRED', 'TOKEN_REFRESH_FAILED'],
    messages: [
      'Workspace-sync credential was rejected as expired; connector import stopped before fetching pages.',
      'Workspace-sync credential was rejected as expired; index refresh could not fetch source changes.',
      'Workspace-sync credential refresh failed; report source fetch was skipped. No report was produced.',
    ],
    hypothesis: 'A shared workspace-sync credential or its refresh path may be blocking three dependent jobs.',
    nextChecks: [
      'Inspect the credential expiry and refresh result in the host connector settings; do not paste the secret into the lab.',
      'Confirm whether these jobs use the same credential and compare their timestamps with the first authentication failure.',
      'After an authorized credential repair, rerun one sync and then the dependent index/report jobs; check their new records.',
    ],
  },
  {
    name: 'customer export pipeline',
    jobs: ['customer-import', 'customer-merge', 'weekly-export'],
    codes: ['SCHEMA_MISMATCH', 'REQUIRED_FIELD_MISSING', 'UPSTREAM_DATA_UNAVAILABLE'],
    messages: [
      'Source emitted account_key while the importer required customer_id; the batch was rejected.',
      'Required customer_id field was absent in staged records; merge was not applied.',
      'Accepted customer batch was unavailable; weekly export was skipped.',
    ],
    hypothesis: 'A source schema change may be preventing the importer from producing the downstream customer batch.',
    nextChecks: ['Compare source and importer schemas for the failed batch.', 'Check whether account_key should map to customer_id.', 'Validate the proposed mapping against a small sample before rerunning the pipeline.'],
  },
  {
    name: 'connector quota burst',
    jobs: ['source-poller', 'attachment-fetch', 'digest-builder'],
    codes: ['RATE_LIMITED', 'RETRY_BUDGET_EXHAUSTED', 'UPSTREAM_DATA_UNAVAILABLE'],
    messages: [
      'Connector returned HTTP 429 and retry-after 60 seconds; source polling paused.',
      'Attachment fetch retried inside the provider cooldown; its retry budget was exhausted.',
      'Fresh attachments were unavailable after the poller failed; digest build was skipped.',
    ],
    hypothesis: 'A provider quota limit and retries inside its cooldown may explain the missing downstream inputs.',
    nextChecks: ['Check the provider quota window and Retry-After response.', 'Inspect actual retry timing and concurrency.', 'Retry one small batch after the cooldown and verify that dependent inputs arrive.'],
  },
  {
    name: 'missing workspace input',
    jobs: ['input-loader', 'result-transform', 'summary-publisher'],
    codes: ['FILE_NOT_FOUND', 'UPSTREAM_DATA_UNAVAILABLE', 'NO_INPUT_RECORDS'],
    messages: [
      'Expected inputs/current-batch.csv was absent from this workspace; loader stopped.',
      'Input loader produced no accepted batch; transformation was skipped.',
      'No transformed records were available; summary publication was skipped.',
    ],
    hypothesis: 'A missing expected input file may have stopped the upstream loader and its dependent jobs.',
    nextChecks: ['Check the producer output path and the loader working directory.', 'Confirm whether the input was renamed, moved, or never produced.', 'Restore or regenerate the intended input, then rerun the loader before its dependents.'],
  },
];

const csvCell = value => `"${String(value).replaceAll('"', '""')}"`;
const toCSV = record => `${fields.join(',')}\n${fields.map(field => csvCell(record[field])).join(',')}\n`;

function workspace(split, index) {
  const number = String(index + 1).padStart(2, '0');
  const id = `space-failures-${split}-${number}`;
  const profile = cases[index % cases.length];
  const folder = ['results', 'exports', 'output', 'runs'][index % 4];
  const measure = ['telemetry', 'observations', 'measurements', 'readings'][index % 4];
  const day = ({ train: 1, validation: 13, test: 20 })[split] + index;
  const date = `2026-08-${String(day).padStart(2, '0')}`;
  const project = `${split}-${number}`;
  const files = profile.jobs.map((job, j) => {
    const record = {
      run: `${id}-run-${j + 1}`, job, status: j === 2 ? 'blocked' : 'failed',
      error_code: profile.codes[j], message: `${profile.messages[j]} Synthetic incident ${project}.`,
      observed_at: `${date}T02:${String(j * 2).padStart(2, '0')}:00Z`, attempts: j === 2 ? 1 : j + 2,
    };
    const csv = (index + j) % 2 === 0;
    return {
      path: `${folder}/${project}/${j === 0 ? 'workspace-job-failures-' : ''}${measure}-${j + 1}.${csv ? 'csv' : 'json'}`,
      content: csv ? toCSV(record) : JSON.stringify({ synthetic: true, incident: id, records: [record] }, null, 2),
    };
  });
  for (let j = 0; j < 9; j++) {
    const directory = ['archive', 'docs', 'templates'][j % 3];
    const basename = j < 3 ? 'workspace-job-failures-summary' : j < 6 ? 'workspace-job-failures-reference' : 'document-index';
    const path = `${directory}/${project}/${basename}-${j + 1}.json`;
    files.push({ path, content: JSON.stringify({
      synthetic: true, incident: id, title: `${profile.name}: ${directory} document ${j + 1}`,
      description: j < 3 ? 'Example overview only. This is not an observed execution record.'
        : j < 6 ? 'Reference instructions for checking job configuration. No observed failure records are included.'
          : 'Document catalog entry. Contains no execution data.',
      revision: index + j + 1, note: `Synthetic ${split} fixture ${number}; reference ${j + 1}.`,
    }, null, 2) });
  }
  return { id, name: `${split === 'test' ? 'Test' : split === 'train' ? 'Train' : 'Validation'} · ${profile.name}${index >= 4 ? ` ${Math.floor(index / 4) + 1}` : ''}`,
    task: { query: 'workspace job failures', fields, maxReads: 4 }, files };
}

const dataset = validateDataset({
  id: 'space-failures-synthetic-v1', name: 'Space failures · synthetic incident records',
  train: Array.from({ length: 12 }, (_, i) => workspace('train', i)),
  validation: Array.from({ length: 4 }, (_, i) => workspace('validation', i)),
  test: Array.from({ length: 6 }, (_, i) => workspace('test', i)),
});
const examples = dataset.train.flatMap(collectDemonstrations);
const validation = dataset.validation.flatMap(collectDemonstrations);
const policy = createTaskPolicy(17), epochs = 60, learningRate = 0.05, seed = 17;
const history = [{ epoch: 0, ...evaluateDemonstrations(policy, examples), validationLoss: evaluateDemonstrations(policy, validation).loss }];
for (let epoch = 1; epoch <= epochs; epoch++) {
  const metrics = trainEpoch(policy, examples, { learningRate, seed: seed + epoch - 1 });
  const val = evaluateDemonstrations(policy, validation);
  history.push({ epoch, ...metrics, validationLoss: val.loss, validationAccuracy: val.accuracy });
}
const evaluations = Object.fromEntries(['learned', 'filename', 'random'].map(controller => [controller,
  evaluateTaskPolicy(policy, dataset.test, { controller, seed: 17 })]));
const selectedRun = evaluations.learned.runs[0];
const results = {
  schemaVersion: 1, title: 'Space failures · reproducible synthetic demonstration',
  scope: 'All records are fictional. These results measure file discovery and exact field extraction in this curriculum, not root-cause diagnosis or access to a real Space. The xo-space adapter is not implemented by this demonstration.',
  datasetId: dataset.id, datasetDigest: datasetDigest(dataset),
  splits: Object.fromEntries(['train', 'validation', 'test'].map(split => [split, dataset[split].map(item => item.id)])),
  configuration: { epochs, learningRate, seed, examples: examples.length, readBudget: 4, filesPerWorkspace: 12, relevantFilesPerWorkspace: 3 },
  policy, featureNames: FEATURE_NAMES, policyHash: taskPolicyHash(policy), history,
  evaluation: Object.fromEntries(Object.entries(evaluations).map(([controller, value]) => [controller, value.summary])),
  selectedRun,
  interpretation: {
    producedBy: 'Human-authored explanation of the cited synthetic records; not generated by the fly.',
    evidence: 'Two jobs report AUTH_EXPIRED and a third reports TOKEN_REFRESH_FAILED within four minutes. Each message refers to the workspace-sync credential.',
    hypothesis: cases[0].hypothesis, nextChecks: cases[0].nextChecks,
    limits: 'The records suggest a common dependency but do not prove a root cause. Eight files remain unread. Verify with live host logs and configuration before acting.',
  },
};
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = resolve(repoRoot, 'public/fly/examples');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'space-failures.dataset.json'), `${JSON.stringify(dataset, null, 2)}\n`);
await writeFile(resolve(output, 'space-failures-results.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ dataset: 'public/fly/examples/space-failures.dataset.json',
  results: 'public/fly/examples/space-failures-results.json', selectedWorkspace: selectedRun.workspaceId,
  evaluation: results.evaluation, initialLoss: history[0].loss, finalLoss: history.at(-1).loss,
  contentDigest: sha256(canonicalJSON(dataset)),
}, null, 2));
