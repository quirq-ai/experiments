"use client";

import Link from "next/link";
import {
  Download,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Shuffle,
  Sparkles,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FractalMode =
  | "mandelbrot"
  | "julia"
  | "burningShip"
  | "sierpinski"
  | "fern"
  | "tree";

type Palette = "aurora" | "ember" | "prism" | "noir";
type QuadrantKey = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
type QuadrantVisibility = Record<QuadrantKey, number>;

type Viewport = {
  centerX: number;
  centerY: number;
  zoom: number;
};

type CanvasSize = {
  width: number;
  height: number;
};

type DrawSettings = {
  mode: FractalMode;
  palette: Palette;
  iterations: number;
  nodeBudget: number;
  colorShift: number;
  juliaX: number;
  juliaY: number;
  branchAngle: number;
  animate: boolean;
  mirrorHorizontal: boolean;
  mirrorVertical: boolean;
  quadrantVisibility: QuadrantVisibility;
};

type SymmetrySettings = {
  horizontal: boolean;
  vertical: boolean;
};

type Preset = {
  id: FractalMode;
  name: string;
  iterations: number;
  view: Viewport;
  julia?: {
    x: number;
    y: number;
  };
  branchAngle?: number;
};

type FractalExplainer = {
  what: string;
  equationUnit: string;
  geometryUnit: string;
  seed: string;
  rule: string;
  growth: string;
};

const PRESETS: Record<FractalMode, Preset> = {
  mandelbrot: {
    id: "mandelbrot",
    name: "Mandelbrot",
    iterations: 180,
    view: { centerX: -0.56, centerY: 0, zoom: 1.05 }
  },
  julia: {
    id: "julia",
    name: "Julia",
    iterations: 170,
    view: { centerX: 0, centerY: 0, zoom: 1.15 },
    julia: { x: -0.72, y: 0.28 }
  },
  burningShip: {
    id: "burningShip",
    name: "Burning Ship",
    iterations: 190,
    view: { centerX: -0.48, centerY: -0.58, zoom: 1.18 }
  },
  sierpinski: {
    id: "sierpinski",
    name: "Sierpinski",
    iterations: 150,
    view: { centerX: 0, centerY: 0, zoom: 1.08 }
  },
  fern: {
    id: "fern",
    name: "Barnsley Fern",
    iterations: 165,
    view: { centerX: 0, centerY: 4.8, zoom: 0.93 }
  },
  tree: {
    id: "tree",
    name: "Fractal Tree",
    iterations: 170,
    view: { centerX: 0, centerY: 0.35, zoom: 1.06 },
    branchAngle: 29
  }
};

const MODES = Object.values(PRESETS);
const PALETTES: Array<{ id: Palette; name: string }> = [
  { id: "aurora", name: "Aurora" },
  { id: "ember", name: "Ember" },
  { id: "prism", name: "Prism" },
  { id: "noir", name: "Noir" }
];
const DEFAULT_QUADRANT_VISIBILITY: QuadrantVisibility = {
  topLeft: 100,
  topRight: 100,
  bottomLeft: 100,
  bottomRight: 100
};
const QUADRANT_CONTROLS: Array<{ id: QuadrantKey; name: string }> = [
  { id: "topLeft", name: "Top left" },
  { id: "topRight", name: "Top right" },
  { id: "bottomLeft", name: "Bottom left" },
  { id: "bottomRight", name: "Bottom right" }
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const MAX_NODE_BUDGET = 1_000_000;

export function FractalPlayground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    view: Viewport;
  } | null>(null);

  const [size, setSize] = useState<CanvasSize>({ width: 960, height: 620 });
  const [settings, setSettings] = useState<DrawSettings>({
    mode: "mandelbrot",
    palette: "aurora",
    iterations: PRESETS.mandelbrot.iterations,
    nodeBudget: 250000,
    colorShift: 18,
    juliaX: PRESETS.julia.julia?.x ?? -0.72,
    juliaY: PRESETS.julia.julia?.y ?? 0.28,
    branchAngle: PRESETS.tree.branchAngle ?? 29,
    animate: false,
    mirrorHorizontal: false,
    mirrorVertical: false,
    quadrantVisibility: DEFAULT_QUADRANT_VISIBILITY
  });
  const [view, setView] = useState<Viewport>(PRESETS.mandelbrot.view);
  const [unitMode, setUnitMode] = useState(true);
  const [unitStep, setUnitStep] = useState(0);

  const activePreset = PRESETS[settings.mode];
  const maxStep = maxBuildStep(settings.mode);
  const explainer = getExplainer(settings, unitMode, unitStep);
  const growthPercent = unitMode
    ? (unitStep / maxStep) * 100
    : (settings.nodeBudget / MAX_NODE_BUDGET) * 100;

  const setQuadrantVisibility = useCallback(
    (quadrant: QuadrantKey, value: number) => {
      setSettings((current) => ({
        ...current,
        quadrantVisibility: {
          ...current.quadrantVisibility,
          [quadrant]: clamp(Math.round(value), 0, 100)
        }
      }));
    },
    []
  );

  const status = useMemo(() => {
    if (unitMode) {
      return unitStep === 0 ? "1 unit" : `step ${unitStep}/${maxStep}`;
    }

    return `${settings.nodeBudget.toLocaleString()} nodes`;
  }, [maxStep, settings.nodeBudget, unitMode, unitStep]);

  const applyPreset = useCallback((mode: FractalMode) => {
    const preset = PRESETS[mode];
    setSettings((current) => ({
      ...current,
      mode,
      iterations: preset.iterations,
      juliaX: preset.julia?.x ?? current.juliaX,
      juliaY: preset.julia?.y ?? current.juliaY,
      branchAngle: preset.branchAngle ?? current.branchAngle
    }));
    setView(preset.view);
    setUnitStep(0);
  }, []);

  const resetView = useCallback(() => {
    const preset = PRESETS[settings.mode];
    setView(preset.view);
    setSettings((current) => ({
      ...current,
      iterations: preset.iterations,
      juliaX: preset.julia?.x ?? current.juliaX,
      juliaY: preset.julia?.y ?? current.juliaY,
      branchAngle: preset.branchAngle ?? current.branchAngle
    }));
    setUnitStep(0);
  }, [settings.mode]);

  const randomize = useCallback(() => {
    setSettings((current) => {
      if (current.mode === "julia") {
        return {
          ...current,
          juliaX: Number((-0.82 + Math.random() * 0.56).toFixed(3)),
          juliaY: Number((-0.42 + Math.random() * 0.84).toFixed(3)),
          colorShift: Math.round(Math.random() * 360)
        };
      }

      if (current.mode === "tree") {
        return {
          ...current,
          branchAngle: Math.round(18 + Math.random() * 30),
          colorShift: Math.round(Math.random() * 360)
        };
      }

      return {
        ...current,
        colorShift: Math.round(Math.random() * 360),
        iterations: Math.round(110 + Math.random() * 160)
      };
    });
  }, []);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const anchor = document.createElement("a");
    anchor.download = `${settings.mode}-fractal.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }, [settings.mode]);

  const zoomBy = useCallback((factor: number) => {
    setView((current) => ({
      ...current,
      zoom: clamp(current.zoom * factor, 0.35, 1200)
    }));
  }, []);

  const adjustGrowth = useCallback(
    (direction: number) => {
      if (unitMode) {
        setUnitStep((current) =>
          clamp(current + direction, 0, maxBuildStep(settings.mode))
        );
        return;
      }

      setSettings((current) => ({
        ...current,
        nodeBudget: clamp(
          Math.round(
            (current.nodeBudget * (direction > 0 ? 1.25 : 0.8)) / 1000
          ) * 1000,
          1000,
          MAX_NODE_BUDGET
        )
      }));
    },
    [settings.mode, unitMode]
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const worldBefore = screenToWorld(
        pointerX,
        pointerY,
        rect.width,
        rect.height,
        view,
        settings.mode
      );
      const nextZoom = clamp(
        view.zoom * (event.deltaY < 0 ? 1.22 : 0.82),
        0.35,
        1200
      );
      const span = baseSpan(settings.mode) / nextZoom;
      const nextCenterX =
        worldBefore.x - (pointerX / rect.width - 0.5) * span;
      const nextCenterY =
        worldBefore.y + (pointerY / rect.height - 0.5) * span * (rect.height / rect.width);

      setView({
        centerX: nextCenterX,
        centerY: nextCenterY,
        zoom: nextZoom
      });
    },
    [settings.mode, view]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        view
      };
    },
    [view]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const span = baseSpan(settings.mode) / drag.view.zoom;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      setView({
        centerX: drag.view.centerX - (dx / rect.width) * span,
        centerY: drag.view.centerY + (dy / rect.height) * span * (rect.height / rect.width),
        zoom: drag.view.zoom
      });
    },
    [settings.mode]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let frame = 0;
    let disposed = false;

    const draw = (time: number) => {
      renderFractal(canvas, size, settings, view, time, unitMode, unitStep);
      if (settings.animate && !disposed) {
        frame = requestAnimationFrame(draw);
      }
    };

    frame = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [settings, size, unitMode, unitStep, view]);

  return (
    <main className="labShell">
      <section className="stageColumn" aria-label="Fractal visualizer">
        <header className="topBar">
          <div>
            <p className="eyebrow">Fractal Lab</p>
            <h1>Unit grows into shape</h1>
          </div>
          <div className="metricStrip" aria-label="Current fractal metrics">
            <Link className="navPill" href="/journey">
              Commit journey →
            </Link>
            <span>{activePreset.name}</span>
            <span>{status}</span>
            <span>{view.zoom.toFixed(view.zoom > 20 ? 0 : 2)}x</span>
          </div>
        </header>

        <div className="stage" ref={stageRef}>
          <canvas
            ref={canvasRef}
            aria-label={`${activePreset.name} fractal canvas`}
            className="fractalCanvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          />
          <div className="canvasOverlay">
            <span>{unitMode ? "unit builder" : settings.palette}</span>
            <span>{symmetryLabel(settings)}</span>
            <span>
              {view.centerX.toFixed(2)}, {view.centerY.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      <aside className="controlPanel" aria-label="Fractal controls">
        <div className="controlHeader">
          <div>
            <p className="eyebrow">Simulator</p>
            <h2>Create</h2>
          </div>
          <div className="iconCluster">
            <button
              className="iconButton"
              type="button"
              aria-label={settings.animate ? "Pause animation" : "Start animation"}
              data-tooltip={settings.animate ? "Pause" : "Animate"}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  animate: !current.animate
                }))
              }
            >
              {settings.animate ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              className="iconButton"
              type="button"
              aria-label="Randomize fractal"
              data-tooltip="Randomize"
              onClick={randomize}
            >
              <Shuffle size={18} />
            </button>
            <button
              className="iconButton"
              type="button"
              aria-label="Reset fractal"
              data-tooltip="Reset"
              onClick={resetView}
            >
              <RefreshCcw size={18} />
            </button>
            <button
              className="iconButton"
              type="button"
              aria-label="Export fractal image"
              data-tooltip="Export"
              onClick={downloadImage}
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        <div className="modeToggle" role="radiogroup" aria-label="Simulation mode">
          <button
            type="button"
            role="radio"
            aria-checked={unitMode}
            data-active={unitMode}
            onClick={() => setUnitMode(true)}
          >
            Unit build
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!unitMode}
            data-active={!unitMode}
            onClick={() => setUnitMode(false)}
          >
            Full field
          </button>
        </div>

        <div className="controlGroup">
          <label htmlFor="fractal-mode">Fractal</label>
          <select
            id="fractal-mode"
            value={settings.mode}
            onChange={(event) => applyPreset(event.target.value as FractalMode)}
          >
            {MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </div>

        <section className="explainerPanel" aria-live="polite">
          <div>
            <p className="eyebrow">Start with one unit</p>
            <h3>{activePreset.name}</h3>
          </div>
          <p>{explainer.what}</p>
          <div className="grammarList">
            <div>
              <span>Equation unit</span>
              <code>{explainer.equationUnit}</code>
            </div>
            <div>
              <span>Geometry unit</span>
              <code>{explainer.geometryUnit}</code>
            </div>
            <div>
              <span>Seed</span>
              <code>{explainer.seed}</code>
            </div>
          </div>
          <div className="ruleBlock">
            <span>Rule of evolution</span>
            <code>{explainer.rule}</code>
          </div>
          <div className="growthReadout">
            <div>
              <span>Growth now</span>
              <strong>{explainer.growth}</strong>
            </div>
            <div className="growthTrack" aria-hidden="true">
              <span style={{ width: `${growthPercent}%` }} />
            </div>
          </div>
        </section>

        <div className="controlGroup">
          <label>Symmetry</label>
          <div className="switchGrid">
            <label className="switchControl">
              <input
                type="checkbox"
                checked={settings.mirrorHorizontal}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    mirrorHorizontal: event.target.checked
                  }))
                }
              />
              <span>Horizontal axis</span>
            </label>
            <label className="switchControl">
              <input
                type="checkbox"
                checked={settings.mirrorVertical}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    mirrorVertical: event.target.checked
                  }))
                }
              />
              <span>Vertical axis</span>
            </label>
          </div>
        </div>

        <div className="controlGroup">
          <div className="labelRow">
            <label>Visibility index</label>
            <output>{Math.round(averageQuadrantVisibility(settings.quadrantVisibility))}% avg</output>
          </div>
          <div className="quadrantGrid" aria-label="Quadrant visibility index">
            {QUADRANT_CONTROLS.map((quadrant) => (
              <label className="quadrantControl" key={quadrant.id}>
                <span>{quadrant.name}</span>
                <output>{settings.quadrantVisibility[quadrant.id]}%</output>
                <input
                  aria-label={`${quadrant.name} visibility index`}
                  type="range"
                  value={settings.quadrantVisibility[quadrant.id]}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(event) =>
                    setQuadrantVisibility(quadrant.id, Number(event.target.value))
                  }
                />
                <div className="visibilityStepper">
                  <button
                    aria-label={`Lower ${quadrant.name} visibility`}
                    type="button"
                    onClick={() =>
                      setQuadrantVisibility(
                        quadrant.id,
                        settings.quadrantVisibility[quadrant.id] - 10
                      )
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    aria-label={`Raise ${quadrant.name} visibility`}
                    type="button"
                    onClick={() =>
                      setQuadrantVisibility(
                        quadrant.id,
                        settings.quadrantVisibility[quadrant.id] + 10
                      )
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="controlGroup">
          <label>Palette</label>
          <div className="paletteGrid" role="radiogroup" aria-label="Color palette">
            {PALETTES.map((palette) => (
              <button
                key={palette.id}
                className="paletteButton"
                data-active={settings.palette === palette.id}
                data-palette={palette.id}
                type="button"
                role="radio"
                aria-checked={settings.palette === palette.id}
                onClick={() =>
                  setSettings((current) => ({ ...current, palette: palette.id }))
                }
              >
                <span aria-hidden="true" />
                {palette.name}
              </button>
            ))}
          </div>
        </div>

        {unitMode ? (
          <Slider
            label="Growth step"
            value={unitStep}
            min={0}
            max={maxStep}
            step={1}
            onChange={(value) => setUnitStep(value)}
          />
        ) : (
          <Slider
            label="Node budget"
            value={settings.nodeBudget}
            min={1000}
            max={MAX_NODE_BUDGET}
            step={1000}
            onChange={(value) =>
              setSettings((current) => ({ ...current, nodeBudget: value }))
            }
          />
        )}

        <div className="growthButtons" aria-label="Growth depth controls">
          <button
            className="actionButton"
            type="button"
            onClick={() => adjustGrowth(-1)}
          >
            <Minus size={17} />
            {unitMode ? "Back one" : "Fewer"}
          </button>
          <button
            className="actionButton"
            type="button"
            onClick={() => adjustGrowth(1)}
          >
            <Plus size={17} />
            {unitMode ? "Apply rule" : "More"}
          </button>
        </div>

        {!unitMode ? (
          <Slider
            label="Equation depth"
            value={settings.iterations}
            min={50}
            max={320}
            step={5}
            onChange={(value) =>
              setSettings((current) => ({ ...current, iterations: value }))
            }
          />
        ) : null}

        <Slider
          label="Color"
          value={settings.colorShift}
          min={0}
          max={360}
          step={1}
          suffix="deg"
          onChange={(value) =>
            setSettings((current) => ({ ...current, colorShift: value }))
          }
        />

        {settings.mode === "julia" ? (
          <div className="dualGrid">
            <Slider
              label="Julia real"
              value={settings.juliaX}
              min={-1.1}
              max={0.4}
              step={0.01}
              onChange={(value) =>
                setSettings((current) => ({ ...current, juliaX: value }))
              }
            />
            <Slider
              label="Julia imaginary"
              value={settings.juliaY}
              min={-0.8}
              max={0.8}
              step={0.01}
              onChange={(value) =>
                setSettings((current) => ({ ...current, juliaY: value }))
              }
            />
          </div>
        ) : null}

        {settings.mode === "tree" ? (
          <Slider
            label="Branch angle"
            value={settings.branchAngle}
            min={12}
            max={55}
            step={1}
            suffix="deg"
            onChange={(value) =>
              setSettings((current) => ({ ...current, branchAngle: value }))
            }
          />
        ) : null}

        <div className="controlGroup">
          <label>View</label>
          <div className="viewButtons">
            <button
              className="actionButton"
              type="button"
              onClick={() => zoomBy(1.35)}
            >
              <ZoomIn size={17} />
              Zoom
            </button>
            <button
              className="actionButton"
              type="button"
              onClick={() => zoomBy(0.74)}
            >
              <ZoomOut size={17} />
              Pull back
            </button>
          </div>
        </div>

        <div className="presetList" aria-label="Fractal presets">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              className="presetButton"
              data-active={settings.mode === mode.id}
              type="button"
              onClick={() => applyPreset(mode.id)}
            >
              <Sparkles size={15} />
              {mode.name}
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}

function maxBuildStep(mode: FractalMode) {
  if (mode === "sierpinski") {
    return 6;
  }
  if (mode === "fern" || mode === "tree") {
    return 8;
  }
  return 7;
}

function getSymmetry(settings: DrawSettings): SymmetrySettings {
  return {
    horizontal: settings.mirrorHorizontal,
    vertical: settings.mirrorVertical
  };
}

function symmetryMultiplier(symmetry: SymmetrySettings) {
  return (symmetry.horizontal ? 2 : 1) * (symmetry.vertical ? 2 : 1);
}

function averageQuadrantVisibility(visibility: QuadrantVisibility) {
  const values = Object.values(visibility);
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function symmetryLabel(settings: DrawSettings) {
  if (settings.mirrorHorizontal && settings.mirrorVertical) {
    return "4-way symmetry";
  }
  if (settings.mirrorHorizontal) {
    return "horizontal mirror";
  }
  if (settings.mirrorVertical) {
    return "vertical mirror";
  }
  return "single growth";
}

function getExplainer(
  settings: DrawSettings,
  unitMode: boolean,
  unitStep: number
): FractalExplainer {
  const juliaImaginary =
    settings.juliaY < 0
      ? `- ${Math.abs(settings.juliaY).toFixed(2)}`
      : `+ ${settings.juliaY.toFixed(2)}`;
  const fieldGrowth = unitMode
    ? `construction step ${unitStep}: ${unitStep === 0 ? "one fundamental unit" : "the rule has been applied repeatedly"}`
    : `${settings.nodeBudget.toLocaleString()} rendered nodes; ${symmetryLabel(settings)}`;

  switch (settings.mode) {
    case "mandelbrot":
      return {
        what:
          "Start from one orbit. A Mandelbrot image grows when you copy that orbit-test across more sample points in the complex plane.",
        equationUnit: "one c = x + yi, with z0 = 0",
        geometryUnit: "one sampled point in the complex plane",
        seed: "one orbit at the selected center point",
        rule: "z(n+1) = z(n)^2 + c; stop when |z| > 2",
        growth: fieldGrowth
      };
    case "julia":
      return {
        what:
          "Start from one initial z0. A Julia image grows when you run that same fixed-c rule from more starting points.",
        equationUnit: `one z0 = x + yi, c = ${settings.juliaX.toFixed(2)} ${juliaImaginary}i`,
        geometryUnit: "one sampled starting point",
        seed: "one orbit under the fixed c",
        rule: "z(n+1) = z(n)^2 + c; stop when |z| > 2",
        growth: fieldGrowth
      };
    case "burningShip":
      return {
        what:
          "Start from one folded orbit. The larger ship appears as the same folded test is sampled across more points.",
        equationUnit: "one c = x + yi, with z0 = 0",
        geometryUnit: "one sampled folded orbit",
        seed: "one orbit at the selected center point",
        rule: "z(n+1) = (|Re z(n)| + i|Im z(n)|)^2 + c",
        growth: fieldGrowth
      };
    case "sierpinski":
      return {
        what:
          "Start from one triangle. Each growth step replaces that triangle with three half-size corner triangles.",
        equationUnit: "triangle T with vertices a, b, c",
        geometryUnit: "one triangle",
        seed: "one filled triangle",
        rule: "T -> top(T/2) + left(T/2) + right(T/2)",
        growth: unitMode
          ? `${Math.pow(3, unitStep).toLocaleString()} visible triangle units`
          : `${Math.round(settings.iterations * 520).toLocaleString()} chaos-game dots`
      };
    case "fern":
      return {
        what:
          "Start from one point. Each step moves the point through stem and leaflet transforms until a fern distribution appears.",
        equationUnit: "point p = (x, y), transform A_k and offset b_k",
        geometryUnit: "one point",
        seed: "p0 = (0, 0)",
        rule: "p(n+1) = A_k p(n) + b_k",
        growth: unitMode
          ? `${unitStep === 0 ? 1 : Math.round(50 * Math.pow(2.35, unitStep)).toLocaleString()} generated point units`
          : `${Math.round(settings.iterations * 560).toLocaleString()} transform steps`
      };
    case "tree":
      return {
        what:
          "Start from one trunk segment. Each step grows two smaller branches from the tip of every live segment.",
        equationUnit: "branch = (start, length, angle)",
        geometryUnit: "one line segment",
        seed: "one trunk segment",
        rule: `branch -> length*0.72 at +${settings.branchAngle}deg and length*0.69 at -${Math.round(settings.branchAngle * 0.92)}deg`,
        growth: unitMode
          ? `${Math.pow(2, unitStep + 1) - 1} segment units`
          : `${Math.round(clamp(settings.iterations / 24, 5, 12))} branch generations`
      };
  }
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
  const formatted = Number.isInteger(step)
    ? value.toLocaleString()
    : value.toFixed(2);
  const inputId = `slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="controlGroup">
      <div className="labelRow">
        <label htmlFor={inputId}>{label}</label>
        <output htmlFor={inputId}>
          {formatted}
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

function renderFractal(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  settings: DrawSettings,
  view: Viewport,
  time: number,
  unitMode: boolean,
  unitStep: number
) {
  if (unitMode) {
    renderUnitGrowth(canvas, size, settings, view, time, unitStep);
    return;
  }

  if (
    settings.mode === "mandelbrot" ||
    settings.mode === "julia" ||
    settings.mode === "burningShip"
  ) {
    renderEscapeFractal(canvas, size, settings, view, time);
    return;
  }

  if (settings.mode === "sierpinski") {
    renderSierpinski(canvas, size, settings, view, time);
    return;
  }

  if (settings.mode === "fern") {
    renderFern(canvas, size, settings, view, time);
    return;
  }

  renderTree(canvas, size, settings, view, time);
}

function renderUnitGrowth(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  settings: DrawSettings,
  view: Viewport,
  time: number,
  unitStep: number
) {
  const scale = Math.min(window.devicePixelRatio || 1, 1.55);
  const width = Math.round(clamp(size.width * scale, 420, 1280));
  const height = Math.round(clamp(size.height * scale, 360, 900));
  setCanvasSize(canvas, width, height);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  paintBackground(context, width, height);

  if (
    settings.mode === "mandelbrot" ||
    settings.mode === "julia" ||
    settings.mode === "burningShip"
  ) {
    renderEscapeUnitGrowth(context, width, height, settings, view, time, unitStep);
    return;
  }

  if (settings.mode === "sierpinski") {
    renderSierpinskiUnitGrowth(context, width, height, settings, unitStep);
    return;
  }

  if (settings.mode === "fern") {
    renderFernUnitGrowth(context, width, height, settings, unitStep);
    return;
  }

  renderTreeUnitGrowth(context, width, height, settings, view, time, unitStep);
}

function renderEscapeUnitGrowth(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: DrawSettings,
  view: Viewport,
  time: number,
  unitStep: number
) {
  const symmetry = getSymmetry(settings);
  const sampleCount =
    unitStep === 0 ? 1 : Math.min(181, 2 ** (unitStep + 1) + 1);
  const sampleWidth = symmetry.vertical ? Math.ceil(sampleCount / 2) : sampleCount;
  const sampleHeight = symmetry.horizontal ? Math.ceil(sampleCount / 2) : sampleCount;
  const limit = unitStep === 0 ? 1 : Math.min(settings.iterations, unitStep * 24 + 8);
  const span = baseSpan(settings.mode) / view.zoom;
  const aspect = height / width;
  const cellWidth = width / sampleCount;
  const cellHeight = height / sampleCount;
  const animatedColor = settings.animate ? (time * 0.025) % 360 : 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    const ci = view.centerY - ((y + 0.5) / sampleCount - 0.5) * span * aspect;

    for (let x = 0; x < sampleWidth; x += 1) {
      const cr = view.centerX + ((x + 0.5) / sampleCount - 0.5) * span;
      const result =
        settings.mode === "julia"
          ? iterateJulia(cr, ci, settings.juliaX, settings.juliaY, limit)
          : iterateSet(cr, ci, limit, settings.mode === "burningShip");
      const color = colorFor(
        result.iterations,
        result.smooth,
        limit,
        settings.palette,
        settings.colorShift + animatedColor
      );

      if (sampleCount === 1) {
        const unitSize = Math.min(width, height) * 0.16;
        context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        fillRectWithSymmetry(
          context,
          width / 2 - unitSize / 2,
          height / 2 - unitSize / 2,
          unitSize,
          unitSize,
          width,
          height,
          symmetry
        );
      } else {
        context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        fillRectWithSymmetry(
          context,
          Math.floor(x * cellWidth),
          Math.floor(y * cellHeight),
          Math.ceil(cellWidth) + 1,
          Math.ceil(cellHeight) + 1,
          width,
          height,
          symmetry
        );
      }
    }
  }

  drawOrbitUnit(context, width, height, settings, view, limit, symmetry);
  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
  drawCanvasBadge(context, [
    unitStep === 0 ? "1 unit: one orbit" : `${sampleCount * sampleCount} orbit units`,
    unitStep === 0 ? "apply the equation once" : `each unit runs ${limit} equation steps`,
    symmetryLabel(settings)
  ]);
}

