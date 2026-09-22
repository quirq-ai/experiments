import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { touchWord, type CityDir, type CityFile, type CityMap, type Touch } from "../types";
import type { FilePlayback } from "../playback/reducer";
import { DirLabelSet } from "./dirLabels";
import {
  anchorPinnedElement,
  disposeGroup,
  EDGE_BASE,
  EDGE_LIT,
  EMBER,
  ensureVisible,
  eventMagnitude,
  FatLineBatch,
  fitDistance,
  HOVER_LIFT,
  hotThreshold,
  prefersReducedMotion,
  resolveRecentEvents,
  SceneTip,
  SKY,
  touchColors
} from "./sceneUtils";
import { fireflyTexture } from "./textures";
import { TrailRenderer, type TrailFixation } from "./trail";

interface CitySceneProps {
  city?: CityMap;
  playback: FilePlayback;
  selectedPath?: string;
  onSelect: (path?: string) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  // static map mode: with no session to drive attention height, raise terrain
  // columns by file size (lines of code) instead of leaving the plain flat
  locHeights?: boolean;
  // a clicked trail arc names an exact event; the view decides what a jump
  // means (walk playhead vs constellation cursor), so the scene only reports
  onTrailClick?: (seq: number, path?: string) => void;
  // a clicked district (plate or border) names a subtree: fired with the
  // CityDir.path AFTER the fly-to framing starts; empty plain and Esc fly
  // home without reporting a region
  onRegionClick?: (path: string) => void;
  // world-anchored detail card: while a pin is set the scene positions this
  // element beside the pinned object every frame (left/top relative to the
  // scene host) — the view owns the card, the scene owns its geometry
  anchorElRef?: RefObject<HTMLElement | null>;
  // fired when the pin clears (empty plain, Esc fly-home) so the view can
  // drop the card it anchored; a new pin just moves, it never fires this
  onPinCleared?: () => void;
}

// the live pin: the clicked object's world point, frozen at click time, plus
// what stays lit while pinned — an arc by seq, or a district by plate index
interface CityPin {
  point: THREE.Vector3;
  arcSeq?: number;
  dirIndex?: number;
}

// Attention terrain: the map is a flat dark plain (fog of war); height is
// earned by attention — touch depth × revisits — so mountains grow where the
// walker lingered. Light is data: only touched terrain gets bright color.
const colors: Record<Touch | "unvisited" | "ghost" | "selected", THREE.Color> = {
  unvisited: new THREE.Color("#56534b"),
  ghost: new THREE.Color("#3a3831"),
  ...touchColors
};

const TILE_H = 0.14;
const LABEL_Y = 2.4;
// the inspector docks on the right; selection pans the camera clear of it
const INSPECTOR_RESERVED_PX = 348;
// canonical god-view direction — shared by the initial fit and every fly-to
// framing, so focusing a district never changes the reading angle
const VIEW_DIR = new THREE.Vector3(0.46, 1.08, 0.72).normalize();
// district border width classes: attention-lit borders step up from the 1px
// hairline; the p85 quantile of nonzero district sums splits lit from hot
const DISTRICT_LIT_PX = 2;
const DISTRICT_HOT_PX = 3.2;
// per-frame lerp toward a fly-to framing — same easing family as the terrain
const FLY_EASE = 0.12;

// plate top height, the same step the district plates are built with
function plateTop(dir: CityDir): number {
  return -0.2 + Math.min(dir.depth, 3) * 0.06;
}

// one district border: four segments tracing the rect at the plate's top,
// floated a hair above it so the line never z-fights the plate face
function pushRectOutline(
  positions: number[],
  owners: number[],
  dir: CityDir,
  bounds: { cx: number; cz: number },
  owner: number
) {
  const y = plateTop(dir) + 0.02;
  const x0 = dir.rect.x - bounds.cx;
  const x1 = dir.rect.x + dir.rect.w - bounds.cx;
  const z0 = dir.rect.z - bounds.cz;
  const z1 = dir.rect.z + dir.rect.d - bounds.cz;
  positions.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  owners.push(owner, owner, owner, owner);
}

function attentionHeight(touch: Touch, visits: number): number {
  const base = touch === "edit" ? 7.2 : touch === "read" ? 4.2 : 1.6;
  return base * (1 + 0.35 * Math.log2(Math.max(visits, 1)));
}

