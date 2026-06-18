"use client";

/* eslint-disable react-hooks/immutability -- imperative three.js mutation inside useFrame is the react-three-fiber idiom */

import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Stars, useTexture } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import {
  earthLongitude,
  moonNode,
  moonPosition,
  planetLongitude,
  sunMoonSeparation,
} from "@/lib/ephemeris";

const DEG = Math.PI / 180;
const TEX = "/textures/";

export type FocusRequest = {
  nonce: number;
  kind: "planet" | "eclipse" | "reset";
  name?: string;
};

export type PlanetDef = {
  name: string;
  L0: number; // mean longitude at J2000, deg
  n: number; // mean daily motion, deg/day
  au: number;
  size: number;
  tiltDeg: number;
  rotationHours: number;
  texture: string;
  isEarth?: boolean;
  hasRings?: boolean;
};

export const PLANETS: PlanetDef[] = [
  { name: "Mercury", L0: 252.2503, n: 4.0923388, au: 0.387, size: 0.38, tiltDeg: 0.03, rotationHours: 1407.6, texture: "2k_mercury.jpg" },
  { name: "Venus", L0: 181.9798, n: 1.6021305, au: 0.723, size: 0.9, tiltDeg: 177.4, rotationHours: -5832.5, texture: "2k_venus_atmosphere.jpg" },
  { name: "Earth", L0: 100.4644, n: 0.9856091, au: 1.0, size: 0.95, tiltDeg: 23.44, rotationHours: 23.93, texture: "2k_earth_daymap.jpg", isEarth: true },
  { name: "Mars", L0: 355.4533, n: 0.5240207, au: 1.524, size: 0.55, tiltDeg: 25.19, rotationHours: 24.62, texture: "2k_mars.jpg" },
  { name: "Jupiter", L0: 34.3964, n: 0.0830853, au: 5.203, size: 2.3, tiltDeg: 3.13, rotationHours: 9.93, texture: "2k_jupiter.jpg" },
  { name: "Saturn", L0: 49.9542, n: 0.0334441, au: 9.537, size: 1.9, tiltDeg: 26.73, rotationHours: 10.66, texture: "2k_saturn.jpg", hasRings: true },
  { name: "Uranus", L0: 313.2381, n: 0.0117313, au: 19.191, size: 1.3, tiltDeg: 97.77, rotationHours: -17.24, texture: "2k_uranus.jpg" },
  { name: "Neptune", L0: 304.88, n: 0.0059811, au: 30.069, size: 1.25, tiltDeg: 28.32, rotationHours: 16.11, texture: "2k_neptune.jpg" },
];

export const SUN_SIZE = 3.2;
export const MOON_DIST = 2.4;
export const MOON_SIZE = 0.26;
const EARTH_SIZE = 0.95;

// Compressed distance scale so Neptune stays on screen.
export const orbitRadius = (au: number) => 13 * Math.pow(au, 0.45);

function vecFromLonLat(out: THREE.Vector3, lonDeg: number, latDeg: number, r: number) {
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  out.set(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
  return out;
}

function getPos(map: Map<string, THREE.Vector3>, key: string): THREE.Vector3 {
  let v = map.get(key);
  if (!v) {
    v = new THREE.Vector3();
    map.set(key, v);
  }
  return v;
}

const srgb = (t: THREE.Texture | THREE.Texture[]) => {
  for (const tex of Array.isArray(t) ? t : [t]) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }
};

type SimRefs = {
  timeRef: { current: { t: number } };
  speedRef: { current: number };
  pausedRef: { current: boolean };
};

type BodyProps = {
  refs: SimRefs;
  posMap: Map<string, THREE.Vector3>;
  showLabels: boolean;
  onSelect: (name: string) => void;
};

function Clock({ timeRef, speedRef, pausedRef }: SimRefs) {
  useFrame((_, delta) => {
    if (!pausedRef.current) {
      timeRef.current.t += speedRef.current * Math.min(delta, 0.1);
    }
  });
  return null;
}

function Label({ text, y }: { text: string; y: number }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div className="select-none whitespace-nowrap rounded-full bg-black/50 px-2 py-0.5 text-[11px] tracking-wide text-white/75">
        {text}
      </div>
    </Html>
  );
}

