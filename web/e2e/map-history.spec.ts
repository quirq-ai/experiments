import { expect, test, type Page } from "playwright/test";

// Map-history mode: /?map=1&repo=… synthesizes the repo's git log into a
// trace and hands it to the normal playback deck. These mocks stand in for
// /api/repomap, /api/repomap/history, and /api/repomap/commit, so the specs
// run without a server or a real git repo.

const REPO = "/fictional/repos/orchard";

const city = {
  version: 1,
  repo: {
    root: REPO,
    commit: "demo456",
    dirty: false,
    generatedAt: "2026-01-01T00:00:00Z"
  },
  files: [
    {
      id: 1,
      path: "src/root.ts",
      dir: "src",
      lines: 20,
      bytes: 400,
      lang: "TypeScript",
      rect: { x: 0, z: 0, w: 1, d: 1 },
      ghost: false
    },
    {
      id: 2,
      path: "src/trellis.ts",
      dir: "src",
      lines: 30,
      bytes: 600,
      lang: "TypeScript",
      rect: { x: 2, z: 0, w: 1, d: 1 },
      ghost: false
    },
    {
      id: 3,
      path: "src/lantern.ts",
      dir: "src",
      lines: 12,
      bytes: 240,
      lang: "TypeScript",
      rect: { x: 4, z: 0, w: 1, d: 1 },
      ghost: false
    }
  ],
  dirs: [{ path: "src", depth: 1, rect: { x: 0, z: 0, w: 5, d: 1 }, fileCount: 3, lines: 62 }],
  layout: { algorithm: "synthetic", weight: "lines" }
};

// three fictional commits, chronological; the last one also touches a path
// the citymap no longer holds (the deleted-file → ghost case)
const history = {
  version: 1,
  session: {
    id: "git-orchard",
    harness: "git",
    title: "orchard · git history",
    cwd: REPO,
    startedAt: "2026-01-01T10:00:00Z",
    endedAt: "2026-01-01T12:00:00Z",
    eventCount: 3
  },
  events: [
    {
      seq: 0,
      ts: "2026-01-01T10:00:00Z",
      tool: "commit aaa1111",
      action: "edit",
      targets: [{ path: "src/root.ts", touch: "edit" }],
      resultBytes: 10,
      isError: false,
      outcomeKnown: true,
      summary: "Plant the fictional root — Ada Grove · +10 −0"
    },
    {
      seq: 1,
      ts: "2026-01-01T11:00:00Z",
      tool: "commit bbb2222",
      action: "edit",
      targets: [{ path: "src/trellis.ts", touch: "edit" }],
      resultBytes: 27,
      isError: false,
      outcomeKnown: true,
      summary: "Grow the fictional trellis — Ada Grove · +24 −3"
    },
    {
      seq: 2,
      ts: "2026-01-01T12:00:00Z",
      tool: "commit ccc3333",
      action: "edit",
      targets: [
        { path: "src/lantern.ts", touch: "edit" },
        { path: "src/pruned.ts", touch: "edit" }
      ],
      resultBytes: 23,
      isError: false,
      outcomeKnown: true,
      summary: "Hang the fictional lantern — Bo Fern · +5 −18"
    }
  ],
  marks: [],
  stats: {
    filesInRepo: 3,
    fovea: 3,
    parafovea: 0,
    edited: 3,
    eventsBeforeFirstEdit: 0,
    regressionRate: 0,
    errorRate: 0,
    actions: { search: 0, read: 0, edit: 3, exec: 0, verify: 0, other: 0 },
    errors: { search: 0, read: 0, edit: 0, exec: 0, verify: 0, other: 0 },
    maxEditsPerFile: 1,
    churnFiles: 0,
    userTurns: 0,
    compactions: 0,
    subagents: 0,
    resultBytes: 60,
    editsAfterLastVerify: 3,
    observability: { reads: "exact", errors: "exact" }
  }
};

const commitDetail = {
  hash: "bbb2222",
  author: "Ada Grove",
  ts: "2026-01-01T11:00:00Z",
  subject: "Grow the fictional trellis",
  files: [{ path: "src/trellis.ts", insertions: 24, deletions: 3 }],
  patch:
    "diff --git a/src/trellis.ts b/src/trellis.ts\n@@ -1,3 +1,24 @@\n+const fictionalTrellis = true;\n"
};

interface MapMockOptions {
  /** history endpoint answer; "missing" = 404 "not a git repo" */
  history?: "missing";
}

async function mockMap(page: Page, options: MapMockOptions = {}) {
  const historyRepos: string[] = [];
  await page.route("**/api/repomap**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/repomap") {
      await route.fulfill({ json: city });
      return;
    }
    if (url.pathname === "/api/repomap/history") {
      historyRepos.push(url.searchParams.get("repo") ?? "");
      if (options.history === "missing") {
        await route.fulfill({ status: 404, body: "not a git repo" });
        return;
      }
      await route.fulfill({ json: history });
      return;
    }
    if (url.pathname === "/api/repomap/commit") {
      if (url.searchParams.get("hash") === "bbb2222") {
        await route.fulfill({ json: commitDetail });
        return;
      }
      await route.fulfill({ status: 404, body: "fictional commit not found" });
      return;
    }
    await route.fulfill({ status: 404, body: "fictional route not found" });
  });
  return historyRepos;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test("map mode lights the deck from git history and a commit bar opens its diff", async ({ page }) => {
  const historyRepos = await mockMap(page);
  await page.goto(`/?map=1&repo=${encodeURIComponent(REPO)}`);

  // the deck appears with one observation per commit, playhead at the end,
  // and the history was requested for the citymap's own root (StrictMode
  // double-mounts in dev, so only the param matters — not the request count)
  await expect(page.locator(".deck-pos-count")).toHaveText("3 / 3");
  expect(historyRepos.length).toBeGreaterThan(0);
  for (const repo of historyRepos) expect(repo).toBe(REPO);

  // each commit is one strip bar; a still click on the middle bar jumps the
  // playhead there and opens the commit's EVENT card
  const bars = page.locator('.strip-bar[role="button"]');
  await expect(bars).toHaveCount(3);
  await bars.nth(1).click();
  await expect(page.locator(".deck-pos-count")).toHaveText("2 / 3");

  const card = page.locator(".detail-card");
  await expect(card).toBeVisible();
  await expect(card.locator(".detail-card-title")).toHaveText("bbb2222");
  await expect(card).toContainText("Committed 1 file · +24 −3");
  await expect(card).toContainText("Grow the fictional trellis — Ada Grove");
  // the lazily fetched diff: numstat row plus the mocked patch snippet
  await expect(card).toContainText("+24 −3");
  await expect(card.locator(".detail-card-patch")).toContainText("const fictionalTrellis = true;");

  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
});

test("a repo without git history keeps the static map: no deck, no toast", async ({ page }) => {
  await mockMap(page, { history: "missing" });
  await page.goto(`/?map=1&repo=${encodeURIComponent(REPO)}`);

  // the map itself is up…
  await expect(page.locator(".hud-repo")).toHaveText("orchard");
  // …and the deck stays exactly as map-only always was: inert and empty
  await expect(page.locator(".deck-pos-count")).toHaveText("0 / 0");
  await expect(page.locator(".readout-summary")).toHaveText("Select a session to start the walk.");
  await expect(page.locator(".strip-bar")).toHaveCount(0);
  await expect(page.locator(".toast.error")).toHaveCount(0);
});
