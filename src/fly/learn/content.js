// Static educational content. Runnable examples use the same public modules as
// the worker and the headless verification suite; no second simulator lives here.
export const LEARN_SNIPPETS = {
  motor: {
    label: 'The three motor instructions', language: 'JavaScript',
    context: 'Equivalent to the kinematic update in src/fly/core/engine.js. Units are meters, radians and seconds.',
    code: `const DT = 0.12;
const ACTIONS = [-1, 0, 1]; // action IDs: 0, 1, 2

yaw += ACTIONS[action] * turnRate * DT;
x += (Math.cos(yaw) * speed + wind[0] * 0.12) * DT;
z += (Math.sin(yaw) * speed + wind[2] * 0.12) * DT;

// A fixed reflex, outside the learned policy, stabilizes height.
y += clamp((0.027 - y) * 2, -0.008, 0.008) * DT;`
  },
  sarsa: {
    label: 'The actual weight update', language: 'JavaScript',
    context: 'Core calculation from src/fly/policies/sarsa.js. features and nextFeatures contain nine active integer indices each.',
    code: `const q = values(policy, features)[action];
const nextQ = terminal ? 0 : values(policy, nextFeatures)[nextAction];
const delta = reward + gamma * nextQ - q;

// Decay older traces; replace traces for this state/action with 1.
for (let i = 0; i < traces.length; i++) traces[i] *= gamma * lambda;
for (const feature of features) traces[action * 90 + feature] = 1;

const rate = alpha / features.length; // alpha / 9
for (let i = 0; i < traces.length; i++) {
  policy.weights[i] += rate * delta * traces[i];
}`
  },
  browser: {
    label: 'Control the selected specimen', language: 'Browser console',
    context: 'Open this app’s browser developer console. This complete sequence trains the selected specimen, waits for completion, tests it and exports its results. It changes your local collection; pause/resume still works through the app.',
    code: `var lab = window.__solar.flySession;
await lab.ready;
var waitForJob = async () => {
  while (lab.state.job) await new Promise(resolve => setTimeout(resolve, 100));
  if (lab.state.error) throw new Error(lab.state.error);
};
if (lab.state.job) throw new Error('Finish or cancel the current job first.');

// Inspect the selected specimen without changing it.
console.table(lab.state.specimen.genome);
console.log(lab.state.specimen.policy);

// Start 200 additional training episodes on this specimen.
lab.train({ curriculum: 'varied', episodes: 200 });
console.log(lab.state.job); // live progress is also shown in Train
await waitForJob();

// After training completes, test frozen weights in 50 new worlds.
lab.launch({ scenario: 'orchard', seed: 500000, count: 50, benchmark: true });
await waitForJob();

// After the expedition completes, inspect results and export a backup.
console.table(lab.state.report.comparisons);
lab.exportData();`
  },
  controls: {
    label: 'Create, inspect, pause and replay', language: 'Browser console',
    context: 'Use after defining lab in the example above. Creation and checkpoint selection require an idle job. pause() is a toggle.',
    code: `// Create a fresh learner; name and body traits are separate from weights.
lab.createSpecimen({
  name: 'Scent student',
  genome: { sensitivity: 1.2, speed: 0.023, memory: 1.4, exploration: 0.12 }
});

// Independent commands: run one when you need it.
// if (lab.state.job && !lab.state.paused) lab.pause(); // pause
// if (lab.state.job && lab.state.paused) lab.pause();  // resume

// Other independent commands:
// lab.cancel();                         // discard this unfinished job
// lab.selectCheckpoint(checkpointId);   // restore saved learned weights
// lab.selectRun(0);                     // choose the first recorded trial
// lab.setReplay(10);                    // jump to recorded frame 10
// lab.launch({ scenario: 'wind-shift', seed: 500000, count: 50 });

console.table(lab.state.specimen.checkpoints || []);
console.log(lab.state.snapshot);`
  },
  tick: {
    label: 'Step the real core yourself', language: 'Browser console',
    context: 'Creates an isolated episode in console memory. It does not change your saved specimen or the displayed expedition. Use the app’s development server.',
    code: `var core = await import('/src/fly/core/engine.js');
var learner = await import('/src/fly/policies/sarsa.js');
var ep = core.createEpisode({
  seed: 2049,
  genome: core.createGenome(),
  policy: core.createPolicy(11),
  scenario: 'orchard',
  training: true,
  epsilon: 0.12
});

console.log(core.observe(ep));       // filtered sensory observation
console.log(ep.features);            // 9 active feature indices
console.log(ep.action);              // the next action to execute
core.stepEpisode(ep, 1);             // exactly 0.12 simulated seconds
console.log(core.snapshotEpisode(ep));
console.log(learner.values(ep.policy, ep.features));
console.log(core.summarizeEpisode(ep));

// Unlike a weight-only save, this includes the world and RNG state.
var saved = core.checkpointEpisode(ep);
var restored = core.restoreEpisode(saved);`
  },
  terminal: {
    label: 'Run the project checks', language: 'Terminal',
    context: 'Run from the repository root. The audit trains six policies and prints JSON; it can take longer than the unit tests.',
    code: `npm run test:fly
npm run build

# Release audit: two curricula × three training seeds, 50 worlds each.
npm run evaluate:fly -- --episodes=200 --count=50`
  },
  headless: {
    label: 'Train and compare without the browser', language: 'Terminal · Node.js',
    context: 'A complete executable example. Run from the repository root with Node.js. It writes a raw policy checkpoint to /tmp/fly-policy.json; this file is for the core API, not the UI Import button.',
    code: `node --input-type=module <<'JS'
import { writeFile } from 'node:fs/promises';
import { createGenome, createPolicy } from './src/fly/core/engine.js';
import { trainPolicy, evaluatePolicy, hashPolicy } from './src/fly/experiments/runner.js';

const genome = createGenome({ sensitivity: 1, memory: 1.4 });
const initial = createPolicy(11);
const trained = trainPolicy({
  policy: initial, genome, curriculum: 'varied', episodes: 200, seed: 11
});
const worlds = { genome, count: 50, seed: 500000, scenario: 'orchard' };
const before = hashPolicy(trained.policy);
const results = [
  ['untrained', evaluatePolicy({ ...worlds, policy: initial })],
  ['trained', evaluatePolicy({ ...worlds, policy: trained.policy })],
  ['reactive', evaluatePolicy({ ...worlds, policy: initial, controller: 'reactive' })]
];
console.table(results.map(([condition, result]) => ({
  condition,
  successes: result.summary.successes,
  trials: result.summary.count,
  successRate: result.summary.successRate,
  meanDuration: result.summary.meanDuration,
  meanCollisions: result.summary.meanCollisions
})));
if (hashPolicy(trained.policy) !== before) throw new Error('Evaluation changed weights');
await writeFile('/tmp/fly-policy.json', JSON.stringify({ genome, policy: trained.policy }, null, 2));
JS`
  },
  worker: {
    label: 'Messages crossing the worker boundary', language: 'JavaScript · protocol example',
    context: 'Illustrates the internal protocol. FlySession creates and owns this worker; use the session commands above for normal app control. policy and genome must be valid serialized objects.',
    code: `// Main thread → worker
worker.postMessage({
  type: 'train', jobId: 'experiment-01',
  policy, genome, episodes: 200, curriculum: 'varied', seed: 11
});
worker.postMessage({ type: 'pause', jobId: 'experiment-01' });
worker.postMessage({ type: 'checkpoint', jobId: 'experiment-01' });
worker.postMessage({ type: 'resume', jobId: 'experiment-01' });

// After training completes, evaluate with the returned learned policy:
worker.postMessage({
  type: 'evaluate', jobId: 'expedition-01',
  policy: trainedPolicy, genome, scenario: 'orchard',
  count: 50, seed: 500000, benchmark: true
});
// worker.postMessage({ type: 'cancel', jobId: 'expedition-01' });
// To resume in a fresh worker, include a saved job checkpoint:
// worker.postMessage({ type: 'resume', jobId: 'experiment-01', checkpoint });

// Worker → main thread (message shapes; not executable statements)
// { type: 'progress', jobId, completed, total, history, snapshot }
// { type: 'trained', jobId, policy, history, summary }
// { type: 'paused', jobId, checkpoint }
// { type: 'checkpoint', jobId, checkpoint }
// { type: 'resumed', jobId }
// { type: 'evaluated', jobId, runs, summary, comparisons }`
  }
};

