// Runtime: one paused GSAP timeline. Element motion is tweened; continuous effects
// (year counter, ops index, playhead, chroma, grain, flicker, flash, theme) are pure
// functions of time, written by a single scene-ticker. Seek-safe and deterministic.
(function () {
  const D = window.FILM_DATA;
  const root = document.getElementById("root");
  const tl = gsap.timeline({ paused: true });
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const THEMES = {
    dark: {
      "--bg": "#0b0906", "--ink": "#dcb86e", "--ink2": "rgba(220,184,110,.62)", "--con": "rgba(220,184,110,.30)",
      "--acc": "#ffe3a3", "--txt": "#eed9a8", "--txt2": "#bb9d65", "--paperop": "0", "--ghostop": ".08", "--grainop": ".13",
      "--flashc": "#fff3d6", "--vig": "rgba(0,0,0,.62)", "--accf": "url(#glow)",
      "--dgf": "drop-shadow(0 0 3px rgba(255,196,110,.35))",
    },
    paper: {
      "--bg": "#e3d2ad", "--ink": "#3a2714", "--ink2": "rgba(58,39,20,.66)", "--con": "rgba(58,39,20,.32)",
      "--acc": "#9a2c14", "--txt": "#24170a", "--txt2": "#452f16", "--paperop": "1", "--ghostop": ".045", "--grainop": ".16",
      "--flashc": "#fffaf0", "--vig": "rgba(70,40,12,.22)", "--accf": "none", "--dgf": "none",
    },
  };

  // ---------- helpers ----------
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut3 = (p) => 1 - Math.pow(1 - p, 3);
  const xOf = (y) => clamp(1 - Math.log(D.axisNow - Math.min(y, D.axisNow - 1)) / Math.log(D.axisSpan), 0, 1);
  const fmtYear = (y) => (y < 0 ? Math.round(-y) + " BC" : Math.max(1, Math.round(y)) + " AD");

  const scenes = D.segs.filter((s) => s.kind === "scene");
  const cards = D.segs.filter((s) => s.kind === "card");
  const endSeg = D.segs.find((s) => s.kind === "end");
  const cuts = D.segs.filter((s) => s.start > 0).map((s) => ({ t: s.start, amp: s.kind === "scene" ? 9 : s.kind === "card" ? 20 : 26, flash: s.kind !== "scene" }));
  const START_YEAR = -2600;

  // ---------- per-scene choreography ----------
  function drawOn(els, at, dur, amount, ease) {
    if (!els.length) return;
    tl.fromTo(els, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: dur, ease: ease || "power2.out", stagger: { each: amount / Math.max(1, els.length), from: "start" } }, at);
  }
  const SHAPE_SEL = "path,line,circle,ellipse,rect,polyline,polygon";

  function diagram(scope, S, T) {
    const svg = $(".dg-svg", scope);
    if (!svg) return;
    const L = (c) => { const g = $("." + c, svg); return g ? $$(SHAPE_SEL, g) : []; };
    drawOn(L("L-con"), S + 0.02, 0.8, Math.min(0.9, T * 0.18), "power1.inOut");
    drawOn(L("L-main"), S + 0.2, 0.75, T * 0.34, "power2.inOut");
    drawOn(L("L-detail"), S + 0.55, 0.45, T * 0.36, "power1.out");
    const acc = L("L-acc");
    drawOn(acc, S + T * 0.5, 0.7, 0.35, "expo.out");
    const accG = $(".L-acc", svg);
    if (accG) tl.fromTo(accG, { opacity: 0.55 }, { opacity: 1, duration: 0.25, repeat: 3, yoyo: true, ease: "sine.inOut" }, S + T * 0.5 + 0.4);
    const labels = $$(".L-lbl text", svg);
    if (labels.length) tl.fromTo(labels, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none", stagger: Math.min(0.08, (T * 0.3) / labels.length) }, S + T * 0.32);
    $$(".spin", svg).forEach((g) => {
      const o = g.dataset.cx + " " + g.dataset.cy, deg = +g.dataset.deg || 0;
      tl.fromTo(g, { rotation: 0, svgOrigin: o }, { rotation: deg, svgOrigin: o, duration: T, ease: "none" }, S);
    });
  }

  function camera(cam, S, T, i) {
    const dir = i % 2 ? 1 : -1;
    tl.fromTo(cam, { scale: 1.09, rotation: dir * 0.6, y: 18 }, { scale: 1.0, rotation: 0, y: 0, duration: 0.9, ease: "expo.out" }, S);
    tl.to(cam, { scale: 1.035, y: -10, duration: T - 0.9, ease: "none" }, S + 0.9);
  }

  function caption(id, S, T) {
    tl.fromTo(`#${id}-year`, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, S + 0.1);
    tl.fromTo(`#${id}-rule`, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "expo.inOut" }, S + 0.15);
    tl.fromTo(`#${id}-title`, { opacity: 0, y: 26, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.55, ease: "power3.out" }, S + 0.3);
    tl.fromTo(`#${id}-line`, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, S + 0.6);
        tl.fromTo(`#${id}-ghost`, { y: 30 }, { y: -30, duration: T, ease: "none" }, S);
  }

  scenes.forEach((seg, i) => {
    const el = document.getElementById("s" + seg.id);
    diagram(el, seg.start, seg.dur);
    camera($(".cam", el), seg.start, seg.dur, i);
    caption("s" + seg.id, seg.start, seg.dur);
  });

  // letter-spread entrance on per-glyph spans (transform only)
  function spread(sel, at, dur, px) {
    const gl = $$(sel + " .gl"), mid = (gl.length - 1) / 2;
    gl.forEach((g, i) => tl.fromTo(g, { x: (i - mid) * px, opacity: 0 }, { x: 0, opacity: 1, duration: dur, ease: "expo.out" }, at + Math.abs(i - mid) * 0.02));
  }

  // ---------- title ----------
  (function () {
    const el = document.getElementById("title");
    const T = D.segs[0].dur;
    diagram(el, 0.3, T - 0.3);
    tl.fromTo("#title-cam", { scale: 1.12, opacity: 0 }, { scale: 1.0, opacity: 1, duration: 2.4, ease: "power2.out" }, 0);
    tl.to("#title-cam", { scale: 1.04, duration: T - 2.4, ease: "none" }, 2.4);
    tl.fromTo("#plate rect, #plate path, #plate circle", { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", stagger: 0.04 }, 0.2);
    tl.fromTo("#plate text", { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.15 }, 1.2);
    tl.fromTo("#t-greek", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.9);
    spread("#t-word", 1.0, 1.8, 34);
    tl.fromTo("#t-rule", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "expo.inOut" }, 1.6);
    tl.fromTo("#t-sub", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 2.1);
    tl.fromTo("#t-quote", { opacity: 0 }, { opacity: 1, duration: 1.0, ease: "none" }, 3.0);
    tl.fromTo("#hud", { opacity: 0 }, { opacity: 1, duration: 1.0, ease: "power1.inOut" }, 3.6);
  })();

  // ---------- chapter cards ----------
  cards.forEach((seg) => {
    const n = seg.ch, S = seg.start, T = seg.dur;
    tl.fromTo(`#c${n}-orn circle, #c${n}-orn line`, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut", stagger: 0.12 }, S);
    tl.fromTo(`#c${n}-orn`, { rotation: -8, scale: 0.94 }, { rotation: 4, scale: 1.02, duration: T, ease: "none" }, S);
    tl.fromTo(`#c${n}-roman`, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, S + 0.1);
    tl.fromTo(`#c${n}-word`, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" }, S + 0.05);
    spread(`#c${n}-word`, S + 0.05, 0.9, 26);
    tl.to(`#c${n}-word`, { scale: 1.05, duration: T - 0.95, ease: "none" }, S + 0.95);
    tl.fromTo(`#c${n}-gloss`, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, S + 0.55);
  });

  // ---------- end ----------
  (function () {
    const S = endSeg.start, T = endSeg.dur;
    tl.to("#hud", { opacity: 0, duration: 0.6, ease: "power1.in" }, S);
    tl.to("#plate", { opacity: 0, duration: 0.4 }, S);
    tl.fromTo("#end-orn circle, #end-orn line", { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", stagger: 0.2 }, S + 0.1);
    tl.fromTo("#end-orn", { rotation: 0 }, { rotation: 30, duration: T, ease: "none" }, S);
    tl.fromTo("#end-word", { opacity: 0, scale: 1.4, filter: "blur(18px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.4, ease: "expo.out" }, S + 0.3);
    tl.to("#end-word", { scale: 1.06, duration: T - 1.7, ease: "none" }, S + 1.7);
    tl.fromTo("#end-sub", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.0, ease: "power2.out" }, S + 1.6);
    tl.fromTo("#end-mark", { opacity: 0 }, { opacity: 1, duration: 1.0, ease: "none" }, S + 2.8);
    tl.to("#end .card-in", { opacity: 0, duration: 0.8, ease: "power1.in" }, S + T - 1.0);
  })();

  // ---------- scene-ticker ----------
  const hudCh = $("#hud-ch"), hudVal = $("#hud-val"), bars = $$("#hud-bar i"), plateFig = $("#plate-fig");
  const tlHead = $("#tl-head"), tlYear = $("#tl-year"), tlProg = $("#tl-prog");
  const caR = $("#ca-r"), caGB = $("#ca-gb"), grain = $("#grain"), flicker = $("#flicker"), flash = $("#flash"), content = $("#content");
  const dots = D.scenes.map((s) => ({ el: document.getElementById("tl-dot-" + s.id), id: s.id }));
  let lastTheme = null, lastCh = null, lastVal = null, lastYear = null, lastFig = null;

  function state(t) {
    let idx = -1;
    for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].start) idx = i;
    if (idx < 0) return { year: START_YEAR, ops: 0, idx };
    const cur = scenes[idx], prev = scenes[idx - 1];
    const p = easeOut3(clamp((t - cur.start) / 1.1, 0, 1));
    const py = prev ? prev.year : START_YEAR, po = prev ? prev.ops : 0;
    return { year: py + (cur.year - py) * p, ops: po + (cur.ops - po) * p, idx };
  }
  function chapterAt(t) {
    let c = 1;
    for (const s of cards) if (t >= s.start) c = s.ch;
    return c;
  }

  function render(t) {
    // theme
    const ch = chapterAt(t);
    const theme = t >= cards[0].start && t < endSeg.start ? D.chapters[ch - 1].theme : "dark";
    if (theme !== lastTheme) { const v = THEMES[theme]; for (const k in v) root.style.setProperty(k, v[k]); lastTheme = theme; }
    const chKey = t < cards[0].start ? 0 : ch;
    if (chKey !== lastCh) { const c = D.chapters[ch - 1]; hudCh.textContent = chKey ? c.roman + " · " + c.word : "PROLOGVS"; lastCh = chKey; }

    // year + ops
    const st = state(t);
    const x = D.tl.x + D.tl.w * xOf(st.year);
    tlHead.setAttribute("transform", "translate(" + x.toFixed(1) + " 0)");
    tlProg.setAttribute("x2", x.toFixed(1));
    const ys = fmtYear(st.year);
    if (ys !== lastYear) { tlYear.textContent = ys; lastYear = ys; }
    const e = Math.floor(st.ops + 1e-6), m = Math.pow(10, st.ops - e);
    const vs = m.toFixed(1) + "×10<sup>" + e + "</sup>";
    if (vs !== lastVal) {
      hudVal.innerHTML = vs; lastVal = vs;
      const lit = Math.round((st.ops / 20) * bars.length);
      bars.forEach((b, i) => b.classList.toggle("on", i < lit));
    }
    const fig = st.idx >= 0 ? "FIG. " + D.scenes[st.idx].id + " / " + D.scenes.length : "FIG. 00";
    if (fig !== lastFig) { plateFig.textContent = fig; lastFig = fig; }
    dots.forEach((d, i) => d.el.classList.toggle("on", i <= st.idx));

    // cut-driven effects: chroma spike, shake, flash
    let spike = 0, fl = 0, sh = 0, cutT = 0;
    for (const c of cuts) {
      if (t >= c.t && t - c.t < 1.5) {
        const k = Math.exp(-(t - c.t) * 7);
        spike = Math.max(spike, c.amp * k);
        sh = Math.max(sh, (c.amp / 3) * Math.exp(-(t - c.t) * 12));
        if (c.flash) fl = Math.max(fl, 0.8 * Math.exp(-(t - c.t) * 8));
        cutT = c.t;
      }
    }
    const frame = Math.floor(t * 30);
    const pk = lastTheme === "paper" ? 0.45 : 1;
    const dx = pk * (1.1 + spike + Math.sin(t * 1.7) * 0.35);
    caR.setAttribute("dx", dx.toFixed(2));
    caGB.setAttribute("dx", (-dx).toFixed(2));
    caR.setAttribute("dy", (spike * 0.15).toFixed(2));
    const jx = (hash(frame + cutT) - 0.5) * 2 * sh, jy = (hash(frame * 1.3 + 9) - 0.5) * 2 * sh;
    content.style.transform = sh > 0.05 ? "translate(" + jx.toFixed(1) + "px," + jy.toFixed(1) + "px)" : "none";
    flash.style.opacity = fl.toFixed(3);

    // film texture: grain jitter at 12 fps, projector flicker at 24
    const gf = Math.floor(t * 12);
    grain.style.transform = "translate(" + ((hash(gf) - 0.5) * 160).toFixed(0) + "px," + ((hash(gf + 50) - 0.5) * 160).toFixed(0) + "px)";
    flicker.style.opacity = (0.02 + 0.045 * hash(Math.floor(t * 24) + 3)).toFixed(3);
  }

  tl.to({ v: 0 }, { v: 1, duration: D.total, ease: "none", onUpdate: function () { render(tl.time()); } }, 0);
  render(0);
  window.__timelines["main"] = tl;
  tl.seek(0);
})();