// static map height: normalized lines of code, log-scaled so a few huge files
// don't flatten everything else. maxLog is log2(largest file's lines).
const LOC_MIN_H = 0.3;
const LOC_MAX_H = 16;
// gamma > 1 exaggerates the top end: small files stay low, big files spike, so
// the skyline reads as a city (towers vs shacks) instead of a uniform plateau
const LOC_HEIGHT_GAMMA = 2.2;
// normalized 0..1 position of a file by lines of code (log-scaled)
function locFraction(lines: number, maxLog: number): number {
  if (maxLog <= 0) return 0;
  return Math.min(1, Math.log2(Math.max(lines, 1)) / maxLog);
}
function locHeight(t: number): number {
  return LOC_MIN_H + Math.pow(t, LOC_HEIGHT_GAMMA) * (LOC_MAX_H - LOC_MIN_H);
}

// LOC tier ramp: sequential single-hue steel with monotonic lightness — small
// files stay deep and dark, the largest files rise to a bright steel blue.
// Stops are interpolated so the terrain reads as a continuous gradient rather
// than hard bands.
const LOC_RAMP: { at: number; color: THREE.Color }[] = [
  { at: 0.0, color: new THREE.Color("#233d53") }, // deepest steel (small files)
  { at: 0.35, color: new THREE.Color("#336288") },
  { at: 0.7, color: new THREE.Color("#4b89bb") },
  { at: 1.0, color: new THREE.Color("#6cb2ec") } // brightest steel (largest files)
];
function locColor(t: number): THREE.Color {
  for (let i = 1; i < LOC_RAMP.length; i++) {
    if (t <= LOC_RAMP[i].at) {
      const lo = LOC_RAMP[i - 1];
      const hi = LOC_RAMP[i];
      const span = hi.at - lo.at;
      const k = span > 0 ? (t - lo.at) / span : 0;
      return lo.color.clone().lerp(hi.color, k);
    }
  }
  return LOC_RAMP[LOC_RAMP.length - 1].color.clone();
}

interface TerrainSlot {
  fileId: number;
  target: number;
  color: THREE.Color;
}

