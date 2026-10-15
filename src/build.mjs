// Builds index.html from src/film.mjs + assets/diagrams/*.svg.
// Run: node src/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { W, H, FILM, CHAPTERS, SCENES, timing, yearToX } from "./film.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIAG = path.join(ROOT, "assets/diagrams");
const { segs, total } = timing();
const r1 = (n) => Math.round(n * 10) / 10;

// ---------- diagrams ----------
const SHAPES = /<(path|line|circle|ellipse|rect|polyline|polygon)\b(?![^>]*pathLength)/g;
function prepSvg(raw, extraClass = "") {
  let s = raw.replace(/<\?xml[^>]*>/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  s = s.replace(SHAPES, '<$1 pathLength="100"');
  s = s.replace(/<svg\b([^>]*)>/, (m, attrs) => {
    attrs = attrs.replace(/\s(width|height|class)="[^"]*"/g, "");
    return `<svg${attrs} class="dg-svg ${extraClass}" preserveAspectRatio="xMidYMid meet">`;
  });
  return s;
}
function loadDiagram(id) {
  const f = fs.readdirSync(DIAG).find((n) => n.startsWith(id + "-") && n.endsWith(".svg"));
  if (!f) {
    console.warn(`! missing diagram ${id}, using placeholder`);
    return prepSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none"><g class="L-con" stroke-width="1.2"><circle cx="500" cy="500" r="420"/></g><g class="L-main" stroke-width="2.6"><circle cx="500" cy="500" r="300"/></g><g class="L-detail" stroke-width="1.3"><line x1="200" y1="500" x2="800" y2="500"/></g><g class="L-acc" stroke-width="3.6"><circle cx="500" cy="500" r="40"/></g><g class="L-lbl"><text x="500" y="560" font-family="JetBrains Mono" font-size="22" text-anchor="middle" fill="currentColor">FIG. ${id}</text></g></svg>`,
    );
  }
  return prepSvg(fs.readFileSync(path.join(DIAG, f), "utf8"));
}

// ---------- procedural title plate: an astrolabe ----------
function astrolabe() {
  const cx = 500, cy = 500;
  const P = (r, a) => [r1(cx + r * Math.cos(a)), r1(cy + r * Math.sin(a))];
  const con = [], main = [], det = [], acc = [], lbl = [];
  con.push(`<line x1="40" y1="500" x2="960" y2="500"/>`, `<line x1="500" y1="40" x2="500" y2="960"/>`);
  for (const r of [455, 330, 150]) con.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
  con.push(`<line x1="${P(470, -Math.PI / 4).join('" y1="')}" x2="${P(470, (3 * Math.PI) / 4).join('" y2="')}"/>`);
  con.push(`<line x1="${P(470, Math.PI / 4).join('" y1="')}" x2="${P(470, (-3 * Math.PI) / 4).join('" y2="')}"/>`);
  for (const r of [430, 410, 380, 250, 60]) main.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
  // limb ticks
  let ticks = "";
  for (let i = 0; i < 360; i += 2) {
    const a = (i * Math.PI) / 180, len = i % 30 === 0 ? 30 : i % 10 === 0 ? 18 : 9;
    const [x1, y1] = P(430, a), [x2, y2] = P(430 - len, a);
    ticks += `M${x1} ${y1}L${x2} ${y2}`;
  }
  det.push(`<path d="${ticks}"/>`);
  // rete: eccentric ecliptic ring + star pointers
  det.push(`<circle cx="${cx}" cy="${cy - 70}" r="255"/>`);
  let star = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + 0.26;
    const [x1, y1] = P(250, a), [x2, y2] = P(372, a + 0.05), [x3, y3] = P(250, a + 0.1);
    star += `M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}`;
  }
  det.push(`<path d="${star}"/>`);
  // almucantars
  for (let k = 1; k <= 6; k++) det.push(`<ellipse cx="${cx}" cy="${cy + k * 18}" rx="${330 - k * 40}" ry="${300 - k * 42}"/>`);
  // hours
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    const [x1, y1] = P(60, a), [x2, y2] = P(250, a);
    det.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }
  // alidade (the pointer) as accent
  const [ax1, ay1] = P(440, -0.62), [ax2, ay2] = P(440, -0.62 + Math.PI);
  acc.push(`<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}"/>`, `<circle cx="${cx}" cy="${cy}" r="14"/>`);
  const labels = ["ORIENS", "MERIDIES", "OCCIDENS", "SEPTENTRIO"];
  labels.forEach((t, i) => {
    const [x, y] = P(485, (i * Math.PI) / 2);
    lbl.push(`<text x="${x}" y="${y + 7}" text-anchor="middle" font-family="JetBrains Mono" font-size="20" letter-spacing="3" fill="currentColor" transform="rotate(${i * 90 + 90} ${x} ${y})">${t}</text>`);
  });
  return prepSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
