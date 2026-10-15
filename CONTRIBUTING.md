# Contributing to innernet

Innernet is small enough to hold in your head: a crawler, local JSON indexes, one search
engine and an encyclopedia drawn from them. This page is how to work on it. For how it
behaves (the crawl rules, ranking, operators, every kind of Innerpedia page), read the
field guide on the home page at [/#guide](http://localhost:3470/#guide). For how it should look
and sound, read [DESIGN.md](DESIGN.md).

## Setup

```bash
pnpm install
pnpm index        # crawl ~/Programming into data/index.json (about a minute)
pnpm dev          # http://localhost:3470, bound to 127.0.0.1 only
```

- Run the dev server from this folder. It reads the selected local and GitHub indexes
  from this project, whatever output path a command-line local indexer was told.
- The first `pnpm dev` or `pnpm build` needs the network once, to fetch the fonts. After
  that `next/font` serves them locally and the browser never leaves localhost.
- Open the **Sources** page (`/sources`) beside **Guide**. Under **Input**, choose Local,
  Remote, or both. Remote takes public GitHub repository links from any account, one per
  line (`https://github.com/owner/name` or `owner/name`), up to 50; there is no
  whole-account mode. **Save**, then **Sync now**. The choices persist in
  `data/sources.json`; **Sync now** refreshes the selected sources and logs its start and
  outcome in the current activity session, as saving is logged. `pnpm index` remains the
  local-only command.
  For command-line rebuilds, the server notices the new file on the next request; there
  is nothing to restart.

## The loop

Edit, let hot reload show you the page, then check the part you touched. There is no
lint, test or format tooling; these are the checks.

| What you changed | Check | Expect |
| --- | --- | --- |
| Anything | `pnpm -s typecheck` | a clean exit, about a second |
| Search, ranking, operators | `pnpm tsx --conditions=react-server scripts/try-search.ts "linear clone"` | results, the knowledge-panel pick, did-you-mean and suggestions, printed |
| Anything you can see | `scripts/shot.sh "/wiki/innernet" out.png 1440 2400 dark` | a settled screenshot, and the names of any elements that scroll the page sideways |
| The indexer | `INNERNET_ROOTS=~/some/small/dir INNERNET_OUT=/tmp/innernet-test.json pnpm index` | a test index, with your real one left alone |
| The database | `INNERNET_DB_DIR=/tmp/innernet-db pnpm db:store`, then `pnpm db:status` with the same folder | the index and history stored in a scratch copy, the real one left alone |
| The history | with the dev server stopped, `INNERNET_HISTORY_DIR=/tmp/h INNERNET_DB_DIR=/tmp/hdb pnpm dev`; open a few pages, append a line to `/tmp/h/<session>/notes.jsonl` and reload `/activity` | the line shows, once, however often the page is read; the real history left alone |
| Sources | visit `/sources`; check Local, Remote and both; add repository links from two accounts, save, reload, sync; read Generated data; connect, sync and disconnect the remote with a scratch `INNERNET_HOME` | choices persist, each repository list has its own snapshot, generated paths are relative, a switch to remote asks to confirm and copies the index and history, and the page scrolls as a document |
| Copy | `rg -n "[\x{2013}\x{2014}]" -g '!node_modules' -g '!.next' -g '!data' .` | no matches |

A few things worth knowing about these tools:

- `try-search` needs `--conditions=react-server`, because `lib/search.ts` and
  `lib/data.ts` import `server-only`. Any terminal script that imports them does too.
- `shot.sh` talks to `http://localhost:3470` unless `SHOT_BASE` names another server.
  Its last two arguments are the height and `light` or `dark` (it sets
  `prefers-color-scheme`). A narrow width gives the narrow layout but not a phone user
  agent. Pass a tall height to see a whole page, or `SHOT_SCROLL=#guide` (an element or
  a number of pixels) to capture the window scrolled there, as the home page's hand-off
  to the field guide needs. `SHOT_EVAL` runs a snippet in the settled page first, such as
  a click that opens Sources' connect notice.
- The server cannot show an index written with `INNERNET_OUT`. Inspect that file with
  `node`, or point `INNERNET_ROOTS` at a small folder and let it write the real one when
  you are happy to rebuild. Terminal scripts can search it, though: `lib/data.ts` reads
  `data/index.json` under the working directory, so write the test index to
  `/tmp/t/data/index.json` and run `try-search` from `/tmp/t`, with this folder's
  `node_modules/.bin/tsx --conditions=react-server` and this folder's `scripts/try-search.ts`.
- `INNERNET_MAX_DEPTH=3` overrides the depth in `innernet.config.json` for one run, as
  `INNERNET_ROOTS` does the roots.
- The demo's database is reached only with its connection string in the environment,
  loaded for one command from the gitignored `.env.neon.local`:
  `set -a; . ./.env.neon.local; set +a; INNERNET_DEMO=1 pnpm build`, then the same
  prefix for `pnpm exec next start -p 3491 -H 127.0.0.1` or `pnpm db:status --demo`.
  Never copy it into `.env` or `.env.local`, which Next.js would load. A build that sees
  it keeps no Turbopack cache (`next.config.ts`), since that cache saves the build's
  whole environment. Test visits on the demo use ids of the demo's shape; clear them with
  the history page's Clear button, or `DELETE /api/activity`, before you finish.
- A route crawler (211 routes: every operator, tabs, odd slugs, specials, 404s) was used
  while building Innernet but is not in the repo yet. Landing it as `scripts/crawl.mjs`
  would be a welcome first pull request.

## Conventions

**Popups never scroll.** Popups, modals, dialogs and popovers are only for brief
information or small, focused confirmations that fit without scrolling, including on
phones and at increased text size. If content needs scrolling, put it on a normal
page. Do not clip, hide or shrink content to fit an overlay. Source choices and
storage locations belong on `/sources`. Check narrow and wide screens when changing
an overlay; the app-wide rule is in
[`.cursor/rules/non-scrolling-popups.mdc`](.cursor/rules/non-scrolling-popups.mdc).

**Server first.** Pages are Server Components that read `lib/data.ts` and
`lib/search.ts`. The client components are few and each has a reason only the browser
can satisfy: the search box, the home hero search, the theme toggle and the contents
rail; the field guide's copy button, folder recipe, reveal motion and progress ruler;
the Innerpedia globe and the reveal of the boxes below it; and the history's recorder,
the header's back and forward buttons, the local Sources page controls, and the history
page's two views of this browser. The search box asks `/api/suggest`, the recorder posts
each page visited to `/api/activity`. Sources posts to `/api/sources` to inspect or
save Local/Remote choices and the repository list, `/api/sources/sync` to rebuild the
saved selection, `/api/sources/open` to reveal or edit named locations, and
`/api/storage` to read, test, connect, sync or disconnect the remote database. All include the current session ID
and require the same origin on localhost. Local sync runs the `pnpm index` crawler into
`data/index.json`; Remote runs the anonymous public GitHub crawler with
`INNERNET_REMOTE_CACHE=.github-cache`, `INNERNET_GITHUB_REPOSITORIES` (a JSON list of
`owner/name`) and an `INNERNET_REMOTE_OUT` of `data/github-<hash>.json`, one per list.
A list never serves another list's snapshot, and the bundled demo index never stands in
locally. Both selected means an in-memory combination of the indexes. This machine's
PGlite is always the database in use; a remote one connected on Sources (`lib/storage.ts`,
`~/.innernet/remote.json`) is kept in step with it both ways by `lib/db/remote-sync.ts`,
which only adds to the remote and deletes there only what was deleted here
(`lib/db/tombstones.ts`). `scripts/try-remote-sync.ts` runs two machines and a remote as
PGlite folders, with no network. The demo's database is refused as a remote.

Saving choices records a `sources` event; sync records `sync` events with `started`,
`completed` or `failed` status. Concurrent syncs and source changes during a sync return
409. Sources is hidden on the demo and its routes return 404 there. Generated data shows
relative paths with copy and open actions, plus edit for this tab's history file; the
folder settings open from Input. Generated pages come from JSON,
not individual HTML files. On the demo the activity post is made only when the demo has a database, and its history
page then reads and clears the visitor's own sessions on the same route (a `POST` of
`{"read": [ids]}` and a `DELETE` of `{"sessions": [ids]}`: ids never go in an address);
without one the demo keeps history in `localStorage` and sends nothing. The history
page's Store now is a plain form posting to `/api/db/store`, local only. Keep it that way: no other browser fetches, no external browser requests, no new client
components without a reason only the browser can satisfy.

