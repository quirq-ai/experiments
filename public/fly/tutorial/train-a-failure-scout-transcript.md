# Train a failure scout

Video duration: 86.6 seconds. Narration is synthesized using the macOS Samantha voice.
All incidents and data are synthetic. App screenshots show an actual local training run. The video’s incident diagram and interpretation are explanatory graphics, not generated app output.

Dataset: [space-failures.dataset.json](../examples/space-failures.dataset.json).
Measured results: [space-failures-results.json](../examples/space-failures-results.json).
The filenames deliberately include misleading query matches to exercise the learned ranking policy. The filename baseline score is specific to this constructed collection and does not establish broad real-world superiority.
The recorded browser run includes three human teaching choices. Its scores match the independently generated audit, but individual read order and policy weights can differ. The diagram’s hypothesis is a human interpretation of the extracted evidence; the trained model does not diagnose root causes.

## 00:00:00 · WHY / FAILURE TRIAGE

When workspace automations fail, evidence gets scattered. Train a small fly to find useful files and collect facts for a failure report.

## 00:00:08 · 01 / CREATE

Open Report Scout and create a scout named Failure Scout. Its learned skill is choosing which file to read next.

## 00:00:15 · 02 / DATA

In Data, import the supplied space-failures dataset. Training, validation, and test workspaces are separate. Every incident in this collection is synthetic.

## 00:00:25 · 03 / TEACH

In Teach, start a demonstration. Select current incident evidence files. Each click teaches a useful next read; the collection also supplies automatic teaching examples.

## 00:00:36 · 04 / TRAIN

Set sixty epochs, learning rate zero point zero five, and seed seventeen. Train the scout and watch its measured loss curve.

## 00:00:44 · 05 / TEST

Evaluate held-out cases. Compare useful-file coverage with filename matching and random reads, using the same four-read budget. These results apply to this synthetic collection.

## 00:00:55 · 06 / INSPECT

Run the nightly workspace sync test. Its cited records show two authentication-expired errors and one token-refresh failure. Eight files remain unread, so the report is partial.

## 00:01:06 · USE CASE / UNDERSTAND A FAILURE

The shared credential suggests a connection problem. Check token expiry, refresh results, and which jobs share that credential before claiming a root cause.

## 00:01:15 · 07 / EXPORT

After evaluation, export the trained JSON. It contains the policy and provenance. Running this fly inside xo-space will require the adapter we plan to build next.
