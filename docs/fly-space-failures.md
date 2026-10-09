# Train a fly to collect failure evidence

This demo teaches **Report Scout** to find structured execution records among reference documents, extract seven fields, and return a source-cited report. All incidents, jobs, records, timestamps, and messages are synthetic. The app does not connect to a real Space. Execution inside xo-space still requires the planned adapter.

## Files

- Watch the local tutorial: `/fly/tutorial/index.html` (MP4, captions, transcript, and downloads).
- Example browser-trained fly: [`failure-scout.fly.json`](../public/fly/examples/failure-scout.fly.json). Use **Create → Import its artifact** to inspect it; importing requires a fresh local evaluation before re-export.

- Importable collection: [`public/fly/examples/space-failures.dataset.json`](../public/fly/examples/space-failures.dataset.json)
- Measured results, policy, learning history, and example report: [`public/fly/examples/space-failures-results.json`](../public/fly/examples/space-failures-results.json)
- Reproducible generator: [`scripts/fly/create-failure-demo.mjs`](../scripts/fly/create-failure-demo.mjs)

With the local app running, the dataset is also available at `/fly/examples/space-failures.dataset.json`. Save that JSON file, then import it through the studio. The results JSON is explanatory output; **import the `.dataset.json` file**, not the results file.

## A five-minute practice run

1. Open `/fly?studio=workspace`. In **Create**, name a fresh scout **Failure Scout** and click **Create a scout**. Starting fresh makes the measured results below reproducible.
2. In **Data**, click **Import dataset JSON** and select `space-failures.dataset.json`. Confirm **12 training, 4 validation, and 6 test workspaces**. Each workspace contains 12 files, including three complete execution records and nine reference documents. The assignment is `workspace job failures`; its fields and four-read budget are already included.
3. In **Teach**, select **Train · nightly workspace sync**, then click **Start a demonstration**. Read these three paths in order:
   - `results/train-01/telemetry-2.json`
   - `results/train-01/telemetry-3.csv`
   - `results/train-01/workspace-job-failures-telemetry-1.csv`

   The extracted records should appear with file and row/object citations. Move to Train after these three useful choices; there is no need to teach an unnecessary fourth read. This optional demonstration agrees with the automatic teacher. Your decisions replace matching automatic examples. The remaining training workspaces already supply automatic labels. Manual overrides can change example ordering and therefore the exact weights; the demonstrated browser run has the same aggregate test scores as the reproducible automatic-teacher run.
4. In **Train**, enter **60 epochs**, **0.05 learning rate**, and **17 training seed**, then click **Train the scout**. A fresh scout has 36 teaching decisions across 12 workspaces. The policy learns to rank file paths from metadata; the JSON/CSV extractor itself is fixed.
5. In **Test**, click **Evaluate held-out cases**. Each reader gets the same four-read budget. Select **Test · nightly workspace sync** and click **Run this workspace** to see the actual trace and cited rows.
6. In **Export**, click **Export skill artifact** to save the trained model JSON. Keep the dataset separately if you want to retrain later. The artifact is a portable policy record; it does not install itself or run in xo-space yet.

## Use case: why did three workspace jobs fail?

Suppose a morning sync, search index, and report all failed. Opening similarly named documentation can waste the first few reads. A trained scout can gather the actual execution records into one small report for you or a future host assistant to inspect.

In **Test · nightly workspace sync**, the scout extracts the following fictional evidence:

| Time on 2026-08-20 (UTC) | Job | Status | Error | Attempts | Source |
| --- | --- | --- | --- | --- | --- |
| 02:00 | `connector-sync` | failed | `AUTH_EXPIRED` | 2 | `results/test-01/workspace-job-failures-telemetry-1.csv`, row 2 |
| 02:02 | `search-index` | failed | `AUTH_EXPIRED` | 3 | `results/test-01/telemetry-2.json`, `$.records[0]` |
| 02:04 | `daily-report` | blocked | `TOKEN_REFRESH_FAILED` | 1 | `results/test-01/telemetry-3.csv`, row 2 |

**Evidence:** the first two messages say the workspace-sync credential was rejected as expired. The third says refreshing that credential failed, so the report's source fetch was skipped. Each extracted row retains a content hash as well as its source location.

**Hypothesis:** a shared workspace-sync credential or its refresh path may be blocking three dependent jobs. This is a human interpretation of the records, not a diagnosis produced or proven by the fly. The fly ranks files and copies matching fields; it does not reason about credential repair.

**Next checks:** inspect the credential expiry and refresh result in the host connector settings. Confirm whether all three jobs actually share that credential and compare the first authentication failure with their timestamps. After an authorized repair, rerun one sync and then its dependent index/report jobs, checking the new execution records. No secret belongs in this practice dataset.

The benefit is a focused, traceable evidence packet: three observed symptoms, their order, their source files, and a clear starting point for investigation. The same collection includes schema-mismatch, quota-limit, and missing-input scenarios.

## What the measurements mean

The checked-in results were generated from a fresh policy by the same pure training and inference core used by the app. No test examples are used for weight updates. The synthetic collection was designed before this evaluation and is deliberately simple.

| Reader | Useful-file coverage | Useful reads | Reads per workspace |
| --- | ---: | ---: | ---: |
| Learned scout | 100% | 75% | 4 |
| Filename matching | 0% | 0% | 4 |
| Seeded random | 44.4% | 33.3% | 4 |

Coverage means the fraction of the three relevant files discovered, averaged across six test workspaces. Useful reads means the fraction of inspected files that yielded complete requested records. The loss falls from approximately **2.395 to 0.249** over 60 epochs.

The filename baseline is intentionally challenged by reference documents that repeat the query words. Strong results here demonstrate learning the collection's directory and naming patterns, not general failure understanding or performance in arbitrary workspaces. Independent real-world data is required to measure that.

Every report remains **partial**: four of twelve files were read, leaving eight unread. The evaluation oracle knows that all three complete records were found; the deployed reader cannot assume unseen files contain nothing useful.

## Dataset shape and regeneration

The JSON contains `id`, `name`, `train`, `validation`, and `test`. Each workspace contains its own `id`, `name`, `task`, and `files`. Files have a safe relative `path` and literal text `content`. Workspaces have distinct IDs and content across splits. None is a copied test instance in the training split.

Requested fields are `run`, `job`, `status`, `error_code`, `message`, `observed_at`, and `attempts`. Complete records are JSON objects inside `records` arrays or rows in CSV files. The nine reference documents per workspace deliberately lack the complete set of requested fields.

Regenerate both JSON files from the repository root:

```sh
node scripts/fly/create-failure-demo.mjs
```

The command validates the collection, trains for 60 epochs, evaluates the three readers on the held-out split, and writes the resulting policy, metrics, loss history, and source-cited example report. It makes no network calls and performs no live workspace actions.
