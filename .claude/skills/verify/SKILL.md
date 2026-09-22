---
name: verify
description: Build, launch, and drive the Space Walk web UI end-to-end for verification.
---

# Verifying Space Walk

## Build & launch

```sh
npm --prefix web run build                  # tsc -b && vite build → web/dist
go build -o bin/spacewalk ./cmd/spacewalk
bin/spacewalk serve --no-open --dev --port <PORT> # --dev serves web/dist from the working tree
```

Gotchas:

- Always pass `--no-open` during automated verification so repeated server
  starts do not create tabs or steal focus from the user's current work.
- Port 8765 is the vite-proxy convention and is often already taken by a dev
  server; pick another port and check the log for `bind: address already in use`.
- Sessions come from `~/.claude/projects`, `~/.codex/sessions`, and
  `~/.pi/agent/sessions` — this machine has real data, no fixtures needed.
  `testdata/claude-session.jsonl` works via `spacewalk open`.
- `bin/spacewalk map <repo>` (or the `/?map=1&repo=<path>` URL) serves the
  static citymap with no session.

## Drive (headless Chrome + CDP, no npm installs)

Pick the browser per host:

- **macOS**: system Chrome + raw CDP over Node's built-in WebSocket. WebGL
  renders under plain `--headless=new` on the real GPU (Metal, ~120fps).

  ```sh
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp> \
    --window-size=1440,900 --no-first-run about:blank &
  ```

  New-tab endpoint needs PUT: `fetch('http://127.0.0.1:9333/json/new?<url>', {method:'PUT'})`.

- **This Linux box**: no system Chrome; use the playwright *library* from
  `web/node_modules` with the cached browser and software WebGL:

  ```js
  chromium.launch({
    executablePath: '/home/coder/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  ```

  Do NOT `npx playwright test` here — the package pins a browser build the
  cache doesn't have. Swiftshader renders one WebGL frame in ~14–19 s with
  several scenes mounted: give screenshots 90 s timeouts and prefer flows
  that mount one canvas (focus mode) when timing matters.

## Flows worth driving

- Load via `/?session=<key>` deep link (legacy bare session id resolves only if
  unique); assert `.session-row.active .session-title`.
- Readout `.deck-pos-count` shows `N / N` after load (playhead starts at end).
- `[aria-label="Restart playback"]` → `1 / N`; `[aria-label="Play playback"]`
  → ~3 ticks/second at 1× (the `.speed-btn` / `S` key cycles the multiplier);
  playback draws the ember trail + firefly.
- Scene view lives in the dock's scene section: the top strip icon (tree/
  mountain shape mirrors the current view) opens a compact pop with `Tree` /
  `Terrain` radio rows plus the encoding legend; pressing `V` cycles views
  directly. Switching rebuilds the scene — watch for `Runtime.exceptionThrown`.
  The pop coexists with an open sheet (report stays open while switching).
- `/?map=1&repo=<abs-path>` renders the citymap with no trace and no transport
  (map-only mode); the rail-head folder icon (`[aria-label="Open a repository
  map"]`) opens a popover — primary card for the active session's repo (name +
  path), then an "or open any repository" path input — and opens the map via
  `window.open`, so in headless drive the URL directly instead of clicking.
- The right-edge dock strip is a panel registry with two sections (scene /
  session, hairline divider): View (pop), `Crosshair` = Inspect (sheet; file
  details, teaching empty state when nothing is selected), `Sparkles` =
  Evaluate (sheet; judge report, status dot mirrors running/done/stale/failed).
  Clicking a report finding jumps the playhead to its evidence seq and selects
  the file; the rail rows mirror evaluation state with `.rail-eval` badges.
- `[aria-label="Export video"]` records playback client-side (MediaRecorder →
  webm download): the label flips to `Recording video`, the transport, rail,
  and view toggle lock while recording, and the playhead restores afterwards.
  Capture the download in CDP with `Browser.setDownloadBehavior`.
- Rapid session switch (click uncached row, 150ms later a cached row) must end
  showing the last-clicked session's data.
- Bogus `?session=` must fall back to the newest session with a console.warn.
- **Constellation** (`/?constellation=1`, or the rail-head Rows3 icon): all
  non-empty sessions as parallel lanes on one gap-compressed wall-clock
  scrubber. Assert one `.lane` per non-empty session; scrub `.deck .strip-input`
  and assert `.lane-now` readouts + the deck clock change; every lane's
  `.strip-playhead` must share one x coordinate across mixed row shapes
  (focus mode, >6 lanes); click a `.lane-meta` → exactly one canvas mounted
  (focus), Esc restores; the lane Open button hands off to the walk view at
  the playhead's seq. Seams render as hatched `.lane-gap` spans labeled with
  real idle durations. The HUD's Orbit icon (or `/?constellation=one`) switches
  to the one-world layout: a single shared map (sessions grouped by cwd,
  others named in a chip) with every walker's fold union-merged onto one
  scene — assert exactly 1 canvas, one `.world-chip` per shared-cwd session,
  and chip statuses that move with the global scrubber.
- Scrubbing `.strip-input` from a script: set the value through the NATIVE
  setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,
  'value').set.call(el, v)`) before dispatching `input` — React tracks the
  value property, and a plain `el.value =` assignment makes it swallow the
  event as a no-op (symptom: the deck clock never moves).
