# Fly Expedition Lab — incremental design and build plan

> Implementation status: the first Scent Seekers release is built. See [the implementation notes](fly-lab-implementation.md) for delivered features, measured learning results, and explicit differences from the broader roadmap below. Full 3D control, obstacle physics, later Changing World experiments, and Evolution Arena remain future increments.

Status: planning baseline; no Fly Lab implementation yet. 2026-09-17.

## Product direction

Build one Observatory instrument at `/fly`, with a persistent specimen collection and the workflow **Create → Train → Expedition → Compare**. Begin with **Scent Seekers**, then prioritize **Changing World** and **Evolution Arena**. Extend the same instrument with **Brain Twins** and **Glasshouse Navigators**.

The central experience is watching a fly trained in a controlled chamber meet unfamiliar conditions, then examining what it sensed, did, and learned. Every release should deliver an experiment that can be run and understood, not an unfinished collection of screens.

The architectural target is to avoid rebuilding the world, training loop, renderer, storage, or analysis for each experiment. Zero future rework cannot be guaranteed: new sensors or more detailed biomechanics may need a new model version. Versioned contracts should let earlier specimens and results remain readable and runnable with their compatible model.

## Decisions to make once

| Area | Initial decision | Why it survives later phases |
| --- | --- | --- |
| Integration | One Fly Lab adapter within the existing vanilla JS / Three.js app | New experiments stay inside the lab rather than multiplying top-level integration branches |
| Simulation | Pure JavaScript core, fixed simulation ticks, seeded randomness; no DOM or Three.js imports | Exactly the same environment runs visibly, in accelerated training, and in evaluation |
| World | Three-dimensional positions, lightweight bounded flight dynamics, explicit collision primitives from the beginning | Later obstacles, gusts, and glasshouse routes do not require replacing a 2D engine |
| Odor | Bounded, seeded, advected Gaussian puffs behind a field interface | Wind changes affect existing odor; source depletion and new sources use the same model |
| Sensors | Versioned observations in the fly's local frame; presence masks for optional channels | Future visual or contact sensors can be added explicitly without silently changing old policies |
| Controllers | A shared policy interface supporting random, reactive, and trainable implementations | Scientific controls, new learners, and connectome-derived models reuse one environment |
| Learning | Start with a small linear SARSA(λ) learner using tile-coded sensory features and discrete steering actions | Real individual learning with inspectable weights and bounded browser cost; other policy families can be added later |
| Evolution | Separate inherited parameters from acquired weights and moment-to-moment memory | Selection can reuse individual training and evaluation without pretending they are the same process |
| Storage | Versioned IndexedDB records, immutable checkpoints/results, explicit export/import | Specimens, generations, and histories survive refreshes and later releases |
| Replay | Store tick-indexed samples/events and resumable checkpoints independently of video | Long experiments remain inspectable without depending on a ten-second screen recording |
| Execution | One worker first, with cancellable jobs and bounded messages | Later worker pools or server execution can implement the same job protocol after profiling |

