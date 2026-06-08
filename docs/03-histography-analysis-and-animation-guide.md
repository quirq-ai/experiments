# histography.io: UI and animation analysis, and a guide for matching its finesse in the visualizer

This doc has two halves. The first is a detailed teardown of what [histography.io](https://histography.io/) actually does and why it feels expensive. The second is a practical playbook for agents: the specific techniques, with code-level guidance, to reach that level of polish in this visualizer (which renders a repo's commit history as a flowing green/red wave).

---

## Part 1: what histography is and why it feels premium

Histography is an interactive timeline of all recorded history. Every event drawn from Wikipedia is one small dot. Tens of thousands of dots sit on a near-black canvas, arranged left to right by date, and you scrub, filter, and click through time. It was a four-month graduation project by Matan Stauber, and it self-updates daily from Wikipedia. Confirmed tech (from the creator's interviews): the dot field is **WebGL rendered through Pixi.js** (2D sprite batching on the GPU), with plain CSS and JavaScript for the surrounding UI.

### The five things that make it feel finished

1. **One mark per record, and density is the message.** Nothing is aggregated away. Where history is busy the screen is dense, where it is sparse the dots thin out. You read the distribution before you read a single label. The emotional hook is "I am looking at everything."

2. **Constant ambient motion.** Even when you do nothing, every dot drifts with a subtle Brownian jitter. The field never sits perfectly still, so it reads as alive rather than as a static chart. This low-amplitude idle motion is most of the "feeling".

3. **Eased, physical transitions.** When you change era or filter, dots do not cut to their new positions. They fly and re-settle with spring-like easing. State changes are journeys, not jumps. This is the single biggest tell of a premium interactive piece.

4. **A warped, legible time axis.** Time is non-linear: recent years move slowly (a year at a time), the deep past accelerates, because there are far fewer recorded events back there. The axis bends to keep dot density readable so no era crushes the rest.

5. **Severe restraint.** Black field, near-monochrome dots, almost no chrome. Color and size are spent sparingly and therefore mean something. The bottom scrubber doubles as a density histogram, so even the navigation is data.

### The interaction model, briefly

A density histogram scrubber along the bottom that you drag to travel through time. Category filters (wars, politics, inventions, music, and so on) that re-cluster the swarm. Hover enlarges a dot and shows a label; click opens a panel with the Wikipedia summary and a link. A "random event" affordance and an auto-play mode that walks you through time.

### Why Pixi/WebGL matters

Drawing tens of thousands of independently animating marks at 60fps is only possible if they are batched on the GPU. DOM nodes or one canvas draw-call per dot die after a few thousand. The renderer choice is not incidental, it is what allows requirement 1 (one mark per record) to coexist with requirement 2 (everything is always moving).

---

## Part 2: a playbook for matching the finesse in the visualizer

The visualizer is not a dot field, it is a flowing wave (additions as a green ridge above a center line, deletions as red below). But the qualities that make histography feel expensive are renderer-agnostic. Here is how to get them, mapped to the code in `components/CommitWave.tsx`.

### 2.1 The render loop: one rAF, no React in the hot path

The non-negotiable foundation. Run a single `requestAnimationFrame` loop. Keep all per-frame mutable state in a `useRef` object, never in React state, so the animation never triggers a re-render. React owns the chrome (sidebar, header); the canvas owns the motion. This is exactly the split histography uses (CSS/JS UI around a self-contained renderer), and it is what `CommitWave` already does with its `st` ref.

```
useState  -> chrome only (selected branch, loading)
useRef    -> wave geometry, time t, hover index, reveal progress
rAF loop  -> reads the ref, draws, never calls setState
```

If you ever see jank, the first suspect is a React state update firing inside the loop.

### 2.2 Easing: ease-out for reveals, critically-damped springs for moves

Linear motion is the universal tell of an amateur animation. Two curves cover almost everything:

- **Reveals and one-shot draws:** ease-out cubic, `1 - (1 - x)^3`. Fast start, gentle settle. The wave's left-to-right draw-in uses this.
- **State-to-state moves (the histography swarm):** a critically-damped spring, integrated per frame, not a fixed-duration tween. `v += (target - x) * k; v *= damping; x += v;` with `k` around 0.012 and damping around 0.86 gives a soft, physical settle with no overshoot. Use this whenever a value chases a new target (a dot moving, a bar resizing, a camera panning).

Never animate position linearly. If two things start and stop together, stagger them.

### 2.3 Ambient idle motion: the wave must breathe

This is requirement 2, and it is what separates "a chart" from "a living thing". Add a small, slow, multi-frequency modulation so the shape is never static:

```js
const wob = (col) =>
  1 + 0.06 * Math.sin(t * 0.8 + col * 0.045)
    + 0.03 * Math.sin(t * 0.37 - col * 0.02);
```

Two layered sines at different frequencies and phases, multiplying the amplitude, plus a per-column phase offset so the ripple travels along the wave. Keep the amplitude small (a few percent). The same principle drives histography's Brownian dots and xo-swarm's presence-waves (long-period, phase-offset, ease-in-out loops). Layering at least two frequencies is what keeps it from looking like a mechanical pulse.

### 2.4 Organic shape from a smoothing kernel

Histography's dot clouds look natural because they are made of thousands of independent points. The wave gets the same organic quality a different way: instead of drawing one spike per commit (which looks like a jagged bar chart), each commit contributes a soft Gaussian bump, and the bumps are summed across the width into smooth overlapping ridges (a mountain range). This is the `rebuild()` step in `CommitWave`:

```
for each output column x:
  sum over nearby commits j of  value_j * exp(-(x - cx_j)^2 / (2 sigma^2))
```

`sigma` is roughly the commit spacing, so neighbors blend. Precompute the whole ridge once per data change or resize, then only apply the cheap breathing modulation per frame. The expensive smoothing is static; the animation on top is nearly free.

### 2.5 The warped axis (do not skip this)

A plain linear time axis is the fastest way to lose the histography quality. Either warp time (recent commits get more horizontal space, the `1 - sqrt(age)` mapping is a start) or, for a rhythmic wave, use even per-commit spacing so the wave has a steady cadence and quiet periods do not become dead flat regions. The visualizer currently uses even spacing for cadence; a "real time gaps" mode is a natural finesse upgrade (see 2.10).

### 2.6 Depth and glow, cheaply

Histography gets depth from sheer dot count and subtle alpha. The wave gets it from layering:

- **Fill with a vertical gradient** that fades to transparent away from the baseline, so the ridge has body without a hard edge.
- **Stroke the crest** with a bright 1.5px line and a `shadowBlur` of ~14 in the crest color. Canvas `shadowBlur` on a stroke is a one-line glow. Reset `shadowBlur` to 0 immediately after, it is expensive if left on for fills.
- **A slow white sweep** (a translucent vertical gradient band) traveling across the wave adds life and a sense of a light passing over a surface.

Spend glow only on the few elements that carry meaning (the crest, the hovered point). Glow everywhere reads as noise, the opposite of histography's restraint.

### 2.7 Crisp on retina: device pixel ratio

A blurry canvas instantly looks cheap. Scale the backing store by `devicePixelRatio` (capped at 2 for performance) and set the transform once:

```js
const dpr = Math.min(2, window.devicePixelRatio || 1);
canvas.width = W * dpr; canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

Re-run on resize via a `ResizeObserver`. `CommitWave` does this.

### 2.8 Hover that feels precise

Map the mouse to the nearest commit by index (cheap, because spacing is known), draw a thin vertical guide and a glowing dot on each ridge at that column, and show a compact readout (subject, +adds in green, -dels in red, hash, author, date). Snapping to the nearest record, rather than requiring a pixel-perfect hover, is what makes it feel responsive. Histography does the same: the whole dot grows to meet you.

### 2.9 Performance budget for 60fps

- Precompute everything static (the ridge arrays, colors, positions) once per data or resize. Per frame, only modulate and draw.
- Prefer typed arrays (`Float32Array`) for the ridge buffers.
- Cull: do not draw columns outside the viewport. With a warped or scrolling axis, clip to the visible range.
- If the mark count grows past the low tens of thousands (a huge monorepo at one-mark-per-commit), move from Canvas 2D to GPU instancing (Pixi.js or raw WebGL points), which is the histography answer. Canvas 2D is fine for the wave because it draws one path, not N sprites.
- Keep `shadowBlur` usage minimal and always reset it.

### 2.10 Finesse upgrades, in priority order

These take the visualizer from "good" to "histography-level":

1. **Continuous scroll mode.** Let the wave drift slowly leftward like a live seismograph, newest commits entering from the right. Pure ambient motion, very premium, near-free to add on top of the breathing modulation.
2. **Real-time spacing.** Position commits by actual timestamp so quiet weeks become calm flat stretches and crunch periods bunch up. This restores histography's "density is the story" quality. Offer it as a toggle against the current even-spacing cadence.
3. **Parallax depth.** A second, blurrier, slower copy of the wave behind the main one at low alpha. Cheap depth.
4. **Crest particles.** A few slow sparks riding along the green crest where additions are largest, fading in and out. Spend them sparingly.
5. **Author or subsystem color grading.** Subtly tint segments of the wave by who authored that stretch, staying within the green/red family so it does not become a rainbow.
6. **Replay with sound-off shimmer.** On replay, intensify the sweep and let each newly revealed commit flash its crest dot briefly, so history visibly streams in.

### 2.11 Accessibility and restraint (the easy 20% that signals care)

- Honor `@media (prefers-reduced-motion: reduce)`: drop the breathing, the sweep, and the draw-in to a static render. Both histography-style ambition and the XO house style (presence-waves) gate motion this way.
- Keep the palette tiny: black field, one accent, green up, red down. Restraint is not a limitation here, it is the aesthetic. Every time you are tempted to add a color or a motion, ask whether histography would.

---

## The single sentence to remember

Match histography by doing four things well and nothing else loudly: render in one rAF loop outside React, move everything with eased springs and a slow multi-frequency breath, shape the data organically (smoothing kernel) on a non-linear or rhythmic axis, and spend color and glow only where they carry meaning.

## Sources

- Smashing Magazine interview with Matan Stauber (Pixi.js / WebGL confirmation): https://www.smashingmagazine.com/2016/09/interview-with-matan-stauber/
- Adobe blog teardown of how Histography was built: https://blog.adobe.com/en/publish/2015/12/03/data-meets-design
- histography.io
- In-repo reference for XO-native ambient motion: `xo-swarm/components/presence-waves.tsx` and `.xo-presence` in `xo-swarm/app/globals.css` (see doc 02).
