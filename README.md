# Autospawn clone

A local, mock-data clone of [autospawn.com](https://www.autospawn.com), an AI outbound-sales platform ("agents that find customers the moment they want to buy"). Built to study the product's UX. All data is fictional and in-memory; nothing talks to the real service.

> Note: "Autospawn" is someone else's brand. Rebrand (one constant in `components/logo.tsx` plus metadata in `app/layout.tsx`) before deploying this anywhere public.

## Run it

```bash
npm install
npm run dev -- --port 3411
```

## The 10 cloned features

1. **Dispatch composer** (`/workspace`): the "Who should we go after?" screen. Structured Contact / Company / Signal targeting bar, a "write a prompt instead" mode, and suggested targeting plays. Submitting simulates an agent run and creates a campaign.
2. **AI lead-sourcing runs**: the dispatch simulation walks through the agent's steps (read ICP, scan sources, qualify, enrich), spends credits, and lands you in a new campaign with generated leads.
3. **Campaigns** (`/campaigns/[id]`): lead queue per campaign with "Actions needed" / "Sequenced" tabs, select-all, sort control, "Get more leads" (spends credits), and "Schedule".
4. **Lead dossier**: click any lead for the full dossier: company facts, "also collected during the run" evidence rows with source links, contacts, the detected signal with evidence, and the agent's qualification verdict.
5. **Watcher** (`/watcher`): add accounts to monitor; a Signals dropdown picks which buying-signal types to watch; rows show watching / fired states.
6. **Inbox** (`/inbox`): outreach tracking with funnel stat cards (contacted, opened, replies, bounced), campaign / status / time-range filters, and an activity list fed by sequenced leads.
7. **Analytics** (`/analytics`): performance-by-day chart (dashed empty state until sends exist) plus a campaign summary list.
8. **Sequences**: campaign-level sequence applied per lead from the dossier; steps span Email / LinkedIn with day offsets, subjects, and body copy.
9. **Business profile and ICP** (`/profile`): identity, business model and stage chips, proof points, strategist contact channel (email / iMessage), ideal customer profile, competitors, account actions. Plus the other settings surfaces: Permissions, Billing, Payments, Leads.
10. **Credits, plans, and superpowers**: credit balance and plan in the sidebar footer, Starter / Pro / Scale pricing with per-plan credit tiers on the landing page, the "Connections" integrations marketplace (`/superpowers`), and email-account health (`/email-accounts`).

Also cloned: the marketing landing page (hero with typed-prompt animation, product frame, five value-prop sections, pricing, footer) and the login screen.

## The backend

The app now has a real backend inside the same Next.js app: every flow goes through route handlers under `app/api/`, and nothing product-shaped happens client-side anymore.

- **Persistence**: a single-user JSON store at `.data/autospawn.json` (`lib/server/db.ts`) with atomic writes and a credit ledger. Campaigns, leads, sequences, watched accounts, the business profile, and credits all survive restarts. (It started as better-sqlite3; the native module segfaults under some sandboxed launchers, so the store is pure JS on purpose.)
- **The agent** (`lib/server/agent.ts`): lead sourcing and sequence writing run through the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`), which spawns the bundled Claude Code runtime. With no `ANTHROPIC_API_KEY` set, it uses this machine's own Claude Code login, so your Claude subscription powers the backend. Every agent call has a deterministic fallback generator (`lib/server/generate.ts`), so the product works fully with no auth at all; responses carry `via: "claude" | "fallback"` so the UI can tell you which ran.
- **Leads are fictional by design**: the agent is prompted to invent plausible companies rather than emit unverified claims about real people. Swap the prompt in `generateLeads` if you want real-research mode.
- **Composio** (`lib/server/composio.ts` + `/api/connections`): with `COMPOSIO_API_KEY` set, the Connections page lists Composio's real toolkit catalog, starts hosted OAuth via connect links, shows live connection status, and can disconnect accounts. Set `COMPOSIO_MCP_URL` to also expose your connected tools to the agent as an MCP server during runs.
- **Credits are enforced server-side**: dispatch costs 24, more-leads costs 8, every debit lands in the ledger, and an empty balance returns HTTP 402.

### Endpoints

`GET /api/state` · `POST /api/dispatch` · `POST /api/campaigns/:id/more-leads` · `POST /api/leads/:id/apply-sequence` · `POST /api/watcher` · `DELETE /api/watcher/:id` · `PUT /api/profile` · `POST /api/claude/test` · `GET|POST /api/connections` · `DELETE /api/connections/:id`

### Environment (`.env.local`, all optional)

```bash
ANTHROPIC_API_KEY=      # skip to use your Claude Code login instead
COMPOSIO_API_KEY=       # enables live Connections (dashboard.composio.dev)
COMPOSIO_MCP_URL=       # optional MCP endpoint handed to agent runs
AUTOSPAWN_FALLBACK_ONLY=1  # force the deterministic generator, no model calls
```

Run `npm run dev` from your own terminal so the spawned Claude CLI can reach your keychain login; launchers that sandbox the process can break OAuth refresh (the Superpowers page has a "Test connection" button that tells you exactly what's happening). Note Anthropic's policy: products distributed to end users may not offer claude.ai subscription login without approval, so ship API-key auth if this ever leaves your machine.

## How it's built

- **Next.js 16 (App Router) + Tailwind v4 + TypeScript.**
- **Design tokens** live in `app/globals.css` (warm off-white canvas, hairline borders, chip grays, black pill CTAs, accent dots). The real site uses a custom "autospawnSans"; Poppins is the closest Google Font.
- **Shared kit**: `components/ui.tsx` (PillButton, Card, CountChip, TimeRange, StatCard, SignalBadge, PageHeader, Avatar...), `components/icons.tsx` (stroke SVG icons), `components/logo.tsx`.
- **Shells**: `components/app-shell.tsx` (workspace sidebar: Dispatch, Watcher, Inbox, Analytics, campaign list, user footer) and `components/settings-shell.tsx` (Back + settings nav), applied via the `(app)` and `(settings)` route groups.
- **State**: `lib/store.tsx`, a React context holding credits, campaigns, watched accounts, and sequenced-lead ids, so dispatch runs, watching, and sequencing mutate one shared workspace. Seed data in `lib/data.ts`.

## What's still simulated

- Signal ingestion: no pollers over funding wires or job boards yet; signals come from the agent's generation (or the fallback).
- Sending: sequences are drafted and stored, never sent; there is no scheduler, warmup, or reply detection behind the Inbox numbers.
- Watcher alerts: watched accounts persist, but nothing fires signals against them on a schedule.
- Enrichment providers: contact data comes from the agent, not a waterfall of data vendors.
