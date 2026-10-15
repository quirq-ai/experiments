// Film data: chapters, scenes, and the derived timing. Everything the build and the page need.

export const W = 1080;
export const H = 1920;

export const FILM = {
  title: "HEPHAESTUS",
  greek: "Ἥφαιστος",
  subtitle: "Five thousand years of the thinking machine",
  quote: "Golden handmaids, forged by Hephaestus: in them is understanding.",
  quoteSrc: "Homer, Iliad XVIII",
  end: "COGITO.",
  endSub: "The machine learns to think.",
};

// theme: which chapters sit on aged paper (the mechanical age) vs gold on black (the electric age)
export const CHAPTERS = [
  { n: 1, roman: "I", word: "CALCULUS", gloss: "the pebble", theme: "paper" },
  { n: 2, roman: "II", word: "MACHINA", gloss: "the mechanism", theme: "paper" },
  { n: 3, roman: "III", word: "ANALYTICA", gloss: "the engine", theme: "paper" },
  { n: 4, roman: "IV", word: "LOGOS", gloss: "reason, made electric", theme: "dark" },
  { n: 5, roman: "V", word: "SILICIUM", gloss: "the crystal", theme: "dark" },
  { n: 6, roman: "VI", word: "RETE", gloss: "the net", theme: "dark" },
  { n: 7, roman: "VII", word: "MENS", gloss: "the mind", theme: "dark" },
];

// ops: log10 of the fastest machine's operations per second at that date (order of magnitude)
export const SCENES = [
  { id: "01", ch: 1, year: -2500, when: "c. 2500", era: "BC", title: "The Abacus", line: "Pebbles on ruled lines. The first memory outside the mind.", ops: 0.0, dur: 5.5 },
  { id: "02", ch: 1, year: -100, when: "c. 100", era: "BC", title: "The Antikythera Mechanism", line: "Thirty bronze gears predict the sky.", ops: 0.0, dur: 5.5 },
  { id: "03", ch: 2, year: 1642, when: "1642", era: "AD", title: "The Pascaline", line: "A teenage Pascal turns arithmetic into brass.", ops: 0.2, dur: 5.5 },
  { id: "04", ch: 2, year: 1804, when: "1804", era: "AD", title: "The Jacquard Loom", line: "A chain of punched cards tells a machine what to do.", ops: 0.3, dur: 5.5 },
  { id: "05", ch: 3, year: 1837, when: "1837", era: "AD", title: "The Analytical Engine", line: "Babbage designs a mill and a store: a general computer, in brass.", ops: 0.4, dur: 5.0 },
  { id: "06", ch: 3, year: 1843, when: "1843", era: "AD", title: "Note G", line: "Ada Lovelace writes the first program, for a machine never built.", ops: 0.4, dur: 5.0 },
  { id: "07", ch: 4, year: 1936, when: "1936", era: "AD", title: "The Turing Machine", line: "An endless tape, a reading head, and the limits of all computation.", ops: 0.5, dur: 5.0 },
  { id: "08", ch: 4, year: 1945, when: "1945", era: "AD", title: "ENIAC", line: "17,468 vacuum tubes. Five thousand additions a second.", ops: 3.7, dur: 5.0 },
  { id: "09", ch: 5, year: 1947, when: "1947", era: "AD", title: "The Transistor", line: "At Bell Labs, the switch shrinks to a crystal of germanium.", ops: 3.8, dur: 4.5 },
  { id: "10", ch: 5, year: 1958, when: "1958", era: "AD", title: "The Integrated Circuit", line: "Kilby puts every part on one chip. The circuit becomes an object.", ops: 4.6, dur: 4.5 },
  { id: "11", ch: 5, year: 1971, when: "1971", era: "AD", title: "Intel 4004", line: "2,300 transistors on a sliver of silicon. A computer on a chip.", ops: 7.6, dur: 4.5 },
  { id: "12", ch: 6, year: 1983, when: "1983", era: "AD", title: "TCP/IP", line: "ARPANET adopts one protocol. The internet is born.", ops: 8.6, dur: 4.2 },
  { id: "13", ch: 6, year: 1991, when: "1991", era: "AD", title: "The World Wide Web", line: "At CERN, pages begin to link to pages.", ops: 10.2, dur: 4.2 },
  { id: "14", ch: 6, year: 2007, when: "2007", era: "AD", title: "The Pocket Computer", line: "Billions now carry a networked computer everywhere they go.", ops: 14.7, dur: 4.2 },
  { id: "15", ch: 7, year: 2012, when: "2012", era: "AD", title: "Deep Learning", line: "Neural networks, trained on graphics chips, learn to see.", ops: 16.2, dur: 4.0 },
  { id: "16", ch: 7, year: 2017, when: "2017", era: "AD", title: "The Transformer", line: "Attention is all you need.", ops: 17.0, dur: 4.0 },
  { id: "17", ch: 7, year: 2026, when: "2026", era: "AD", title: "Machines That Reason", line: "The written record of humanity, distilled into a mind of silicon.", ops: 18.2, dur: 5.5 },
];

export const TITLE_DUR = 6.0;
export const CARD_DUR = 2.2;
export const END_DUR = 7.0;

export function timing() {
  const segs = [];
  let t = 0;
  segs.push({ kind: "title", start: 0, dur: TITLE_DUR });
  t += TITLE_DUR;
  for (const ch of CHAPTERS) {
    segs.push({ kind: "card", ch: ch.n, start: +t.toFixed(3), dur: CARD_DUR });
    t += CARD_DUR;
    for (const s of SCENES.filter((x) => x.ch === ch.n)) {
      segs.push({ kind: "scene", id: s.id, ch: ch.n, start: +t.toFixed(3), dur: s.dur, year: s.year, ops: s.ops });
      t += s.dur;
    }
  }
  segs.push({ kind: "end", start: +t.toFixed(3), dur: END_DUR });
  t += END_DUR;
  return { segs, total: +t.toFixed(3) };
}

// Log time axis: the ancient past compresses, the present stretches. NOW sits at 2030.
export const AXIS = { now: 2030, span: 2030 + 2600 };
export function yearToX(y) {
  const v = 1 - Math.log(AXIS.now - Math.min(y, AXIS.now - 1)) / Math.log(AXIS.span);
  return Math.max(0, Math.min(1, v));
}
