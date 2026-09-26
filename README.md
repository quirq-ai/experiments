# shipnotes-demo

A runnable tour of [aqualang89/shipnotes-components](https://github.com/aqualang89/shipnotes-components). The three components are vendored unmodified; `index.html` wires them into one page and shows the attributes going in and the events coming out.

## Run

```bash
python3 -m http.server 8471
```

Then open http://localhost:8471. Opening `index.html` from disk works too. In Claude Code desktop it's the `shipnotes-demo` entry in `experiments/.claude/launch.json`.

## What the upstream repo is

MIT-licensed UI pieces with moving parts, built with Codex for the [Ship Notes](https://x.com/shipnotesai) build videos on X. Each is one JS file that registers a custom element with Shadow DOM. No package, no build, no dependencies: copy the file, add a `<script defer>`, use the tag. Upstream hosts its own demos on [GitHub Pages](https://aqualang89.github.io/shipnotes-components/components/signal-orb/demo.html).

| Element | What it is | In | Out |
| --- | --- | --- | --- |
| `<pull-lamp>` | SVG desk lamp; pulling the cord switches the theme | `on` (boolean) | `themechange`, `detail.theme` is `"light"` or `"dark"` |
| `<signal-orb>` | Particle status light for an AI app: WebGL, 12k particles (6k on touch), Canvas 2D fallback | `state`: `listening` `thinking` `searching` `done`; `level` 0..1; `particles` 200..20000 | nothing |
| `<project-stack>` | Three stacked portfolio cards with tabs, CSS 3D | a child `<script type="application/json">` holding exactly 3 `{title, tag, description, href, accent?}` | nothing |

The repo reads like the output of an agent-driven build-and-post loop: its `.gitignore` hides `AGENTS.md`, `STATE.md`, `POST.md`, `proof/` and `*.mp4`, and every component has a `recording` attribute for rendering clean video frames. The first commit (2026-09-22) shipped nine components. The next day all but the lamp were pulled, and they're coming back one per video: Signal Orb on 09-23, Project Stack on 09-26. Still only in git history: a record player, a folding-letter send button, a throttle, a file dock, a contact card and a GSAP launch switch.

## What the demo shows

- **Pull Lamp** drives this page's theme. "Change theme from the page" shows the other direction: set `on` from code and no event comes back.
- **Signal Orb**: the four states, `level`, the particle budget, and a simulated agent turn. A readout shows the renderer, live particle count and fps, so you can watch the automatic budget step down on a slow machine.
- **Project Stack**: edit the JSON and rebuild. "Try hostile input" feeds it markup, `javascript:` and `data:` links and bad accents, and the log reports what the element actually rendered.

## Gotchas found while wiring it

- **React 19 crashes on `<signal-orb state="thinking" />`.** React sets a prop as a property whenever `key in element`, and the orb defines `state`, `level` and `particles` as getters with no setters, so the render throws `Cannot set property state ... which has only a getter`. Checked with react-dom 19.2.4 in jsdom against these exact files. Workaround below; upstream setters would fix it.
- **React event props are case-sensitive.** `onthemechange` works; `onThemeChange` listens for an event that never fires.
- **Project Stack reads its JSON once**, on first connect. New data means a new element.
- **Project Stack needs exactly three items.** Anything else silently shows its built-in sample (Orbit, Forma, Echo).
- **Only the lamp emits events.** The stack's selected card lives on `el.active` with no change event.
- **The orb's automatic particle budget only goes down**: 40% after 30 slow frames in a row, floor 800, no recovery. Set `particles` to pin it.
- **The orb and the stack are styled for dark backgrounds**, so this page keeps their stages dark in both themes.
- **Upstream only tested Chromium.**

## Using them from React 19

```jsx
// Crashes: React assigns orb.state, which only has a getter
<signal-orb state="thinking" level={0.7} />

// Works: set the attributes yourself
const orb = useRef(null);
useEffect(() => {
  orb.current.setAttribute('state', state);
  orb.current.setAttribute('level', String(level));
}, [state, level]);
<signal-orb ref={orb} />

// Works: lowercase event prop; on={false} removes the attribute
<pull-lamp on={theme === 'light'} onthemechange={e => setTheme(e.detail.theme)} />
```

The scripts call `customElements` as soon as they load, so in Next.js load them on the client (`next/script`, or `import()` inside a `useEffect`).

## Where it could fit in XO

- `signal-orb` as the agent status in the xo-coworker chat: composing → `listening`, runtime streaming → `thinking`, tool call running → `searching`, turn complete → `done`.
- `pull-lamp` as a theme switch with some character on xo-main or xo-room.

## Layout

```
index.html                 the tour
demo.css                   page theme, which follows the lamp
demo.js                    host-page wiring: attributes in, events out, rebuilds
vendor/shipnotes/          upstream files, unmodified, plus LICENSE and UPSTREAM.md
scripts/sync-upstream.sh   re-vendor at a branch, tag or commit
```

## Updating

```bash
scripts/sync-upstream.sh
```

Pass a branch, tag or commit to pin one. The script rewrites `vendor/shipnotes/UPSTREAM.md` and lists upstream's component folders so new releases are easy to spot.

## License

The components are MIT, © 2026 Ship Notes. The license travels with them in `vendor/shipnotes/LICENSE`.