export function CityScene({
  city,
  playback,
  selectedPath,
  onSelect,
  onCanvasReady,
  locHeights,
  onTrailClick,
  onRegionClick,
  anchorElRef,
  onPinCleared
}: CitySceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const tileMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const terrainMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const plateMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const plateDirsRef = useRef<CityDir[]>([]);
  // attention-lit district borders: two fat-line width classes
  const borderMidRef = useRef<FatLineBatch | null>(null);
  const borderHotRef = useRef<FatLineBatch | null>(null);
  // in-flight camera framing (position + orbit target), lerped per frame
  const flyRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  // the full fit, remembered so Esc / empty ground can fly back to it
  const homeRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const filesRef = useRef<CityFile[]>([]);
  const slotsRef = useRef<TerrainSlot[]>([]);
  const heightsRef = useRef<Map<number, number>>(new Map());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cityGroupRef = useRef<THREE.Group | null>(null);
  const trailRef = useRef<TrailRenderer | null>(null);
  const fireflyRef = useRef<THREE.Sprite | null>(null);
  const labelSetRef = useRef<DirLabelSet | null>(null);
  const frameRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  const boundsRef = useRef({ cx: 0, cz: 0, size: 120 });
  // handlers live in the mount effect; they read playback through this ref
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  // same ref trick for the optional arc-click callback — when it is absent
  // the arcs stay decoration and never swallow a tile click
  const onTrailClickRef = useRef(onTrailClick);
  onTrailClickRef.current = onTrailClick;
  // and for the optional district-click callback — the pointer handlers live
  // in the mount effect and must always see the latest prop
  const onRegionClickRef = useRef(onRegionClick);
  onRegionClickRef.current = onRegionClick;
  // world-anchored card: the pin the render loop projects each frame, plus
  // the view's card element and clear callback, mirrored like the handlers
  const pinRef = useRef<CityPin | null>(null);
  const anchorElProp = useRef(anchorElRef);
  anchorElProp.current = anchorElRef;
  const onPinClearedRef = useRef(onPinCleared);
  onPinClearedRef.current = onPinCleared;
  // camera fit deferred while the viewport reports no size (hidden pane,
  // background tab); resize retries it instead of leaving the camera at NaN
  const fitPendingRef = useRef<(() => boolean) | null>(null);

  const bounds = useMemo(() => {
    if (!city || city.files.length === 0) return { cx: 0, cz: 0, size: 120, halfW: 60, halfD: 60 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const file of city.files) {
      minX = Math.min(minX, file.rect.x);
      maxX = Math.max(maxX, file.rect.x + file.rect.w);
      minZ = Math.min(minZ, file.rect.z);
      maxZ = Math.max(maxZ, file.rect.z + file.rect.d);
    }
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      size: Math.max(maxX - minX, maxZ - minZ, 60),
      halfW: (maxX - minX) / 2,
      halfD: (maxZ - minZ) / 2
    };
  }, [city]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = prefersReducedMotion();
    reducedRef.current = reduced;

    const scene = new THREE.Scene();
    scene.background = SKY;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight || 1, 0.1, 2400);
    camera.position.set(70, 130, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);
    onCanvasReady?.(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !reduced;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.44;
    // the god view drifts slowly around the terrain until the user takes over
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = -0.5;
    const tip = new SceneTip(host);
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      // the user grabbing the camera always beats an in-flight framing
      flyRef.current = null;
      tip.hide();
    });
    controlsRef.current = controls;

    const sky = new THREE.HemisphereLight("#6f93ad", "#101318", 1.7);
    scene.add(sky);
    const moon = new THREE.DirectionalLight("#9db8cc", 1.1);
    moon.position.set(-60, 120, -40);
    scene.add(moon);

    // trail arcs and lit borders are fat lines: they raycast in screen space
    // with a generous pixel threshold, so thin strokes stay easy to hit
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line2 = { threshold: 8 };
    const pointer = new THREE.Vector2();
    const castFrom = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const pickArc = (event: PointerEvent) => {
      if (!onTrailClickRef.current || !trailRef.current) return undefined;
      castFrom(event);
      return trailRef.current.pick(raycaster);
    };
    // nearest hit wins: terrain and tiles sit above the plates, so files keep
    // their click-to-select and the streets between them name the district.
    // Depth-0 plates cover the whole map and count as ground, not district.
    type ScenePick = { file: CityFile } | { dir: CityDir };
    const pick = (event: PointerEvent): ScenePick | undefined => {
      castFrom(event);
      const targets: THREE.Object3D[] = [];
      if (terrainMeshRef.current) targets.push(terrainMeshRef.current);
      if (tileMeshRef.current) targets.push(tileMeshRef.current);
      if (plateMeshRef.current) targets.push(plateMeshRef.current);
      for (const batch of [borderMidRef.current, borderHotRef.current]) {
        if (batch?.object.visible) targets.push(batch.object);
      }
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) return undefined;
      if (hit.object === terrainMeshRef.current) {
        if (hit.instanceId === undefined) return undefined;
        const slot = slotsRef.current[hit.instanceId];
        const file = slot ? filesRef.current[slot.fileId] : undefined;
        return file ? { file } : undefined;
      }
      if (hit.object === tileMeshRef.current) {
        if (hit.instanceId === undefined) return undefined;
        const file = filesRef.current[hit.instanceId];
        return file ? { file } : undefined;
      }
      if (hit.object === plateMeshRef.current) {
        if (hit.instanceId === undefined) return undefined;
        const dir = plateDirsRef.current[hit.instanceId];
        return dir && dir.depth >= 1 ? { dir } : undefined;
      }
      const batch = hit.object === borderMidRef.current?.object ? borderMidRef.current : borderHotRef.current;
      const owner = typeof hit.faceIndex === "number" ? batch?.ownerAt(hit.faceIndex) : undefined;
      const dir = owner !== undefined ? plateDirsRef.current[owner] : undefined;
      return dir && dir.depth >= 1 ? { dir } : undefined;
    };

    // smooth focus flight: the framing math mirrors fitView (same direction,
    // same breathing room and size floor); motion is a per-frame lerp
    const flyToDistrict = (dir: CityDir) => {
      const b = boundsRef.current;
      const center = new THREE.Vector3(dir.rect.x + dir.rect.w / 2 - b.cx, 0, dir.rect.z + dir.rect.d / 2 - b.cz);
      const corners: THREE.Vector3[] = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          corners.push(new THREE.Vector3((sx * dir.rect.w) / 2, 0, (sz * dir.rect.d) / 2));
        }
      }
      const fitted = fitDistance(camera, VIEW_DIR, corners);
      if (fitted === null) return;
      const dsize = Math.max(dir.rect.w, dir.rect.d);
      const distance = THREE.MathUtils.clamp(
        Math.max(fitted * 1.12, dsize * 0.6),
        controls.minDistance,
        controls.maxDistance
      );
      controls.autoRotate = false;
      flyRef.current = { position: center.clone().addScaledVector(VIEW_DIR, distance), target: center };
    };
    const flyHome = () => {
      const home = homeRef.current;
      if (!home) return;
      controls.autoRotate = false;
      flyRef.current = { position: home.position.clone(), target: home.target.clone() };
    };

    // pinned-district highlight: the same HOVER_LIFT brightness lift the tree
    // uses, on the plate face and on any lit borders the district earned
    const liftPlate = (index: number | undefined, lifted: boolean) => {
      const plates = plateMeshRef.current;
      const dir = index !== undefined ? plateDirsRef.current[index] : undefined;
      if (!plates || !dir || index === undefined) return;
      const shade = plateShade(dir);
      if (lifted) shade.multiplyScalar(HOVER_LIFT);
      plates.setColorAt(index, shade);
      if (plates.instanceColor) plates.instanceColor.needsUpdate = true;
    };
    // pin lifecycle: a qualifying click records (or just moves) the pin and
    // its persistent highlight; empty plain and Esc clear both and tell the
    // view, so the card and the lift always leave together
    let pinCardSeen = false;
    const setPin = (pin: CityPin | null) => {
      pinCardSeen = false;
      const prev = pinRef.current;
      if (prev?.dirIndex !== pin?.dirIndex) {
        liftPlate(prev?.dirIndex, false);
        liftPlate(pin?.dirIndex, true);
      }
      pinRef.current = pin;
      trailRef.current?.setPinned(pin?.arcSeq ?? -1);
      borderMidRef.current?.tint((owner) => owner === pin?.dirIndex);
      borderHotRef.current?.tint((owner) => owner === pin?.dirIndex);
      if (!pin && prev) onPinClearedRef.current?.();
    };

    let downAt: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    // click priority: arc (names an exact event) → file tile/column (select)
    // → district plate or border (fly to frame it) → empty plain (deselect
    // + fly back to the full fit)
    const onPointerUp = (event: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      downAt = null;
      if (moved > 5) return;
      const arc = pickArc(event);
      if (arc) {
        // pin at the arc's apex before reporting, so the card the view opens
        // is anchored on its very first frame
        setPin({ point: arc.apex, arcSeq: arc.seq });
        onTrailClickRef.current?.(arc.seq, arc.path);
        return;
      }
      const picked = pick(event);
      if (picked && "file" in picked) {
        onSelect(picked.file.path);
        return;
      }
      if (picked) {
        // plate and border clicks both land here; the fly-to framing stays
        // exactly as before and the region report is additive
        flyToDistrict(picked.dir);
        if (onRegionClickRef.current) {
          // pin at the plate center on its top face so the card rides the
          // district it names through the fly-to
          const b = boundsRef.current;
          const index = plateDirsRef.current.indexOf(picked.dir);
          setPin({
            point: new THREE.Vector3(
              picked.dir.rect.x + picked.dir.rect.w / 2 - b.cx,
              plateTop(picked.dir),
              picked.dir.rect.z + picked.dir.rect.d / 2 - b.cz
            ),
            dirIndex: index >= 0 ? index : undefined
          });
          onRegionClickRef.current(picked.dir.path);
        }
        return;
      }
      onSelect(undefined);
      setPin(null);
      flyHome();
    };
    // hover: cursor + one-line readout, throttled to one raycast per frame
    let hoverRaf = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (downAt) {
        tip.hide();
        return;
      }
      if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        const arc = pickArc(event);
        trailRef.current?.setHover(arc ? arc.index : -1);
        if (arc) {
          renderer.domElement.style.cursor = "pointer";
          tip.show(arc.path, "click to jump", event.clientX, event.clientY);
          return;
        }
        const picked = pick(event);
        renderer.domElement.style.cursor = picked ? "pointer" : "";
        if (!picked) {
          tip.hide();
          return;
        }
        if ("dir" in picked) {
          tip.show(picked.dir.path, `${picked.dir.fileCount} files · click to frame`, event.clientX, event.clientY);
          return;
        }
        const file = picked.file;
        const snapshot = playbackRef.current;
        const touch = snapshot.touchByPath.get(file.path);
        const visits = snapshot.visitsByFile.get(file.id) ?? 0;
        const meta = touch
          ? `${touchWord(touch)} · ${visits} visit${visits === 1 ? "" : "s"}`
          : touchWord(undefined);
        tip.show(file.path, file.ghost ? `${meta} · ghost` : meta, event.clientX, event.clientY);
      });
    };
    const onPointerLeave = () => {
      tip.hide();
      renderer.domElement.style.cursor = "";
      trailRef.current?.setHover(-1);
    };
    // Esc rides the empty-plain path: drop the selection and pin, fly home
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      onSelect(undefined);
      setPin(null);
      flyHome();
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);

    const resize = () => {
      if (!hostRef.current) return;
      const w = hostRef.current.clientWidth;
      const h = hostRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // fat-line widths are in pixels; the materials must know the viewport
      trailRef.current?.setResolution(w, h);
      borderMidRef.current?.setResolution(w, h);
      borderHotRef.current?.setResolution(w, h);
      if (fitPendingRef.current?.()) fitPendingRef.current = null;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const clock = new THREE.Clock();
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const render = () => {
      // fly-to framing: ease camera and orbit target together, snap when
      // close (or immediately under prefers-reduced-motion)
      const fly = flyRef.current;
      if (fly) {
        if (reducedRef.current || camera.position.distanceToSquared(fly.position) < 0.01) {
          camera.position.copy(fly.position);
          controls.target.copy(fly.target);
          flyRef.current = null;
        } else {
          camera.position.lerp(fly.position, FLY_EASE);
          controls.target.lerp(fly.target, FLY_EASE);
        }
      }
      controls.update();
      labelSetRef.current?.updateTargets(camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
      labelSetRef.current?.ease(reducedRef.current);

      // grow / shrink terrain columns toward their attention targets
      const terrain = terrainMeshRef.current;
      const slots = slotsRef.current;
      const heights = heightsRef.current;
      if (terrain && slots.length > 0) {
        let moving = false;
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const file = filesRef.current[slot.fileId];
          if (!file) continue;
          let cur = heights.get(slot.fileId) ?? 0;
          const diff = slot.target - cur;
          if (Math.abs(diff) > 0.015) {
            cur = reducedRef.current ? slot.target : cur + diff * 0.13;
            heights.set(slot.fileId, cur);
            moving = true;
          } else if (cur !== slot.target) {
            heights.set(slot.fileId, slot.target);
            cur = slot.target;
            moving = true;
          }
          const sx = Math.max(file.rect.w, 0.45) + 0.04;
          const sz = Math.max(file.rect.d, 0.45) + 0.04;
          matrix.compose(
            new THREE.Vector3(
              file.rect.x + file.rect.w / 2 - boundsRef.current.cx,
              Math.max(cur, 0.02) / 2 + TILE_H,
              file.rect.z + file.rect.d / 2 - boundsRef.current.cz
            ),
            quaternion,
            new THREE.Vector3(sx, Math.max(cur, 0.02), sz)
          );
          terrain.setMatrixAt(i, matrix);
        }
        if (moving) terrain.instanceMatrix.needsUpdate = true;
      }

      const firefly = fireflyRef.current;
      if (firefly?.visible) {
        const t = clock.getElapsedTime();
        const base = firefly.userData.baseScale as number;
        const pulse = reducedRef.current ? 1 : 1 + 0.1 * Math.sin(t * 2.4);
        firefly.scale.setScalar(base * pulse);
      }

      // world-anchored card: reproject the pinned point every frame so the
      // card rides its object through orbit, damping, and fly-to
      const pin = pinRef.current;
      const anchorEl = anchorElProp.current?.current;
      if (pin && anchorEl) {
        pinCardSeen = true;
        anchorPinnedElement(anchorEl, pin.point, camera, host.clientWidth, host.clientHeight);
      } else if (pin && pinCardSeen && !anchorEl) {
        // the view dismissed the card (X, outside chrome): its anchor element
        // is gone, so the pin and its highlight leave with it
        setPin(null);
      }
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      tip.dispose();
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      scene.clear();
      onCanvasReady?.(null);
    };
  }, [onSelect, onCanvasReady]);

  // build the plain: ground, grid, district plates, flat file tiles
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    filesRef.current = city?.files ?? [];
    slotsRef.current = [];
    heightsRef.current = new Map();
    boundsRef.current = bounds;
    // a rebuilt world invalidates the pinned point; drop it quietly
    pinRef.current = null;
    if (!city || city.files.length === 0) return;

    const group = new THREE.Group();
    const size = bounds.size;

    scene.fog = new THREE.Fog(SKY, size * 2.1, size * 4.2);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 6, size * 6),
      new THREE.MeshStandardMaterial({ color: "#101318", roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.32;
    group.add(ground);

    const grid = new THREE.GridHelper(size * 2.8, 46, "#242832", "#1b1f27");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.position.y = -0.3;
    group.add(grid);

    const plateDirs = city.dirs.filter((dir) => dir.depth <= 3 && dir.rect.w > 0 && dir.rect.d > 0);
    plateDirsRef.current = plateDirs;
    const canvasSize = rendererRef.current?.getSize(new THREE.Vector2()) ?? new THREE.Vector2(1, 1);
    if (plateDirs.length > 0) {
      const plateGeo = new THREE.BoxGeometry(1, 1, 1);
      const plateMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
      const plates = new THREE.InstancedMesh(plateGeo, plateMat, plateDirs.length);
      const matrix = new THREE.Matrix4();
      plateDirs.forEach((dir, i) => {
        const top = plateTop(dir);
        const height = top + 0.3;
        matrix.compose(
          new THREE.Vector3(
            dir.rect.x + dir.rect.w / 2 - bounds.cx,
            top - height / 2,
            dir.rect.z + dir.rect.d / 2 - bounds.cz
          ),
          new THREE.Quaternion(),
          new THREE.Vector3(dir.rect.w, height, dir.rect.d)
        );
        plates.setMatrixAt(i, matrix);
        plates.setColorAt(i, plateShade(dir));
      });
      plates.instanceMatrix.needsUpdate = true;
      if (plates.instanceColor) plates.instanceColor.needsUpdate = true;
      plateMeshRef.current = plates;
      group.add(plates);

      // hairline borders make districts read as districts before any light;
      // attention re-draws them fatter (width is the magnitude channel)
      const hairlinePositions: number[] = [];
      const hairlineOwners: number[] = [];
      plateDirs.forEach((dir, i) => {
        if (dir.depth < 1) return;
        pushRectOutline(hairlinePositions, hairlineOwners, dir, bounds, i);
      });
      if (hairlinePositions.length > 0) {
        const borderGeo = new THREE.BufferGeometry();
        borderGeo.setAttribute("position", new THREE.Float32BufferAttribute(hairlinePositions, 3));
        const borders = new THREE.LineSegments(
          borderGeo,
          new THREE.LineBasicMaterial({ color: EDGE_BASE, transparent: true, opacity: 0.9 })
        );
        group.add(borders);
      }
      const borderMid = new FatLineBatch(DISTRICT_LIT_PX, EDGE_LIT);
      const borderHot = new FatLineBatch(DISTRICT_HOT_PX, EDGE_LIT);
      borderMid.setResolution(canvasSize.x, canvasSize.y);
      borderHot.setResolution(canvasSize.x, canvasSize.y);
      borderMidRef.current = borderMid;
      borderHotRef.current = borderHot;
      group.add(borderMid.object, borderHot.object);
    }
    flyRef.current = null;

    // flat tiles: every file exists on the map, dark until visited
    const tileGeo = new THREE.BoxGeometry(1, 1, 1);
    const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, city.files.length);
    const matrix = new THREE.Matrix4();
    for (const file of city.files) {
      const sx = Math.max(file.rect.w, 0.45);
      const sz = Math.max(file.rect.d, 0.45);
      const x = file.rect.x + file.rect.w / 2 - bounds.cx;
      const z = file.rect.z + file.rect.d / 2 - bounds.cz;
      matrix.compose(new THREE.Vector3(x, TILE_H / 2, z), new THREE.Quaternion(), new THREE.Vector3(sx, TILE_H, sz));
      tiles.setMatrixAt(file.id, matrix);
      tiles.setColorAt(file.id, baseColor(file));
    }
    tiles.instanceMatrix.needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    tileMeshRef.current = tiles;
    group.add(tiles);

    // attention terrain: unlit columns that grow out of the plain
    const terrain = new THREE.InstancedMesh(
      attentionColumnGeometry(),
      new THREE.MeshBasicMaterial({ toneMapped: false, vertexColors: true }),
      city.files.length
    );
    terrain.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(city.files.length * 3), 3);
    terrain.count = 0;
    terrain.frustumCulled = false;
    terrainMeshRef.current = terrain;
    group.add(terrain);

    // district labels above the plain; drawn over the columns so a mountain
    // range never buries the name of the district behind it
    labelSetRef.current = new DirLabelSet(
      city.dirs
        .filter((dir) => dir.depth >= 1 && dir.fileCount > 0 && dir.rect.w > 0 && dir.rect.d > 0)
        .map((dir) => ({
          name: dirBasename(dir.path),
          x: dir.rect.x + dir.rect.w / 2 - bounds.cx,
          z: dir.rect.z + dir.rect.d / 2 - bounds.cz,
          radius: Math.hypot(dir.rect.w, dir.rect.d) / 2,
          fileCount: dir.fileCount,
          depth: dir.depth
        })),
      group,
      LABEL_Y,
      true
    );

    const firefly = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fireflyTexture(),
        color: EMBER,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true
      })
    );
    firefly.userData.baseScale = Math.max(size * 0.028, 2.2);
    firefly.visible = false;
    fireflyRef.current = firefly;
    group.add(firefly);

    const trail = new TrailRenderer(1.4);
    trail.setResolution(canvasSize.x, canvasSize.y);
    trailRef.current = trail;
    group.add(trail.object);

    cityGroupRef.current = group;
    scene.add(group);

    // keep the canonical viewing direction, but pull back exactly far
    // enough that the whole plain fits the viewport's frustum — the fixed
    // size multiplier ignores the aspect ratio and overflows short windows
    const fitView = (): boolean => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return true;
      const corners: THREE.Vector3[] = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          corners.push(new THREE.Vector3(sx * bounds.halfW, 0, sz * bounds.halfD));
        }
      }
      const fitted = fitDistance(camera, VIEW_DIR, corners);
      if (fitted === null) return false;
      // breathing room so map edges clear the HUD overlays; floor keeps
      // near-empty maps from parking the camera on the ground
      const distance = Math.max(fitted * 1.12, size * 0.6);
      camera.position.copy(VIEW_DIR).multiplyScalar(distance);
      controls.target.set(0, 0, 0);
      controls.minDistance = size * 0.18;
      controls.maxDistance = Math.max(size * 2.6, distance * 1.2);
      controls.update();
      // remember the full fit so Esc / empty plain can fly back to it
      homeRef.current = { position: camera.position.clone(), target: new THREE.Vector3(0, 0, 0) };
      return true;
    };
    fitPendingRef.current = fitView() ? null : fitView;

    return () => {
      fitPendingRef.current = null;
      disposeGroup(group);
      scene.remove(group);
      cityGroupRef.current = null;
      tileMeshRef.current = null;
      terrainMeshRef.current = null;
      plateMeshRef.current = null;
      plateDirsRef.current = [];
      borderMidRef.current = null;
      borderHotRef.current = null;
      flyRef.current = null;
      homeRef.current = null;
      trailRef.current = null;
      fireflyRef.current = null;
      labelSetRef.current = null;
    };
  }, [city, bounds]);

  // district attention: visits accumulate up the path prefixes, and the
  // border's width class says which districts are pulling the walker
  useEffect(() => {
    const mid = borderMidRef.current;
    const hot = borderHotRef.current;
    if (!mid || !hot || !city) return;
    const dirs = plateDirsRef.current;
    // depth-0 plates would always win every quantile; they stay hairline
    const eligible = new Map<string, number>();
    dirs.forEach((dir, i) => {
      if (dir.depth >= 1) eligible.set(dir.path, i);
    });
    const sums: number[] = new Array(dirs.length).fill(0);
    for (const [fileId, visits] of playback.visitsByFile) {
      const file = city.files[fileId];
      if (!file) continue;
      const parts = file.path.split("/");
      let path = "";
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        const index = eligible.get(path);
        if (index !== undefined) sums[index] += visits;
      }
    }
    const hotAt = hotThreshold(sums.filter((sum) => sum > 0));
    const midPositions: number[] = [];
    const midOwners: number[] = [];
    const hotPositions: number[] = [];
    const hotOwners: number[] = [];
    dirs.forEach((dir, index) => {
      const sum = sums[index];
      if (sum <= 0) return;
      if (sum >= hotAt) pushRectOutline(hotPositions, hotOwners, dir, boundsRef.current, index);
      else pushRectOutline(midPositions, midOwners, dir, boundsRef.current, index);
    });
    mid.setSegments(midPositions, midOwners);
    hot.setSegments(hotPositions, hotOwners);
    // a rebuild resets every border to base; re-lift the pinned district's
    const pinnedDir = pinRef.current?.dirIndex;
    if (pinnedDir !== undefined) {
      mid.tint((owner) => owner === pinnedDir);
      hot.tint((owner) => owner === pinnedDir);
    }
  }, [city, bounds, playback]);

  // playback → terrain targets and colors
  useEffect(() => {
    const terrain = terrainMeshRef.current;
    const tiles = tileMeshRef.current;
    if (!terrain || !tiles || !city) return;

    const heights = heightsRef.current;
    const slots: TerrainSlot[] = [];
    const present = new Set<number>();
    // static map mode: no session drives attention, so raise every column by
    // its lines of code instead of leaving the terrain flat
    const maxLog = locHeights
      ? Math.log2(Math.max(1, city.files.reduce((m, f) => Math.max(m, f.lines), 1)))
      : 0;
    for (const file of city.files) {
      const touch = playback.touchByFile.get(file.id);
      const selected = file.path === selectedPath;
      tiles.setColorAt(file.id, selected ? colors.selected : baseColor(file));
      if (touch) {
        const visits = playback.visitsByFile.get(file.id) ?? 1;
        let color = colors[touch];
        if (file.ghost) color = color.clone().lerp(colors.ghost, 0.45);
        if (selected) color = colors.selected;
        slots.push({ fileId: file.id, target: attentionHeight(touch, visits), color });
        present.add(file.id);
      } else if (locHeights) {
        const t = locFraction(file.lines, maxLog);
        let color = locColor(t);
        if (file.ghost) color = color.lerp(colors.ghost, 0.45);
        if (selected) color = colors.selected;
        slots.push({ fileId: file.id, target: locHeight(t), color });
        present.add(file.id);
      }
    }
    // let columns that just went dark shrink back into the plain
    for (const [fileId, cur] of heights) {
      if (cur > 0.04 && !present.has(fileId)) {
        slots.push({ fileId, target: 0, color: colors.unvisited });
      } else if (cur <= 0.04 && !present.has(fileId)) {
        heights.delete(fileId);
      }
    }

    slots.forEach((slot, i) => terrain.setColorAt(i, slot.color));
    terrain.count = slots.length;
    if (terrain.instanceColor) terrain.instanceColor.needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    slotsRef.current = slots;
  }, [city, playback, selectedPath, locHeights]);

  // the inspector opens over the right edge; pan the selected tile clear of it
  useEffect(() => {
    if (!city || !selectedPath) return;
    const file = city.files.find((f) => f.path === selectedPath);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const canvas = rendererRef.current?.domElement;
    if (!file || !camera || !controls || !canvas) return;
    controls.autoRotate = false;
    // an instant pan and an in-flight framing cannot share the camera
    flyRef.current = null;
    const top = heightsRef.current.get(file.id) ?? TILE_H;
    const world = centerFor(file, bounds);
    world.y = top;
    ensureVisible(camera, controls, world, canvas.clientWidth, canvas.clientHeight, INSPECTOR_RESERVED_PX);
  }, [city, bounds, selectedPath]);

  // trail: ballistic arcs between recent fixations + the firefly at the head
  useEffect(() => {
    const trail = trailRef.current;
    if (!trail || !city) return;

    const peakFor = (file: CityFile): number => {
      const touch = playback.touchByFile.get(file.id);
      const visits = playback.visitsByFile.get(file.id) ?? 1;
      return touch ? attentionHeight(touch, visits) : TILE_H;
    };

    // each fixation keeps the event behind it (seq → click-to-jump,
    // magnitude → arc width); the sidecar is filtered exactly like the
    // points, so arc and event indices never skew
    const events = resolveRecentEvents(playback);
    const fixations: TrailFixation[] = [];
    playback.recentTargets.forEach((target, i) => {
      // playback resolves fileId with the same path key the citymap uses, so
      // a target still missing one has no tile to land on
      const file = target.fileId !== undefined ? city.files[target.fileId] : undefined;
      if (!file) return;
      const point = centerFor(file, bounds);
      point.y = peakFor(file) + 0.4;
      fixations.push({
        point,
        path: target.path,
        seq: events[i]?.seq,
        magnitude: eventMagnitude(events[i])
      });
    });

    const firefly = fireflyRef.current;
    if (firefly) {
      const head = fixations[fixations.length - 1];
      if (head) {
        // the arc rides 0.4 above the peak, the firefly 1.6 — hence +1.2
        firefly.position.set(head.point.x, head.point.y + 1.2, head.point.z);
        firefly.visible = true;
      } else {
        firefly.visible = false;
      }
    }

    trail.update(fixations);
  }, [city, playback, bounds]);

  return <div className="city-scene" ref={hostRef} aria-label="Attention terrain" />;
}

