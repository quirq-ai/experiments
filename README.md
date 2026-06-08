# XO Visualizer

A calm, histography-style view of a repo's history. A left sidebar lists every branch; the main stage draws that branch as a single flowing wave: additions rise above the line as a green ridge, deletions fall below as red. The wave breathes, glows, and streams in. Point it at any local repo.

Built to match the XO stack: Next.js 16 (App Router), React 19, Tailwind v4, TypeScript. Rendering is plain Canvas 2D, no heavy deps.

## Run

```bash
cd experiments/visualizer
pnpm install   # or npm install
pnpm dev       # http://localhost:3000
```

It opens on synthetic sample data so the field is never empty.

## Load a real repo

Paste an **absolute path** to any git repo into the top bar and hit **Load folder**:

```
/Users/you/code/xo-swarm
~/code/some-repo
```

The path is read server-side: a Next.js Route Handler (`app/api/commits/route.ts`) shells out to `git log --numstat` via `execFile` (no shell, so the path can't inject commands) and returns a normalized commit list. The browser never touches the filesystem. This follows the workspace rule that external/system access stays server-side.

## The animation

The "feeling" is lifted from histography: dark, smooth, organic, in constant gentle motion.

- **One branch = one wave.** Each commit contributes a soft Gaussian bump, summed across the width into a flowing ridge (a mountain range, not a spiky bar chart).
- **Green up, red down.** Additions rise above the centre line; deletions fall below.
- **It breathes.** A slow traveling ripple modulates the amplitude so the wave is alive even when idle, with a soft white sweep passing across it.
- **Streams in.** On branch switch or **▶ Replay**, the wave draws itself left to right with an ease-out reveal.

Hover anywhere to snap to the nearest commit: a vertical guide, glowing crest dots, and a readout of subject, +additions, -deletions, hash, author, date.

## Encoding

| Visual | Data |
|---|---|
| Branch (sidebar) | one git branch; shows commit count and HEAD |
| Horizontal position | commit order along the branch |
| Green ridge height | additions (perceptually compressed, `value^0.6`) |
| Red ridge depth | deletions (same scale, shared with green) |

## Files

```
app/
  page.tsx                 branch sidebar + stage + folder loader
  layout.tsx, globals.css  XO charcoal/lime theme
  api/branches/route.ts    server-side: list branches for a repo path
  api/commits/route.ts     server-side: read one branch's commits (add/del)
components/
  CommitWave.tsx           the flowing green/red wave (canvas + RAF)
  XoLogo.tsx               the XO chevron mark
lib/
  gitLog.ts                git for-each-ref + git log --numstat parsers
  sampleData.ts            synthetic branches + commits fallback
  types.ts                 Commit / Branch types
```

## Theme

XO charcoal `#08090a`, lime `#83d63a`, neon `#41ff00`. Logo is the two-chevron XO mark (outer white, inner lime).

A no-build `demo.html` sits alongside this README: open it directly in a browser to see the animation on sample data without installing anything.
