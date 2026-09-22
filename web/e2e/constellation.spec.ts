import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Route } from "playwright/test";

const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../testdata/agent-lens/browser-fixtures.json", import.meta.url)),
    "utf8"
  )
);

// Four clocked sessions an hour apart plus one empty straggler: enough to
// exercise lanes, seams, and the non-empty default without a real machine
// scan. Each lane replays the fixture trace with wall-clock timestamps.
const BASE_MS = Date.parse("2026-03-14T09:00:00.000Z");
const HOUR_MS = 3_600_000;
const STEP_MS = 10_000;

interface FictionalLane {
  key: string;
  title: string;
  offsetMs: number;
}

const LANES: FictionalLane[] = [
  { key: "fictional-alpha", title: "Fictional constellation Alpha", offsetMs: 0 },
  { key: "fictional-beta", title: "Fictional constellation Beta", offsetMs: HOUR_MS },
  { key: "fictional-gamma", title: "Fictional constellation Gamma", offsetMs: 2 * HOUR_MS },
  { key: "fictional-delta", title: "Fictional constellation Delta", offsetMs: 3 * HOUR_MS }
];

const EMPTY_KEY = "fictional-empty";
const EMPTY_TITLE = "Fictional empty session";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function laneTrace(lane: FictionalLane) {
  const trace = structuredClone(fixtures.traces.root);
  trace.session.id = lane.key;
  trace.session.title = lane.title;
  for (const event of trace.events as { seq: number; ts?: string }[]) {
    event.ts = iso(BASE_MS + lane.offsetMs + event.seq * STEP_MS);
  }
  return trace;
}

function laneSession(lane: FictionalLane) {
  return {
    ...fixtures.session,
    key: lane.key,
    id: lane.key,
    title: lane.title,
    startedAt: iso(BASE_MS + lane.offsetMs),
    endedAt: iso(BASE_MS + lane.offsetMs + 3 * STEP_MS)
  };
}

async function mockConstellationApp(page: Page) {
  // newest first, the way the server lists a real machine; the empty
  // session trails so the boot fallback auto-opens a clocked one
  const sessions = [...LANES].reverse().map(laneSession);
  sessions.push({
    ...fixtures.session,
    key: EMPTY_KEY,
    id: EMPTY_KEY,
    title: EMPTY_TITLE,
    eventCount: 0,
    startedAt: iso(BASE_MS - HOUR_MS)
  });

  const traces = new Map(LANES.map((lane) => [lane.key, laneTrace(lane)]));
  const emptyTrace = structuredClone(fixtures.traces.root);
  emptyTrace.session.id = EMPTY_KEY;
  emptyTrace.session.title = EMPTY_TITLE;
  emptyTrace.session.eventCount = 0;
  emptyTrace.events = [];
  emptyTrace.marks = [];
  traces.set(EMPTY_KEY, emptyTrace);

  await page.route("**/api/sessions**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/sessions") {
      await route.fulfill({ json: sessions });
      return;
    }

    const snapshot = path.match(/^\/api\/sessions\/([^/]+)\/snapshot$/);
    if (snapshot) {
      const trace = traces.get(decodeURIComponent(snapshot[1]));
      if (trace) {
        await route.fulfill({ json: { trace, city: fixtures.city } });
      } else {
        await route.fulfill({ status: 404, body: "fictional session not found" });
      }
      return;
    }
    if (/^\/api\/sessions\/[^/]+\/agents$/.test(path)) {
      await route.fulfill({ json: fixtures.graph });
      return;
    }
    if (/^\/api\/sessions\/[^/]+\/report$/.test(path)) {
      await route.fulfill({ json: fixtures.reportStatus });
      return;
    }

    await route.fulfill({ status: 404, body: "fictional route not found" });
  });
}