function drawOrbitUnit(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: DrawSettings,
  view: Viewport,
  limit: number,
  symmetry: SymmetrySettings
) {
  const orbitLimit = Math.max(1, Math.min(42, limit));
  let zr = settings.mode === "julia" ? view.centerX : 0;
  let zi = settings.mode === "julia" ? view.centerY : 0;
  const cr = settings.mode === "julia" ? settings.juliaX : view.centerX;
  const ci = settings.mode === "julia" ? settings.juliaY : view.centerY;
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= orbitLimit; i += 1) {
    points.push(worldToPixel(zr, zi, width, height, view, settings.mode));
    const foldedZr = settings.mode === "burningShip" ? Math.abs(zr) : zr;
    const foldedZi = settings.mode === "burningShip" ? Math.abs(zi) : zi;
    const nextZr = foldedZr * foldedZr - foldedZi * foldedZi + cr;
    const nextZi = 2 * foldedZr * foldedZi + ci;
    zr = nextZr;
    zi = nextZi;

    if (!Number.isFinite(zr) || !Number.isFinite(zi) || zr * zr + zi * zi > 16) {
      break;
    }
  }

  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.88)";
  context.lineWidth = 2;
  points.slice(1).forEach((point, index) => {
    drawLineWithSymmetry(
      context,
      points[index],
      point,
      width,
      height,
      symmetry
    );
  });
  points.slice(0, 12).forEach((point, index) => {
    context.fillStyle =
      index === 0 ? "rgba(255, 184, 64, 0.95)" : "rgba(255, 255, 255, 0.72)";
    drawCircleWithSymmetry(
      context,
      point,
      index === 0 ? 7 : 4,
      width,
      height,
      symmetry
    );
  });
  context.restore();
}

