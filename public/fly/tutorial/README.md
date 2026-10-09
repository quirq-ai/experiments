# Train a failure scout

[Watch the tutorial](./index.html) · [Download MP4](./train-a-failure-scout.mp4) · [Transcript](./train-a-failure-scout-transcript.md) · [Captions](./train-a-failure-scout.vtt)

This short video shows the Report Scout training app using real browser captures: create a scout, import a separated training/validation/test collection, demonstrate useful reads, train a file-ranking policy, evaluate it, inspect cited records, and export the trained JSON. Narration is **synthesized speech**, using the macOS Samantha voice. Full narration is also burned into the video as open captions; WebVTT and SRT tracks are included.

The example is a **fictional nightly workspace sync failure**. Two records report `AUTH_EXPIRED`; another reports `TOKEN_REFRESH_FAILED`. Their messages refer to one shared credential. This gives a person a focused hypothesis to check against connection settings and refresh logs. The fly itself ranks files and extracts requested fields; it does not independently establish a root cause or repair a connection.

## Try the same run

1. Open `/fly?studio=workspace` and create a fresh scout named **Failure Scout**.
2. In **Data**, choose **Import dataset JSON** and select [space-failures.dataset.json](../examples/space-failures.dataset.json). It contains 12 training, 4 validation, and 6 test workspaces. Every record is synthetic.
3. In **Teach**, select **Train · nightly workspace sync**, then **Start a demonstration**. Choose these three files in order:
   - `results/train-01/telemetry-2.json`
   - `results/train-01/telemetry-3.csv`
   - `results/train-01/workspace-job-failures-telemetry-1.csv`
4. Switch to **Train** after those three choices. Set **60** epochs, **0.05** learning rate, and **17** seed. Click **Train the scout**. The recorded run combines 3 human choices with 33 automatic teacher decisions.
5. In **Test**, click **Evaluate held-out cases**. Compare all three controllers under the same four-read budget. Then choose **Test · nightly workspace sync** and **Run this workspace**.
6. Read the extraction table and source evidence. A report remains **partial** because the scout read 4 of 12 files; it does not claim the remaining files are irrelevant.
7. In **Export**, choose **Export skill artifact**. The JSON is portable trained state. The xo-space adapter is a later phase; exporting does not install or execute this skill in xo-space today.

The recorded result is 100% useful-file coverage for the learned scout, 0% for filename matching, and approximately 44% for random reads. The filenames intentionally contain misleading query matches. These results describe this constructed collection, not general accuracy on unseen real workspaces. The browser run includes human examples, so its exact weights and read order may differ slightly from the independent [audit JSON](../examples/space-failures-results.json).

## Rebuild the video

The source is `scripts/fly/render-failure-walkthrough.py`. It requires Pillow, `ffmpeg`, and macOS `/usr/bin/say`. Place the original captures at `/tmp/fly-walkthrough/01-create.jpg` through `07-export.jpg`, using the stage names in the script. Captures should be 1453×993; crop coordinates scale for other resolutions.

```sh
python3 scripts/fly/render-failure-walkthrough.py \
  --captures /tmp/fly-walkthrough \
  --ffmpeg /absolute/path/to/ffmpeg
```

The renderer makes 1280×720 H.264/AAC video at 24 fps, a JPEG poster, open captions, WebVTT/SRT captions, a transcript, and a JSON timing manifest. Intermediate scene images and audio stay under `/tmp/fly-walkthrough/render`. The opening incident cards and the hypothesis diagram are explanatory graphics; the seven app screenshots are actual captured UI.
