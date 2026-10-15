# experiments

One repo, one branch per experiment. This branch, `main`, is the index.

## How it works

Every experiment starts as a folder. [`./publish`](publish) turns each folder into a branch:

- **Branch name = folder name.** The `innernet/` folder is the [`innernet`](https://github.com/quirq-ai/experiments/tree/innernet) branch.
- **Branch root = folder contents.** Clone a branch and you have the folder back.
- **Branches are orphans.** They share no history with each other or with `main`.
- **One commit per change.** Publishing adds a snapshot commit only when the folder changed, so a branch's log is that experiment's history. The author date is when the folder last changed.
- **Ignored files stay home.** The folder's own `.gitignore` applies, and [`.publishignore`](.publishignore) always wins on top of it: dependencies, build caches, `.env` files, local state. Files over GitHub's 100 MB limit are left out and named in the commit message.
- **Untouched clones become pointers.** A folder that is a clean clone of someone else's repo publishes a README with the upstream URL and exact commit instead of a copy.

## Get an experiment

```bash
git clone --single-branch -b <name> https://github.com/quirq-ai/experiments.git <name>
```

## Index

<!-- index:start -->
<!-- index:end -->

## Publish

Clone `main`, keep experiment folders inside it, then:

```bash
./publish                # every folder; pushes what changed, then this index
./publish innernet rea   # only these folders
./publish --dry-run      # show what would happen; write and push nothing
```

Descriptions and stack labels live in [`experiments.json`](experiments.json): edit them there and the next publish rewrites the table. Folders listed under `skip` never get a branch. Clones of repos owned by an account under `owners` are always copied, never turned into pointers.

`./publish` only builds on commits it made itself. If a branch gets commits from anywhere else, it stops rather than snapshot over them; `--force` overrides that.
