// Pedagogical optical text scanner inspired by the Tesseract OCR engine.
// Pipeline: render → binarize → segment → match templates → report confidence.
// Not the real Tesseract engine; a teaching toy that makes the stages visible.

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

/** Render uppercase text to an offscreen canvas and return ImageData + metrics.
 *  Classic document polarity: dark ink on light paper (required for the OCR stages). */
export function renderTextPlate(text, {
  width = 512,
  height = 160,
  fontSize = 48,
  padding = 24,
} = {}) {
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#eef2f8';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#0c1220';
  ctx.font = `700 ${fontSize}px "IBM Plex Mono", "SF Mono", Menlo, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const clean = String(text || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 24);
  ctx.fillText(clean || 'TESSERACT', padding, height / 2);
  const image = ctx.getImageData(0, 0, width, height);
  return { canvas: cv, image, text: clean || 'TESSERACT', width, height };
}

/** Convert RGBA ImageData to a binary mask (1 = ink, 0 = paper). */
export function binarize(image, threshold = 128) {
  const { data, width, height } = image;
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    mask[p] = lum > threshold ? 0 : 1;
  }
  return { mask, width, height };
}

/**
 * Connected-component style column segmentation for monospace-ish glyphs.
 * Returns bounding boxes [{x0,x1,y0,y1}] left-to-right.
 * Wide empty gaps become explicit space markers (box with zero height).
 */
export function segmentGlyphs({ mask, width, height }, minGap = 4, spaceGap = 14) {
  const colInk = new Uint8Array(width);
  for (let x = 0; x < width; x++) {
    let ink = 0;
    for (let y = 0; y < height; y++) ink += mask[y * width + x];
    colInk[x] = ink > 0 ? 1 : 0;
  }
  const boxes = [];
  let x = 0;
  // skip leading paper
  while (x < width && !colInk[x]) x++;
  while (x < width) {
    const x0 = x;
    while (x < width && colInk[x]) x++;
    // absorb tiny gaps inside a glyph
    let look = x;
    while (look < width && look - x < minGap) {
      if (colInk[look]) {
        x = look + 1;
        while (x < width && colInk[x]) x++;
        look = x;
      } else look++;
    }
    const x1 = x;
    let y0 = height, y1 = 0;
    for (let yy = 0; yy < height; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        if (mask[yy * width + xx]) {
          if (yy < y0) y0 = yy;
          if (yy > y1) y1 = yy;
        }
      }
    }
    if (x1 - x0 >= 2 && y1 >= y0) {
      boxes.push({ x0, x1, y0, y1: y1 + 1, space: false });
    }
    // measure following empty run; large gap => space
    const gapStart = x;
    while (x < width && !colInk[x]) x++;
    if (x < width && x - gapStart >= spaceGap) {
      boxes.push({ x0: gapStart, x1: x, y0: 0, y1: 0, space: true });
    }
  }
  return boxes;
}

/** Build binary templates at the same type size the plate uses, then downsample. */
function buildTemplates(size = 24, fontSize = 56) {
  const templates = {};
  const pad = 16;
  const big = Math.ceil(fontSize * 1.6) + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = big;
  cv.height = big;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  for (const ch of CHARSET) {
    if (ch === ' ') {
      templates[ch] = new Uint8Array(size * size);
      continue;
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, big, big);
    ctx.fillStyle = '#000';
    ctx.font = `700 ${fontSize}px "IBM Plex Mono", "SF Mono", Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, big / 2, big / 2 + 1);
    const img = ctx.getImageData(0, 0, big, big);
    // tight bbox of ink
    let x0 = big, x1 = 0, y0 = big, y1 = 0;
    const ink = new Uint8Array(big * big);
    for (let y = 0; y < big; y++) {
      for (let x = 0; x < big; x++) {
        const i = (y * big + x) * 4;
        const isInk = img.data[i] < 128 ? 1 : 0;
        ink[y * big + x] = isInk;
        if (isInk) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < x0) {
      templates[ch] = new Uint8Array(size * size);
      continue;
    }
    templates[ch] = resampleGlyph(ink, big, { x0, x1: x1 + 1, y0, y1: y1 + 1 }, size);
  }
  return { templates, size };
}