function useHoverCursor(hovered: boolean) {
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255, 224, 150, 1)");
  g.addColorStop(0.25, "rgba(255, 180, 80, 0.5)");
  g.addColorStop(0.6, "rgba(255, 140, 40, 0.12)");
  g.addColorStop(1, "rgba(255, 120, 20, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function Sun({ refs, posMap, showLabels, onSelect }: BodyProps) {
  const mesh = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const map = useTexture(TEX + "2k_sun.jpg", srgb);
  const glow = useMemo(() => makeGlowTexture(), []);
  useHoverCursor(hovered);

  useFrame(() => {
    mesh.current.rotation.y = refs.timeRef.current.t * (24 / 600) * 2 * Math.PI;
    getPos(posMap, "Sun").set(0, 0, 0);
  });

  return (
    <group>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          onSelect("Sun");
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[SUN_SIZE, 64, 64]} />
        <meshBasicMaterial map={map} />
      </mesh>
      <sprite scale={[15, 15, 1]}>
        <spriteMaterial map={glow} color="#ffd27a" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight intensity={2.8} decay={0} color="#fff3da" />
      {showLabels && <Label text="Sun" y={SUN_SIZE + 1.0} />}
    </group>
  );
}

function SaturnRings({ size }: { size: number }) {
  const map = useTexture(TEX + "2k_saturn_ring_alpha.png", srgb);
  const geo = useMemo(() => {
    const inner = size * 1.3;
    const outer = size * 2.3;
    const g = new THREE.RingGeometry(inner, outer, 96, 1);
    // remap UVs radially so the ring texture reads inner -> outer
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const mid = (inner + outer) / 2;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, v.length() < mid ? 0 : 1, 1);
    }
    return g;
  }, [size]);

  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2}>
      <meshBasicMaterial map={map} side={THREE.DoubleSide} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

