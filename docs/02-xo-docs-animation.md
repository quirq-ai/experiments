# Animation in xo-docs (Fumadocs)

A note on sourcing first. The canonical `xo-docs` repo is not checked out in this workspace. `xo-docs` is a Fumadocs site (per the workspace map: Next.js + Fumadocs, sections like getting-started, agents, troubleshooting). Two Fumadocs sites that share its exact stack are present here and were read directly for this doc: `internal/xo-internal` and `internal/xo-data-room`. Everything below is grounded in those plus Fumadocs' documented behavior. Where a detail is framework default rather than XO-specific, it is called out.

## The stack that produces the motion

Both XO Fumadocs sites declare the same three lines at the top of their global CSS:

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';
```

and the same dependency shape:

| Piece | Version |
|---|---|
| `fumadocs-ui` | ^16.7 |
| `fumadocs-core`, `fumadocs-mdx` | ^16 / ^14 (xo-internal) |
| `tailwindcss` + `@tailwindcss/postcss` | ^4.2 |
| `next-themes` | ^0.4 |

The important takeaway: **there is no `framer-motion`, no GSAP, no custom animation engine.** The motion in xo-docs comes from three layers, in order of how much work they do:

1. Fumadocs UI's built-in component animations (the bulk of it).
2. Tailwind v4 transition utilities and the keyframes shipped in `fumadocs-ui/css/preset.css`.
3. A small amount of hand-written CSS transition in the site's own `global.css`.

## Layer 1: what Fumadocs animates for you

These are the animations a reader actually sees on an xo-docs page, all provided by `fumadocs-ui` out of the box (most are Radix primitives under the hood, so they are spring-free, transform and opacity based, and respect reduced-motion):

- **Sidebar nav tree.** Expanding and collapsing folders animates height and opacity. Nested groups use a Radix Accordion (accordion-down / accordion-up keyframes from the preset).
- **Search dialog (Cmd/Ctrl-K).** Fades and scales in over a backdrop, list items highlight on keyboard navigation. This is the single most "premium feeling" motion in a Fumadocs site.
- **Mobile navigation.** The hamburger menu opens a drawer that slides in, backdrop fades.
- **Table of contents scroll-spy.** As you scroll, the active heading marker moves to track the section you are in. The indicator transitions position rather than snapping.
- **Theme toggle.** `next-themes` swaps the light and dark token sets. Fumadocs typically sets `disableTransitionOnChange` so colors flip cleanly rather than smearing every element through a transition.
- **Links, cards, and callouts.** Hover and focus states transition (color, background, border). The `<Cards>` / `<Card>` components lift on hover.
- **Code blocks.** Copy button fade-in on hover, and tabbed code groups cross-fade between tabs. Highlighting is Shiki (static, build-time), so the color is not animated.
- **Accordions and tabs in MDX content** (`<Accordions>`, `<Tabs>`) use the same Radix open/close transitions.
- **Page transitions.** Navigating between docs pages fades the content area in.

Because these are framework defaults, you generally tune them by overriding CSS variables and a few utility classes, not by writing animation code.

## Layer 2: Tailwind v4 plus the Fumadocs preset

`fumadocs-ui/css/preset.css` registers the keyframes the components reference (accordion open/close, dialog enter/exit, fade and zoom). Tailwind v4 provides the `transition`, `duration`, `ease`, and `animate` utilities the markup uses. XO sites do not add a custom keyframe library on top, the preset is enough.

## Layer 3: XO's own CSS

The XO customization is deliberately light. In `xo-data-room/app/global.css` the only hand-written motion is short, tasteful state transitions:

```css
transition: border-color 0.15s ease, background-color 0.15s ease;
```

The rest of the XO layer is not animation at all, it is theming: redefining the Fumadocs design tokens to the brand. xo-data-room sets `--color-fd-primary` to the XO lime `#83d63a` in dark mode (and a darkened `#65a830` in light mode for contrast); xo-internal uses the desaturated internal green `hsl(145 18% 30%)` so team docs read differently from public ones. Both flip a full token set between light and dark (`--fd-background`, `--fd-foreground`, `--fd-muted`, `--fd-accent`, and so on), and that token swap is what gives the smooth theme change.

So the XO recipe for a docs site is: take Fumadocs' motion as-is, restyle the tokens to the brand, and add only a couple of 0.15s ease hover transitions.

## The one custom XO animation worth copying

If you want a genuinely XO-native motion (not a Fumadocs default) to reference, it lives in `xo-swarm`, not in the docs sites: the **presence-waves** overlay (`components/presence-waves.tsx` + `.xo-presence` in `app/globals.css`). It is a good model because it is calm, ambient, brand-colored, and accessible, exactly the qualities the visualizer wants. The mechanics:

- Three fixed, full-screen, `pointer-events-none` layers, each a soft radial gradient in the brand green at very low alpha (7%, 5%, 4%).
- `mix-blend-mode: screen` so the layers add light rather than paint over content.
- Each layer drifts on its own slow loop: `14s`, `19s`, `24s`, all `ease-in-out infinite`, translating a few percent and scaling between 1.0 and ~1.12.
- The whole overlay fades in over `1.4s` only when something is active (`data-active="true"`), and it is fully disabled under `@media (prefers-reduced-motion: reduce)`.

```css
.xo-presence__layer--a {
  background: radial-gradient(circle at 30% 35%, hsl(92 66% 53% / 7%), transparent 60%);
  animation: xo-presence-drift-a 14s ease-in-out infinite;
}
@keyframes xo-presence-drift-a {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50%      { transform: translate3d(4%, -3%, 0) scale(1.12); }
}
```

## Lessons for the visualizer

1. **Restraint reads as quality.** xo-docs feels polished because it animates a few things well (search, sidebar, theme) and leaves everything else still. Do not over-animate the visualizer either.
2. **Transform and opacity only.** Every motion above animates `transform` and `opacity`, the two properties the compositor can move without layout or paint. Keep the visualizer's CSS chrome on the same diet.
3. **Slow, offset, looping ambient motion** (the presence-waves pattern: long durations, per-layer phase offset, `ease-in-out`) is the XO house style for "alive but calm". The breathing ripple in the commit wave is the same idea.
4. **Theme via tokens, brand via one accent.** Drive everything off CSS variables and spend color carefully (the lime accent, green for additions, red for deletions), exactly as the docs spend their single `--color-fd-primary`.
5. **Always gate on `prefers-reduced-motion`.** Both the docs defaults and the presence-waves do. The visualizer should too.