function renderSierpinskiUnitGrowth(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: DrawSettings,
  unitStep: number
) {
  const symmetry = getSymmetry(settings);
  const margin = Math.min(width, height) * 0.08;
  const top = { x: width / 2, y: margin };
  const left = { x: margin * 1.4, y: height - margin };
  const right = { x: width - margin * 1.4, y: height - margin };

  drawWithSymmetry(context, width, height, symmetry, () => {
    drawSierpinskiUnit(context, top, left, right, unitStep, unitStep, settings);
  });
  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
  drawCanvasBadge(context, [
    unitStep === 0
      ? `${symmetryMultiplier(symmetry)} unit${symmetryMultiplier(symmetry) > 1 ? "s" : ""}: one triangle`
      : `${(Math.pow(3, unitStep) * symmetryMultiplier(symmetry)).toLocaleString()} triangle units`,
    "replace each triangle with 3 smaller corner triangles",
    symmetryLabel(settings)
  ]);
}

function drawSierpinskiUnit(
  context: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  depth: number,
  maxDepth: number,
  settings: DrawSettings
) {
  if (depth === 0) {
    const color = colorFor(
      maxDepth,
      maxDepth,
      Math.max(1, maxDepth + 1),
      settings.palette,
      settings.colorShift + maxDepth * 16
    );
    context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.9)`;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.lineTo(c.x, c.y);
    context.closePath();
    context.fill();
    return;
  }

  const ab = midpoint(a, b);
  const ac = midpoint(a, c);
  const bc = midpoint(b, c);
  drawSierpinskiUnit(context, a, ab, ac, depth - 1, maxDepth, settings);
  drawSierpinskiUnit(context, ab, b, bc, depth - 1, maxDepth, settings);
  drawSierpinskiUnit(context, ac, bc, c, depth - 1, maxDepth, settings);
}

function renderFernUnitGrowth(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: DrawSettings,
  unitStep: number
) {
  const symmetry = getSymmetry(settings);
  const multiplier = symmetryMultiplier(symmetry);
  const count =
    unitStep === 0 ? 1 : Math.min(85000, Math.round(50 * Math.pow(2.35, unitStep)));
  const generatedCount = Math.ceil(count / multiplier);
  let x = 0;
  let y = 0;

  for (let i = 0; i < generatedCount; i += 1) {
    if (unitStep > 0) {
      const transformed = nextFernPoint(x, y, seedNoise(i * 2.17 + 0.31));
      x = transformed.x;
      y = transformed.y;
    }

    const point = fernToPixel(x, y, width, height);
    const color = colorFor(
      i % Math.max(2, settings.iterations),
      i % Math.max(2, settings.iterations),
      Math.max(2, settings.iterations),
      settings.palette,
      settings.colorShift + y * 10
    );

    context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${unitStep === 0 ? 0.95 : 0.72})`;
    drawCircleWithSymmetry(
      context,
      point,
      unitStep === 0 ? 11 : 1.1,
      width,
      height,
      symmetry
    );
  }

  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
  drawCanvasBadge(context, [
    unitStep === 0
      ? `${multiplier} point unit${multiplier > 1 ? "s" : ""}`
      : `${count.toLocaleString()} point units`,
    "move the point through affine fern transforms",
    symmetryLabel(settings)
  ]);
}

