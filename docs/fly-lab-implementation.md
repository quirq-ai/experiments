# Fly Expedition Lab — first release

## Delivered

Scent Seekers is available at `/fly`, with Create → Train → Expedition → Compare.
The application remains vanilla JavaScript and uses the observatory's shared
Three.js renderer, camera, capture tools, and URL navigation.

- Inherited sensitivity, sensory-memory duration, exploration, and flight speed.
- Real tile-coded linear SARSA(λ) updates in a Web Worker; steady and varied curricula.
- Frozen-policy orchard expeditions, plus a wind-shift scenario.
- Matched untrained and reactive controls, counts, Wilson intervals, failures,
  time, path length, energy, and boundary collisions.
- Per-flight replay with actual odor samples and trajectories. The first 12 flights
  retain full sampled records; all requested flights contribute to the metrics.
- Local specimens, learned checkpoints, resumable paused jobs, and versioned JSON export/import.
- Procedural fly model, chamber and orchard; a separate on-demand MaleCNS anatomy sample.

## Learn manual

Train includes a Learn entry that opens an accessible reading dialog with five
chapters: the model, control loop, training, teaching, and commands. Content in
`src/fly/learn/content.js` describes the actual implementation, including its
engineered steering prior, privileged shaping, replacing traces, limitations,
worker protocol and checkpoint formats. Browser and terminal examples include
explicit execution environments and copy controls.

`src/ui/flyLearn.js` runs a separate seeded episode for the tick inspector. It uses
`createEpisode` and `stepEpisode` directly. Action scores are compared at the same
previous observation before/after the weight update, avoiding confusion with the
next action chosen before that update. Disabling learning resets the episode with
frozen weights and no shaping. It never uses the selected specimen or session job.

Verified in the browser: first training tick changes nine weights with reward
0.2490629387; frozen evaluation changes zero weights and gives −0.015. Chapter
navigation, copy confirmation, compact layout and native dialog dismissal were
checked. The full headless teaching example was executed successfully.

## Scientific scope

This is a tractable model of navigation and learning, inspired by connectomics.
It does not emulate the complete male fly brain. Real geometry never acquires
fictional neural activity from the unrelated controller. The anatomy view shows
DNge104_R (body 12781) and DNge104_L (body 556329), not the entire connectome.
See [asset attribution](../public/fly/ATTRIBUTION.md).

The authoritative core advances in 0.12-second ticks using seeded random streams.
Flight is kinematic, with heading control, wind drift, energy costs, bounds, and a
fixed-altitude reflex. Odor consists of advected Gaussian puffs in two channels.
The visual scent overlay uses those puffs. Fruit and fly positions are model
coordinates; expedition fly bodies are enlarged 2.6× for visibility. Vegetation,
moss, and stage details are decorative, with no obstacle collision or turbulence.

The sensory encoder has an engineered steering prior based on local odor gradients,
wind, and boundary avoidance. SARSA learns steering actions from those features;
it is not discovering olfactory navigation from unprocessed receptors. The policy
has no target position as an observation. Training has a disclosed privileged
reward shaping term (100 × reduction in distance to the rewarding source), in
addition to arrival reward and tick/collision costs. Evaluation removes shaping,
exploration, and weight updates. Energy is a model budget, not measured metabolism.

Training and expeditions use separate seeded suites by default. User-selected
world seeds enable reproducible comparisons, but arbitrary choices do not guarantee
statistical independence. Success means reaching the rewarding source before the
episode horizon, once per episode. Failure-inclusive mean duration is distinct
from mean time to source among successes.

## Validation

`npm run test:fly` checks an independent numerical SARSA update, fixed-tick and
checkpoint determinism, frozen evaluation, sensory behavior, arrival accounting,
version validation, held-out learning, failure-inclusive statistics, worker/core
parity, and session record ownership/import/resume behavior.

`npm run evaluate:fly` runs 200 training episodes with independent seeds 11, 29,
and 47, then tests every condition against the same 50 held-out worlds. The model
parameters were frozen before this final audit. Full results, intervals, seeds,
and manifest are in [fly-release-audit.json](fly-release-audit.json).

| Condition | Arrivals out of 50, by training seed |
| --- | --- |
| Untrained | 1 |
| Reactive scent follower | 50 |
| Steady curriculum | 50, 49, 50 |
| Varied curriculum | 50, 27, 50 |

Varied training averaged 84.7% success versus 2% untrained. Its variability is
material. This does not establish superiority over the reactive baseline or over
steady training, nor biological validity. The release gate measures a useful
learned improvement in this reduced task.

## Browser verification

Verified in the running app: specimen creation, a 200-episode variable-wind job,
training pause → refresh → exact job resume, frozen orchard evaluation, flight
selection and replay scrubbing, anatomy loading, wind-shift evaluation, persisted
results after refresh, and Solar ↔ Fly navigation. No browser warnings/errors were
reported in those checks. Layouts were inspected at 1440×900, 678×993, and 390×844.

The browser specimen `Fern` (policy seed 17, training seed 7301) achieved 12/12
arrivals in orchard worlds starting at seed 41001; the matched untrained policy
achieved 0/12 and reactive control 12/12. Under the wind-shift scenario, the same
checkpoint achieved 7/12, untrained 0/12, and reactive 7/12. These small exploratory
batches are workflow checks, separate from the 50-world release audit above.

Production build and all 14 automated tests pass. Vite retains the existing
large-bundle advisory for the application's shared entry bundle.

## Boundaries for the next increments

`core/engine.js` owns model state and physics; `policies/sarsa.js` owns learned
weights and eligibility traces. `experiments/runner.js` owns manifests/statistics;
`runtime/worker.js` schedules the same core; `runtime/session.js` coordinates
browser commands and persistence. `flylab.js` and `render/` only display snapshots.
`FlyPanel` only presents state and dispatches commands.

Changing World already has one wind-shift scenario. Reward reversal, source
depletion, retraining comparisons, and broader event schedules remain later work.
Evolution Arena's selection, mutation, and generation UI remain later work; the
specimen genome, learned policy, parent ID, and runtime state are separate now.
New sensory or body capabilities must get a new model/encoder version and may
require compatible retraining. General obstacle physics, full 3D control, and a
connectome-derived controller are not implemented in this release.