// Columns must read as phosphorescence, not paint: glow pools at the crest and
// falls off into the plain. Vertex shade multiplies the per-instance touch
// color; the top face sits under the side rims so edges catch the most light.
function attentionColumnGeometry(): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const pos = geo.getAttribute("position");
  const normal = geo.getAttribute("normal");
  const shade = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) + 0.5;
    const glow = normal.getY(i) === 1 ? 0.82 : 0.34 + 0.66 * t * t;
    shade.fill(glow, i * 3, i * 3 + 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  return geo;
}

// plate base shade by depth — shared by the build pass and the pin lift so
// restoring an unpinned plate lands on exactly the color it was built with
function plateShade(dir: CityDir): THREE.Color {
  return new THREE.Color("#161a20").lerp(new THREE.Color("#242832"), Math.min(dir.depth, 3) / 3);
}

function baseColor(file: CityFile): THREE.Color {
  if (file.ghost) return colors.ghost;
  let h = 2166136261;
  for (let i = 0; i < file.path.length; i++) {
    h = Math.imul(h ^ file.path.charCodeAt(i), 16777619);
  }
  const jitter = ((h >>> 0) % 1000) / 1000 - 0.5;
  return colors.unvisited.clone().offsetHSL(0, 0, jitter * 0.05);
}

function centerFor(file: CityFile, bounds: { cx: number; cz: number }): THREE.Vector3 {
  return new THREE.Vector3(file.rect.x + file.rect.w / 2 - bounds.cx, 0, file.rect.z + file.rect.d / 2 - bounds.cz);
}

function dirBasename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1) || path;
}
