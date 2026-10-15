---
message: "Computing is one accelerating project: from counting stones to thinking machines"
format: 1080x1920
duration: 110s
mode: autonomous
---

# HEPHAESTUS: five thousand years of the thinking machine

Modeled on the "Prometheus" (Western Civilization) film: engraved plates drawing themselves on,
a log-scale year ruler along the bottom, a running ops/second index, Latin chapter cards,
chromatic aberration spikes on every cut, film grain and flicker. Aged paper for the mechanical
age (I to III), gold on black for the electric age (IV to VII). Scene length shrinks chapter by
chapter (5.5s to 4.0s) so the film itself accelerates.

Structure is generated: `src/film.mjs` (data + timing) and `src/build.mjs` write `index.html`;
`src/runtime.js` holds the single paused GSAP timeline plus one scene-ticker for the continuous
effects. Diagrams are layered SVGs in `assets/diagrams/` (L-con, L-main, L-detail, L-acc, L-lbl).
Monolithic by design: the HUD, ruler and effects span every scene on one clock.

Rules composed per scene: svg stroke draw-on (staggered by layer), camera push (expo settle then
linear drift), caption stack reveal (year slide, rule scaleX, title clip-path wipe, line fade),
parallax ghost numeral, gear spin, accent glow pulse.

| # | Segment | Year | Title |
|---|---------|------|-------|
| 0 | Title | | HEPHAESTUS, astrolabe plate |
| I | CALCULUS | c. 2500 BC, c. 100 BC | Abacus, Antikythera |
| II | MACHINA | 1642, 1804 | Pascaline, Jacquard loom |
| III | ANALYTICA | 1837, 1843 | Analytical Engine, Note G |
| IV | LOGOS | 1936, 1945 | Turing machine, ENIAC |
| V | SILICIUM | 1947, 1958, 1971 | Transistor, IC, Intel 4004 |
| VI | RETE | 1983, 1991, 2007 | TCP/IP, WWW, pocket computer |
| VII | MENS | 2012, 2017, 2026 | Deep learning, Transformer, reasoning machines |
| End | COGITO. | | |
