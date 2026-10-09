import { validateDataset } from './core.js';

// Separate generated projects, not row-level slices of a shared file. These are
// explicitly synthetic metadata-learning fixtures, not evidence of arbitrary
// real-workspace competence. Uploaded project suites can test that separately.
function workspace(split, index) {
  const id = `scout-${split}-${String(index + 1).padStart(2, '0')}`;
  const project = `${split}-${(index * 37 + 83).toString(36)}`;
  const outputs = ['exports', 'results', 'runs', 'output'][index % 4];
  const measures = ['measurements', 'observations', 'telemetry', 'readings'][index % 4];
  const experiment = ['orchard', 'wind', 'chamber', 'navigation'][index % 4];
  const files = [];
  for (let j = 0; j < 3; j++) {
    const record = { run: `${id}-${j + 1}`, success: (index + j) % 3 !== 0,
      duration: Math.round((8 + ((index * 13 + j * 7) % 170) / 10) * 10) / 10 };
    const csv = (index + j) % 2 === 0;
    files.push({ path: `${outputs}/${project}/${j === 0 ? `${experiment}-experiment-metrics-` : ''}${measures}-${j + 1}.${csv ? 'csv' : 'json'}`,
      content: csv ? `run,success,duration\n${record.run},${record.success},${record.duration}\n`
        : JSON.stringify(j === 1 ? { records: [record], project } : [record], null, 2) });
  }
  for (let j = 0; j < 9; j++) {
    const folder = ['archive', 'docs', 'templates'][j % 3];
    const csv = (j + index) % 3 === 0;
    const name = j < 3 ? `${experiment}-experiment-metrics-summary` : j < 6 ? `${experiment}-reference` : 'document-index';
    files.push({ path: `${folder}/${project}/${name}-${j + 1}.${csv ? 'csv' : 'json'}`,
      content: csv ? `description,version,status\n${id} notes ${j},${index + 1},draft\n`
        : JSON.stringify({ project, title: `${experiment} experiment metrics`, revision: index + j,
          description: `Reference material ${id}, document ${j + 1}. No measured flight records.`, status: 'draft' }, null, 2) });
  }
  return { id, name: `${split[0].toUpperCase() + split.slice(1)} project ${index + 1}`,
    task: { query: `${experiment} experiment metrics`, fields: ['run', 'success', 'duration'], maxReads: 4 }, files };
}

export function createStarterDataset() {
  return validateDataset({ id: 'report-scout-starter-v1', name: 'Report Scout · synthetic project suite',
    train: Array.from({ length: 24 }, (_, i) => workspace('train', i)),
    validation: Array.from({ length: 8 }, (_, i) => workspace('validation', i + 101)),
    test: Array.from({ length: 16 }, (_, i) => workspace('test', i + 211)) });
}