<g class="L-con" stroke-width="1.2">${con.join("")}</g>
<g class="L-main" stroke-width="2.6"><g class="spin" data-cx="500" data-cy="500" data-deg="-24">${main.join("")}</g></g>
<g class="L-detail" stroke-width="1.3"><g class="spin" data-cx="500" data-cy="500" data-deg="40">${det.join("")}</g></g>
<g class="L-acc" stroke-width="3.6"><g class="spin" data-cx="500" data-cy="500" data-deg="-70">${acc.join("")}</g></g>
<g class="L-lbl">${lbl.join("")}</g></svg>`);
}

// ---------- the surveyor's plate frame (persistent) ----------
const PL = { x: 60, y: 300, s: 960 };
function plateFrame() {
  const { x, y, s } = PL, e = [];
  e.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`);
  e.push(`<rect x="${x + 14}" y="${y + 14}" width="${s - 28}" height="${s - 28}"/>`);
  let t = "";
  for (let i = 0; i <= s - 28; i += 24) {
    const L = i % 120 === 0 ? 14 : 7;
    t += `M${x + 14 + i} ${y + 14}v${L}M${x + 14 + i} ${y + s - 14}v${-L}M${x + 14} ${y + 14 + i}h${L}M${x + s - 14} ${y + 14 + i}h${-L}`;
  }
  e.push(`<path class="thin" d="${t}"/>`);
  for (const [cx, cy] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) {
    e.push(`<path d="M${cx - 26} ${cy}h52M${cx} ${cy - 26}v52"/>`, `<circle cx="${cx}" cy="${cy}" r="9"/>`);
  }
  return `<svg id="plate" class="plate" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none">${e
    .join("")
    .replace(SHAPES, '<$1 pathLength="100"')}
  <text class="pl-t" x="${x + 30}" y="${y - 14}">LAT 35°52' N</text>
  <text class="pl-t" x="${x + s - 30}" y="${y - 14}" text-anchor="end">LON 23°19' E</text>
  <text class="pl-t" x="${x + 30}" y="${y + s + 32}">TABVLA MACHINARVM</text>
  <text class="pl-t" id="plate-fig" x="${x + s - 30}" y="${y + s + 32}" text-anchor="end">FIG. 00</text></svg>`;
}