**Shared code stays shared.** The indexer imports `lib/text.ts`, `lib/normalize.ts` and
`lib/types.ts`, and `lib/links.ts`, `lib/format.ts` and `lib/lang-colors.ts` are meant to
be importable from anywhere. Keep all six free of `server-only` and of Next imports.

**Tokens, not values.** Colours live in `app/globals.css`. A new token goes in four
places: `:root`, the dark `@media` block, `:root[data-theme="dark"]`, and `@theme
inline`. Components use the utilities (`bg-surface`, `text-muted`, `border-line`), never
hex. Check both themes.

**Links through `lib/links.ts`.** `wikiHref`, `categoryHref`, `searchHref` and
`vscodeHref` handle encoding, underscores and empty parameters for you.

**Index text is never HTML.** Snippets and leads are segment arrays rendered as React
nodes; READMEs go through react-markdown with `skipHtml`. Nothing from the index goes
near `dangerouslySetInnerHTML`.

**Privacy is a feature.** The indexer reads READMEs, CLAUDE.md or AGENTS.md, manifests,
git metadata and a project's own logo image (found by name), and nothing else. If you need a new kind of input, read names rather
than contents where you can, and run anything textual through `redactSecrets` and
`cleanLine` in `lib/text.ts`. The database keeps to the same line: this machine's copy
stays in PGlite on this machine (`lib/db/neon.ts` refuses local mode outright), and the
demo writes to Neon only the index and what `lib/db/demo-history.ts` lists. Anything new
a demo keeps about its visitors must be anonymous, capped, gone within 30 days and
clearable by the visitor, and README.md must say so.

