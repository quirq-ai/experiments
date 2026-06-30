# Galaxy sandbox

Interactive galaxy and particle simulation. Thousands of stars orbit galaxy cores under softened gravity; close passes pull spiral arms into tidal tails and slow encounters merge cores.

It opens on the **Sessions** scene: every Claude Code session on your machine is rendered as its own galaxy, sized by message count and colored by project, with the session you launched from highlighted in lime at the center. The other scenes (Trio, Collision, Binary, Cluster, Solo) are the pure physics sandbox.

## Run

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # production build in dist/
```

## Controls

- Sessions scene: click a galaxy to inspect it; drag to pan; scroll to zoom
- Sandbox scenes: drag on space to hurl a galaxy (drag direction sets velocity)
- Scroll to zoom, right-drag or two-finger drag to pan
- Space: pause, R: reset scene, G: add a random galaxy (sandbox only)
- Sliders: simulation speed, gravity strength, trail length (all live)

## Sessions scene

Each session galaxy can be inspected and prompted:

- **Click a galaxy** to open a card with its project, title, message count, transcript size, and last-active time.
- **Prompt it** from the card. The prompt is delivered headlessly via `claude --resume <id> -p "<prompt>"` in that session's working directory, so the session keeps the same transcript and history.
- **Active sessions move.** Any session whose transcript was written in the last 90 seconds (including one you just prompted) gets a pulsing core, a faster orbit, and a green activity dot. So the moment a session starts working, its galaxy comes alive.

### Requirements for prompting

- The `claude` CLI must be on `PATH` and logged in (the same auth your interactive sessions use). Prompting shells out to it; if it is not authenticated the resumed session records a 401 instead of a real reply.
- The current session (the one that launched the dev server) cannot be prompted from the UI: it is already live, so talk to it directly. The server detects it via `CLAUDE_CODE_SESSION_ID`, falling back to the most recently active session.
- A session that was written to in the last 20 seconds is treated as live in another window and is not resumed, to avoid interleaved writes to its transcript.

## How it works

The engine (`src/engine/sim.ts`) integrates particles with semi-implicit Euler over softened point-mass gravity from each galaxy core. Particles are stored in typed arrays per galaxy. In the sandbox scenes, cores attract each other and merge on slow close passes, conserving momentum. In the Sessions scene, cores ride prescribed golden-angle orbits (recent sessions close in, older ones drift out) and each star only feels its own core, so dozens of galaxies stay cheap. Rendering is Canvas 2D with additive blending, and trails come from fading the previous frame instead of clearing it. React only drives the HUD, the inspect card, and the activity poller; the simulation never re-renders the component tree.

Session data is served by a small Vite middleware (`vite.config.ts`) that reads `~/.claude/projects/*/`. The browser never touches the filesystem or the `claude` binary directly: it calls `GET /api/sessions` and `POST /api/prompt`, and the server does the file reads and process spawn. This keeps the design server-side by default, with no credentials or paths exposed to the client.