// ---------- timeline ruler ----------
const TL = { x: 80, w: 920, y: 1768 };
function ruler() {
  const X = (yr) => r1(TL.x + TL.w * yearToX(yr));
  let minor = "", major = "";
  const years = [];
  for (let y = -2500; y < 0; y += 250) years.push(y);
  for (let y = 0; y < 1800; y += 50) years.push(y);
  for (let y = 1800; y < 2000; y += 10) years.push(y);
  for (let y = 2000; y <= 2030; y += 2) years.push(y);
  const majors = new Map([[-2500, "2500 BC"], [0, "0"], [1500, "1500"], [1000, "1000"], [1900, "1900"], [2000, "2000"], [2030, "NOW"]]);
  for (const y of years) {
    if (majors.has(y)) major += `M${X(y)} ${TL.y - 18}v36`;
    else minor += `M${X(y)} ${TL.y - 7}v14`;
  }
  const labels = [...majors].map(([y, t]) => `<text class="tl-lab" x="${X(y)}" y="${TL.y + 50}" text-anchor="middle">${t}</text>`).join("");
  const dots = SCENES.map((s) => `<circle class="tl-dot" id="tl-dot-${s.id}" cx="${X(s.year)}" cy="${TL.y}" r="6"/>`).join("");
  return `<svg id="ruler" viewBox="0 0 ${W} 240" width="${W}" height="240" style="top:${TL.y - 120}px" fill="none">
  <g transform="translate(0 ${120 - TL.y})">
    <line class="tl-base" x1="${TL.x}" y1="${TL.y}" x2="${TL.x + TL.w}" y2="${TL.y}"/>
    <line id="tl-prog" class="tl-prog" x1="${TL.x}" y1="${TL.y}" x2="${TL.x}" y2="${TL.y}"/>
    <path class="tl-minor" d="${minor}"/><path class="tl-major" d="${major}"/>
    ${labels}${dots}
    <g id="tl-head"><path class="tl-headp" d="M0 ${TL.y - 26}l-11 -18h22z"/><line class="tl-headl" x1="0" y1="${TL.y - 26}" x2="0" y2="${TL.y + 20}"/>
      <text id="tl-year" class="tl-year" x="0" y="${TL.y - 56}" text-anchor="middle">2600 BC</text></g>
  </g></svg>`;
}

// ---------- clips ----------
const glyphs = (w) => [...w].map((c) => `<span class="gl">${c}</span>`).join("");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function fitWord(word, maxW, maxSize, perChar = 0.9) {
  return Math.min(maxSize, Math.floor(maxW / (word.length * perChar)));
}

function sceneClip(seg) {
  const s = SCENES.find((x) => x.id === seg.id);
  return `
    <div id="s${s.id}" class="clip scene" data-start="${seg.start}" data-duration="${seg.dur}" data-track-index="1">
      <div class="ghost" id="s${s.id}-ghost">${CHAPTERS[s.ch - 1].roman}</div>
      <div class="cam" id="s${s.id}-cam">${loadDiagram(s.id)}</div>
      <div class="cap">
        <div class="cap-year" id="s${s.id}-year"><span class="yr">${esc(s.when)}</span><span class="era">${s.era}</span></div>
        <div class="cap-rule" id="s${s.id}-rule"></div>
        <div class="cap-title" id="s${s.id}-title">${esc(s.title)}</div>
        <div class="cap-line" id="s${s.id}-line">${esc(s.line)}</div>
      </div>
    </div>`;
}

function cardClip(seg) {
  const c = CHAPTERS[seg.ch - 1];
  const size = fitWord(c.word, 900, 190, 0.92);
  return `
    <div id="c${c.n}" class="clip card" data-start="${seg.start}" data-duration="${seg.dur}" data-track-index="2">
      <div class="card-in">
        <svg class="card-orn" id="c${c.n}-orn" viewBox="0 0 1000 1000" fill="none">
          <circle pathLength="100" cx="500" cy="500" r="470"/><circle pathLength="100" cx="500" cy="500" r="440"/>
          <line pathLength="100" x1="20" y1="500" x2="980" y2="500"/>
        </svg>
        <div class="card-roman" id="c${c.n}-roman">${c.roman}</div>
        <div class="card-word" id="c${c.n}-word" style="font-size:${size}px">${glyphs(c.word)}</div>
        <div class="card-gloss" id="c${c.n}-gloss">${esc(c.gloss)}</div>
      </div>
    </div>`;
}

function titleClip(seg) {
  const size = fitWord(FILM.title, 940, 130, 0.95);
  return `
    <div id="title" class="clip scene" data-start="${seg.start}" data-duration="${seg.dur}" data-track-index="1">
      <div class="cam" id="title-cam">${astrolabe()}</div>
      <div class="cap title-cap">
        <div class="t-greek" id="t-greek">${FILM.greek}</div>
        <div class="t-word" id="t-word" style="font-size:${size}px">${glyphs(FILM.title)}</div>
        <div class="cap-rule" id="t-rule"></div>
        <div class="t-sub" id="t-sub">${esc(FILM.subtitle)}</div>
        <div class="t-quote" id="t-quote">“${esc(FILM.quote)}” <span>${esc(FILM.quoteSrc)}</span></div>
      </div>
    </div>`;
}

