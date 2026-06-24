// Shared fractal engine primitives, extracted from FractalPlayground so both
// the math playground and the data-driven visualizers render with the same
// color/noise core. Pure and dependency-free: safe on server or client.

export type Palette = "aurora" | "ember" | "prism" | "noir";

export const PALETTES: Array<{ id: Palette; name: string }> = [
  { id: "aurora", name: "Aurora" },
  { id: "ember", name: "Ember" },
  { id: "prism", name: "Prism" },
  { id: "noir", name: "Noir" }
];

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// Deterministic hash-noise: the same input always yields the same value in [0, 1).
export function seedNoise(value: number) {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// HSL -> RGB without the css color engine, so canvas pixel writes stay fast.
export function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number
): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4))
  ];
}

// Escape-time / depth coloring used across the engine.
export function colorFor(
  iterations: number,
  smooth: number,
  limit: number,
  palette: Palette,
  shift: number
): [number, number, number] {
  if (iterations >= limit) {
    if (palette === "noir") {
      return [238, 239, 231];
    }
    return [7, 9, 12];
  }

  const t = smooth / limit;
  const glow = Math.pow(t, 0.42);
  const hueMap: Record<Palette, number> = {
    aurora: 146,
    ember: 10,
    prism: 218,
    noir: 0
  };
  const hue =
    palette === "noir"
      ? (shift + smooth * 0.35) % 360
      : (hueMap[palette] + shift + smooth * (palette === "prism" ? 7 : 3.4)) % 360;
  const saturation = palette === "noir" ? 12 : palette === "ember" ? 86 : 76;
  const lightness =
    palette === "noir"
      ? 18 + glow * 68
      : 16 + glow * (palette === "ember" ? 58 : 64);

  return hslToRgb(hue, saturation, lightness);
}

export const rgbCss = (color: [number, number, number], alpha = 1) =>
  alpha >= 1
    ? `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    : `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
