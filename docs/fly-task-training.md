# Report Scout training studio

Report Scout is the training-app portion of the portable Fly architecture.
Open `/fly?studio=workspace`, or **Train a working fly** in the Fly Lab.
The xo-space runtime/adapter PR is intentionally deferred until this training
experience is accepted. No xo-space code or `.quirq` directory was modified.

## Using the studio

1. **Create:** name a workspace scout. It starts with 19 zero-valued weights.
   Workspace policies are separate from the Scent Seekers flight controller.
2. **Data:** inspect the included synthetic collection: 24 training projects,
   8 validation projects, and 16 test projects. Each has 12 JSON/CSV files,
   three containing complete requested records, and a budget of four reads.
   Upload your own files/folder to add a training workspace, or import a dataset
   JSON to define explicit training, validation, and test collections.
3. **Teach:** choose a training workspace and start a demonstration. Select the
   next file to inspect. The app records candidate features before your action,
   then displays extracted values and source locations. Reset starts another run;
   previously recorded teaching decisions remain in the training collection.
4. **Train:** choose epochs, rate, and seed. The Web Worker learns from generated
   teacher choices plus your demonstrations. Your choice supersedes the generated
   label for an identical decision. Training and validation losses are real;
   validation examples never update weights. Cancel preserves the last completed
   checkpoint. Closing the dialog lets the current job continue in the browser.
5. **Test:** evaluate frozen learned, filename-match, and seeded-random policies
   on the same test projects. Inspect source-linked reports and read traces.
6. **Export:** after training and a matching evaluation, inspect/download the
   self-contained `*.fly.json`. Importing it creates a separate scout and requires
   a fresh local evaluation before export.

Training records persist in IndexedDB. A page refresh retains completed work
and discards an unfinished task-training job. Start another job to continue from
the last completed policy; partial optimization is not resumed automatically.
Dataset export includes source contents
and your active teaching decisions. Deployment export does not include them.
No training data is sent to a server.

## What this model learns

`linear-file-ranker-v1` scores each unread file using 19 metadata features:
file type, query/name overlap, path categories, file size, depth, requested-field
name overlap, and task progress. Training minimizes cross-entropy against the
demonstrated next read. Greedy inference breaks ties by sorted relative path.

The policy never reads unopened file contents. The labeled teacher and test
evaluator can inspect the fixture's expected records; those labels are not
features. The initial skill learns file selection. Parsing, extraction, completion
at the read budget, and report formatting are deterministic installed behavior.
It does not learn a language model or arbitrary tool execution.

JSON input supports a record object, arrays of records, or a records/rows/data/results
array. Requested fields can be column names, dotted paths, or JSON pointers.
CSV supports quoted commas, escaped quotes, and multiline values. A complete
extracted record contains every requested non-null field; false and zero are
valid values. Sources include relative path, record location, and content hash.
Malformed inputs appear as read errors, never fabricated output.

## Reading the results

- Useful-file coverage: fraction of the fixture's relevant files found.
- Useful reads: fraction of inspected files that supplied complete records.
- All relevant found: fraction of test projects where every relevant file was found.
- Complete reports: all eligible files inspected successfully, without unread files.

Relevance means the file contains at least one complete record for the requested
fields. These benchmark metrics use fixture ground truth. Actual reports remain
explicitly **partial** when unread files remain, even when the test oracle says
the policy found all relevant files. Parse failures also prevent a complete report.

The reproducible audit uses 60 epochs, rate 0.05, and independent training seeds
17, 29, and 47. Each trained policy found all three relevant files in all 16 test
projects within four reads (100% coverage, 75% useful reads). Filename matching
and the fixed seeded random condition each averaged 33.3% coverage and 25% useful
reads in that suite. This is a deliberately synthetic metadata curriculum;
performance on arbitrary real projects has not been established. See
[the audit record](fly-task-audit.json).

Changing datasets invalidates visible/exportable evaluation until rerun. Training
lineage preserves previous workspace content digests; content-identical test
workspaces used in that fly's earlier training are rejected even after renaming.
This detects exact content reuse, not every form of semantic duplication.
Human decisions from old collections are
excluded from training and dataset export. Imported artifacts with unknown
earlier provenance cannot establish historical independence from their earlier data.

## Dataset format

Download the starter dataset for a complete working example. The essential shape:

```json
{
  "id": "my-independent-projects",
  "name": "My report curriculum",
  "train": [{
    "id": "training-project-1",
    "name": "Training project",
    "task": { "query": "experiment metrics", "fields": ["run", "success", "duration"], "maxReads": 4 },
    "files": [{ "path": "results/trial.json", "content": "{\"run\":\"a\",\"success\":true,\"duration\":12}" }]
  }],
  "validation": [],
  "test": []
}
```

This minimal example can train, but cannot be evaluated/exported until independent
test workspaces are supplied. Do not copy training projects into the test split.
The importer rejects duplicate workspace contents even when renamed.

Limits: 64 files/workspace; 256 KB/file; 4 MB/workspace; 160 workspaces and 24 MB
of raw content/dataset; 12 requested fields; 10,000 rows/file. The app caps a JSON
dataset package at 32 MB, including teaching decisions. A deployable artifact is
limited to 2 MB. Paths must be relative JSON/CSV paths without traversal segments.
Folder imports must contain only supported files. Uploaded data stays local.

## Portable artifact and future adapter

`format: "xo-fly"`, schema version 1, task family `report-scout-v1` contains:

- Fly ID/name/revision and all policy coefficients.
- Feature, task, observation, action, runtime, and deterministic skill versions.
- The task template pinned during training, not whichever file is being previewed.
- Whitelisted capability requests and compact training/evaluation provenance.
- A cumulative training lineage and SHA-256 integrity digest.

The digest is SHA-256 of the recursively key-sorted JSON payload with the
`integrity` member omitted. Object keys are sorted; array order is retained.
The shared validator checks this digest, dimensions, versions, provenance, and
capabilities. The digest identifies payload integrity, not trustworthy authorship
or proven competence. The later host may also hash the complete file bytes for
its immutable version store.

The future xo-space adapter must supply the declared runtime and skills. Exporting
today does not activate an agent in an unmodified xo-space installation.

## Code and verification

- `src/fly/tasks/core.js`: deterministic inference, extraction, training, metrics,
  artifact construction/validation. Browser and Node use the same module.
- `fixtures.js`: explicitly separated synthetic practice and test projects.
- `worker.js`: chunked optimization/evaluation and cancellation.
- `session.js`: browser collection, provenance, worker coordination, import/export.
- `src/ui/flyTasks.js` and `tasks.css`: scoped, accessible training studio.

```sh
npm run test:fly
npm run evaluate:scout
npm run build
```

The automated suite includes an independently calculated gradient update,
read/label separation, parsing and citations, frozen evaluation, actual worker
parity, cancellation, persistence, tampered imports, lineage, stale evaluation,
and the existing scent-navigation regressions.