function endClip(seg) {
  return `
    <div id="end" class="clip card end" data-start="${seg.start}" data-duration="${seg.dur}" data-track-index="2">
      <div class="card-in">
        <svg class="card-orn" id="end-orn" viewBox="0 0 1000 1000" fill="none">
          <circle pathLength="100" cx="500" cy="500" r="470"/><circle pathLength="100" cx="500" cy="500" r="300"/>
          <line pathLength="100" x1="20" y1="500" x2="980" y2="500"/><line pathLength="100" x1="500" y1="20" x2="500" y2="980"/>
        </svg>
        <div class="end-word" id="end-word">${FILM.end}</div>
        <div class="card-gloss" id="end-sub">${esc(FILM.endSub)}</div>
        <div class="end-mark" id="end-mark">${FILM.title} · MMXXVI</div>
      </div>
    </div>`;
}

const clips = segs
  .map((g) => (g.kind === "scene" ? sceneClip(g) : g.kind === "card" ? cardClip(g) : g.kind === "title" ? titleClip(g) : endClip(g)))
  .join("\n");

// ---------- page ----------
const DATA = {
  total,
  segs,
  scenes: SCENES.map((s) => ({ id: s.id, ch: s.ch, year: s.year, ops: s.ops })),
  chapters: CHAPTERS.map((c) => ({ n: c.n, roman: c.roman, word: c.word, theme: c.theme })),
  tl: TL,
  axisNow: 2030,
  axisSpan: 4630,
};

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Cinzel"; src: url("assets/fonts/cinzel-latin.woff2") format("woff2"); font-weight: 400 900; font-display: block; }
      @font-face { font-family: "EB Garamond"; font-style: italic; src: url("assets/fonts/ebgaramond-italic-latin.woff2") format("woff2"); font-weight: 400; font-display: block; unicode-range: U+0000-00FF, U+2000-206F; }
      @font-face { font-family: "EB Garamond"; font-style: italic; src: url("assets/fonts/ebgaramond-italic-greek.woff2") format("woff2"); font-weight: 400; font-display: block; unicode-range: U+0370-03FF, U+1F00-1FFF; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #0b0906; }
      #root {
        --bg: #0b0906; --ink: #dcb86e; --ink2: rgba(220,184,110,.62); --con: rgba(220,184,110,.30);
        --acc: #ffe3a3; --txt: #eed9a8; --txt2: #bb9d65; --paperop: 0; --ghostop: .08; --grainop: .13;
        --flashc: #fff3d6; --vig: rgba(0,0,0,.62); --accf: url(#glow); --dgf: drop-shadow(0 0 3px rgba(255,196,110,.35));
        position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--bg);
        font-family: "JetBrains Mono", monospace; color: var(--txt);
      }
      .layer { position: absolute; inset: 0; pointer-events: none; }
      #bgglow { background: radial-gradient(ellipse 70% 45% at 50% 40%, rgba(255,190,100,.10), transparent 70%); }
      #paper { opacity: var(--paperop); background: url("assets/tex/paper.jpg") center / 1080px 1920px no-repeat; }
      #content { position: absolute; inset: 0; filter: url(#ca); }
      .plate { position: absolute; left: 0; top: 0; }
      .plate rect, .plate path, .plate circle { stroke: var(--ink2); stroke-width: 2; stroke-dasharray: 100 100; }
      .plate path.thin { stroke-width: 1.4; }
      .pl-t { fill: var(--txt2); font: 400 20px "JetBrains Mono"; letter-spacing: 3px; }
      .scene, .card { position: absolute; inset: 0; }
      .ghost { position: absolute; left: 0; right: 0; top: 330px; text-align: center; font: 900 760px/1 "Cinzel"; color: var(--ink); opacity: var(--ghostop); }
      .cam { position: absolute; left: ${PL.x + 30}px; top: ${PL.y + 30}px; width: ${PL.s - 60}px; height: ${PL.s - 60}px; }
      .dg-svg { width: 100%; height: 100%; display: block; overflow: visible; filter: var(--dgf); }
      .dg-svg path, .dg-svg line, .dg-svg circle, .dg-svg ellipse, .dg-svg rect, .dg-svg polyline, .dg-svg polygon {
        stroke-dasharray: 100 100; stroke-linecap: butt; stroke-linejoin: round; vector-effect: none; }
      .dg-svg .L-con { stroke: var(--con); }
      .dg-svg .L-main { stroke: var(--ink); }
      .dg-svg .L-detail { stroke: var(--ink2); }
      .dg-svg .L-acc { stroke: var(--acc); filter: var(--accf); }
      .dg-svg .L-lbl { fill: var(--txt2); color: var(--txt2); }
      .dg-svg .L-lbl text { stroke: none; }
      .cap { position: absolute; left: 70px; right: 70px; top: ${PL.y + PL.s + 56}px; }
      .cap-year { display: flex; align-items: baseline; gap: 18px; }
      .cap-year .yr { font: 700 132px/1 "Cinzel"; letter-spacing: -0.01em; color: var(--txt); }
      .cap-year .era { font: 400 32px/1 "JetBrains Mono"; letter-spacing: 6px; color: var(--txt2); }
      .cap-rule { height: 3px; width: 100%; margin: 18px 0 20px; background: var(--ink2); transform-origin: 0 50%; }
      .cap-title { font: 700 52px/1.08 "Cinzel"; letter-spacing: .03em; text-transform: uppercase; color: var(--txt); max-width: 940px; }
      .cap-line { margin-top: 14px; font: italic 400 40px/1.22 "EB Garamond"; color: var(--txt2); max-width: 900px; }
      .title-cap { text-align: left; }
      .t-greek { font: italic 400 44px/1 "EB Garamond"; color: var(--txt2); margin-bottom: 8px; }
      .t-word { font-family: "Cinzel"; font-weight: 900; line-height: 1; letter-spacing: .06em; color: var(--txt); white-space: nowrap; }
      .t-sub { font: italic 400 44px/1.2 "EB Garamond"; color: var(--txt); }
      .t-quote { margin-top: 22px; font: italic 400 32px/1.3 "EB Garamond"; color: var(--txt2); max-width: 900px; }
      .t-quote span { display: block; margin-top: 6px; font: 400 22px "JetBrains Mono"; letter-spacing: 4px; text-transform: uppercase; }
      .card { background: var(--bg); }
      .card::before { content: ""; position: absolute; inset: 0; opacity: var(--paperop); background: url("assets/tex/paper.jpg") center / 1080px 1920px no-repeat; }
      .card-in { position: absolute; left: 0; right: 0; top: 460px; height: 1000px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .card-orn { position: absolute; left: 40px; top: 0; width: 1000px; height: 1000px; }
      .card-orn circle, .card-orn line { stroke: var(--con); stroke-width: 2; stroke-dasharray: 100 100; }
      .card-roman { font: 700 72px/1 "Cinzel"; color: var(--txt2); letter-spacing: .2em; margin-bottom: 26px; }
      .gl { display: inline-block; }
      .card-word { font-family: "Cinzel"; font-weight: 900; line-height: 1; letter-spacing: .08em; color: var(--txt); white-space: nowrap; }
      .card-gloss { margin-top: 30px; font: italic 400 50px/1.2 "EB Garamond"; color: var(--txt2); }
      .end-word { font: 900 170px/1 "Cinzel"; letter-spacing: .06em; color: var(--txt); }
      .end-mark { margin-top: 60px; font: 400 24px "JetBrains Mono"; letter-spacing: 8px; color: var(--txt2); }
      #hud { opacity: 0; }
      .hud-l { position: absolute; left: 70px; top: 96px; }
      .hud-name { font: 700 30px/1 "Cinzel"; letter-spacing: .42em; color: var(--txt); }
      .hud-ch { margin-top: 18px; font: 400 24px/1 "JetBrains Mono"; letter-spacing: 5px; color: var(--txt2); }
      .hud-r { position: absolute; right: 70px; top: 90px; text-align: right; }
      .hud-lab { font: 400 20px/1 "JetBrains Mono"; letter-spacing: 5px; color: var(--txt2); }
      .hud-val { margin-top: 10px; font: 700 50px/1 "JetBrains Mono"; color: var(--txt); font-variant-numeric: tabular-nums; }
      .hud-val sup { font-size: 30px; vertical-align: 22px; margin-left: 2px; }
      .hud-bar { margin: 14px 0 0 auto; width: 300px; height: 12px; display: flex; gap: 3px; }
      .hud-bar i { flex: 1; height: 100%; border: 1.5px solid var(--ink2); }
      .hud-bar i.on { background: var(--ink); border-color: var(--ink); }
      #ruler { position: absolute; left: 0; }
      .tl-base { stroke: var(--con); stroke-width: 2; }
      .tl-prog { stroke: var(--ink); stroke-width: 3; }
      .tl-minor { stroke: var(--ink2); stroke-width: 1.5; }
      .tl-major { stroke: var(--ink); stroke-width: 2.5; }
      .tl-lab { fill: var(--txt); font: 400 22px "JetBrains Mono"; letter-spacing: 1px; }
      .tl-dot { fill: var(--bg); stroke: var(--ink2); stroke-width: 2; }
      .tl-dot.on { fill: var(--ink); stroke: var(--ink); }
      .tl-headp { fill: var(--acc); }
      .tl-headl { stroke: var(--acc); stroke-width: 2; }
      .tl-year { fill: var(--txt); font: 700 26px "JetBrains Mono"; letter-spacing: 2px; }
      #frame { border: 2px solid var(--con); inset: 30px; }
      #grain { inset: -200px; opacity: var(--grainop); background: url("assets/tex/grain.png") 0 0 / 512px 512px repeat; }
      #vig { background: radial-gradient(ellipse 80% 70% at 50% 45%, transparent 55%, var(--vig) 100%); }
      #flicker { background: #000; opacity: 0; }
      #flash { background: var(--flashc); opacity: 0; mix-blend-mode: screen; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}" data-fps="30">
      <svg width="0" height="0" style="position:absolute" aria-hidden="true">
        <filter id="ca" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset id="ca-r" in="r" dx="1.5" dy="0" result="ro" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
          <feOffset id="ca-gb" in="gb" dx="-1.5" dy="0" result="gbo" />
          <feBlend in="ro" in2="gbo" mode="screen" />
        </filter>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </svg>
      <div id="bgglow" class="layer"></div>
      <div id="paper" class="layer"></div>
      <div id="vig" class="layer" data-layout-ignore></div>
      <div id="content">
        ${plateFrame()}
        ${clips}
      </div>
      <div id="hud" class="layer">
        <div class="hud-l"><div class="hud-name">${FILM.title}</div><div class="hud-ch" id="hud-ch">I · CALCULUS</div></div>
        <div class="hud-r"><div class="hud-lab">OPS / SECOND</div><div class="hud-val" id="hud-val">1.0×10<sup>0</sup></div>
          <div class="hud-bar" id="hud-bar">${"<i></i>".repeat(20)}</div></div>
        ${ruler()}
      </div>
      <div id="frame" class="layer" data-layout-ignore></div>
      <div id="grain" class="layer" data-layout-ignore></div>
      <div id="flicker" class="layer" data-layout-ignore></div>
      <div id="flash" class="layer" data-layout-ignore></div>
    </div>
    <script>
      window.FILM_DATA = ${JSON.stringify(DATA)};
    </script>
    <script>
${fs.readFileSync(path.join(ROOT, "src/runtime.js"), "utf8")}
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(ROOT, "index.html"), html);
console.log(`index.html written: ${segs.length} segments, total ${total}s, ${(html.length / 1024).toFixed(0)} KB`);