The proposed SARSA learner is a software control model, not a simulation of the recorded fly nervous system. Phase 0 must establish that it learns a useful scent task before committing to its settings. If it fails that gate, adjust or replace the policy implementation while keeping the world and records intact. Algorithm background: [Sutton and Barto, Reinforcement Learning](https://www.incompleteideas.net/book/bookdraft2018mar21.pdf).

## Scientific connection to the research

Keep three things visibly distinct:

1. **Measured anatomy:** a small, attributed subset of MaleCNS neuron skeletons, annotations, and connectivity, with dataset version and source IDs.
2. **Reduced computational model:** the flight, odor, sensory, memory, and learning assumptions that actually drive the first expedition.
3. **Experimental results:** observations from running that specific model, not claims about how a biological fly necessarily behaves.

Phase 0 includes a small data-access and rendering pilot. Phase 1 includes an anatomy inspector with provenance. The first learning model does not acquire biological credibility merely by displaying that anatomy beside it. Activity highlights must describe their source; do not animate real neurons as if an unrelated policy's weights were measured neural firing.

A later connectome-informed controller should use real connectivity through the same policy interface and explicitly record how anatomical connection counts were converted into model parameters. A full connectome-to-body model is a separate research extension. The full dataset is not an initial browser download.

Sources: [Google announcement](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/), [MaleCNS data and skeletons](https://male-cns.janelia.org/download/). More detailed embodied models to evaluate later: [NeuroMechFly v2](https://www.nature.com/articles/s41592-024-02497-y) and [Flybody](https://github.com/TuragaLab/flybody). Neither is assumed to be a drop-in browser component or a validated embodiment of this male connectome.

## Shared system boundaries

```text
Create / Train / Expedition / Compare UI
                     │ commands, progress, snapshots
                  FlySession
                     │ versioned job protocol
                Experiment worker
          ┌──────────┼──────────────┐
       Training   Evaluation    Evolution
          └──────────┼──────────────┘
                 Episode core
          Scenario → World → Sensors → Policy → Body
                     │ snapshots, events, metrics
          Three.js view / Replay / Record store
```

The worker owns authoritative experiment state. The view interpolates snapshots and draws them. Camera changes, particle effects, frame rate, and UI refresh frequency cannot change an experiment's outcome.

The same episode core handles every run condition. Evolution orchestrates existing jobs. Changing World supplies event schedules. Brain Twins supplies matched checkpoints and interventions. Glasshouse supplies a new scenario plus a declared sensor/controller capability version when necessary.

### Durable records

| Record | Contents |
| --- | --- |
| `ScenarioSpec` | ID/version, bounds, source definitions, odor-channel identities, separate food/reward mapping, wind, colliders, spawn distribution, maximum ticks, success rules, and scheduled events |
| `Genome` | Inherited, bounded parameters such as sensory sensitivity, memory time constants, motor limits, and learning-rate settings; initialization seed; no acquired weights by default |
| `Specimen` | Identity, parent IDs, genome reference, compatible body/sensor/policy versions, and selected checkpoint |
| `PolicyCheckpoint` | Learned weights, encoder configuration, algorithm version, training provenance, and content hash; immutable |
| `EpisodeState` | Tick, body states, environment/puff states, event cursor, sensor memory, controller runtime state, and all random-generator states |
| `JobCheckpoint` | Episode state plus learner traces/optimizer state, schedules, completed episodes, and orchestration state needed for exact pause/resume |
| `RunManifest` | Scenario/model versions, specimen/checkpoint IDs, seeds, timestep, learning condition, reward/metric definitions, intervention, and simulator build ID |
| `RunResult` | Outcome, component metrics, failures/timeouts, sampled trajectory, event log, and replay/checkpoint references |
| `GenerationRecord` | Parentage, mutations, training budget, selection suite, fitness components, selected offspring, and final audit references |

Separate policy checkpoints from complete job checkpoints. Reloading learned weights starts a fresh episode; resuming a paused job restores its environment, random state, and learner state as well.

Records have `schemaVersion` plus separate model/encoder versions. Migrate storage shapes explicitly. Keep old model/encoder handlers for supported saved runs; never silently resize weights or relabel old experiments as using a newer model. Imports validate dimensions, finite numbers, compatibility, and source manifests. Incompatible runs remain inspectable with a clear explanation.

### Minimal behavioral contracts

- `createEpisode(runManifest)` creates authoritative world and agent state.
- `stepTicks(count)` advances a specified number of fixed steps and emits events/metrics.
- `observe(agentId)` exposes only permitted sensed information.
- `policy.act(observation, memory, actionRng)` produces a bounded action and next runtime memory.
- `learner.update(transition)` is called only when the declared learning condition permits it.
- `snapshot()` returns a compact view state; `checkpoint()` returns complete resumable state.
- `restore(checkpoint)` checks versions and restores all required state.
- `summarize()` returns metrics from authoritative simulation events.
- `FlyView.render(snapshot, interpolation)` has no authority to advance physics or learning.

Use a serializable worker protocol with request/job IDs for start, pause, resume, cancel, checkpoint, progress, result, and error. Batch updates; transfer bounded buffers with explicit ownership. Keep the working implementation simple before adding parallel workers.

### Physical and sensory model

- Use meters and seconds in simulation, with an explicit render-scale conversion. Relative odor concentration and a normalized energy budget are labeled as model quantities, not measured molarity or joules.
- Start with smooth velocity/heading control, bounded turn/climb rates, wind drift, and swept collision checks. Wing animation reflects movement but does not generate aerodynamic forces in this version.
- Begin with stereo samples for at least two odor channels, recent odor history, time since odor contact, local wind direction, self-motion, normalized energy, and a small set of local obstacle probes. Odor identity and food/reward identity are separate, allowing later cue/reward reversal without changing sensor contracts. No target coordinates or hidden world map are available to the policy.
- Freeze the initial observation/action schema and encoder configuration. New sensory capabilities require a compatible policy implementation or an explicit new version; schema padding alone cannot give an old trained policy a new skill.
- The field sampled by sensors is the field visualized by the scent overlay. Decorative particles use a separate random stream and cannot influence sensing. Puff transport is an approximation, not resolved turbulent fluid mechanics; obstacle treatment must be stated.
- Keep time progression exact: acceleration runs more fixed ticks; it does not enlarge the physics timestep or discard unprocessed simulated time.
- Use separate seeded random streams for world events, agent action sampling, learning, mutations, and visual effects. Randomness should be indexed by purpose/agent so worker ordering does not alter a trial.

## Incremental releases and completion gates

### Phase 0 — prove the reusable foundation

Deliver a thin `/fly` integration, the initial schemas, a pure episode core, one chamber/source, basic 3D motion/sensors, random/reactive controls, the learner pilot, worker protocol, save/resume pilot, and one real-data anatomy sample. Add a simple scheduled wind change now to exercise the extension seam.

Completion gates:

- An episode runs through the same core in a Node verification script and browser worker, producing matching results within declared floating-point tolerances.
- With the same build and manifest, different render rates and acceleration settings produce the same event/metric sequence.
- Pause/resume reproduces uninterrupted behavior, including random state and learner state.
- A tiny deterministic learning fixture gives independently calculable weight updates. A simple scent curriculum produces measurable learning across several training seeds.
- Profile simulation, storage, and rendering before choosing cohort limits. Establish a reference viewport/device and record actual results.

### Phase 1 — Scent Seekers, complete experience

Deliver specimen creation; one polished orchard and one training chamber; rewarded and distractor odor sources; narrow and varied training curricula; actual learning curves; saved checkpoints; frozen-policy expeditions; cohort comparison; replay; data export; and the attributed anatomy inspector. In initial cohort benchmarks, flies do not collide with each other or consume shared source reserves; use independent matched worlds or non-interacting agents. Displaying trajectories together must not change the evaluation conditions.

First experiment: compare **untrained**, **predictable-wind trained**, and **variable-wind trained** specimens on the same unfamiliar orchard seeds. Include a separate reactive odor-following baseline.

Completion gates:

- A user can create → train → save → reload → launch → compare without developer tools.
- Training updates weights; frozen evaluation leaves their hashes unchanged. Different individuals keep independent runtime memories.
- At least 50 held-out world seeds per reported condition and multiple independent training seeds are available in the release evaluation. Report success counts/uncertainty and timeouts, not only successful flight times.
- Predeclare a useful improvement target over untrained behavior before tuning; report the observed result and comparisons to the reactive baseline. Do not assume learning must beat a strong heuristic.
- A recorded replay shows the corresponding observations, actions, rewards, and trajectory. Exported metadata identifies the exact run.
- Near and overview views remain readable; controls remain responsive while a cancellable training job runs.

### Phase 2 — Changing World

Add reusable event presets: wind rotation, source depletion, replacement food source, odor/reward reversal, and increasing sensor noise. Each event fires on an integer simulation tick and is recorded.

Offer two explicit experimental conditions: **frozen learned weights** and **online learning permitted**. Runtime sensory memory can change in both. Reset each matched comparison from the same checkpoint and initial state.

Add adaptation latency, repeated obsolete choices, cumulative reward, and recovery curves to the existing analysis. Define recovery against a prespecified window/threshold; report trials that never recover. Re-test the original conditions to measure retained performance. Source depletion is prescribed by scenario events, or independently tracked per trial, so another fly cannot alter a paired comparison.

Completion gate: the same specimen and runner execute both the original orchard and event-driven variants; changing the scenario requires no new simulator or separate training pipeline. Events replay at the same ticks. Online experiments cannot overwrite their starting checkpoints.

### Phase 3 — Evolution Arena

Add a generation scheduler around the existing pipeline:

```text
Generate genomes → instantiate fresh specimens → train equally
→ evaluate on selection suite → select parents → mutate → next generation
```

Start with bounded mutation and elitist selection; add crossover only if it brings a demonstrated benefit. Evolve a small declared parameter set first. Keep body size and sensor/action dimensions fixed initially.

Default inheritance passes genome parameters and initialization rules, not acquired weights. Each child receives the same training budget. Any later inheritance of learned weights is a separately labeled experimental mode.

Show family trees, generation curves, trait distributions, and fitness components. Treat multi-agent resource competition as a later explicit environment mode; the initial comparison runs individuals in matched independent worlds so they do not change each other's test conditions.

Completion gates:

- Generations reuse the same learner/evaluator, with resumable/cancellable jobs and reconstructable parentage.
- Selection uses designated selection seeds. A sealed final audit suite never affects training, selection, or checkpoint choice.
- Compare against an equal-compute random-genome search baseline. Equal budgets mean equal simulated experience, not equal wall-clock time.
- Report all fitness components, diversity, failures, and resource cost; a rising selection score alone is not evidence of generalization.

### Phase 4 — Brain Twins, deeper causal experiments

Basic cloning/comparison already exists in Phase 1. Add recorded interventions: mask a sensor channel, alter memory retention, change a motor limit, or attenuate a pathway only when the selected controller actually has that pathway.

Run twins in independent matched worlds with paired seeds and identical initial checkpoints. Show synchronized paths, sensor/action timelines, and paired outcome differences. Sensor masking and policy-weight edits have distinct labels and semantics.

Completion gate: interventions are declarative run inputs, leaving baseline checkpoints unchanged. The UI does not invent biological circuit attribution for the software controller.

### Phase 5 — Glasshouse Navigators

Add authored glasshouse layouts, new obstacle assets, route objectives, and landmark/vision sensor capabilities. Reuse the 3D body, collision system, episode runner, curricula, evaluation, replay, and evolution scheduler.

A lightweight directional landmark sensor is the first visual capability. An actual image-based visual policy is a later policy/encoder version with its own training and performance budget. Earlier scent-trained specimens remain usable on compatible tasks and can be cloned into an explicitly new training configuration.

Completion gate: adding a habitat and sensor/policy capability does not replace storage, UI workflow, experiment scheduling, or reporting. A version mismatch is visible rather than silently coerced.

## Evaluation and learning rules

- Keep reward and evaluation metrics separate. Arrival, safe movement, time, and budget costs must have explicit definitions. Avoid rewarding high odor indefinitely, repeated arrival on the same food, or boundary/collision loops.
- Start with short, easy curricula and sparse arrival rewards plus explicit costs. If privileged shaping is needed, confine it to training, document it in the manifest, and confirm it does not leak into policy observations or evaluation scores.
- Partition seeds into training, validation/selection, and sealed audit sets. Version each suite; keep the audit hidden from model selection.
- Compare on matched environmental seeds while preserving independent controller randomness. Record both environment and training seeds.
- Report success rate with uncertainty, time-to-source including censored failures, path length, wrong-source visits, collisions, and model energy cost. State the denominator and episode horizon.
- Never infer true biological neural activity from a software policy. Trace actual model inputs, memory, action values, and selected actions; label any simulated neural model separately.
- Do not tune parameters by watching sealed audit results repeatedly. Once used for development decisions, that set becomes validation and a new audit is needed.

## Visual design that grows with the lab

Use the existing dark Observatory frame, warm/cool lighting, restrained bloom, typography, and compact translucent controls. Give this instrument a consistent four-stage interface instead of a separate panel design for every experiment.

- **Create:** macro specimen turntable; articulated legs, compound-eye texture, translucent veined wings; morphology and model provenance available without crowding the subject.
- **Train:** a clear chamber, one selected specimen, trial progress, curriculum controls, reward components, and a real learning curve.
- **Expedition:** the habitat dominates. Overview and follow cameras, selected-fly sensory inset, optional field overlays, clear source/goal markers, and bounded trails.
- **Compare:** synchronized replay, ghost paths, cohort distributions, world-event markers, checkpoint selection, and later a family-tree view.

Build one reusable fly asset and one habitat asset kit. Share materials, animation states, picking IDs, camera bookmarks, and selection styling. Use detail levels for wings/eyes, instancing for background vegetation and distant flies, and pooled geometry/buffers. Show rapid wing motion as a stable motion envelope at normal speed and individual strokes in slow motion, avoiding frame-rate aliasing. Keep decorative particles out of scientific state.

Initial performance targets to validate, not guarantees: smooth 60 fps near 1280×720 with 16–32 visible flies on the agreed development machine, and prompt controls during background jobs. Adapt visual detail or cohort limits based on profiling; do not alter scientific fidelity halfway through a recorded run. Full trajectories are retained for inspected runs, while large training/evolution jobs keep summaries and selected diagnostic episodes.

## Repository implementation map

Create modules only as their phase needs them; this is ownership guidance rather than a requirement to pre-create empty abstractions.

```text
src/fly/
  contracts.js                 record versions, validation, capability definitions
  core/                        ticks, random streams, world, odor, body, sensors, events
  policies/                    random, reactive, SARSA, later circuit/visual policies
  experiments/                 train, evaluate, metrics; later evolve and interventions
  scenarios/                   chamber/orchard; later changing-world and glasshouse specs
  runtime/                     session, worker, job protocol
  records/                     IndexedDB, migrations, checkpoints, replay, export
  render/                      fly asset, habitat kit, field view, trails, picking
  data/                        curated connectome subset metadata and provenance
  flylab.js                    adapter to Observatory's stage, mode and capture
src/ui/flyPanel.js              stage navigation and panel coordination
src/ui/fly/                    shared specimen, training, mission and comparison views
scripts/fly/                   dataset preprocessing and repeatable evaluation commands
tests/fly/                     numerical, determinism, learning and compatibility checks
```

Integration work is confined to a `/fly` entry in `src/nav/routes.js`, tab/panel markup in `index.html`, a namespaced stylesheet, help/shortcut hooks, and explicit Fly Lab construction/mode/update/capture hooks in `src/main.js`. Keep the adapter cheap and create heavy assets/worker state on first activation. Restore bloom, fog, controls, lighting adjustments, and camera settings when leaving the lab. Leaving pauses jobs by default; background continuation is an explicit run option.

Reuse the shared stage, camera controls, panel drag helper, snapshot/video recorder, and compatible UI conventions. Use existing trails as a reference or add a backward-compatible sample-spacing option: their current sampling threshold is tuned to astronomical distances. Replay paths remain sourced from tick data.

Do not wire the fly experiment directly to `DiffusionField`: it is a 2D enclosed-room model that also packs display pixels. Do not use `capture/datatrace.js` as the research log: it samples by wall-clock time for video and its generic expected-error thresholds are inappropriate for expedition success. Implement a fly-specific trace/HUD adapter and preserve full experiment records separately. Ensure fly capture never falls through to solar data.

No React migration, general-purpose ECS, whole-app lab registry rewrite, server requirement, or full-connectome emulation is needed for these releases. A richer body solver or remote training worker can later implement the existing interfaces as a distinct, versioned backend; it will still need validation and likely new compatible training.

## Efficient delivery and verification

1. Complete Phase 0 contracts and the headless learning/data pilots first. Do not build a large UI around an unproven learning loop.
2. Once a snapshot and command contract exists, work in parallel: one owner for simulation/learning, one for assets/rendering, one for panel/records. Use shared fixture snapshots so graphics can progress independently of training tuning.
3. One integration owner edits `main.js` and shared routing/capture files. Make small phase-based commits; avoid multiple agents rewriting the same glue.
4. Finish and verify the entire Scent Seekers loop before adding evolutionary population management. Then add one experiment family per release.
5. Validate consequential behavior with Node's built-in test runner and focused browser checks. Tests cover independent numerical fixtures, seeded reproducibility, resume equivalence, frozen evaluation, reward edge cases, event timing, storage compatibility, inheritance, and train/test separation. Avoid tests that merely repeat implementation details.
6. Build and exercise the affected lab, inspect console errors and visual layout, and smoke-check transitions to existing labs. Check worker cancellation and resource cleanup. Test save/reload, export/import and migrations with retained old fixtures.

Current repository baseline: the app builds and starts after recovering ten Diffusion/Tesseract files from local commit `50bda68`. Those files remain untracked from the earlier startup repair; preserve them and handle that baseline recovery separately from the new Fly Lab work. This plan changes no application behavior.

The first implementation milestone is Phase 0 plus the complete Phase 1 Scent Seekers experience. Changing World and Evolution Arena are committed design requirements for the shared contracts, not separate engines to build in advance.
