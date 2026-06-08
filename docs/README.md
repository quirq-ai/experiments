# Visualizer docs

Reference material for building and extending the XO Visualizer.

1. [xo-swarm: tech stack and coding conventions](./01-xo-swarm-stack-and-conventions.md)
   The XO platform baseline: Next.js 16 + React 19 + TS strict + Tailwind v4 + shadcn/Radix, zustand stores, Drizzle/Postgres, Clerk, the custom `server.js`, code style, and the agent working model. Use this as the house-style reference for anything written into XO repos.

2. [Animation in xo-docs (Fumadocs)](./02-xo-docs-animation.md)
   Where the motion in XO's docs sites comes from (Fumadocs built-ins, Tailwind v4, a thin CSS layer, brand tokens), plus the one custom XO-native ambient animation worth copying (the xo-swarm presence-waves).

3. [histography.io analysis and animation guide](./03-histography-analysis-and-animation-guide.md)
   A teardown of what makes histography.io feel premium, and a code-level playbook for reaching that finesse in this visualizer's commit wave.

A note on sourcing: the canonical `xo-docs` repo is not part of this checkout, so doc 02 is reconstructed from the sibling Fumadocs sites that share its stack (`internal/xo-internal`, `internal/xo-data-room`). Docs 01 and 03 are grounded in `xo-swarm` source and the histography creator's interviews respectively.
