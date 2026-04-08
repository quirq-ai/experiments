# Refactor: Paperclip → XO

## Context
Deep rebrand of the entire monorepo from "paperclip" to "xo". This touches env vars, directory names, imports, branding, Docker, CI, docs, and package names. The external dependency `hermes-paperclip-adapter` is **excluded** from renaming.

**Key ordering decision**: Package identity (package.json name/dep changes) is done **last** to avoid breaking pnpm resolution while all other changes are in flight.

## Naming Map

| Old | New |
|-----|-----|
| `paperclip` | `xo` |
| `@paperclipai/*` | `@xo/*` |
| `paperclipai` (CLI) | `xo` |
| `PAPERCLIP_*` env vars | `XO_*` |
| `.paperclip/` directory | `.xo/` |
| `Paperclip` (display) | `XO` |
| `paperclipai/paperclip` (GitHub) | `sharmasuraj0123/xo-org` |

---

## Phase 1: Environment Variables (~350 occurrences, ~50 files)

The largest and highest-risk phase. Do this first while the build is still stable.

### 1a: Create backwards-compat shim
`packages/shared/src/env-compat.ts` — for each `XO_*` var, fall back to `PAPERCLIP_*` with deprecation warning. Call early in server + CLI startup.

### 1b: Rename all `process.env.PAPERCLIP_*` → `process.env.XO_*`

**Critical files** (highest density):
- `server/src/home-paths.ts` — also rename functions: `resolvePaperclipHomeDir` → `resolveXoHomeDir`
- `server/src/worktree-config.ts` — 20+ references
- `packages/adapter-utils/src/server-utils.ts` — 30+ refs in function names, config keys, env vars
- `packages/shared/src/config-schema.ts` — `PaperclipConfig` type → `XoConfig`
- `cli/src/commands/env.ts` — canonical env var table
- `server/src/agent-auth-jwt.ts` — JWT defaults `"paperclip"` → `"xo"`
- `server/src/ui-branding.ts` — HTML markers + meta tags
- `.env.example` — DB connection string defaults

### 1c: Path constants
- `".paperclip"` → `".xo"` everywhere (home dir, config walks, worktree markers)
- Add fallback: if `~/.xo` missing but `~/.paperclip` exists, use it with warning

### 1d: Config key compat
- `paperclipRuntimeSkills`, `paperclipSkillSync` in adapter-utils — accept both old/new keys
- JWT: accept both `"paperclip"/"xo"` issuer/audience during transition

---

## Phase 2: File & Directory Renames

| Old | New |
|-----|-----|
| `skills/paperclip/` | `skills/xo/` |
| `skills/paperclip-create-agent/` | `skills/xo-create-agent/` |
| `skills/paperclip-create-plugin/` | `skills/xo-create-plugin/` |
| `packages/plugins/create-paperclip-plugin/` | `packages/plugins/create-xo-plugin/` |
| `server/src/__tests__/paperclip-env.test.ts` | `xo-env.test.ts` |
| `server/src/__tests__/paperclip-skill-utils.test.ts` | `xo-skill-utils.test.ts` |
| `scripts/paperclip-commit-metrics.ts` | `scripts/xo-commit-metrics.ts` |

Update all references to renamed paths in code, tests, and scripts.

---

## Phase 3: Branding & UI

- `server/src/startup-banner.ts`: ASCII art, display strings
- `ui/index.html`: `<title>Paperclip</title>` → `<title>XO</title>`
- `ui/src/context/ThemeContext.tsx`: localStorage key `"paperclip.theme"` → `"xo.theme"` (with fallback)
- HTML meta tags: `paperclip-worktree-*` → `xo-worktree-*`
- CLI display strings throughout `cli/src/commands/`
- Skill SKILL.md files content

---

## Phase 4: Docker & Infrastructure

- **Dockerfile**: `PAPERCLIP_HOME=/paperclip` → `XO_HOME=/xo`, volume, filter refs
- **docker-compose.yml**: postgres user/db `paperclip` → `xo`, all env vars, volume names
- **docker-compose.quickstart.yml**: service name, env vars, volume
- **docker-compose.untrusted-review.yml**: paths, env vars

---

## Phase 5: CI/CD

- `.github/workflows/pr.yml`: `create-paperclip-plugin` exclusion, `~/.paperclip/` paths, `PAPERCLIP_E2E_SKIP_LLM`
- `.github/workflows/e2e.yml`: env vars
- `.github/workflows/release-smoke.yml`: env vars, version input names
- `.github/workflows/release.yml`, `docker.yml`: check for refs

---

## Phase 6: Documentation

- `docs/start/what-is-paperclip.md` → rename + update
- `doc/*.md` files: update active docs, leave historical plans as-is
- `README.md`, `CONTRIBUTING.md`, `AGENTS.md`
- `docs/deploy/*.md`, `docs/cli/*.md`: env vars, paths

---

## Phase 7: Scripts & Tests

- ~27 scripts in `/scripts/` with paperclip refs (paths, package names)
- `/tests/e2e/`, `/tests/release-smoke/`: env var references
- All test files setting `process.env.PAPERCLIP_*`
- `/evals/` config files

---

## Phase 8: Import Statements (~114 files)

Global find-replace `@paperclipai/` → `@xo/` across all `*.ts`, `*.tsx`, `*.js`, `*.mjs` files. Safe because `hermes-paperclip-adapter` doesn't use this prefix.

**Note**: This will cause TypeScript errors until Phase 9 completes. That's expected — the imports won't resolve until package names are updated.

---

## Phase 9: Package Identity (package.json files) — LAST

Done **last** so all other changes happen while the build is stable.

1. **Leaf packages**: `packages/shared`, `packages/db`, `packages/adapter-utils`, `packages/plugins/sdk` — change `name` field from `@paperclipai/*` to `@xo/*`
2. **Adapter packages**: all 7 in `packages/adapters/` — change name + update deps to `@xo/*`
3. **Plugin packages**: `packages/plugins/create-xo-plugin` (already renamed dir in Phase 2) — update package.json
4. **App packages**: `server/package.json`, `ui/package.json`, `cli/package.json` — names, deps, bin field, descriptions, GitHub URLs
5. **Root** `package.json` — name, script filters, bin alias
6. Delete `pnpm-lock.yaml`, run `pnpm install` to regenerate

**Files**: ~20 package.json files + `pnpm-lock.yaml`

---

## Gotchas

1. **`hermes-paperclip-adapter`** — must be excluded from ALL find-replaces (appears in 5 files)
2. **`server-utils.ts`** — highest risk file, 30+ paperclip refs in exported function names used across all adapters
3. **Config JSON keys** (`paperclipRuntimeSkills`) — persisted in config files, need compat reader
4. **Skill entry keys** — stored as `paperclipai/paperclip/${name}` in DB, need dual-format support
5. **Docker volumes** — renaming orphans existing volumes (document as breaking)
6. **JWT tokens** — old tokens with `iss: "paperclip"` need transition acceptance

---

## Verification

1. `pnpm install` — lockfile regenerates
2. `pnpm build` — all packages compile
3. `pnpm typecheck` — no TS errors
4. `pnpm test:run` — all tests pass
5. `docker compose build` — Docker works
6. Final grep for remaining `paperclip` (excluding node_modules, lock, hermes-paperclip-adapter, historical release notes)
7. Test backwards compat: set `PAPERCLIP_HOME=~/.paperclip` without `XO_HOME`, confirm server starts with deprecation warning