export const LEARN_SECTIONS = [
  {
    id: 'overview', kicker: '01 / THE FLY', title: 'What is actually learning?',
    intro: 'The fly is a small, inspectable reinforcement-learning agent: a body, a sensory system, a steering policy and experience.',
    html: `
      <div class="learn-callout"><strong>A reduced computational fly.</strong><p>The expedition uses kinematic flight, synthetic odor and a 270-weight software controller. The two measured MaleCNS neurons in Anatomy are scientific reference geometry; their connections do not compute these decisions. Wings, legs and foliage add visual context, rather than aerodynamic or collision simulation.</p></div>
      <h3>Four different kinds of state</h3>
      <table class="learn-table"><thead><tr><th>Part</th><th>What it contains</th><th>When it changes</th></tr></thead><tbody>
        <tr><td>Genome</td><td>Sensor sensitivity, speed, turning limit, sensory memory, exploration, learning rate and energy budget.</td><td>Chosen for a new specimen. Training does not evolve these parameters.</td></tr>
        <tr><td>Policy</td><td>270 numerical weights that score three steering actions; model version and training history metadata.</td><td>Updated during training. Frozen during expeditions.</td></tr>
        <tr><td>Episode</td><td>Position, heading, energy, filtered odor, odor puffs, action, reward, eligibility traces and random-generator state.</td><td>Changes every simulation tick and resets for a new trial.</td></tr>
        <tr><td>World</td><td>Two sources, a bounded flight arena, wind and a scheduled event list.</td><td>Initialized from a seed; puffs and wind then evolve over time.</td></tr>
      </tbody></table>
      <h3>The body’s limits</h3>
      <p>The arena is 300 × 210 mm horizontally, with height bounded between 8 and 75 mm. A default fly moves at 23 mm/s. Its policy chooses heading changes in the horizontal plane; an automatic reflex keeps it near 27 mm altitude. The policy cannot flap individual wings, accelerate, pitch, roll or choose its own altitude.</p>
      <p>Each episode has a default limit of 240 ticks × 0.12 seconds = <strong>28.8 simulated seconds</strong>. Arrival within 14 mm of the rewarded source, an empty energy reserve or the tick limit ends the trial. The default energy reserve lasts 40 simulated seconds, so the time limit normally arrives first.</p>
      <h3>What “memory” means here</h3>
      <p>The Memory trait is a smoothing time constant, from 0.2 to 5 seconds. It blends current odor samples with recent samples; it is not a remembered map or a history of past expeditions. Learned weights persist across episodes. Sensory memory and eligibility traces belong to one episode.</p>
      <h3>Where the research enters</h3>
      <p>The anatomy inspector shows the left and right DNge104 descending neuron skeletons from MaleCNS v1.0, with measured geometry under CC BY 4.0. A connectome records wiring; this lab’s learning rule and movement model are separately specified software assumptions.</p>
      <p class="learn-source"><a href="https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/" target="_blank" rel="noopener noreferrer">Google Research: the male fly connectome ↗</a> · <a href="https://male-cns.janelia.org/download/" target="_blank" rel="noopener noreferrer">MaleCNS data and attribution ↗</a></p>
    `
  },
  {
    id: 'loop', kicker: '02 / ONE TICK', title: 'Sense → choose → move → learn',
    intro: 'Every 120 milliseconds of simulated time, the same deterministic control loop turns a local observation into a motor instruction.',
    html: `
      <div data-learn-inspector></div>
      <ol class="learn-steps">
        <li><strong>Advance the world.</strong> Apply scheduled events, update wind, emit odor puffs and move them with the wind. A source emits every four ticks; its Gaussian puffs spread and fade as they age.</li>
        <li><strong>Execute the chosen action.</strong> Turn left, hold heading or turn right, then move forward. Apply the altitude reflex, arena bounds and energy cost.</li>
        <li><strong>Measure the outcome.</strong> Record progress, collisions, arrival, energy and the immediate reward. Decide whether the episode has ended.</li>
        <li><strong>Sense the new state.</strong> Sample odors A and B at the body. Estimate the A gradient with samples 4 mm to either side along the arena’s X and Z axes. Smooth odor and gradient using the Memory time constant.</li>
        <li><strong>Encode and choose again.</strong> Convert the observation into nine active feature indices. Score each action, then select the next action with the current exploration setting.</li>
        <li><strong>Learn, if training.</strong> Use the reward and the old and next state/action pairs to update weights. The next tick executes the action just chosen.</li>
      </ol>
      <p>The initial observation and first action are computed when the episode is created. During each step, the next action is chosen <em>before</em> that step’s weight update: this is an on-policy SARSA loop.</p>
      <h3>The sensory system already contains a navigation prior</h3>
      <p>The encoder combines <strong>upwind direction</strong> with the <strong>crosswind gradient of odor A</strong> to produce a desired bearing relative to the fly’s current heading. If A falls below 0.003 model units, it adds a sideways search component. Near a boundary, it steers inward using normalized arena position. The learner is therefore learning steering values around a hand-engineered guidance signal; it is not discovering plume tracking from raw neurons.</p>
      <p>The learner does not receive food coordinates or distance to food as an observation. The training reward does use that distance. B intensity and the A/B mixture are features, but the desired-bearing calculation is currently hard-wired to A.</p>
      <h3>The observation becomes 90 possible features</h3>
      <table class="learn-table"><thead><tr><th>Feature group</th><th>Slots</th><th>Active per tick</th></tr></thead><tbody>
        <tr><td>Constant bias</td><td>1</td><td>1</td></tr>
        <tr><td>Two offset, 16-bin heading encodings, each split by A contact</td><td>64</td><td>2</td></tr>
        <tr><td>A intensity</td><td>4</td><td>1</td></tr>
        <tr><td>Additional heading feature: first bin modulo 8</td><td>8</td><td>1</td></tr>
        <tr><td>Near-boundary indicator</td><td>2</td><td>1</td></tr>
        <tr><td>Energy band</td><td>4</td><td>1</td></tr>
        <tr><td>B intensity</td><td>4</td><td>1</td></tr>
        <tr><td>B’s fraction of total odor</td><td>3</td><td>1</td></tr>
      </tbody></table>
      <p>Each action owns its own block of 90 weights. A feature uses the array address <code>actionId × 90 + featureId</code>: action 0 has addresses 0–89, action 1 has 90–179 and action 2 has 180–269. Its Q value is the sum of the nine currently active weights in that block. These values estimate future discounted reward; they are not probabilities, neuron voltages or confidence scores.</p>
      <h3>The instruction set is deliberately small</h3>
      <table class="learn-table"><thead><tr><th>Action ID</th><th>Instruction</th><th>Default change per tick</th></tr></thead><tbody>
        <tr><td><code>0</code></td><td>Turn negative / left</td><td>−0.384 rad (about −22°)</td></tr>
        <tr><td><code>1</code></td><td>Hold heading</td><td>0 rad; keep moving forward</td></tr>
        <tr><td><code>2</code></td><td>Turn positive / right</td><td>+0.384 rad (about +22°)</td></tr>
      </tbody></table>
      <div data-learn-snippet="motor"></div>
      <div class="learn-callout"><strong>Simulation time is independent of rendering.</strong><p>The worker advances fixed ticks, while Three.js displays snapshots. A slow frame does not change the model’s time step or learning rule. Recorded expedition frames are normally four ticks apart, so a replay frame is not one motor instruction.</p></div>
      <p class="learn-source">Implementation: <code>src/fly/core/engine.js</code> → <code>observe</code>, <code>stepEpisode</code>; <code>src/fly/policies/sarsa.js</code> → <code>encode</code>, <code>chooseAction</code>.</p>
    `
  },
  {
    id: 'learning', kicker: '03 / THE UPDATE', title: 'How experience changes the policy',
    intro: 'Training changes real numerical weights using SARSA(λ): State–Action–Reward–State–Action, with eligibility traces that give recent decisions credit.',
    html: `
      <h3>Reward is the teaching signal</h3>
      <table class="learn-table"><thead><tr><th>Event</th><th>Immediate reward</th><th>When used</th></tr></thead><tbody>
        <tr><td>Every tick</td><td><code>−0.015</code></td><td>Training and evaluation</td></tr>
        <tr><td>Touch an arena boundary</td><td>Additional <code>−0.12</code></td><td>Training and evaluation</td></tr>
        <tr><td>Reach the rewarded source</td><td>Additional <code>+8</code></td><td>Training and evaluation</td></tr>
        <tr><td>Reduce distance to food</td><td><code>100 × (distanceBefore − distanceAfter)</code>, with distance in meters</td><td>Training only</td></tr>
      </tbody></table>
      <p>The terms add together. Moving 2 mm closer without arrival or collision gives <code>−0.015 + 100 × 0.002 = +0.185</code> during training. The identical move scores <code>−0.015</code> in evaluation. Moving away makes the shaping term negative. Entering the decoy region is counted as a wrong-source visit but has no separate reward penalty in this version.</p>
      <div class="learn-callout"><strong>The teacher knows more than the fly.</strong><p>Distance shaping uses the true source location to give frequent feedback. That privileged information reaches the learner through training reward, not its sensory observation. Expedition weights are frozen and this shaping term is removed. Compare held-out arrivals and durations; training and expedition reward totals have different definitions.</p></div>
      <h3>Predict, then correct the prediction</h3>
      <div class="learn-equation"><code>Q(s, a) = sum of active weights for action a</code><br><code>δ = reward + γ × Q(nextState, nextAction) − Q(state, action)</code><br><code>weight[i] += (α / 9) × δ × trace[i]</code></div>
      <p><strong>δ</strong> is the temporal-difference error: how surprising the reward plus next prediction was. At a terminal state the next Q value is zero. A positive error raises values associated with recent actions; a negative error lowers them.</p>
      <table class="learn-table"><thead><tr><th>Parameter</th><th>Default</th><th>Meaning</th></tr></thead><tbody>
        <tr><td><code>α</code> / learningRate</td><td>0.025</td><td>Update strength, divided by nine active features.</td></tr>
        <tr><td><code>γ</code> / discount</td><td>0.97</td><td>How much the next prediction contributes.</td></tr>
        <tr><td><code>λ</code> / trace decay</td><td>0.72</td><td>How far credit spreads to recently active features.</td></tr>
        <tr><td><code>ε</code> / exploration</td><td>Starts at 0.12</td><td>Chance of a uniformly random action rather than the highest Q value.</td></tr>
      </tbody></table>
      <p>Before each update, all traces decay by <code>γ × λ = 0.6984</code>. The nine features for the action just taken get replacement traces of 1. All 270 weights then receive their trace-scaled correction. Traces reset between episodes; learned weights carry forward.</p>
      <div data-learn-snippet="sarsa"></div>
      <h3>Exploration and repeated episodes</h3>
      <p>The training runner uses <code>ε = max(0.025, exploration × (1 − episodeIndex / episodeCount))</code>. The schedule restarts for each new training job. Otherwise it chooses the action with the highest Q value, breaking exact ties with seeded randomness. Fresh policies have zero weights, so their tied action choices are initially random even when ε is zero.</p>
      <p><strong>Steady wind</strong> trains in the chamber with fixed wind and a narrower starting distribution. <strong>Variable wind</strong> trains in the orchard with randomized initial wind direction, sinusoidal gusts and a wider range of starting positions. Source positions and starting headings also vary by seed.</p>
      <h3>Know what the comparison proves</h3>
      <p>An expedition compares the selected checkpoint, a zero-weight learner and a reactive scent follower on the same seeded worlds. The reactive follower directly follows the same engineered bearing, without learned weights. It is a strong baseline, not a deliberately weak opponent.</p>
      <p>Use success count and its 95% Wilson interval, mean duration including failures, successful-arrival time, path length, collisions and wrong-source visits. A good training curve alone does not establish generalization. More episodes or a varied curriculum do not guarantee a better policy; compare multiple independent training seeds. The current wind-shift scenario changes the wind angle by 0.85 rad at tick 90 (10.8 s); it still freezes the policy.</p>
      <p class="learn-source">Implementation: <code>src/fly/policies/sarsa.js</code>, <code>src/fly/experiments/runner.js</code>, <code>src/fly/runtime/worker.js</code>. Background: <a href="https://www.incompleteideas.net/book/bookdraft2018mar21.pdf" target="_blank" rel="noopener noreferrer">Sutton &amp; Barto, Reinforcement Learning ↗</a>.</p>
    `
  },
  {
    id: 'teaching', kicker: '04 / YOUR EXPERIMENT', title: 'How to teach it something',
    intro: 'Teach by changing experience, feedback and the task the fly can perceive—not by sending an English instruction to the controller.',
    html: `
      <h3>A first experiment you can run now</h3>
      <ol class="learn-steps">
        <li><strong>Create a fresh specimen.</strong> Start with the default speed, sensitivity and memory. A new specimen starts with zero weights; cloning an existing specimen also copies its acquired weights.</li>
        <li><strong>Measure the starting point.</strong> Launch an orchard expedition with comparisons enabled. Keep its world seed and trial count so later comparisons use matched conditions.</li>
        <li><strong>Train for 200 episodes.</strong> Choose Steady wind to study specialization, or Variable wind to expose the learner to more varied conditions. The reward rules are already built into this task.</li>
        <li><strong>Test the saved checkpoint.</strong> Launch on worlds separate from training. Compare arrival rate and duration against the untrained and reactive controls. Inspect failed flights as well as successes.</li>
        <li><strong>Change one factor.</strong> For example, train a fresh specimen with the other curriculum, or change only its Memory trait before training. Use equal training budgets.</li>
        <li><strong>Test transfer.</strong> Use the wind-shift expedition to see whether the frozen controller copes with changing conditions. Export checkpoints and results to keep an experiment record.</li>
      </ol>
      <h3>What the controls can and cannot teach</h3>
      <table class="learn-table"><thead><tr><th>Your goal</th><th>Available now</th><th>What it changes</th></tr></thead><tbody>
        <tr><td>More reliable A-source seeking</td><td>More training and a varied curriculum</td><td>Values of the existing steering actions in the existing sensory states.</td></tr>
        <tr><td>Study sensory trade-offs</td><td>Fresh specimens with different sensitivity or Memory</td><td>Input scale and smoothing. Longer memory can smooth noise but delay response.</td></tr>
        <tr><td>Study speed or exploration</td><td>Fresh specimens with different traits</td><td>Movement per tick or the chance of exploratory actions.</td></tr>
        <tr><td>Prefer B instead of A</td><td>Requires code changes</td><td>Rewarded source, target-distance logic and the A-biased guidance encoder must agree on the new task.</td></tr>
        <tr><td>Avoid physical obstacles or fly vertically</td><td>Requires model changes</td><td>World collision rules, observations, motor actions and training tasks must be extended.</td></tr>
        <tr><td>Follow spoken instructions or remember routes</td><td>Not implemented</td><td>There is no language interpreter, route memory or map-building controller.</td></tr>
      </tbody></table>
      <h3>The recipe for a genuinely new skill</h3>
      <p><strong>1. Define a measurable behavior.</strong> “Find B while avoiding A” is testable; “be smarter” is not. Decide the success condition, costs, time limit and metrics before changing the learner.</p>
      <p><strong>2. Make the necessary evidence observable.</strong> Add the relevant sensor or feature. A reward cannot teach the fly to distinguish situations that its encoder collapses into the same state. A B-target task needs an appropriate B-derived guidance signal or a less task-specific encoder.</p>
      <p><strong>3. Make the behavior possible.</strong> Add any required action and world mechanics. Decorative leaves do not currently obstruct flight, so changing collision reward cannot teach leaf avoidance yet.</p>
      <p><strong>4. Design feedback and a curriculum.</strong> Keep a clear terminal reward, add explicit costs and declare any privileged shaping. Start with simpler worlds, then expose the fly to the variation it should handle.</p>
      <p><strong>5. Freeze, test and version.</strong> Evaluate without weight updates on untouched seeds. Keep the old baselines and declare changes to the model, scenario, encoder and policy versions. Changed feature layouts require fresh or explicitly migrated checkpoints.</p>
      <div class="learn-callout"><strong>Changing the reward alone may not change the skill.</strong><p>This release already guides toward A before learning begins. Rewarding B while leaving that prior untouched creates conflicting signals. Extend the world, observation, actions and reward together, then demonstrate the new behavior on held-out trials.</p></div>
      <h3>Where a developer makes each change</h3>
      <table class="learn-table"><thead><tr><th>Change</th><th>Source</th></tr></thead><tbody>
        <tr><td>Sources, sensors, motion, events, termination and reward</td><td><code>src/fly/core/engine.js</code></td></tr>
        <tr><td>Feature encoding, actions, Q values and learning rule</td><td><code>src/fly/policies/sarsa.js</code></td></tr>
        <tr><td>Headless curricula, evaluation and run manifests</td><td><code>src/fly/experiments/runner.js</code></td></tr>
        <tr><td>Browser job scheduling, progress and resume</td><td><code>src/fly/runtime/worker.js</code></td></tr>
        <tr><td>Specimens, save/import/export and app commands</td><td><code>src/fly/runtime/session.js</code></td></tr>
        <tr><td>Regression tests and the release audit</td><td><code>tests/fly/</code>, <code>scripts/fly/evaluate.mjs</code></td></tr>
      </tbody></table>
    `
  },
  {
    id: 'commands', kicker: '05 / UNDER THE HOOD', title: 'Commands, checkpoints and the core',
    intro: 'These are real interfaces in this repository. Start with app commands, then inspect one tick or run a repeatable experiment without graphics.',
    html: `
      <div class="learn-callout"><strong>Three levels of instruction.</strong><p>The motor accepts three integer action IDs. The experiment system accepts structured JavaScript objects. Your computer executes the JavaScript through its runtime; this lab does not expose a custom assembly language, neural opcode set or natural-language training command.</p></div>
      <h3>1. Drive the app’s experiment session</h3>
      <p><code>window.__solar.flySession</code> is the app’s debug interface. It uses the same specimen selection, validation, worker and storage as the buttons. Training continues from the selected policy; it does not silently reset learned weights.</p>
      <div data-learn-snippet="browser"></div>
      <p>These methods dispatch asynchronous jobs and return immediately. Check <code>lab.state.job</code> or wait for the interface to report completion before issuing a dependent command. <code>lab.state.ready</code> indicates that saved records have loaded.</p>
      <div data-learn-snippet="controls"></div>
      <h3>2. Inspect one exact simulation step</h3>
      <p>The core has no dependency on rendering or browser storage. <code>createEpisode</code> copies its policy input. To preserve newly learned weights after a training episode, keep <code>ep.policy</code>; the original policy object is unchanged.</p>
      <div data-learn-snippet="tick"></div>
      <p><code>ep.action</code> is the next scheduled motor instruction. After stepping, <code>ep.fly.action</code> records the instruction just executed. The snapshot’s Q values describe the current features using the current weights; they can differ from the values used to choose the already-scheduled next action before its last update.</p>
      <h3>3. Run headless experiments</h3>
      <div data-learn-snippet="terminal"></div>
      <p>The release audit uses training seeds 11, 29 and 47 and an audit world base seed of 9,000,000. Keep that audit suite separate from parameter tuning. The example below uses a development world seed of 500,000 instead.</p>
      <div data-learn-snippet="headless"></div>
      <h3>4. Understand the worker’s command contract</h3>
      <p>Training and evaluation run in a dedicated web worker. It yields between bounded chunks of fixed ticks, sends progress and returns serialized results. <code>train</code>, <code>evaluate</code>, <code>pause</code>, <code>resume</code>, <code>checkpoint</code> and <code>cancel</code> are orchestration messages, not new skills the fly understands.</p>
      <div data-learn-snippet="worker"></div>
      <h3>What a save actually contains</h3>
      <table class="learn-table"><thead><tr><th>Record</th><th>Contents and purpose</th></tr></thead><tbody>
        <tr><td>Policy checkpoint</td><td>Weights, policy and encoder versions, initialization seed and completed training metadata. Start a new episode with this learned controller.</td></tr>
        <tr><td>Episode checkpoint</td><td>Full dynamic world, fly, policy, traces, current features/action and random streams. Continue from the same simulation tick.</td></tr>
        <tr><td>Job checkpoint</td><td>Episode checkpoint plus completed trials, history, remaining work and orchestration state. Resume an interrupted browser job.</td></tr>
        <tr><td>Run manifest and replay</td><td>Versions, seeds, genome, policy hash, reward rules, assumptions, metrics and recorded display snapshots. Explain and review the run.</td></tr>
      </tbody></table>
      <p>Training episode seeds are <code>100000 + trainingSeed × 10007 + episodeIndex × 101</code>; evaluation worlds use <code>worldSeed + trialIndex × 137</code>. The app’s training seed starts at 7301 plus the specimen’s completed episode count. The chosen development and audit suites are separate; arbitrary user-supplied seeds are not automatically checked for overlap.</p>
      <p>Seeds determine the world and action random streams. Training world <code>i</code> uses <code>100000 + trainingSeed × 10007 + i × 101</code>; evaluation world <code>i</code> uses <code>worldBaseSeed + i × 137</code>. The app chooses its training seed as <code>7301 + previouslyTrainedEpisodes</code>. These schedules give repeatable experiment sets; arbitrary user-supplied seeds are not automatically checked for overlap.</p>
      <p>Fixed time steps and serialized random state make pause/resume reproducible within this model. Changing a model or encoder version changes the experiment, even if the seed stays the same.</p>
      <p>The app stores records locally in IndexedDB under <code>observatory-fly-lab</code>. Export downloads the selected specimen, learned policy and matching results as <code>fly-expedition.json</code>. A raw core-policy JSON file is a different format. The UI retains up to 12 policy checkpoints per specimen, five recent result records and full replays for at most the first 12 selected-policy trials in an expedition; aggregate metrics cover the whole requested cohort.</p>
    `
  }
];