function renderTreeUnitGrowth(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: DrawSettings,
  view: Viewport,
  time: number,
  unitStep: number
) {
  const symmetry = getSymmetry(settings);
  const depth = unitStep + 1;
  const wind = settings.animate ? Math.sin(time * 0.0014) * 5 : 0;
  const angle = ((settings.branchAngle + wind) * Math.PI) / 180;

  context.lineCap = "round";
  drawBranch(
    context,
    0,
    -1.72,
    1.42,
    Math.PI / 2,
    depth,
    depth,
    angle,
    width,
    height,
    view,
    settings,
    symmetry
  );
  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
  drawCanvasBadge(context, [
    unitStep === 0
      ? `${symmetryMultiplier(symmetry)} segment unit${symmetryMultiplier(symmetry) > 1 ? "s" : ""}`
      : `${((Math.pow(2, depth) - 1) * symmetryMultiplier(symmetry)).toLocaleString()} segment units`,
    "each live tip grows two smaller branches",
    symmetryLabel(settings)
  ]);
}

function midpoint(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function nextFernPoint(x: number, y: number, random: number) {
  if (random < 0.01) {
    return { x: 0, y: 0.16 * y };
  }
  if (random < 0.86) {
    return { x: 0.85 * x + 0.04 * y, y: -0.04 * x + 0.85 * y + 1.6 };
  }
  if (random < 0.93) {
    return { x: 0.2 * x - 0.26 * y, y: 0.23 * x + 0.22 * y + 1.6 };
  }
  return { x: -0.15 * x + 0.28 * y, y: 0.26 * x + 0.24 * y + 0.44 };
}

function fernToPixel(x: number, y: number, width: number, height: number) {
  return {
    x: width / 2 + x * (width / 6.3),
    y: height - height * 0.07 - y * (height / 11.2)
  };
}

function drawCanvasBadge(context: CanvasRenderingContext2D, lines: string[]) {
  context.save();
  context.font = "600 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  const width =
    Math.max(...lines.map((line) => context.measureText(line).width)) + 28;
  const height = lines.length * 24 + 18;
  context.fillStyle = "rgba(7, 10, 14, 0.7)";
  context.fillRect(16, 16, width, height);
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  lines.forEach((line, index) => {
    context.fillText(line, 30, 45 + index * 24);
  });
  context.restore();
}

function dimensionsForNodeBudget(
  size: CanvasSize,
  nodeBudget: number,
  maxWidth: number,
  maxHeight: number
) {
  const aspect = Math.max(0.4, Math.min(2.4, size.width / size.height));
  let width = Math.round(Math.sqrt(nodeBudget * aspect));
  let height = Math.round(Math.sqrt(nodeBudget / aspect));
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  width = Math.round(clamp(width * scale, 40, maxWidth));
  height = Math.round(clamp(height * scale, 40, maxHeight));

  return { width, height };
}

function mirroredPixelCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  symmetry: SymmetrySettings
) {
  const xs = symmetry.vertical ? [x, width - 1 - x] : [x];
  const ys = symmetry.horizontal ? [y, height - 1 - y] : [y];
  const points: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();

  ys.forEach((nextY) => {
    xs.forEach((nextX) => {
      const px = Math.round(clamp(nextX, 0, width - 1));
      const py = Math.round(clamp(nextY, 0, height - 1));
      const key = `${px}:${py}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push({ x: px, y: py });
      }
    });
  });

  return points;
}

function mirroredCanvasPoints(
  point: { x: number; y: number },
  width: number,
  height: number,
  symmetry: SymmetrySettings
) {
  const xs = symmetry.vertical ? [point.x, width - point.x] : [point.x];
  const ys = symmetry.horizontal ? [point.y, height - point.y] : [point.y];
  return ys.flatMap((y) => xs.map((x) => ({ x, y })));
}

function writePixelWithSymmetry(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: [number, number, number],
  alpha: number,
  symmetry: SymmetrySettings
) {
  mirroredPixelCoordinates(x, y, width, height, symmetry).forEach((point) => {
    const index = (point.y * width + point.x) * 4;
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = alpha;
  });
}

function fillRectWithSymmetry(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  width: number,
  height: number,
  symmetry: SymmetrySettings
) {
  const xs = symmetry.vertical ? [x, width - x - rectWidth] : [x];
  const ys = symmetry.horizontal ? [y, height - y - rectHeight] : [y];
  ys.forEach((nextY) => {
    xs.forEach((nextX) => {
      context.fillRect(nextX, nextY, rectWidth, rectHeight);
    });
  });
}

function drawCircleWithSymmetry(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  radius: number,
  width: number,
  height: number,
  symmetry: SymmetrySettings
) {
  mirroredCanvasPoints(point, width, height, symmetry).forEach((nextPoint) => {
    context.beginPath();
    context.arc(nextPoint.x, nextPoint.y, radius, 0, Math.PI * 2);
    context.fill();
  });
}

function drawLineWithSymmetry(
  context: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  width: number,
  height: number,
  symmetry: SymmetrySettings
) {
  const starts = mirroredCanvasPoints(start, width, height, symmetry);
  const ends = mirroredCanvasPoints(end, width, height, symmetry);

  starts.forEach((nextStart, index) => {
    const nextEnd = ends[index];
    context.beginPath();
    context.moveTo(nextStart.x, nextStart.y);
    context.lineTo(nextEnd.x, nextEnd.y);
    context.stroke();
  });
}

function drawWithSymmetry(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  symmetry: SymmetrySettings,
  draw: () => void
) {
  draw();

  if (symmetry.vertical) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    draw();
    context.restore();
  }

  if (symmetry.horizontal) {
    context.save();
    context.translate(0, height);
    context.scale(1, -1);
    draw();
    context.restore();
  }

  if (symmetry.horizontal && symmetry.vertical) {
    context.save();
    context.translate(width, height);
    context.scale(-1, -1);
    draw();
    context.restore();
  }
}

function drawSymmetryAxes(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  symmetry: SymmetrySettings
) {
  if (!symmetry.horizontal && !symmetry.vertical) {
    return;
  }

  context.save();
  context.setLineDash([8, 8]);
  context.strokeStyle = "rgba(255, 255, 255, 0.26)";
  context.lineWidth = 1;

  if (symmetry.vertical) {
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.stroke();
  }

  if (symmetry.horizontal) {
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();
  }

  context.restore();
}

function applyQuadrantVisibility(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  visibility: QuadrantVisibility
) {
  const quadrants: Array<{
    id: QuadrantKey;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [
    { id: "topLeft", x: 0, y: 0, width: width / 2, height: height / 2 },
    { id: "topRight", x: width / 2, y: 0, width: width / 2, height: height / 2 },
    { id: "bottomLeft", x: 0, y: height / 2, width: width / 2, height: height / 2 },
    {
      id: "bottomRight",
      x: width / 2,
      y: height / 2,
      width: width / 2,
      height: height / 2
    }
  ];
  const hasFade = quadrants.some(
    (quadrant) => clamp(visibility[quadrant.id], 0, 100) < 100
  );

  if (!hasFade) {
    return;
  }

  context.save();
  quadrants.forEach((quadrant) => {
    const visibleAmount = clamp(visibility[quadrant.id], 0, 100) / 100;
    const dimAmount = 1 - visibleAmount;
    if (dimAmount <= 0) {
      return;
    }

    context.fillStyle = `rgba(5, 8, 12, ${dimAmount.toFixed(2)})`;
    context.fillRect(quadrant.x, quadrant.y, quadrant.width, quadrant.height);
  });

  context.setLineDash([7, 8]);
  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width / 2, 0);
  context.lineTo(width / 2, height);
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
  context.restore();
}

function renderEscapeFractal(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  settings: DrawSettings,
  view: Viewport,
  time: number
) {
  const dimensions = dimensionsForNodeBudget(
    size,
    settings.animate ? Math.min(settings.nodeBudget, 420000) : settings.nodeBudget,
    1500,
    1200
  );
  const width = dimensions.width;
  const height = dimensions.height;
  setCanvasSize(canvas, width, height);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const image = context.createImageData(width, height);
  const data = image.data;
  const span = baseSpan(settings.mode) / view.zoom;
  const aspect = height / width;
  const animatedColor = settings.animate ? (time * 0.025) % 360 : 0;
  const symmetry = getSymmetry(settings);
  const sampleWidth = symmetry.vertical ? Math.ceil(width / 2) : width;
  const sampleHeight = symmetry.horizontal ? Math.ceil(height / 2) : height;
  const juliaX =
    settings.juliaX + (settings.animate ? Math.sin(time * 0.00038) * 0.055 : 0);
  const juliaY =
    settings.juliaY + (settings.animate ? Math.cos(time * 0.00031) * 0.055 : 0);

  for (let y = 0; y < sampleHeight; y += 1) {
    const ci = view.centerY - (y / height - 0.5) * span * aspect;

    for (let x = 0; x < sampleWidth; x += 1) {
      const cr = view.centerX + (x / width - 0.5) * span;
      const result =
        settings.mode === "julia"
          ? iterateJulia(cr, ci, juliaX, juliaY, settings.iterations)
          : iterateSet(cr, ci, settings.iterations, settings.mode === "burningShip");
      const color = colorFor(
        result.iterations,
        result.smooth,
        settings.iterations,
        settings.palette,
        settings.colorShift + animatedColor
      );
      writePixelWithSymmetry(data, width, height, x, y, color, 255, symmetry);
    }
  }

  context.putImageData(image, 0, 0);
  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
}

function iterateSet(
  cr: number,
  ci: number,
  limit: number,
  burningShip: boolean
) {
  let zr = 0;
  let zi = 0;
  let iterations = 0;

  while (zr * zr + zi * zi <= 4 && iterations < limit) {
    const nextZr =
      (burningShip ? Math.abs(zr) : zr) * (burningShip ? Math.abs(zr) : zr) -
      (burningShip ? Math.abs(zi) : zi) * (burningShip ? Math.abs(zi) : zi) +
      cr;
    const nextZi =
      2 * (burningShip ? Math.abs(zr * zi) : zr * zi) + ci;
    zr = nextZr;
    zi = nextZi;
    iterations += 1;
  }

  return {
    iterations,
    smooth: smoothEscape(iterations, zr, zi, limit)
  };
}

function iterateJulia(
  zr: number,
  zi: number,
  cr: number,
  ci: number,
  limit: number
) {
  let iterations = 0;

  while (zr * zr + zi * zi <= 4 && iterations < limit) {
    const nextZr = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = nextZr;
    iterations += 1;
  }

  return {
    iterations,
    smooth: smoothEscape(iterations, zr, zi, limit)
  };
}

function smoothEscape(
  iterations: number,
  zr: number,
  zi: number,
  limit: number
) {
  if (iterations >= limit) {
    return limit;
  }

  const magnitude = Math.sqrt(zr * zr + zi * zi);
  return iterations + 1 - Math.log2(Math.max(1, Math.log2(magnitude)));
}

function renderSierpinski(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  settings: DrawSettings,
  view: Viewport,
  time: number
) {
  const scale = Math.min(window.devicePixelRatio || 1, 1.6);
  const width = Math.round(clamp(size.width * scale, 420, 1280));
  const height = Math.round(clamp(size.height * scale, 360, 900));
  setCanvasSize(canvas, width, height);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  paintBackground(context, width, height);
  const symmetry = getSymmetry(settings);
  const multiplier = symmetryMultiplier(symmetry);
  const dots = Math.min(MAX_NODE_BUDGET, settings.nodeBudget);
  const generatedDots = Math.ceil(dots / multiplier);
  const phase = settings.animate ? time * 0.00038 : 0;
  const vertices = [
    { x: Math.cos(phase) * 0.04, y: 1.05 },
    { x: -1.18, y: -0.88 },
    { x: 1.18, y: -0.88 }
  ];
  let point = { x: 0.11, y: -0.07 };
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;

  for (let i = 0; i < generatedDots; i += 1) {
    const vertex = vertices[Math.floor(seedNoise(i + time * 0.001) * 3)];
    point = {
      x: (point.x + vertex.x) / 2,
      y: (point.y + vertex.y) / 2
    };
    const pixel = worldToPixel(point.x, point.y, width, height, view, settings.mode);
    if (pixel.x >= 0 && pixel.x < width && pixel.y >= 0 && pixel.y < height) {
      const color = colorFor(
        i % settings.iterations,
        i % settings.iterations,
        settings.iterations,
        settings.palette,
        settings.colorShift
      );
      writePixelWithSymmetry(data, width, height, pixel.x, pixel.y, color, 245, symmetry);
    }
  }

  context.putImageData(image, 0, 0);
  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
}

function renderFern(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  settings: DrawSettings,
  view: Viewport,
  time: number
) {
  const scale = Math.min(window.devicePixelRatio || 1, 1.6);
  const width = Math.round(clamp(size.width * scale, 420, 1280));
  const height = Math.round(clamp(size.height * scale, 360, 900));
  setCanvasSize(canvas, width, height);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  paintBackground(context, width, height);
  const symmetry = getSymmetry(settings);
  const multiplier = symmetryMultiplier(symmetry);
  const dots = Math.min(MAX_NODE_BUDGET, settings.nodeBudget);
  const generatedDots = Math.ceil(dots / multiplier);
  const sway = settings.animate ? Math.sin(time * 0.0011) * 0.015 : 0;
  let x = 0;
  let y = 0;
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;

  for (let i = 0; i < generatedDots; i += 1) {
    const random = seedNoise(i * 2.17 + settings.colorShift * 3.13);
    let nextX = 0;
    let nextY = 0;

    if (random < 0.01) {
      nextX = 0;
      nextY = 0.16 * y;
    } else if (random < 0.86) {
      nextX = 0.85 * x + (0.04 + sway) * y;
      nextY = -0.04 * x + 0.85 * y + 1.6;
    } else if (random < 0.93) {
      nextX = 0.2 * x - 0.26 * y;
      nextY = 0.23 * x + 0.22 * y + 1.6;
    } else {
      nextX = -0.15 * x + 0.28 * y;
      nextY = 0.26 * x + 0.24 * y + 0.44;
    }

    x = nextX;
    y = nextY;

    const pixel = worldToPixel(x, y, width, height, view, settings.mode);
    if (pixel.x >= 0 && pixel.x < width && pixel.y >= 0 && pixel.y < height) {
      const color = colorFor(
        i % settings.iterations,
        i % settings.iterations,
        settings.iterations,
        settings.palette,
        settings.colorShift + y * 10
      );
      writePixelWithSymmetry(data, width, height, pixel.x, pixel.y, color, 245, symmetry);
    }
  }

  context.putImageData(image, 0, 0);
  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
}

function renderTree(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  settings: DrawSettings,
  view: Viewport,
  time: number
) {
  const scale = Math.min(window.devicePixelRatio || 1, 1.8);
  const width = Math.round(clamp(size.width * scale, 420, 1400));
  const height = Math.round(clamp(size.height * scale, 360, 960));
  setCanvasSize(canvas, width, height);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  paintBackground(context, width, height);
  context.lineCap = "round";
  const symmetry = getSymmetry(settings);
  const multiplier = symmetryMultiplier(symmetry);
  const depth = Math.round(
    clamp(Math.log2(settings.nodeBudget / multiplier + 1), 5, 20)
  );
  const wind = settings.animate ? Math.sin(time * 0.0014) * 5 : 0;
  const angle = ((settings.branchAngle + wind) * Math.PI) / 180;

  drawBranch(
    context,
    0,
    -1.72,
    1.42,
    Math.PI / 2,
    depth,
    depth,
    angle,
    width,
    height,
    view,
    settings,
    symmetry
  );
  drawSymmetryAxes(context, width, height, symmetry);
  applyQuadrantVisibility(context, width, height, settings.quadrantVisibility);
}

function drawBranch(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
  depth: number,
  maxDepth: number,
  branchAngle: number,
  width: number,
  height: number,
  view: Viewport,
  settings: DrawSettings,
  symmetry: SymmetrySettings
) {
  if (depth <= 0 || length < 0.015) {
    return;
  }

  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;
  const start = worldToPixel(x, y, width, height, view, settings.mode);
  const end = worldToPixel(endX, endY, width, height, view, settings.mode);
  const color = colorFor(
    maxDepth - depth,
    maxDepth - depth,
    maxDepth,
    settings.palette,
    settings.colorShift + depth * 8
  );

  context.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.45 + depth / maxDepth * 0.45})`;
  context.lineWidth = Math.max(1.1, depth * 1.18);
  drawLineWithSymmetry(context, start, end, width, height, symmetry);

  drawBranch(
    context,
    endX,
    endY,
    length * 0.72,
    angle + branchAngle,
    depth - 1,
    maxDepth,
    branchAngle,
    width,
    height,
    view,
    settings,
    symmetry
  );
  drawBranch(
    context,
    endX,
    endY,
    length * 0.69,
    angle - branchAngle * 0.92,
    depth - 1,
    maxDepth,
    branchAngle,
    width,
    height,
    view,
    settings,
    symmetry
  );
}

function baseSpan(mode: FractalMode) {
  if (mode === "fern") {
    return 8.2;
  }
  if (mode === "tree") {
    return 5.2;
  }
  if (mode === "sierpinski") {
    return 3.2;
  }
  return 3.35;
}

function screenToWorld(
  x: number,
  y: number,
  width: number,
  height: number,
  view: Viewport,
  mode: FractalMode
) {
  const span = baseSpan(mode) / view.zoom;
  return {
    x: view.centerX + (x / width - 0.5) * span,
    y: view.centerY - (y / height - 0.5) * span * (height / width)
  };
}

function worldToPixel(
  x: number,
  y: number,
  width: number,
  height: number,
  view: Viewport,
  mode: FractalMode
) {
  const span = baseSpan(mode) / view.zoom;
  const scale = width / span;
  return {
    x: Math.round(width / 2 + (x - view.centerX) * scale),
    y: Math.round(height / 2 - (y - view.centerY) * scale)
  };
}

function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function paintBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#06080c");
  gradient.addColorStop(0.45, "#101416");
  gradient.addColorStop(1, "#090706");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function colorFor(
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

function hslToRgb(hue: number, saturation: number, lightness: number) {
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
  ] as [number, number, number];
}

function seedNoise(value: number) {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
