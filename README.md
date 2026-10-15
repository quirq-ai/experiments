# experiments

One repo, one branch per experiment. This branch, `main`, is the index, and `archive` keeps the finished ones.

## How it works

Every experiment starts as a folder. [`./publish`](publish) turns each folder into a branch:

- **Branch name = folder name.** The `innernet/` folder is the [`innernet`](https://github.com/quirq-ai/experiments/tree/innernet) branch.
- **Branch root = folder contents.** Clone a branch and you have the folder back.
- **Branches are orphans.** They share no history with each other or with `main`.
- **One commit per change.** Publishing adds a snapshot commit only when the folder changed, so a branch's log is that experiment's history. The author date is when the folder last changed.
- **Ignored files stay home.** The folder's own `.gitignore` applies, and [`.publishignore`](.publishignore) always wins on top of it: dependencies, build caches, `.env` files, local state. Files over GitHub's 100 MB limit are left out and named in the commit message.
- **Untouched clones become pointers.** A folder that is a clean clone of someone else's repo publishes a README with the upstream URL and exact commit instead of a copy.
- **Finished experiments get compressed into `archive`.** [`./archive`](archive) squashes a branch into one commit on top of the `archive` branch, then deletes the branch. That commit holds only the experiment's final files, at the root, so the archive tip is the newest archived experiment and each commit back (`archive~1`, `archive~2`, ...) is the one archived before it. Earlier snapshots of the branch are not kept.

## Get an experiment

```bash
git clone --single-branch -b <name> https://github.com/quirq-ai/experiments.git <name>
```

Archived ones live one per commit on `archive`. Clone it and step back through them:

```bash
git clone --single-branch -b archive https://github.com/quirq-ai/experiments.git archive
git -C archive checkout HEAD~1   # one experiment further back each time
```

## Publish and archive

Clone `main`, keep experiment folders inside it, then:

```bash
./publish                # every folder; pushes what changed, then this index
./publish innernet rea   # only these folders
./publish --dry-run      # show what would happen; write and push nothing
./archive trees          # compress a finished experiment into the archive branch
./archive --dry-run trees
```

Archiving leaves the local folder alone, and `./publish` skips archived names from then on. It refuses when the folder has changes that were never published (publish first, or `--force` to archive the published version). To revive an experiment, move its entry from `archived` back to `experiments` and publish it: it starts a fresh branch, and its archived commit stays where it is.

Descriptions and stack labels live in [`experiments.json`](experiments.json): edit them there and the next publish rewrites the table. Folders listed under `skip` never get a branch. Clones of repos owned by an account under `owners` are always copied, never turned into pointers.

`./publish` only builds on commits it made itself. If a branch gets commits from anywhere else, it stops rather than snapshot over them; `--force` overrides that.

## Index

<!-- index:start -->
32 experiments, most recently changed first.

| Experiment | What it is | Stack | Source | Updated |
| --- | --- | --- | --- | --- |
| [rea](https://github.com/quirq-ai/experiments/tree/rea) | REA: reverse engineer anything from the terminal or an agent, through one CLI and MCP server. | TypeScript | [morluto/rea](https://github.com/morluto/rea) (pointer) | 2026-10-13 |
| [workbench](https://github.com/quirq-ai/experiments/tree/workbench) | Codex-style desktop app with two engines behind one UI: the Codex app-server and Claude through the Agent SDK. | Electron |  | 2026-10-13 |
| [claude-messages](https://github.com/quirq-ai/experiments/tree/claude-messages) | An iMessage-style window onto every Claude Code session running on the machine. | Node.js |  | 2026-10-09 |
| [solar-claude](https://github.com/quirq-ai/experiments/tree/solar-claude) | Observatory: pose a question, run it in real physics and keep the trace. Began as a real-ephemeris solar system. | Vite, Three.js | [sharmasuraj0123/solar-claude](https://github.com/sharmasuraj0123/solar-claude) | 2026-10-09 |
| [brand-dna-visualization](https://github.com/quirq-ai/experiments/tree/brand-dna-visualization) | Brand DNA: explore the colors, stories, voice and visual world behind a brand. | Next.js |  | 2026-10-03 |
| [jev-hello](https://github.com/quirq-ai/experiments/tree/jev-hello) | Hello world for Jev, TypeSafe's System One model: typed questions in, probabilities out. | Python |  | 2026-09-28 |
| [shipnotes-demo](https://github.com/quirq-ai/experiments/tree/shipnotes-demo) | Runnable tour of the shipnotes web components, vendored unmodified. | HTML |  | 2026-09-26 |
| [hello-simulator](https://github.com/quirq-ai/experiments/tree/hello-simulator) | Hello Sim, a one-screen SwiftUI app where each card shows one thing Claude can do in the iOS Simulator, plus XO Space. | Swift |  | 2026-09-25 |
| [laya](https://github.com/quirq-ai/experiments/tree/laya) | Laya, a multilingual System 1 decision engine that answers typed questions in one forward pass, with local notes. | Python | [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya) | 2026-09-23 |
| [space-walk](https://github.com/quirq-ai/experiments/tree/space-walk) | Replays coding-agent sessions on a 3D map of the codebase. A fork of cosmtrek/mindwalk. | Go | [sharmasuraj0123/space-walk](https://github.com/sharmasuraj0123/space-walk) | 2026-09-23 |
| [makepad](https://github.com/quirq-ai/experiments/tree/makepad) | Makepad, the AI-accelerated Rust app and game environment, studied for its file explorer and treemap. | Rust | [makepad/makepad](https://github.com/makepad/makepad) (pointer) | 2026-09-18 |
| [navier-stokes](https://github.com/quirq-ai/experiments/tree/navier-stokes) | Flow Lab: an interactive Navier-Stokes fluid lab with four experiments and synchronized measurements. | Vite, React | [sharmasuraj0123/navier-stokes](https://github.com/sharmasuraj0123/navier-stokes) | 2026-09-10 |
| [autospawn-clone](https://github.com/quirq-ai/experiments/tree/autospawn-clone) | Mock-data clone of autospawn.com, an AI outbound sales platform, built to study its UX. | Next.js |  | 2026-08-29 |
| [linear-clone](https://github.com/quirq-ai/experiments/tree/linear-clone) | Linear-style tracker (issues, OKRs, sprints, wiki) that mirrors the .xo state files XO agents write. | Next.js |  | 2026-08-16 |
| [assets](https://github.com/quirq-ai/experiments/tree/assets) | Shared quirq brand assets: the mark, favicon, Möbius artwork and OG image. | Images |  | 2026-07-24 |
| [zombie-survival](https://github.com/quirq-ai/experiments/tree/zombie-survival) | Zombie Survival, a single-file browser game. | HTML |  | 2026-07-24 |
| [experiment-space-smoke](https://github.com/quirq-ai/experiments/tree/experiment-space-smoke) | Generated content for smoke-testing one-click sandbox launch, the sandbox-local Space URL and Agents API turns. | Markdown |  | 2026-07-19 |
| [os-taxonomy](https://github.com/quirq-ai/experiments/tree/os-taxonomy) | Marble's open taxonomy of what children learn (1,590 micro-topics in a prerequisite graph), plus a local viewer. | Vite, React | [withmarbleapp/os-taxonomy](https://github.com/withmarbleapp/os-taxonomy) | 2026-07-12 |
| [trees](https://github.com/quirq-ai/experiments/tree/trees) | How a Tree Eats Air: a single-page carbon simulation. | HTML |  | 2026-07-12 |
| [timesfm](https://github.com/quirq-ai/experiments/tree/timesfm) | TimesFM, Google Research's time-series foundation model, reworked locally. | Python | [google-research/timesfm](https://github.com/google-research/timesfm) | 2026-07-11 |
| [nirvana](https://github.com/quirq-ai/experiments/tree/nirvana) | One-pager and create script for Nirvana agent sandboxes: isolated, managed environments for autonomous agents. | Shell |  | 2026-07-09 |
| [galaxy-sandbox](https://github.com/quirq-ai/experiments/tree/galaxy-sandbox) | Galaxy and particle simulation where every Claude Code session on the machine becomes its own galaxy. | Vite, React |  | 2026-06-30 |
| [fractal-lab](https://github.com/quirq-ai/experiments/tree/fractal-lab) | Interactive canvas playground for exploring fractal simulations. | Next.js |  | 2026-06-25 |
| [experiment-20260612](https://github.com/quirq-ai/experiments/tree/experiment-20260612) | Structured agent environments pilot: a hermetic harness that runs coding agents on xo-cowork-api tasks across environment variants. | Python |  | 2026-06-20 |
| [solar-system](https://github.com/quirq-ai/experiments/tree/solar-system) | Solar system simulation in Next.js and React Three Fiber. | Next.js, Three.js |  | 2026-06-19 |
| [tiny-world-builder](https://github.com/quirq-ai/experiments/tree/tiny-world-builder) | A 3D voxel world editor in a single HTML file: build, sculpt, fly through and share tiny worlds. | HTML, Three.js | [jasonkneen/tiny-world-builder](https://github.com/jasonkneen/tiny-world-builder) (pointer) | 2026-06-19 |
| [vercel](https://github.com/quirq-ai/experiments/tree/vercel) | Three Vercel experiments: the AI SDK computer-use demo, a Next.js sandbox deployer and its Python twin. | Next.js, Python |  | 2026-06-08 |
| [visualizer](https://github.com/quirq-ai/experiments/tree/visualizer) | Histography-style animation of git history where every dot is a commit. | Next.js | [sharmasuraj0123/xo-history](https://github.com/sharmasuraj0123/xo-history) | 2026-06-08 |
| [artifact-evolution](https://github.com/quirq-ai/experiments/tree/artifact-evolution) | One idea in five forms: terminal, markdown one-pager, slide deck, notebook and Next.js app, each kept as an immutable artifact. | Next.js |  | 2026-05-28 |
| [paperclip](https://github.com/quirq-ai/experiments/tree/paperclip) | Paperclip, open-source orchestration for zero-human companies, with two local patches. | Node.js | [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | 2026-04-08 |
| [my-video](https://github.com/quirq-ai/experiments/tree/my-video) | Remotion project with the XO main video plus Clawdbot and XO Agency videos. | Remotion |  | 2026-01-30 |
| [remotion-studio](https://github.com/quirq-ai/experiments/tree/remotion-studio) | Bare Remotion starter project. | Remotion |  | 2026-01-25 |

### Archived

Each finished experiment is one commit on the [`archive`](https://github.com/quirq-ai/experiments/commits/archive) branch, newest first: the tip holds the last one archived, and each commit back holds the one before.

| Experiment | What it was | Archived |
| --- | --- | --- |
| [computing-age](https://github.com/quirq-ai/experiments/tree/e3caeedc48a478f2ba5dd53486aef48ea8b7b679) | Video essay: computing as one accelerating project, from counting stones to thinking machines. | 2026-10-16 |
| [innernet](https://github.com/quirq-ai/experiments/tree/8b2aa8246f6ba3e92ec0eed7429212b8aecc0886) | A personal internet made from your folders: search them like the web, read your projects like an encyclopedia. | 2026-10-16 |
<!-- index:end -->