function Moon({ refs, posMap, showLabels, onSelect, showOrbits }: BodyProps & { showOrbits: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const nodeRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  const map = useTexture(TEX + "2k_moon.jpg", srgb);
  useHoverCursor(hovered);

  useFrame(() => {
    const t = refs.timeRef.current.t;
    const m = moonPosition(t);
    vecFromLonLat(group.current.position, m.lon, m.lat, MOON_DIST);
    group.current.rotation.y = m.lon * DEG + Math.PI; // tidally locked
    nodeRef.current.rotation.y = moonNode(t) * DEG;
    getPos(posMap, "Moon").copy(group.current.position).add(getPos(posMap, "Earth"));
  });

  return (
    <>
      <group ref={group}>
        <mesh
          scale={hovered ? 1.2 : 1}
          onClick={(e) => {
            e.stopPropagation();
            onSelect("Moon");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[MOON_SIZE, 32, 32]} />
          <meshStandardMaterial map={map} roughness={1} metalness={0} />
        </mesh>
        {showLabels && <Label text="Moon" y={MOON_SIZE + 0.42} />}
      </group>
      {showOrbits && (
        <group ref={nodeRef}>
          {/* lunar orbit plane: inclined 5.1 deg, node regresses over 18.6 years */}
          <group rotation-x={5.145 * DEG}>
            <mesh rotation-x={-Math.PI / 2}>
              <ringGeometry args={[MOON_DIST - 0.02, MOON_DIST + 0.02, 128]} />
              <meshBasicMaterial color="#8899bb" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        </group>
      )}
    </>
  );
}

function Planet({ def, refs, posMap, showLabels, onSelect, children }: BodyProps & { def: PlanetDef; children?: React.ReactNode }) {
  const group = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const map = useTexture(TEX + def.texture, srgb);
  useHoverCursor(hovered);

  const R = orbitRadius(def.au);
  const spinRate = (24 / def.rotationHours) * 2 * Math.PI; // rad/day

  useFrame(() => {
    const t = refs.timeRef.current.t;
    const lon = def.isEarth ? earthLongitude(t) : planetLongitude(def.L0, def.n, t);
    vecFromLonLat(group.current.position, lon, 0, R);
    spin.current.rotation.y = t * spinRate;
    getPos(posMap, def.name).copy(group.current.position);
  });

  return (
    <group ref={group}>
      <group rotation-z={-def.tiltDeg * DEG} scale={hovered ? 1.12 : 1}>
        <mesh
          ref={spin}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(def.name);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[def.size, 48, 48]} />
          <meshStandardMaterial map={map} roughness={1} metalness={0} />
        </mesh>
        {def.hasRings && <SaturnRings size={def.size} />}
      </group>
      {showLabels && <Label text={def.name} y={def.size + 0.75} />}
      {children}
    </group>
  );
}

function OrbitRing({ r }: { r: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <ringGeometry args={[r - 0.04, r + 0.04, 256]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.09} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

const BELT_COUNT = 1500;

function AsteroidBelt({ refs }: { refs: SimRefs }) {
  const group = useRef<THREE.Group>(null!);
  const inst = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < BELT_COUNT; i++) {
      const r = 19 + Math.random() * 4.5;
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(r * Math.cos(a), (Math.random() - 0.5) * 0.9, -r * Math.sin(a));
      dummy.scale.setScalar(0.03 + Math.random() * 0.07);
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      dummy.updateMatrix();
      inst.current.setMatrixAt(i, dummy.matrix);
    }
    inst.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    // mean motion of a ~2.7 AU orbit
    group.current.rotation.y = refs.timeRef.current.t * 0.22 * DEG;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={inst} args={[undefined, undefined, BELT_COUNT]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#9a8f85" roughness={1} />
      </instancedMesh>
    </group>
  );
}

// Umbra cone from the Moon toward Earth plus the shadow spot on the surface,
// shown when Sun and Moon nearly align.
function EclipseShadow({ refs, posMap }: { refs: SimRefs; posMap: Map<string, THREE.Vector3> }) {
  const cone = useRef<THREE.Mesh>(null!);
  const spot = useRef<THREE.Mesh>(null!);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const toMoon = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const t = refs.timeRef.current.t;
    const sep = sunMoonSeparation(t);
    const moon = posMap.get("Moon");
    const earth = posMap.get("Earth");
    if (!moon || !earth || sep > 1.8) {
      cone.current.visible = false;
      spot.current.visible = false;
      return;
    }
    const fade = (1.8 - sep) / 1.8;
    dir.copy(moon).normalize(); // shadow axis: from Sun (origin) through the Moon

    const m = cone.current;
    m.visible = true;
    const len = earth.distanceTo(moon);
    m.position.copy(moon).addScaledVector(dir, len / 2);
    m.quaternion.setFromUnitVectors(up, dir);
    m.scale.set(1, len, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = fade * 0.5;

    // umbra spot where the shadow axis meets the surface
    const s = spot.current;
    s.visible = true;
    toMoon.copy(moon).sub(earth).normalize();
    s.position.copy(earth).addScaledVector(toMoon, EARTH_SIZE * 0.96);
    (s.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;
  });

  return (
    <>
      <mesh ref={cone} visible={false}>
        {/* narrow end (top, +Y) points at Earth */}
        <cylinderGeometry args={[0.1, MOON_SIZE, 1, 24, 1, true]} />
        <meshBasicMaterial color="#181226" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={spot} visible={false}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial color="#050308" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

function CameraRig({
  posMap,
  focus,
  sizes,
}: {
  posMap: Map<string, THREE.Vector3>;
  focus: FocusRequest | null;
  sizes: Record<string, number>;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const pending = useRef<FocusRequest | null>(null);
  const fly = useRef<{ from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; k: number } | null>(null);
  const followName = useRef<string | null>(null);
  const prevFollow = useRef(new THREE.Vector3());
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (focus) pending.current = focus;
  }, [focus]);

  useFrame((_, delta) => {
    if (!controls) return;

    const req = pending.current;
    if (req) {
      pending.current = null;
      const from = camera.position.clone();
      const tFrom = controls.target.clone();

      if (req.kind === "reset") {
        followName.current = null;
        fly.current = { from, to: new THREE.Vector3(0, 30, 52), tFrom, tTo: new THREE.Vector3(0, 0, 0), k: 0 };
      } else if (req.kind === "planet" && req.name) {
        const p = posMap.get(req.name);
        if (p) {
          const size = sizes[req.name] ?? 1;
          const dirCam = from.clone().sub(p);
          if (dirCam.lengthSq() < 1e-6) dirCam.set(0, 0.5, 1);
          dirCam.normalize();
          dirCam.y = Math.max(dirCam.y, 0.25);
          dirCam.normalize();
          fly.current = { from, to: p.clone().addScaledVector(dirCam, size * 5.5 + 1.6), tFrom, tTo: p.clone(), k: 0 };
          followName.current = req.name;
          prevFollow.current.copy(p);
        }
      } else if (req.kind === "eclipse") {
        const earth = posMap.get("Earth");
        const moon = posMap.get("Moon");
        if (earth && moon) {
          const out = earth.clone().normalize(); // Sun -> Earth direction
          const side = new THREE.Vector3().crossVectors(out, up0).normalize();
          const to = earth.clone().addScaledVector(out, 5.4).addScaledVector(side, 2.6);
          to.y += 1.7;
          fly.current = { from, to, tFrom, tTo: earth.clone().lerp(moon, 0.4), k: 0 };
          followName.current = "Earth";
          prevFollow.current.copy(earth);
        }
      }
      if (fly.current) controls.enabled = false;
    }

    if (fly.current) {
      const f = fly.current;
      f.k = Math.min(1, f.k + delta / 1.6);
      const e = f.k * f.k * (3 - 2 * f.k);
      camera.position.lerpVectors(f.from, f.to, e);
      controls.target.lerpVectors(f.tFrom, f.tTo, e);
      controls.update();
      if (f.k >= 1) {
        fly.current = null;
        controls.enabled = true;
      }
    } else if (followName.current) {
      const p = posMap.get(followName.current);
      if (p) {
        tmp.copy(p).sub(prevFollow.current);
        if (tmp.lengthSq() > 0) {
          camera.position.add(tmp);
          controls.target.add(tmp);
          prevFollow.current.copy(p);
          controls.update();
        }
      }
    }
  });

  return null;
}

const up0 = new THREE.Vector3(0, 1, 0);

export type SceneProps = SimRefs & {
  showOrbits: boolean;
  showLabels: boolean;
  focus: FocusRequest | null;
  onSelect: (name: string) => void;
};

export default function SolarSystemScene(props: SceneProps) {
  const posMap = useMemo(() => new Map<string, THREE.Vector3>(), []);
  const refs: SimRefs = { timeRef: props.timeRef, speedRef: props.speedRef, pausedRef: props.pausedRef };
  const sizes = useMemo(() => {
    const s: Record<string, number> = { Sun: SUN_SIZE, Moon: MOON_SIZE };
    for (const p of PLANETS) s[p.name] = p.size;
    return s;
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 30, 52], fov: 50, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
        onPointerMissed={() => props.onSelect("")}
      >
        <color attach="background" args={["#030308"]} />
        <ambientLight intensity={0.25} />
        <Suspense fallback={null}>
          <Clock timeRef={props.timeRef} speedRef={props.speedRef} pausedRef={props.pausedRef} />
          <Sun refs={refs} posMap={posMap} showLabels={props.showLabels} onSelect={props.onSelect} />
          {PLANETS.map((def) => (
            <Planet key={def.name} def={def} refs={refs} posMap={posMap} showLabels={props.showLabels} onSelect={props.onSelect}>
              {def.isEarth ? (
                <Moon refs={refs} posMap={posMap} showLabels={props.showLabels} showOrbits={props.showOrbits} onSelect={props.onSelect} />
              ) : null}
            </Planet>
          ))}
          {props.showOrbits && PLANETS.map((d) => <OrbitRing key={d.name} r={orbitRadius(d.au)} />)}
          <AsteroidBelt refs={refs} />
          <EclipseShadow refs={refs} posMap={posMap} />
          <Stars radius={350} depth={80} count={5000} factor={6} saturation={0} fade speed={0.4} />
        </Suspense>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2.5} maxDistance={280} />
        <CameraRig posMap={posMap} focus={props.focus} sizes={sizes} />
      </Canvas>
    </div>
  );
}
