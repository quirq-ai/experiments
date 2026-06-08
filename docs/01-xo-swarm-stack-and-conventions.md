# xo-swarm: tech stack and coding conventions

A reference for agents working in or alongside `xo-swarm`, the XO platform UI (internally named `eliza-agent-builder`). Everything here is taken from the repo as it stands: `package.json`, the config files, and the root operating docs (`AGENTS.md`, `MECHANICS.md`, `GOTCHAS.md`, `XO-PARTICLES.md`).

## Framework and language

`xo-swarm` is a Next.js App Router app on the current XO baseline:

| Piece | Version / setting |
|---|---|
| Next.js | 16.1.6 (App Router) |
| React | 19.2.4 |
| TypeScript | ^5, `strict: true`, `target: ES2017`, `moduleResolution: bundler` |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config`, CSS-first) |
| Path alias | `@/*` maps to `./` (repo root) |

TypeScript is strict. The path alias is flat (`@/*` to the root), so imports look like `@/components/...`, `@/lib/...`, `@/hooks/...`.

## Custom server, not `next dev`

This is the first thing that surprises people. `xo-swarm` does not boot with the stock Next CLI:

```jsonc
"scripts": {
  "dev":   "node server.js",
  "build": "next build",
  "start": "NODE_ENV=production node server.js",
  "lint":  "eslint ."
}
```

It runs a custom `server.js` (it needs a long-lived Node process for things like the time recorder, websockets, and `node-pty` terminals). `next.config.ts` sets `output: "standalone"` for deployment, marks `@whiskeysockets/baileys` as a `serverExternalPackages`, raises `experimental.serverActions.bodySizeLimit` to `100mb`, and pins `reactCompiler: false`. The React Compiler babel plugin is installed but deliberately off.

Operational consequence (from `GOTCHAS.md`): the developer runs their own `next dev` / server on port 3000. Do not start a second one, it fails on `.next/dev/lock`. Reuse the running instance and let HMR pick up edits.

## UI layer

The UI is shadcn/ui on top of Radix, in the "new-york" style:

```jsonc
// components.json
{ "style": "new-york", "rsc": true, "tsx": true,
  "tailwind": { "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide" }
```

Conventions that follow from this:

- Components live in `@/components`, generated primitives in `@/components/ui`, shared utilities in `@/lib`, hooks in `@/hooks`.
- Class composition uses the standard `cn()` helper (`@/lib/utils`) built on `clsx` + `tailwind-merge`. Variants use `class-variance-authority`.
- Radix primitives are used directly and widely (accordion, dialog, dropdown, popover, select, tabs, tooltip, scroll-area, and many more are listed as dependencies).
- Animation helper: `tw-animate-css` (Tailwind-friendly keyframe utilities). There is no `framer-motion` in this repo; motion is CSS-driven (see the presence-waves section below and doc 02).
- Common interaction libraries: `sonner` (toasts), `vaul` (drawers), `cmdk` (command palette), `embla-carousel-react`, `react-day-picker`, `input-otp`, `react-resizable-panels`, `react-dropzone`.
- Icons are `lucide-react`. Do not mix in other icon sets without reason.

## Forms, state, and data

- **Forms:** `react-hook-form` + `zod` + `@hookform/resolvers`. Validate with a zod schema, resolve into RHF.
- **Client state:** `zustand` v5. The pattern is one small store per concern, named `lib/<thing>-store.ts`. Real examples in the tree: `chat-store.ts`, `canvas-split-store.ts`, `agents-tab-store.ts`, `presence-store.ts`, `time-unit-store.ts`. Keep stores narrow and colocated in `lib/`.
- **Database:** `drizzle-orm` with `pg` (Postgres). Schema and migrations under `drizzle/`, config in `drizzle.config.ts`, data access in `app/db/` and a top-level `dal/` (data access layer). Migrations via `drizzle-kit`.
- **Auth:** Clerk (`@clerk/nextjs`, `@clerk/themes`). There is a local `DISABLE_AUTH` mode for single-user work. Note from `GOTCHAS.md`: in that stub `useUser` is typed `never`, so pre-existing tsc errors about `publicMetadata`, `username`, `primaryEmailAddress`, `emailAddresses` are known noise, not regressions.

## AI and rich content

Chat and agent surfaces use the Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) with `streamdown` and `react-markdown`. Markdown rendering stack: `remark-gfm`, `remark-math`, `rehype-katex` (+ `katex`), `rehype-raw`, with `shiki` and `react-syntax-highlighter` for code. Mentions via `react-mentions`.

## Integrations

First-class integrations present in deps: Linear (`@linear/sdk`), WhatsApp (`@whiskeysockets/baileys`), AWS S3 (`@aws-sdk/client-s3`, presigner), terminals (`node-pty` + `@xterm/xterm` + `@xterm/addon-fit`), websockets (`ws`), webhooks (`svix`), and `qrcode`. `recharts` is used for charts, `@tanstack/react-table` for tables, `date-fns` for dates.

## Code style conventions

These are observed from the actual config and source files, follow them for consistency:

- **Indentation is tabs.** The config files (`next.config.ts`, `components.json`, `globals.css`) use tab indentation. Match the file you are editing.
- **Double quotes and semicolons** in TS/TSX.
- **Server-side by default.** RSC is on. Fetch in Server Components, mutate in Server Actions (`app/actions/...`), and only reach for `"use client"` when you need interactivity or browser APIs. This mirrors the workspace-wide rule: keep secrets and external API calls on the server, never prefix server-only env with `NEXT_PUBLIC_`.
- **No em dashes or en dashes anywhere.** This is an explicit workspace rule repeated in `GOTCHAS.md`. Use commas, colons, parentheses, or separate sentences. Double hyphens are only acceptable inside CLI flags.
- **ESLint** is the flat config in `eslint.config.mjs`, extending `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. It ignores `node_modules`, `.next`, `out`, `build`, and `next-env.d.ts`. Run `eslint .` (or scoped to touched files) before handoff.

## How the repo is organized

`AGENTS.md` frames the repo as two connected domains, and you should check cross-domain effects before finalizing:

1. **Product app domain:** `app/` (routes, `app/actions` server actions, `app/api` handlers, auth pages, `launchpad`, `projects`, `pricing`, `subscription`), `components/`, `lib/`, `drizzle/` + `app/db/`, `hooks/`, `public/`.
2. **Multi-agent operations domain:** `universe/` and `universe-worktrees/` (local multi-agent orchestration, research, signal files), plus the root operating docs.

Within the app, `app/launchpad` and `app/projects` are the core product surfaces.

## Agent working model

`AGENTS.md` defines explicit roles so parallel work does not collide. Use them:

- **Scout:** reads the tree and docs, writes a short problem framing and risk list.
- **Implementer:** makes minimal, scoped edits for one task.
- **Verifier:** runs the smallest useful lint/test/build checks tied to the touched files.
- **Integrator:** resolves overlaps, updates docs, prepares the handoff.

The protocol: state scope (target files and non-targets) and the validation command up front, claim file ownership before editing so two agents never edit the same file at once, prefer narrow single-purpose diffs, keep refactors separate from behavior changes, and run the smallest useful checks first. A task is done only when the requested outcome is implemented, local checks for the touched scope pass (or failures are documented with cause), no unrelated files were changed, and a plain-language handoff note exists.

## Verification reality

From `GOTCHAS.md`: there is no Playwright or Puppeteer in this repo, so UI changes cannot be auto-screenshotted. Either have a human eyeball the change, or add a temporary debug API route to exercise a server action. When judging "no new errors", ignore the known `DISABLE_AUTH` tsc noise and stale `.next/types/validator.ts` module-not-found errors.

## The XO mental model (worth knowing)

`MECHANICS.md` and `XO-PARTICLES.md` describe the product metaphor the UI is built around, useful context when touching the project surfaces. A project is a "universe" rendered on a deep-space canvas. There is one particle, **XO**, with two faces: **Terra** ("takes space", the O, a file or folder at rest, drawn as a glowing mass sized by bytes) and **Nova** ("expands space", the X, a running `claude` agent that ignites in an isolated git worktree, does timed work, and leaves new Terra behind). The "four forces" are Energy and Time (a Nova and its record) and Size and Lifespan (the universe it grows). Lifespan is commits times a chosen unit. This framing is why you see ambient cosmic motion in the UI rather than typical dashboard chrome.

## One-line summary for a new agent

Next.js 16 App Router + React 19 + TS strict + Tailwind v4 + shadcn/Radix, zustand stores in `lib/*-store.ts`, Drizzle/Postgres, Clerk auth, Vercel AI SDK, custom `server.js`, tabs and double quotes, server-first, no em dashes, and claim file ownership before you edit.
