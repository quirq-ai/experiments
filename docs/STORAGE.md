# Storage layout

All state for one run lives under `runs/<run_id>/`. Manifest is the source of truth; artifact files are immutable once written.

```
runs/
  r_8b21f0c1/
    manifest.json
    v01-terminal/
      session.cast
    v02-md/
      onepager.md
    v03-deck/
      index.html
    v04-notebook/
      notebook.ipynb
    v05-nextjs/
      index.html        (or a full app dir, with index.html as the entry)
```

## manifest.json shape

```json
{
  "id": "r_8b21f0c1",
  "title": "Ship a churn dashboard",
  "head": "v05",
  "created_at": "2026-05-28T14:01:22.000Z",
  "artifacts": [
    {
      "id": "v01",
      "parent_id": null,
      "run_id": "r_8b21f0c1",
      "form": "terminal",
      "content_ref": "v01-terminal/session.cast",
      "prompt": "Look at our churn data and tell me what we know.",
      "summary": "Ran cohort analysis; 14% monthly churn concentrated in <30d cohorts.",
      "created_at": "2026-05-28T14:01:22.000Z"
    },
    {
      "id": "v02",
      "parent_id": "v01",
      "run_id": "r_8b21f0c1",
      "form": "md",
      "content_ref": "v02-md/onepager.md",
      "prompt": "Summarize what we found into a one-pager.",
      "summary": "Condensed terminal session into a single page with thesis/evidence/ask.",
      "created_at": "2026-05-28T14:09:51.000Z"
    }
  ]
}
```

## Invariants

1. `head` always points to an existing artifact id.
2. Every artifact except the first has a `parent_id` that exists in the same run.
3. Artifacts are append-only; `appendArtifact` is the only writer.
4. `manifest.json` is written atomically (`tmp` + rename) so a crashed write never leaves a partial file.
5. Directory naming is `v{NN}-{form}`. The number matches the artifact id.

## Why this shape

Append-only fits the "evolution" mental model: rolling back HEAD doesn't delete the future, it just re-points; you can fast-forward again by moving HEAD back. The on-disk layout is human-browsable: open any subdir and you have the raw deliverable.
