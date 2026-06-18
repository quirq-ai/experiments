"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SolarSystemScene, { type FocusRequest } from "@/components/solar-system";
import {
  dayToDate,
  findNextSolarEclipse,
  msToDay,
  sunMoonSeparation,
  type EclipsePrediction,
} from "@/lib/ephemeris";

const FACTS: Record<string, { tag: string; diameter: string; orbit: string; day: string; blurb: string }> = {
  Sun: { tag: "G-type main-sequence star", diameter: "1,392,700 km", orbit: "n/a", day: "~25 days (equator)", blurb: "Holds 99.86 percent of the solar system's mass." },
  Mercury: { tag: "Innermost planet", diameter: "4,879 km", orbit: "88 days", day: "59 days", blurb: "Smallest planet, sun-scorched and airless." },
  Venus: { tag: "Second planet", diameter: "12,104 km", orbit: "225 days", day: "243 days, retrograde", blurb: "Hottest planet, under a crushing CO2 sky." },
  Earth: { tag: "Third planet, home", diameter: "12,756 km", orbit: "365.25 days", day: "23.9 hours", blurb: "The only world known to host life." },
  Moon: { tag: "Earth's satellite", diameter: "3,475 km", orbit: "27.3 days around Earth", day: "tidally locked", blurb: "Its shadow on Earth is what makes a solar eclipse." },
  Mars: { tag: "Fourth planet", diameter: "6,792 km", orbit: "687 days", day: "24.6 hours", blurb: "Rusty desert world with the tallest volcano." },
  Jupiter: { tag: "Gas giant", diameter: "142,984 km", orbit: "11.9 years", day: "9.9 hours", blurb: "Outweighs every other planet combined." },
  Saturn: { tag: "Ringed gas giant", diameter: "120,536 km", orbit: "29.5 years", day: "10.7 hours", blurb: "Rings of water ice, thinner than a city block." },
  Uranus: { tag: "Ice giant", diameter: "51,118 km", orbit: "84 years", day: "17.2 hours", blurb: "Rolls around the Sun tipped on its side." },
  Neptune: { tag: "Ice giant", diameter: "49,528 km", orbit: "165 years", day: "16.1 hours", blurb: "Supersonic winds above 2,000 km/h." },
};

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const fmtTime = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function speedLabel(daysPerSec: number): string {
  if (daysPerSec < 0.99) return `${(daysPerSec * 24).toFixed(1)} hrs / sec`;
  if (daysPerSec < 320) return `${daysPerSec.toFixed(1)} days / sec`;
  return `${(daysPerSec / 365.25).toFixed(2)} yrs / sec`;
}