function laneRow(page: Page, title: string) {
  return page.locator(".lane").filter({ hasText: title });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test("constellation shows a lane per non-empty session and scrubbing moves the readouts", async ({
  page
}) => {
  await mockConstellationApp(page);
  await page.goto("/?constellation=1");

  // one lane per clocked session, none for the empty one
  await expect(page.locator(".lane")).toHaveCount(LANES.length);
  for (const lane of LANES) {
    await expect(laneRow(page, lane.title)).toHaveCount(1);
  }
  await expect(laneRow(page, EMPTY_TITLE)).toHaveCount(0);

  // the cursor opens at the span's origin: Alpha's first event is live,
  // Delta (three hours later) has not started
  const alpha = laneRow(page, "Alpha");
  const delta = laneRow(page, "Delta");
  await expect(alpha.locator(".readout-summary")).toHaveText("Search the fictional moon module");
  await expect(delta.locator(".readout-summary")).toHaveText("not started");

  // scrub to the end of the global axis: Alpha is long over, Delta is on
  // its final event
  const slider = page.getByRole("slider", { name: "Global playback position" });
  const cMax = await slider.getAttribute("max");
  expect(cMax).not.toBeNull();
  await slider.fill(cMax!);
  await expect(alpha.locator(".readout-summary")).toHaveText("ended");
  await expect(delta.locator(".readout-summary")).toHaveText("Verify the fictional garden");

  // and back: the readouts follow the cursor both ways
  await slider.fill("0");
  await expect(alpha.locator(".readout-summary")).toHaveText("Search the fictional moon module");
  await expect(delta.locator(".readout-summary")).toHaveText("not started");
});

test("clicking an occupied strip bucket jumps the shared cursor to its moment", async ({ page }) => {
  await mockConstellationApp(page);
  await page.goto("/?constellation=1");
  await expect(page.locator(".lane")).toHaveCount(LANES.length);

  // the cursor opens at the origin: Delta hasn't started, the deck clock
  // reads Alpha's dawn
  const clock = page.locator(".deck-pos-clock");
  const before = await clock.textContent();
  const delta = laneRow(page, "Delta");
  await expect(delta.locator(".readout-summary")).toHaveText("not started");

  // Delta's occupied buckets sit three hours up the axis — clicking its last
  // one must carry the whole constellation there, not pin the raw click x
  const buckets = delta.locator('.strip-bar[role="button"]');
  await expect(buckets).toHaveCount(4); // one occupied bucket per fixture event
  await buckets.last().click();

  // the shared clock left the origin and every lane reads the same moment:
  // Alpha is hours over, Delta is live inside its final burst
  await expect(clock).not.toHaveText(before!);
  await expect(laneRow(page, "Alpha").locator(".readout-summary")).toHaveText("ended");
  await expect(delta.locator(".readout-summary")).toHaveText("Edit the fictional garden module");
});

test("a lane bucket click opens a detail card whose rows drive the shared cursor", async ({ page }) => {
  await mockConstellationApp(page);
  await page.goto("/?constellation=1");
  await expect(page.locator(".lane")).toHaveCount(LANES.length);

  // Delta's last occupied bucket: the click still jumps the shared cursor
  // (covered above) and now ALSO opens the detail card at the click point.
  // Fixture events sit ~10s apart against a ~937ms bucket, so every occupied
  // bucket holds exactly one event.
  const delta = laneRow(page, "Delta");
  const buckets = delta.locator('.strip-bar[role="button"]');
  await expect(buckets).toHaveCount(4);
  await buckets.last().click();

  const card = page.locator(".detail-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("1 event");

  // the row names Delta's final event exactly; the bucket click before it
  // landed on the bucket's center, so jumping to the event moves the deck
  // clock (…:29 → …:30)
  const clock = page.locator(".deck-pos-clock");
  const before = await clock.textContent();
  await card.locator(".detail-card-row").first().click();
  await expect(clock).not.toHaveText(before!);

  // Esc dismisses the card; the constellation itself stays put
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(page.locator(".lane")).toHaveCount(LANES.length);
});

test("a lane's Open button lands the walk view on that session at the constellation's moment", async ({
  page
}) => {
  await mockConstellationApp(page);
  await page.goto("/?constellation=1");
  await expect(page.locator(".lane")).toHaveCount(LANES.length);

  // cursor at 0 puts Alpha on seq 0; Open must hand exactly that moment over
  await page
    .getByRole("button", { name: "Open Fictional constellation Alpha in the walk view" })
    .click();

  await expect(page.locator(".constellation")).toHaveCount(0);
  await expect(page.locator(".hud-lens")).toHaveText("LensMain");
  await expect(page.locator(".deck-pos-count")).toHaveText("1 / 4");
});

test("one-world layout unions every session onto the shared map", async ({ page }) => {
  await mockConstellationApp(page);
  await page.goto("/?constellation=one");

  // one scene, one chip per shared-cwd session, no per-session frames
  await expect(page.locator(".one-world canvas")).toHaveCount(1);
  await expect(page.locator(".world-chip")).toHaveCount(LANES.length);

  // chips carry each walker's live tool on the global clock
  const alphaChip = page.locator(".world-chip", { hasText: "Alpha" });
  await expect(alphaChip).toHaveClass(/active/);

  // at the end of the axis every walker has finished
  const slider = page.getByRole("slider", { name: "Global playback position" });
  const cMax = await slider.getAttribute("max");
  await slider.fill(cMax!);
  await expect(alphaChip.locator(".world-chip-now")).toHaveText("ended");

  // the layout toggle returns to lanes without losing the cursor
  await page.getByRole("button", { name: "Lane layout" }).click();
  await expect(page.locator(".lane")).toHaveCount(LANES.length);
});

test("world layout renders the union on the terrain — folders as one map", async ({ page }) => {
  await mockConstellationApp(page);
  await page.goto("/?constellation=world");

  // still one scene, one chip per walker — only the geometry changes
  await expect(page.locator(".one-world canvas")).toHaveCount(1);
  await expect(page.locator(".world-chip")).toHaveCount(LANES.length);
  // exact: the accessible name "One world layout" contains this one
  await expect(page.getByRole("button", { name: "World layout", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});
