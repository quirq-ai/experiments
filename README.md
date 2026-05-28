# artifact-evolution

Prototype of the artifact-evolution UI: one idea, five forms, one rail. Terminal -> markdown one-pager -> reveal-style deck -> Jupyter notebook -> Next.js app, with each form persisted as an immutable artifact and the whole history scrubbable in the browser.

Standalone Next.js app under `experiments/`. Lives outside the four XO product repos on purpose: fast iteration, no risk to live code, port the pieces into `xo-cowork-api` and `xo-coworker` once the feel is right.

## Run it

```bash
cd experiments/artifact-evolution
cp .env.local.example .env.local       # then paste your ANTHROPIC_API_KEY
npm install
npm run dev                            # http://localhost:3500
open http://localhost:3500/runs/r_8b21f0c1
```

Without `ANTHROPIC_API_KEY`, the server falls back to `MockPromoter` and warns once at boot. The streaming UX still works (mock chunks are emitted on the same SSE channel).

## Three view modes

The header has a Work / Diff / Movie toggle.

- **Work** is the default: the current artifact fills the stage, metadata + diff pills on the right, rail at the bottom, promote bar below. Click Evolve and a streaming overlay slides over the stage; you watch Claude write the next form token by token. New node pops onto the rail when finalized.
- **Diff** splits the stage: parent on the left, child on the right (rendered in their native forms), with carryover / added / dropped chips below, driven by metadata the promoter emits inside a `<meta>` JSON block.
- **Movie** goes full-screen. Hides chrome, auto-advances every 4.5s with a crossfade, progress bar across the bottom. Esc exits.

## What's wired up

```
app/
  page.tsx                        list of runs (Server Component)
  runs/[id]/page.tsx              run view (Server Component, fetches manifest)
  api/
    runs/route.ts                 GET list, POST create
    runs/[id]/route.ts            GET full manifest (the timeline)
    runs/[id]/evolve/route.ts     POST { target_form, prompt? } -> new artifact
    runs/[id]/head/route.ts       POST { artifact_id } -> rollback / fast-forward
    runs/[id]/events/route.ts     SSE: artifact_created, head_moved, ping
    runs/[id]/artifacts/[aid]/route.ts   raw artifact bytes with the right mime
components/
  RunView.tsx                     client orchestrator, holds selected state + SSE
  Rail.tsx                        horizontal nodes
  Scrubber.tsx                    play / drag through versions
  PromoteBar.tsx                  target-form select + prompt + Evolve button
  Stage.tsx                       form -> renderer dispatch
  Meta.tsx                        right-pane artifact metadata
  preview/
    TerminalView.tsx              text with $-prompt colorizing
    MarkdownView.tsx              tiny md -> html (no deps)
    DeckView.tsx                  iframe to /artifacts/{aid}
    NotebookView.tsx              parses ipynb client-side, renders cells
    AppView.tsx                   iframe to /artifacts/{aid}
lib/
  types.ts                        Form, Artifact, Run, RunEvent
  storage.ts                      file-backed read/write of manifest + payloads
  events.ts                       in-process pub/sub for SSE
  promote.ts                      Promoter interface + MockPromoter default
runs/r_8b21f0c1/                  seeded run with all five forms on disk
docs/STORAGE.md                   on-disk layout + invariants
```

## What's intentionally fake

- **Promoter is mocked.** `lib/promote.ts` builds form-appropriate scaffolding around the parent text so the demo works offline. There's a single seam (`Promoter` interface, `defaultPromoter` export) where you swap in an Anthropic-backed implementation.
- **SSE pub/sub is in-process.** Fine for a single dev server, breaks the moment you run two replicas. For the real port: Redis pubsub or Postgres `LISTEN/NOTIFY`.
- **No auth.** This is a standalone prototype. The real port reuses the Clerk poll-token flow `xo-cowork-api` already runs.
- **Notebook renderer is text-only.** Real cells with plots need either nbformat -> html server-side or jupyterlite client-side.

## Swapping in a real promoter

```ts
// lib/promote.ts
class AnthropicPromoter implements Promoter {
  async promote(input: PromoteInput): Promise<PromoteOutput> {
    // call Claude server-side, return { payload, summary, prompt }
  }
}
export const defaultPromoter: Promoter = new AnthropicPromoter();
```

`ANTHROPIC_API_KEY` belongs in `.env.local`, server-side only, never `NEXT_PUBLIC_`.

## Port plan into the real stack

1. Lift `lib/types.ts` and `docs/STORAGE.md` into `xo-cowork-api` as the canonical artifact model.
2. Re-implement `lib/storage.ts` in Python; same `runs/<id>/manifest.json` layout.
3. Port the five Route Handlers as FastAPI endpoints under `cowork_agent/routes/runs.py`. Replace in-process pubsub with Redis.
4. Lift `components/` into `xo-coworker` Tauri app. Adjust SSE client to use the existing API client + Clerk session.
5. The MockPromoter stays as a CI fixture; production wires `defaultPromoter` to the existing agent runtime (Claude Code / Codex / OpenClaw) using the prompt produced by the verb heuristic.

## Heuristic that decides target form

```
summarize / digest / one-pager  ->  md
present / pitch / brief         ->  deck
explore / analyze / poke        ->  notebook
ship / deploy / dashboard       ->  nextjs
```

Lives in `PromoteBar` today as `suggestNext()`. Move into `lib/promote.ts` when promoting from the agent runtime.