const TEMPLATE_CACHE = { ready: false, templates: null, size: 24, fontSize: 0 };

function ensureTemplates(fontSize = 56) {
  if (!TEMPLATE_CACHE.ready || TEMPLATE_CACHE.fontSize !== fontSize) {
    const built = buildTemplates(24, fontSize);
    TEMPLATE_CACHE.templates = built.templates;
    TEMPLATE_CACHE.size = built.size;
    TEMPLATE_CACHE.fontSize = fontSize;
    TEMPLATE_CACHE.ready = true;
  }
  return TEMPLATE_CACHE;
}

/** Letterbox a glyph crop into a fixed-size binary template (preserve aspect). */
function resampleGlyph(mask, width, box, size) {
  const out = new Uint8Array(size * size);
  const bw = Math.max(box.x1 - box.x0, 1);
  const bh = Math.max(box.y1 - box.y0, 1);
  const scale = Math.min((size - 2) / bw, (size - 2) / bh);
  const dw = bw * scale;
  const dh = bh * scale;
  const ox = (size - dw) / 2;
  const oy = (size - dh) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5 - ox) / scale;
      const v = (y + 0.5 - oy) / scale;
      if (u < 0 || v < 0 || u >= bw || v >= bh) {
        out[y * size + x] = 0;
        continue;
      }
      const sx = box.x0 + Math.floor(u);
      const sy = box.y0 + Math.floor(v);
      out[y * size + x] = mask[sy * width + sx] || 0;
    }
  }
  return out;
}

/** Dice coefficient on ink pixels, in [0,1]. */
function matchGlyph(sample, templates, size) {
  let best = { ch: '?', score: -1 };
  const runners = [];
  let sampleInk = 0;
  for (let i = 0; i < size * size; i++) sampleInk += sample[i];
  for (const [ch, t] of Object.entries(templates)) {
    if (ch === ' ') continue;
    let inter = 0, tInk = 0;
    for (let i = 0; i < size * size; i++) {
      tInk += t[i];
      if (sample[i] && t[i]) inter++;
    }
    const denom = sampleInk + tInk;
    const score = denom > 0 ? (2 * inter) / denom : 0;
    runners.push({ ch, score });
    if (score > best.score) best = { ch, score };
  }
  runners.sort((a, b) => b.score - a.score);
  return { ...best, alt: runners.slice(1, 4) };
}

/**
 * Full OCR pass. Returns plate metadata, boxes, recognized string, per-glyph scores.
 */
export function scanPlate(text, opts = {}) {
  const plate = renderTextPlate(text, opts);
  const binary = binarize(plate.image, opts.threshold ?? 128);
  const boxes = segmentGlyphs(binary);
  const fontSize = opts.fontSize ?? 56;
  const { templates, size } = ensureTemplates(fontSize);
  const glyphs = boxes.map((box, i) => {
    if (box.space) {
      const expected = plate.text[i] || ' ';
      return {
        i, box, expected, ch: ' ', score: 1, correct: expected === ' ', alt: [],
      };
    }
    const sample = resampleGlyph(binary.mask, binary.width, box, size);
    const match = matchGlyph(sample, templates, size);
    const expected = plate.text[i] || '?';
    return {
      i,
      box,
      expected,
      ch: match.ch,
      score: match.score,
      correct: match.ch === expected,
      alt: match.alt,
    };
  });
  const recognized = glyphs.map((g) => g.ch).join('');
  const mean = glyphs.length
    ? glyphs.reduce((s, g) => s + g.score, 0) / glyphs.length
    : 0;
  const accuracy = glyphs.length
    ? glyphs.filter((g) => g.correct).length / glyphs.length
    : 0;
  return {
    plate,
    binary,
    boxes,
    glyphs,
    recognized,
    meanConfidence: mean,
    accuracy,
    expected: plate.text,
  };
}

export { CHARSET };
