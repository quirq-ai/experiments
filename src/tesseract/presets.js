// Destinations for the Tesseract Lab's three meanings.

export const PRESETS = [
  // ---- Hypercube / Interstellar lattice ----
  {
    id: 'inter-drift',
    family: 'hypercube',
    name: 'Bulk drift',
    blurb: 'Cooper floating the void: bedroom moments stacked along world-lines. Time is a corridor you drift through.',
    params: {
      auto: true,
      fly: true,
      speed: 0.55,
      pulse: 1.1,
      extent: 5,
      spacing: 7.2,
    },
    camera: { pos: [0.4, 1.4, 3.2], target: [0, 0.5, -14] },
  },
  {
    id: 'inter-corridor',
    family: 'hypercube',
    name: 'Time corridor',
    blurb: 'Look straight down the Z world-line. Rooms stream past as discrete moments of one bedroom.',
    params: {
      auto: true,
      fly: true,
      speed: 0.85,
      pulse: 1.4,
      extent: 4,
      spacing: 6.6,
    },
    camera: { pos: [0, 1.1, 4.5], target: [0, 0.4, -18] },
  },
  {
    id: 'inter-wide',
    family: 'hypercube',
    name: 'Open lattice',
    blurb: 'Wide alternating lattice. Warm bookshelf rooms on cool beams: the Double Negative open-lattice silhouette.',
    params: {
      auto: true,
      fly: false,
      speed: 0.35,
      pulse: 0.9,
      extent: 6,
      spacing: 7.8,
    },
    camera: { pos: [11, 7, 14], target: [0, 0, 0] },
  },
  {
    id: 'inter-held',
    family: 'hypercube',
    name: 'Held moment',
    blurb: 'Frozen mid-drift. Orbit the lattice yourself and read the world-lines between rooms.',
    params: {
      auto: false,
      fly: false,
      speed: 0,
      pulse: 0.7,
      extent: 5,
      spacing: 7.2,
    },
    camera: { pos: [8, 5, 10], target: [0, 0, -2] },
  },

  // ---- Scanner (optical text recognition) ----
  {
    id: 'ocr-hello',
    family: 'scanner',
    name: 'Scan · HELLO',
    blurb: 'Optical text pipeline: render → binarize → segment → template match. Inspired by HP Labs\' Tesseract OCR.',
    params: { text: 'HELLO', threshold: 128, scanSpeed: 1 },
    camera: { pos: [0, 2, 14], target: [0, 0, 0] },
  },
  {
    id: 'ocr-tess',
    family: 'scanner',
    name: 'Scan · TESSERACT',
    blurb: 'Nine glyphs through the recognizer. Watch confidence per character and the sweep bar.',
    params: { text: 'TESSERACT', threshold: 128, scanSpeed: 0.85 },
    camera: { pos: [0, 2, 14], target: [0, 0, 0] },
  },
  {
    id: 'ocr-4d',
    family: 'scanner',
    name: 'Scan · 4D CUBE',
    blurb: 'Mixed letters and digits. Wrong guesses show up when template overlap is ambiguous.',
    params: { text: '4D CUBE', threshold: 120, scanSpeed: 1.1 },
    camera: { pos: [0, 2, 14], target: [0, 0, 0] },
  },

  // ---- Artifact (sci-fi magic cube) ----
  {
    id: 'art-awaken',
    family: 'artifact',
    name: 'Awakening',
    blurb: 'Nested cubes folding through a phantom fourth axis. The Cosmic Cube / Space Stone silhouette.',
    params: {
      nest: 4,
      pulse: 1,
      energy: 1.1,
      fold: 0.85,
      auto: true,
      speed: 0.5,
    },
    camera: { pos: [5, 4, 7], target: [0, 0, 0] },
  },
  {
    id: 'art-storm',
    family: 'artifact',
    name: 'Power storm',
    blurb: 'High-energy ribbons along every edge. Drag to orbit the core.',
    params: {
      nest: 5,
      pulse: 1.6,
      energy: 1.8,
      fold: 1.2,
      auto: true,
      speed: 0.85,
    },
    camera: { pos: [6, 5, 8], target: [0, 0, 0] },
  },
  {
    id: 'art-dormant',
    family: 'artifact',
    name: 'Dormant relic',
    blurb: 'Quiet nested cages. Slow fold, low glow: a cube waiting for a hand.',
    params: {
      nest: 3,
      pulse: 0.35,
      energy: 0.55,
      fold: 0.4,
      auto: true,
      speed: 0.2,
    },
    camera: { pos: [4.5, 3.5, 6], target: [0, 0, 0] },
  },
];

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}
