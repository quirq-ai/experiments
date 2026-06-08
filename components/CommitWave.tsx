"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Commit } from "@/lib/types";

type PlayState = "idle" | "playing" | "paused";

interface Props {
  commits: Commit[];
  branch: string;
  replaySignal: number;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}

const GREEN = "#5ef38b";
const RED = "#ff5d6c";

export function CommitWave({
  commits,
  branch,
  replaySignal,
  selectedIndex = null,
  onSelect,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [playState, setPlayState] = useState<PlayState>("idle");

  const st = useRef({
    W: 0,
    H: 0,
    dpr: 1,
    pad: 48,
    cx: [] as number[], // x per commit
    top: new Float32Array(0), // green height (px) per commit
    bot: new Float32Array(0), // red depth (px) per commit
    size: new Float32Array(0), // cumulative repo size (net lines) per commit
    maxSize: 1, // largest cumulative size, for normalizing the dots
    commits: [] as Commit[],
    branch: "",
    progress: 0, // float index of the traversal playhead during replay
    animating: false, // true while a replay is running OR paused mid-run
    speed: 0, // commits advanced per millisecond
    lastNow: 0, // timestamp baseline for the delta-based loop
    hover: -1,
    selected: -1, // pinned commit ("current state")
    t: 0, // seconds, drives the selected-commit pulse
    praf: 0, // rAF id for the selection pulse loop
    raf: 0,
  });

  // Imperative draw + playback API, populated once the canvas is mounted so the
  // data, replay, and control effects can drive it without prop churn.
  const api = useRef<{
    rebuild: () => void;
    render: () => void;
    play: () => void;
    pause: () => void;
    resume: () => void;
    restart: () => void;
    next: () => void;
    back: () => void;
    setSelected: (index: number) => void;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const tip = tipRef.current!;
    const ctx = canvas.getContext("2d")!;
    const s = st.current;
    s.dpr = Math.min(2, window.devicePixelRatio || 1);

    const ease = (x: number) => 1 - Math.pow(1 - x, 3);

    function rebuild() {
      const cs = s.commits;
      if (!s.W || cs.length === 0) {
        s.cx = [];
        s.top = new Float32Array(0);
        s.bot = new Float32Array(0);
        s.size = new Float32Array(0);
        s.maxSize = 1;
        return;
      }
      const pad = s.pad;
      const usableW = s.W - pad * 2;
      const n = cs.length;

      s.cx = cs.map((_, i) =>
        n > 1 ? pad + (i * usableW) / (n - 1) : pad + usableW / 2,
      );

      const pw = 0.6; // perceptual compression
      let maxNorm = 1;
      for (const c of cs) maxNorm = Math.max(maxNorm, c.add ** pw, c.del ** pw);

      const maxAmp = Math.max(40, s.H / 2 - 44);
      const top = new Float32Array(n);
      const bot = new Float32Array(n);
      // Cumulative repo size at each state: running sum of additions minus
      // deletions (net lines), floored at 0 since a repo cannot be negative.
      const size = new Float32Array(n);
      let run = 0;
      let maxSize = 1;
      for (let i = 0; i < n; i++) {
        top[i] = (cs[i].add ** pw / maxNorm) * maxAmp;
        bot[i] = (cs[i].del ** pw / maxNorm) * maxAmp;
        run = Math.max(0, run + cs[i].add - cs[i].del);
        size[i] = run;
        if (run > maxSize) maxSize = run;
      }
      s.top = top;
      s.bot = bot;
      s.size = size;
      s.maxSize = maxSize;
    }

    function render() {
      const W = s.W;
      const H = s.H;
      const baseY = H / 2;
      const n = s.cx.length;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#08090a";
      ctx.fillRect(0, 0, W, H);

      if (barRef.current && n > 1) {
        const p = s.animating ? s.progress / (n - 1) : 1;
        barRef.current.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
      }

      // pinned-commit light column: a soft full-height beam marking the
      // selected commit, drawn first so it reads like a spotlight behind the
      // wave. Shown during replay too, so the pin is always locatable.
      if (s.selected >= 0 && s.selected < n) {
        const x = s.cx[s.selected];
        const cp = 0.5 + 0.5 * Math.sin(s.t * 2.2);
        const halfW = 16;
        const beam = ctx.createLinearGradient(x - halfW, 0, x + halfW, 0);
        beam.addColorStop(0, "rgba(131,214,58,0)");
        beam.addColorStop(0.5, `rgba(131,214,58,${0.05 + 0.06 * cp})`);
        beam.addColorStop(1, "rgba(131,214,58,0)");
        ctx.fillStyle = beam;
        ctx.fillRect(x - halfW, 0, halfW * 2, H);
        ctx.strokeStyle = `rgba(234,255,240,${0.1 + 0.18 * cp})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      if (n >= 1) {
        // How far the traversal has grown. When idle, the whole history is
        // shown. During replay, commits 0..base are fully drawn and the next
        // one (the leading commit) grows in from the baseline. A stepped or
        // paused-on-integer position lands with the lead at 0, so commits up to
        // base read as full and resuming grows the next one cleanly.
        const base = s.animating ? Math.floor(s.progress) : n - 1;
        const last = s.animating ? Math.min(base + 1, n - 1) : n - 1;
        const leadFrac =
          s.animating && last !== base ? ease(s.progress - base) : 1;
        // the rightmost commit actually painted (skip the lead while it is ~0)
        const drawLast = leadFrac > 0.02 ? last : Math.min(base, n - 1);
        // grown amplitude for commit i (the leading commit eases up from 0)
        const gTop = (i: number) => (i === last ? s.top[i] * leadFrac : s.top[i]);
        const gBot = (i: number) => (i === last ? s.bot[i] * leadFrac : s.bot[i]);

        // Each commit is a dot on the line; green (additions) and red
        // (deletions) bloom outward from that dot as a soft footprint petal,
        // strongest at the dot and fading toward the tip.
        // With a single commit (HEAD only) there is no gap to divide by; fall
        // back to the full usable width so the lone dot is sized sensibly.
        const spacing =
          n > 1 ? (s.W - s.pad * 2) / (n - 1) : s.W - s.pad * 2;
        const w = Math.max(1.2, Math.min(5, spacing * 0.42));
        // Each dot's radius encodes the repo size at that state. Area is made
        // proportional to size (radius ~ sqrt(size)) so the dots read as a
        // growing mass, with a floor so early tiny states stay visible.
        const minR = Math.max(1, Math.min(2, spacing * 0.18));
        const maxR = Math.max(3, Math.min(9, spacing * 1.1));
        const radiusOf = (i: number) => {
          const f = Math.sqrt(Math.max(0, s.size[i] || 0) / s.maxSize); // 0..1
          const r = minR + (maxR - minR) * f;
          return i === last ? minR + (r - minR) * leadFrac : r;
        };

        const petal = (x: number, h: number, dir: number, rgb: string) => {
          if (h < 0.6) return;
          const tipY = baseY + dir * h;
          const g = ctx.createLinearGradient(0, baseY, 0, tipY);
          g.addColorStop(0, `rgba(${rgb},0.55)`);
          g.addColorStop(0.6, `rgba(${rgb},0.20)`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.beginPath();
          ctx.moveTo(x - w, baseY);
          ctx.quadraticCurveTo(x - w, baseY + dir * h * 0.55, x, tipY);
          ctx.quadraticCurveTo(x + w, baseY + dir * h * 0.55, x + w, baseY);
          ctx.closePath();
          ctx.fillStyle = g;
          ctx.fill();
        };

        for (let i = 0; i <= drawLast; i++) {
          petal(s.cx[i], gTop(i), -1, "94,243,139");
          petal(s.cx[i], gBot(i), 1, "255,93,108");
        }

        // the commit dots (sized by repo size at that state), sitting on the
        // baseline on top of the footprints
        ctx.fillStyle = "rgba(214,228,208,0.92)";
        for (let i = 0; i <= drawLast; i++) {
          ctx.beginPath();
          ctx.arc(s.cx[i], baseY, radiusOf(i), 0, 6.283);
          ctx.fill();
        }

        // traversal playhead: glow the commit dot currently growing in, with a
        // faint vertical guide spanning its footprint, so you can follow it.
        if (s.animating) {
          const x = s.cx[drawLast];
          const ta = gTop(drawLast);
          const ba = gBot(drawLast);
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, baseY - ta);
          ctx.lineTo(x, baseY + ba);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, baseY, radiusOf(drawLast) + 1.6, 0, 6.283);
          ctx.fillStyle = "#eafff0";
          ctx.shadowColor = GREEN;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // baseline
      ctx.strokeStyle = "rgba(131,214,58,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.pad, baseY);
      ctx.lineTo(W - s.pad, baseY);
      ctx.stroke();

      // hover guide + readout (idle only)
      if (!s.animating && s.hover >= 0 && s.hover < n) {
        const x = s.cx[s.hover];
        const ta = s.top[s.hover] || 0;
        const ba = s.bot[s.hover] || 0;
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, baseY - ta - 10);
        ctx.lineTo(x, baseY + ba + 10);
        ctx.stroke();
        for (const [y, color] of [
          [baseY - ta, GREEN],
          [baseY + ba, RED],
        ] as [number, string][]) {
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, 6.283);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        // highlight the commit dot itself, on the line
        ctx.beginPath();
        ctx.arc(x, baseY, 3, 0, 6.283);
        ctx.fillStyle = "#eafff0";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // selected commit ("current state"): a gentle pulse on its dot and
      // footprint. Runs during replay too; before the playhead reaches the
      // pinned commit its footprint is hidden and only the column + dot mark it.
      if (s.selected >= 0 && s.selected < n) {
        const x = s.cx[s.selected];
        const pulse = 0.5 + 0.5 * Math.sin(s.t * 2.2); // 0..1
        let ta = s.top[s.selected] || 0;
        let ba = s.bot[s.selected] || 0;
        if (s.animating) {
          const base = Math.floor(s.progress);
          const last = Math.min(base + 1, n - 1);
          if (s.selected > last) {
            ta = 0;
            ba = 0;
          } else if (s.selected === last && last !== base) {
            const frac = ease(s.progress - base);
            ta *= frac;
            ba *= frac;
          }
        }

        if (ta > 0 || ba > 0) {
          for (const [y, color] of [
            [baseY - ta, GREEN],
            [baseY + ba, RED],
          ] as [number, string][]) {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 6.283);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8 + 8 * pulse;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        // pulsing ring + bright core on the line dot
        ctx.beginPath();
        ctx.arc(x, baseY, 4 + 3 * pulse, 0, 6.283);
        ctx.strokeStyle = `rgba(234,255,240,${0.3 + 0.45 * pulse})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, baseY, 3, 0, 6.283);
        ctx.fillStyle = "#eafff0";
        ctx.shadowColor = GREEN;
        ctx.shadowBlur = 8 + 10 * pulse;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Delta-based loop so the traversal can be paused and resumed without
    // losing its place. Speed is set once per run from the commit count.
    function frame(now: number) {
      const n = s.cx.length;
      if (s.lastNow === 0) s.lastNow = now;
      // Clamp the delta so a backgrounded tab (where rAF is throttled/paused)
      // resumes smoothly on return instead of skipping the elapsed time.
      const dt = Math.min(50, now - s.lastNow);
      s.lastNow = now;
      s.t = now / 1000; // keep the pinned-commit pulse alive during replay
      s.progress = Math.min(n - 1, s.progress + s.speed * dt);
      render();
      if (s.progress < n - 1) {
        s.raf = requestAnimationFrame(frame);
      } else {
        finish();
      }
    }

    function startLoop() {
      cancelAnimationFrame(s.raf);
      s.lastNow = 0; // re-baseline so paused time is not counted
      s.raf = requestAnimationFrame(frame);
    }

    function finish() {
      cancelAnimationFrame(s.raf);
      s.progress = s.cx.length - 1;
      s.animating = false;
      render();
      setPlayState("idle");
      // resume the selection pulse once the replay is done
      if (s.selected >= 0) s.praf = requestAnimationFrame(pulseLoop);
    }

    function play() {
      cancelAnimationFrame(s.raf);
      cancelAnimationFrame(s.praf); // pause the selection pulse during replay
      const n = s.cx.length;
      if (n <= 1) {
        s.animating = false;
        setPlayState("idle");
        render();
        return;
      }
      // Slow, commit-by-commit pace, capped so huge repos stay watchable.
      const perCommit = 110; // ms per commit
      const total = Math.min(15000, Math.max(2000, n * perCommit));
      s.speed = (n - 1) / total; // commits per ms
      s.progress = 0;
      s.animating = true;
      s.hover = -1;
      tip.style.opacity = "0";
      setPlayState("playing");
      startLoop();
    }

    function restart() {
      play();
    }

    function pause() {
      if (!s.animating) return;
      cancelAnimationFrame(s.raf);
      setPlayState("paused");
    }

    function resume() {
      const n = s.cx.length;
      if (n <= 1 || !s.animating) return;
      if (s.progress >= n - 1) {
        play();
        return;
      }
      setPlayState("playing");
      startLoop();
    }

    // Step one commit forward/back. Pauses the run and lands exactly on a
    // commit so the wave reads as fully grown up to that point.
    function step(delta: number) {
      const n = s.cx.length;
      if (n <= 1) return;
      cancelAnimationFrame(s.raf);
      const cur = Math.round(s.progress);
      s.progress = Math.max(0, Math.min(n - 1, cur + delta));
      s.animating = true;
      s.hover = -1;
      tip.style.opacity = "0";
      setPlayState("paused");
      render();
    }

    function next() {
      step(1);
    }

    function back() {
      step(-1);
    }

    // Continuous low-cost loop that runs only while a commit is selected and
    // no replay is in progress, animating that commit's pulse.
    function pulseLoop(now: number) {
      s.t = now / 1000;
      render();
      if (s.selected >= 0 && !s.animating) {
        s.praf = requestAnimationFrame(pulseLoop);
      }
    }

    function setSelected(index: number) {
      s.selected = index;
      cancelAnimationFrame(s.praf);
      if (index >= 0 && !s.animating) {
        s.praf = requestAnimationFrame(pulseLoop);
      } else {
        render();
      }
    }

    function resize() {
      s.W = wrap.clientWidth;
      s.H = wrap.clientHeight;
      canvas.width = s.W * s.dpr;
      canvas.height = s.H * s.dpr;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      rebuild();
      render();
    }

    api.current = {
      rebuild,
      render,
      play,
      pause,
      resume,
      restart,
      next,
      back,
      setSelected,
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    function onMove(e: MouseEvent) {
      if (s.animating) return; // no hover while replaying
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const n = s.commits.length;
      if (n === 0 || mx < s.pad || mx > s.W - s.pad) {
        if (s.hover !== -1) {
          s.hover = -1;
          render();
        }
        tip.style.opacity = "0";
        return;
      }
      const spacing = n > 1 ? (s.W - s.pad * 2) / (n - 1) : 1;
      const idx = Math.max(0, Math.min(n - 1, Math.round((mx - s.pad) / spacing)));
      if (idx !== s.hover) {
        s.hover = idx;
        render();
      }
      const c = s.commits[idx];
      tip.innerHTML =
        `<b style="font-weight:500;display:block;color:#e9ecea">${escapeHtml(c.subject)}</b>` +
        `<span style="display:block;margin-top:4px;font-size:11px">` +
        `<i style="color:${GREEN}">+${c.add.toLocaleString()}</i>  ` +
        `<i style="color:${RED}">-${c.del.toLocaleString()}</i>  ` +
        `<i style="color:#7a807b">${c.hash} · ${c.author} · ${new Date(c.ts).toLocaleDateString()}</i></span>`;
      tip.style.opacity = "1";
      let tx = s.cx[idx] + 14;
      let ty = my - 10;
      if (tx > r.width - 250) tx = s.cx[idx] - 240;
      if (ty < 6) ty = 6;
      if (ty > s.H - 60) ty = s.H - 60;
      tip.style.left = tx + "px";
      tip.style.top = ty + "px";
    }
    function onLeave() {
      if (s.hover !== -1) {
        s.hover = -1;
        if (!s.animating) render();
      }
      tip.style.opacity = "0";
    }
    function onClick(e: MouseEvent) {
      // selection works during replay too (the playhead keeps advancing)
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const n = s.commits.length;
      if (n === 0 || mx < s.pad || mx > s.W - s.pad) return;
      const spacing = n > 1 ? (s.W - s.pad * 2) / (n - 1) : 1;
      const idx = Math.max(0, Math.min(n - 1, Math.round((mx - s.pad) / spacing)));
      onSelectRef.current?.(idx);
    }

    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);
    wrap.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(s.raf);
      cancelAnimationFrame(s.praf);
      ro.disconnect();
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
      wrap.removeEventListener("click", onClick);
      api.current = null;
    };
  }, []);

  // New data or branch: rebuild and draw the full history statically.
  useEffect(() => {
    cancelAnimationFrame(st.current.raf);
    cancelAnimationFrame(st.current.praf);
    st.current.commits = commits;
    st.current.branch = branch;
    st.current.animating = false;
    st.current.progress = commits.length - 1;
    st.current.hover = -1;
    st.current.selected = -1;
    setPlayState("idle");
    api.current?.rebuild();
    api.current?.render();
  }, [commits, branch]);

  // Replay button: run the slow commit-by-commit growth traversal.
  useEffect(() => {
    if (replaySignal === 0) return;
    api.current?.play();
  }, [replaySignal]);

  // Selected commit ("current state"): drive the pulse on the chosen dot.
  useEffect(() => {
    api.current?.setSelected(selectedIndex ?? -1);
  }, [selectedIndex]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div
        ref={tipRef}
        className="pointer-events-none absolute z-10 max-w-[240px] rounded-md border px-3 py-2 text-xs leading-snug opacity-0 transition-opacity"
        style={{ background: "#0e0f11", borderColor: "#23262a" }}
      />

      {playState !== "idle" && (
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/90 px-2 py-1.5 shadow-lg backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={() => api.current?.restart()}
            aria-label="Restart replay"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={() => api.current?.back()}
            aria-label="Previous commit"
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={() =>
              playState === "playing"
                ? api.current?.pause()
                : api.current?.resume()
            }
            aria-label={playState === "playing" ? "Pause replay" : "Resume replay"}
          >
            {playState === "playing" ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={() => api.current?.next()}
            aria-label="Next commit"
          >
            <SkipForward className="size-4" />
          </Button>
          <div className="mx-1 h-1 w-40 overflow-hidden rounded-full bg-muted">
            <div
              ref={barRef}
              className="h-full rounded-full bg-primary transition-[width] duration-75"
              style={{ width: "0%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
