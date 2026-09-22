# Palette validation

Space Walk's data-encoding colours are **not** the xo-space brand tokens. They are
OKLCH derivations in the brand hues, chosen because the raw tokens fail as
categorical encodings on the night surface. This file is the evidence for that
claim and the procedure for re-checking it after any palette change.

## Why the brand tokens were not used directly

The xo-space UI palette (`space_ui/css/base.css`) is designed for text and chrome
on a dark surface, not for carrying identity across small marks in a 3D scene.
Fed to the validator as a four-class categorical set against the `#0b0c0f` sky, it
fails three of the five checks:

```
palette: #a2b56b (eng) · #9db8cc (res, lightened) · #a8d94f (accent) · #c8674c (mkt)
[FAIL] Lightness band      #a2b56b 0.741 · #9db8cc 0.769 · #a8d94f 0.824  (dark band is L 0.48–0.67)
[FAIL] Chroma floor        #9db8cc 0.041  (below ~0.10 — reads as grey, stops doing identity work)
[PASS] CVD separation      worst #a8d94f↔#a2b56b ΔE 9.8 (deutan) · tritan 5.0
[FAIL] Normal-vision floor worst #a8d94f↔#a2b56b ΔE 11.1 — below 15
[PASS] Contrast vs surface all 4 ≥ 3:1
```

The load-bearing failure is the last one: at ΔE 11.1 a viewer with full colour
vision cannot reliably tell *seen* from *edited*. Since those two states are the
whole point of the map — did the agent merely glance at this file, or change
it? — that is disqualifying regardless of how on-brand the hues are.

## What ships

Derived inside the dark-mode lightness band (L 0.48–0.67) with chroma at or above
the floor, holding the brand hue families and the salience order edit > read > seen.

| Role | Hex | OKLCH | Where |
|---|---|---|---|
| Touch: seen / hit | `#6a6700` | L 0.50 C 0.11 h 108 | `--touch-hit` |
| Touch: read | `#5399d1` | L 0.64 C 0.11 h 245 | `--touch-read` |
| Touch: edited | `#78a31e` | L 0.66 C 0.16 h 127 | `--touch-edit` |
| Action: verify | `#477120` | L 0.50 C 0.12 h 133 | `--act-verify` |
| Action: search | `#99927e` | warm neutral, chroma below floor **by design** | `--act-search` |
| Action: exec | `#57687d` | cool neutral, chroma below floor **by design** | `--act-exec` |
| Status: error | `#c8674c` | xo `--mkt`/`--err`, reserved status | `--alarm`, `EMBER` |
| Surface | `#0b0c0f` | xo `--bg` | `--sky`, `SKY` |

Validator results for the categorical sets that must be mutually distinguishable:

```
touch triad — #6a6700, #5399d1, #78a31e (--pairs all)
[PASS] lightness · [PASS] chroma · [PASS] CVD worst ΔE 16.1 deutan / 8.4 tritan
[PASS] normal-vision worst ΔE 17.4 · [PASS] contrast all ≥ 3:1     → ALL CHECKS PASS

action hue slots — #5399d1, #78a31e, #477120 (--pairs all)
[PASS] lightness · [PASS] chroma · [PASS] CVD worst ΔE 16.5 protan / 8.4 tritan
[PASS] normal-vision worst ΔE 16.6 · [PASS] contrast all ≥ 3:1     → ALL CHECKS PASS
```

Two deliberate exceptions, both inherited from upstream's design intent rather
than introduced here:

- **`--act-search` and `--act-exec` sit below the chroma floor on purpose.** The
  timeline encodes observation as the recessive "background hum" so that mutation
  reads as the signal; near-neutral is the point. They are never the only cue —
  the deck legend labels every class in text.
- **Scene tints run lighter than the flat HUD swatches** (`#a8a24e` seen,
  `#9dc0e8` read, `#a8d94f` edited in `web/src/scene/sceneUtils.ts`). Lit 3D
  geometry with additive halos is a different viewing context than a flat legend
  dot; the tints keep the same hue families and the same salience order.

Status colours (`#c8674c`) are validated within their own family, not against the
categorical triad — a reserved status colour is allowed to sit near an action hue
because it never competes with one for identity, and it always ships with a text
label.

## Re-running the checks

The validator is `scripts/validate_palette.js` from the `dataviz` skill bundle
(not vendored here — it lives with the skill):

```sh
node <dataviz-skill>/scripts/validate_palette.js \
  "#6a6700,#5399d1,#78a31e" --mode dark --surface "#0b0c0f" --pairs all
```

Thresholds it enforces: OKLCH L within 0.48–0.67 for dark mode, chroma ≥ ~0.10,
CVD ΔE ≥ 8 (floor 6, legal only with secondary encoding), normal-vision ΔE ≥ 15,
and ≥ 3:1 contrast against the surface. Any change to a `--touch-*` or `--act-*`
token should be re-run through it before shipping, and this file updated with the
new output.

## Known contrast note

`--touch-hit` (`#6a6700`) used as small text on a panel is roughly 3.2:1 — fine
for a legend swatch, below WCAG AA for body text. It is used as a text colour in
one place (the inspector's touch state), where the label is short and adjacent to
its own coloured dot.
