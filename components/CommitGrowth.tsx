"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  GitBranch,
  Leaf,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Sparkles
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  authorHue,
  commitTraits,
  diffMagnitude,
  SAMPLE_COMMITS,
  type Commit
} from "@/lib/commits";
import { clamp, colorFor, hslToRgb, rgbCss, type Palette } from "@/lib/engine";

type CanvasSize = { width: number; height: number };
type ColorMode = "journey" | "author" | "palette";

const DEFAULT_REPO = "/Users/surshar/Programming/XO/xo-swarm-api";
const SEGMENT_BUDGET = 60000;

const COLOR_MODES: Array<{ id: ColorMode; name: string }> = [
  { id: "journey", name: "Journey" },
  { id: "author", name: "Author" },
  { id: "palette", name: "Palette" }
];

const PALETTE_OPTIONS: Array<{ id: Palette; name: string }> = [
  { id: "aurora", name: "Aurora" },
  { id: "ember", name: "Ember" },
  { id: "prism", name: "Prism" },
  { id: "noir", name: "Noir" }
];

export function CommitGrowth() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [repoInput, setRepoInput] = useState(DEFAULT_REPO);
  const [commits, setCommits] = useState<Commit[]>(SAMPLE_COMMITS);
  const [source, setSource] = useState<string>("sample data");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [revealed, setRevealed] = useState(SAMPLE_COMMITS.length);
  const [playing, setPlaying] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("journey");
  const [palette, setPalette] = useState<Palette>("aurora");
  const [maxDepth, setMaxDepth] = useState(11);
  const [showLeaves, setShowLeaves] = useState(true);
  const [sway, setSway] = useState(false);

  const [size, setSize] = useState<CanvasSize>({ width: 960, height: 620 });

  const total = commits.length;
  const current = commits[clamp(revealed - 1, 0, total - 1)];

  const maxMagnitude = useMemo(
    () => Math.max(1, ...commits.map((commit) => diffMagnitude(commit))),
    [commits]
  );

  const loadRepo = useCallback(async (repo: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/commits?repo=${encodeURIComponent(repo)}&limit=300`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load repository.");
      }
      const loaded = data.commits as Commit[];
      setCommits(loaded);
      setRevealed(loaded.length);
      setSource(`${data.count} commits from ${repo.split("/").pop() || repo}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load repository.";
      setError(`${message} Showing sample data instead.`);
      setCommits(SAMPLE_COMMITS);
      setRevealed(SAMPLE_COMMITS.length);
      setSource("sample data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load real history once on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional initial fetch
    loadRepo(DEFAULT_REPO);
  }, [loadRepo]);

  // Track stage size for a crisp canvas.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(320, Math.round(rect.height))
      });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Animate growth: reveal one more commit on a timer until fully grown.
  useEffect(() => {
    if (!playing || revealed >= total) return;
    const timer = window.setTimeout(() => {
      setRevealed((value) => Math.min(value + 1, total));
      if (revealed + 1 >= total) setPlaying(false);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [playing, revealed, total]);

  const draw = useCallback(
    (wind: number) => {
      const canvas = canvasRef.current;
      if (!canvas || total === 0) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      const scale = Math.min(window.devicePixelRatio || 1, 1.8);
      const width = Math.round(clamp(size.width * scale, 420, 1600));
      const height = Math.round(clamp(size.height * scale, 360, 1100));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Background.
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#06080c");
      gradient.addColorStop(0.5, "#0c1014");
      gradient.addColorStop(1, "#070606");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      // Ground line.
      const groundY = height * 0.92;
      context.strokeStyle = "rgba(255, 255, 255, 0.08)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, groundY);
      context.lineTo(width, groundY);
      context.stroke();

      const shown = clamp(revealed, 1, total);
      const depth = Math.min(shown, maxDepth);

      // Which commit shapes generation g. When the journey is longer than the
      // tree is deep, spread all revealed commits across the depth so the whole
      // silhouette keeps morphing as new commits land.
      const indexFor = (generation: number) =>
        depth <= 1
          ? shown - 1
          : Math.round((generation / (depth - 1)) * (shown - 1));

      const colorForGeneration = (
        generation: number,
        commitIndex: number
      ): [number, number, number] => {
        const depthT = depth <= 1 ? 1 : generation / (depth - 1);
        if (colorMode === "journey") {
          const hue = total <= 1 ? 150 : (commitIndex / (total - 1)) * 288;
          return hslToRgb(hue, 70, 38 + depthT * 30);
        }
        if (colorMode === "author") {
          const commit = commits[commitIndex];
          return hslToRgb(authorHue(commit.author), 64, 36 + depthT * 30);
        }
        return colorFor(generation, generation, depth, palette, generation * 12);
      };

      context.lineCap = "round";
      let segments = 0;

      const drawBranch = (
        x: number,
        y: number,
        length: number,
        angle: number,
        generation: number
      ) => {
        if (generation >= depth || length < 1.4 || segments > SEGMENT_BUDGET) {
          return;
        }
        const commitIndex = indexFor(generation);
        const commit = commits[commitIndex];
        const traits = commitTraits(commit.hash);
        const magnitude = Math.min(1, diffMagnitude(commit) / maxMagnitude);

        // Tips sway more than the trunk when wind is applied.
        const windAngle = wind * (generation / Math.max(1, depth));
        const drawAngle = angle + windAngle;
        const endX = x + Math.cos(drawAngle) * length;
        const endY = y + Math.sin(drawAngle) * length;

        const color = colorForGeneration(generation, commitIndex);
        const isNewest = commitIndex === shown - 1;
        const alpha = 0.4 + 0.55 * ((generation + 1) / depth);
        context.strokeStyle = rgbCss(color, isNewest ? Math.min(1, alpha + 0.2) : alpha);
        context.lineWidth = Math.max(1, (depth - generation) * 1.1);
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(endX, endY);
        context.stroke();
        segments += 1;

        // Leaf / node at the outermost generation.
        if (generation === depth - 1 && showLeaves) {
          const radius = 2.2 + magnitude * 4.5;
          context.fillStyle = rgbCss(color, 0.92);
          context.beginPath();
          context.arc(endX, endY, radius, 0, Math.PI * 2);
          context.fill();
          if (isNewest) {
            context.strokeStyle = "rgba(255, 255, 255, 0.85)";
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(endX, endY, radius + 3, 0, Math.PI * 2);
            context.stroke();
          }
        }

        // Real-data influence: bigger commits grow slightly longer limbs.
        const grow = 0.85 + magnitude * 0.3;
        const ratioL = clamp(traits.lengthL * grow, 0.5, 0.84);
        const ratioR = clamp(traits.lengthR * grow, 0.5, 0.84);

        drawBranch(
          endX,
          endY,
          length * ratioL,
          drawAngle - traits.angle + traits.lean + traits.twist,
          generation + 1
        );
        drawBranch(
          endX,
          endY,
          length * ratioR,
          drawAngle + traits.angle + traits.lean - traits.twist,
          generation + 1
        );
      };

      const trunkLength = Math.min(width, height) * 0.2;
      drawBranch(width / 2, groundY, trunkLength, -Math.PI / 2, 0);

      // On-canvas readout.
      drawBadge(context, [
        `commit ${shown} / ${total}`,
        current ? `${current.shortHash}  ${truncate(current.subject, 42)}` : "",
        `depth ${depth} | ${segments.toLocaleString()} branches`
      ]);
    },
    [
      colorMode,
      commits,
      current,
      maxDepth,
      maxMagnitude,
      palette,
      revealed,
      showLeaves,
      size.height,
      size.width,
      total
    ]
  );

  // Redraw on any change; run an animation loop only while swaying.
  useEffect(() => {
    if (!sway) {
      draw(0);
      return;
    }
    let frame = 0;
    let disposed = false;
    const loop = (time: number) => {
      draw(Math.sin(time * 0.0011) * 0.08);
      if (!disposed) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [draw, sway]);

  const replayGrowth = useCallback(() => {
    setRevealed(1);
    setPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((value) => {
      if (!value && revealed >= total) {
        setRevealed(1);
        return true;
      }
      return !value;
    });
  }, [revealed, total]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.download = "commit-journey.png";
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }, []);

  const submitRepo = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const repo = repoInput.trim();
      if (repo) loadRepo(repo);
    },
    [loadRepo, repoInput]
  );

  return (
    <main className="labShell">
      <section className="stageColumn" aria-label="Commit journey visualizer">
        <header className="topBar">
          <div>
            <p className="eyebrow">
              <Link className="backLink" href="/">
                <ArrowLeft size={13} /> Fractal Lab
              </Link>
            </p>
            <h1>Commit journey</h1>
          </div>
          <div className="metricStrip" aria-label="Journey metrics">
            <span>{source}</span>
            <span>
              {Math.min(revealed, total)}/{total}
            </span>
            <span>{loading ? "loading..." : `${COLOR_MODES.find((m) => m.id === colorMode)?.name}`}</span>
          </div>
        </header>

        <div className="stage" ref={stageRef}>
          <canvas
            ref={canvasRef}
            aria-label="Fractal grown from commit history"
            className="fractalCanvas"
          />
          <div className="canvasOverlay">
            <span>{current ? new Date(current.date).toLocaleDateString() : ""}</span>
            <span>{current ? current.author : ""}</span>
          </div>
        </div>
      </section>

      <aside className="controlPanel" aria-label="Journey controls">
        <div className="controlHeader">
          <div>
            <p className="eyebrow">Visualizer</p>
            <h2>Grow</h2>
          </div>
          <div className="iconCluster">
            <button
              className="iconButton"
              type="button"
              aria-label={playing ? "Pause growth" : "Play growth"}
              data-tooltip={playing ? "Pause" : "Grow"}
              onClick={togglePlay}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              className="iconButton"
              type="button"
              aria-label="Replay growth from first commit"
              data-tooltip="Replay"
              onClick={replayGrowth}
            >
              <RefreshCcw size={18} />
            </button>
            <button
              className="iconButton"
              type="button"
              aria-label="Export image"
              data-tooltip="Export"
              onClick={downloadImage}
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        <form className="controlGroup" onSubmit={submitRepo}>
          <label htmlFor="repo-path">Repository path</label>
          <input
            id="repo-path"
            className="repoInput"
            type="text"
            value={repoInput}
            spellCheck={false}
            placeholder="/path/to/a/git/repo"
            onChange={(event) => setRepoInput(event.target.value)}
          />
          <button className="actionButton" type="submit" disabled={loading}>
            <GitBranch size={16} />
            {loading ? "Loading..." : "Load history"}
          </button>
          {error ? <p className="hintError">{error}</p> : null}
        </form>

        <section className="explainerPanel" aria-live="polite">
          <div>
            <p className="eyebrow">Current state</p>
            <h3>{current ? current.shortHash : "-"}</h3>
          </div>
          <p>{current ? current.subject : "No commit selected."}</p>
          <div className="grammarList">
            <div>
              <span>Author</span>
              <code>{current ? current.author : "-"}</code>
            </div>
            <div>
              <span>When</span>
              <code>{current ? new Date(current.date).toLocaleString() : "-"}</code>
            </div>
            <div>
              <span>Change</span>
              <code>
                +{current ? current.additions : 0} / -{current ? current.deletions : 0} across{" "}
                {current ? current.files : 0} file(s)
              </code>
            </div>
          </div>
          <div className="ruleBlock">
            <span>Rule of growth</span>
            <code>generation g shape = traits(hash of commit g)</code>
          </div>
        </section>

        <Slider
          label="Growth"
          value={Math.min(revealed, total)}
          min={1}
          max={Math.max(1, total)}
          step={1}
          suffix={`/ ${total}`}
          onChange={(value) => {
            setPlaying(false);
            setRevealed(value);
          }}
        />

        <div className="growthButtons" aria-label="Step controls">
          <button
            className="actionButton"
            type="button"
            onClick={() => {
              setPlaying(false);
              setRevealed((value) => clamp(value - 1, 1, total));
            }}
          >
            <Minus size={17} /> Back one
          </button>
          <button
            className="actionButton"
            type="button"
            onClick={() => {
              setPlaying(false);
              setRevealed((value) => clamp(value + 1, 1, total));
            }}
          >
            <Plus size={17} /> Next commit
          </button>
        </div>

        <div className="controlGroup">
          <label>Color by</label>
          <div className="paletteGrid" role="radiogroup" aria-label="Color mode">
            {COLOR_MODES.map((mode) => (
              <button
                key={mode.id}
                className="paletteButton"
                data-active={colorMode === mode.id}
                type="button"
                role="radio"
                aria-checked={colorMode === mode.id}
                onClick={() => setColorMode(mode.id)}
              >
                <Sparkles size={14} />
                {mode.name}
              </button>
            ))}
          </div>
        </div>

        {colorMode === "palette" ? (
          <div className="controlGroup">
            <label>Palette</label>
            <div className="paletteGrid" role="radiogroup" aria-label="Palette">
              {PALETTE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className="paletteButton"
                  data-active={palette === option.id}
                  data-palette={option.id}
                  type="button"
                  role="radio"
                  aria-checked={palette === option.id}
                  onClick={() => setPalette(option.id)}
                >
                  <span aria-hidden="true" />
                  {option.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Slider
          label="Max depth"
          value={maxDepth}
          min={4}
          max={13}
          step={1}
          onChange={(value) => setMaxDepth(value)}
        />

        <div className="controlGroup">
          <label>Detail</label>
          <div className="switchGrid">
            <label className="switchControl">
              <input
                type="checkbox"
                checked={showLeaves}
                onChange={(event) => setShowLeaves(event.target.checked)}
              />
              <span>
                <Leaf size={13} /> Leaves
              </span>
            </label>
            <label className="switchControl">
              <input
                type="checkbox"
                checked={sway}
                onChange={(event) => setSway(event.target.checked)}
              />
              <span>Wind sway</span>
            </label>
          </div>
        </div>
      </aside>
    </main>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const inputId = `journey-slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="controlGroup">
      <div className="labelRow">
        <label htmlFor={inputId}>{label}</label>
        <output htmlFor={inputId}>
          {value.toLocaleString()}
          {suffix ? ` ${suffix}` : ""}
        </output>
      </div>
      <input
        id={inputId}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function drawBadge(context: CanvasRenderingContext2D, lines: string[]) {
  const visible = lines.filter(Boolean);
  if (visible.length === 0) return;
  context.save();
  context.font = "600 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  const width = Math.max(...visible.map((line) => context.measureText(line).width)) + 28;
  const height = visible.length * 24 + 18;
  context.fillStyle = "rgba(7, 10, 14, 0.72)";
  context.fillRect(16, 16, width, height);
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  visible.forEach((line, index) => {
    context.fillText(line, 30, 45 + index * 24);
  });
  context.restore();
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