**House style.** Encyclopedia voice in article prose ("is a", "was created in"). Plain,
warm, a little wry. No exclamation marks. No em or en dashes anywhere, in copy, comments
or code: use commas, colons, middots or full stops.

## Recipes

### Add a search operator

1. In `lib/search.ts`, add the key to `ParsedQuery.filters` and `OPS`, to the operator
   regex in `parseQuery()`, to the copy of that regex in `correction()`, and its test to
   `matchesFilters()`.
2. In `components/search/query-tools.ts`, add it to `OP_RE` and give it a label in
   `OP_LABEL`. Typecheck will remind you about the label.
3. Chips appear on their own. If it earns a place, add an example to `EXAMPLES` in
   `components/home/example-queries.tsx` and to the operator lists in README.md and
   DESIGN.md.

Values arrive lowercased and may be quoted (`in:"two words"`). If you add `lang:`
aliases, add them to both `LANG_ALIASES` copies (`lib/search.ts` and
`components/search/query-tools.ts`).

### Add a Special page

1. Routing is done: any `/wiki/Special:Name` reaches `SpecialView`.
2. For a page that redirects (like Random), handle it in `app/wiki/[slug]/page.tsx`
   before rendering.
3. For a page that renders, add a branch to `SpecialView` in
   `components/wiki/special-view.tsx` (branches test `key`, the name lowercased with
   spaces and underscores removed), add it to `SPECIALS` in the same file, and build the
   view like `StatisticsView` with `PageTitle prefix="Special: "`. Put heavy computation
   in `components/wiki/main/insights.ts` behind `once()`.
4. Link it from `LINKS` in `components/wiki/wiki-shell.tsx`, as
   `wikiHref("Special:Name")`, and from `AREAS` in `components/wiki/main/browse.tsx`,
   as `slug: "Special:Name"`.

### Add a framework detector

1. For JavaScript, add `["package-name", "Display Name"]` to `FRAMEWORKS` in
   `scripts/build-index.ts`. It matches a dependency or devDependency name exactly.
2. For every other manifest (pyproject, Cargo, go.mod, requirements.txt), add
   `[/\bname\b/i, "Display Name"]` to `PY_FRAMEWORKS`.
3. If it deserves its own noun, add one to `NOUNS` in
   `components/wiki/article/lead.ts` (most specific first) and to `APP_FRAMEWORKS` in
   `components/search/query-tools.ts`.
4. Re-index. The category, the `fw:` operator, search weight, See also, the infobox and
   the result chips all follow.

### Add an article section

1. If it needs new data, add an optional field to `Page` in `lib/types.ts`, fill it in
   `crawl()` in `scripts/build-index.ts`, and backfill it in `normalizeIndex()` if it can
   be worked out without the disk (older indexes still load).
2. Create `components/wiki/article/<name>.tsx` exporting `hasX(page)` and `X({ page })`,
   patterned on `technology.tsx`, with `Sub` from `parts.tsx` for labelled blocks.
3. In `components/wiki/article-view.tsx`, add the section id to `SECTION_IDS` (so a
   README heading cannot claim it), push a contents item in order, and render
   `<Section id title>` where it belongs. A section shows only when it has something to
   say.
4. Stubs have their own view in `components/wiki/stub-view.tsx`.

## How to verify

- `pnpm -s typecheck` passes.
- The pages you touched look right in light and dark, at 1440 and at 390 wide, with no
  sideways scroll (`shot.sh` names the culprit if there is one).
- Search changes: try-search on a few queries, including one with a typo and one with
  only operators.
- Indexer changes: a test index of a small folder, inspected with `node`, before a full
  `pnpm index`.
- Nothing new reaches the browser: no new requests in the network panel, no new client
  components.
- Hit a page that should not exist and a Special page that does not: the first is a 404,
  the second a polite list.

## Pull request checklist

- [ ] Typecheck passes.
- [ ] Screenshots in light and dark, desktop and phone width, for anything visible.
- [ ] Every page touched still renders with an empty or missing `data/index.json` (with
      `INNERNET_DB=off`, or the stored copy serves instead).
- [ ] No em or en dashes, no exclamation marks, encyclopedia voice in prose.
- [ ] Colours from tokens, links from `lib/links.ts`, index text as React nodes.
- [ ] No new browser requests, no new reads from disk beyond names and the files listed above.
- [ ] README.md, DESIGN.md and the [field guide](http://localhost:3470/#guide) updated if behaviour changed.
- [ ] `data/` and `.next/` left out of the commit.