export default function Home() {
  const timeRef = useRef({ t: 0 });
  const speedRef = useRef(2);
  const pausedRef = useRef(false);

  // start the simulation clock at the real current date
  useEffect(() => {
    timeRef.current.t = msToDay(Date.now());
  }, []);

  const [speedExp, setSpeedExp] = useState(0.3); // speed = 10^exp days/sec
  const [paused, setPaused] = useState(false);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState<string>("");
  const [sep, setSep] = useState<number | null>(null);
  const [eclipse, setEclipse] = useState<EclipsePrediction | null>(null);

  useEffect(() => {
    speedRef.current = Math.pow(10, speedExp);
  }, [speedExp]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const id = setInterval(() => {
      const d = dayToDate(timeRef.current.t);
      setDateStr(fmtDate.format(d));
      setTimeStr(fmtTime.format(d));
      setSep(sunMoonSeparation(timeRef.current.t));
    }, 200);
    return () => clearInterval(id);
  }, []);

  const requestFocus = useCallback((kind: FocusRequest["kind"], name?: string) => {
    setFocus((f) => ({ nonce: (f?.nonce ?? 0) + 1, kind, name }));
  }, []);

  const onSelect = useCallback(
    (name: string) => {
      if (!name) {
        setSelected(null);
        return;
      }
      setSelected(name);
      requestFocus("planet", name);
    },
    [requestFocus],
  );

  const predict = () => {
    setEclipse(findNextSolarEclipse(timeRef.current.t + 0.01));
  };

  const jumpToEclipse = () => {
    if (!eclipse) return;
    timeRef.current.t = eclipse.t;
    setPaused(true);
    setSelected(null);
    requestFocus("eclipse");
  };

  const eclipseNow = sep !== null && sep < 1.4;
  const facts = selected ? FACTS[selected] : null;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#030308] text-white">
      <SolarSystemScene
        timeRef={timeRef}
        speedRef={speedRef}
        pausedRef={pausedRef}
        showOrbits={showOrbits}
        showLabels={showLabels}
        focus={focus}
        onSelect={onSelect}
      />

      {/* clock + time controls */}
      <div className="absolute left-4 top-4 z-50 w-72 rounded-2xl border border-white/10 bg-black/55 p-4 shadow-xl backdrop-blur-md">
        <h1 className="text-lg font-semibold tracking-tight">Solar System</h1>
        <p className="mt-0.5 text-[11px] leading-snug text-white/45">
          Real orbital mechanics from a mean-element ephemeris
        </p>

        <div className="mt-3 rounded-xl bg-white/5 px-3 py-2">
          <div className="font-mono text-xl tabular-nums" data-testid="sim-date">
            {dateStr ?? "..."}
          </div>
          <div className="font-mono text-xs tabular-nums text-white/50">{timeStr} UTC</div>
        </div>

        {eclipseNow && (
          <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200">
            Solar eclipse · Sun-Moon separation {sep!.toFixed(2)}°
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
          >
            {paused ? "Play" : "Pause"}
          </button>
          <button
            onClick={() => {
              timeRef.current.t = msToDay(Date.now());
            }}
            className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
          >
            Today
          </button>
          <button
            onClick={() => {
              setSelected(null);
              requestFocus("reset");
            }}
            className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
          >
            Reset
          </button>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Time speed</span>
            <span className="font-mono tabular-nums">{speedLabel(Math.pow(10, speedExp))}</span>
          </div>
          <input
            type="range"
            min={-2}
            max={2.56}
            step={0.01}
            value={speedExp}
            onChange={(e) => setSpeedExp(parseFloat(e.target.value))}
            className="mt-1 w-full accent-amber-400"
          />
        </div>

        <div className="mt-2 flex gap-4 text-xs text-white/70">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showOrbits} onChange={(e) => setShowOrbits(e.target.checked)} className="accent-amber-400" />
            Orbits
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="accent-amber-400" />
            Labels
          </label>
        </div>
      </div>

      {/* eclipse predictor */}
      <div className="absolute right-4 top-4 z-50 w-80 rounded-2xl border border-white/10 bg-black/55 p-4 shadow-xl backdrop-blur-md">
        <h2 className="text-sm font-semibold">Eclipse predictor</h2>
        <p className="mt-1 text-[11px] leading-snug text-white/45">
          Scans future new moons for one falling close enough to a lunar node for the Moon&apos;s shadow to reach Earth.
        </p>
        <button
          id="predict-eclipse-btn"
          onClick={predict}
          className="mt-3 w-full rounded-lg bg-amber-400/90 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-300"
        >
          Predict next solar eclipse
        </button>
        {eclipse && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="font-mono text-lg tabular-nums" data-testid="eclipse-date">
              {fmtDate.format(eclipse.date)}
            </div>
            <div className="mt-0.5 text-xs text-white/60">
              {fmtTime.format(eclipse.date)} UTC · {eclipse.central ? "central (total or annular)" : "partial"} · Moon lat{" "}
              {eclipse.moonLat.toFixed(2)}°
            </div>
            <button
              id="jump-eclipse-btn"
              onClick={jumpToEclipse}
              className="mt-2 w-full rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
            >
              Jump to the eclipse
            </button>
          </div>
        )}
      </div>

      {/* selected body info */}
      {facts && (
        <div className="absolute bottom-4 right-4 z-50 w-72 rounded-2xl border border-white/10 bg-black/55 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold">{selected}</h3>
              <p className="text-[11px] text-white/45">{facts.tag}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-md px-2 py-0.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-white/45">Diameter</dt>
              <dd className="text-right">{facts.diameter}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/45">Orbit</dt>
              <dd className="text-right">{facts.orbit}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/45">Day</dt>
              <dd className="text-right">{facts.day}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-snug text-white/65">{facts.blurb}</p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap text-xs text-white/40">
        Drag to orbit · Scroll to zoom · Click a body to focus
      </div>
    </main>
  );
}
