import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { touchWord, type CityFile, type CityMap, type Touch } from "../types";
import type { FilePlayback } from "../playback/reducer";
import { DirLabelSet } from "./dirLabels";
import {
  anchorPinnedElement,
  disposeGroup,
  EDGE_BASE,
  EDGE_LIT,
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
import { computeTreeLayout, type TreeDir, type TreeLayout } from "./treeLayout";
import { fireflyTexture, haloTexture } from "./textures";
import { TrailRenderer, type TrailFixation } from "./trail";

interface TreeSceneProps {
  city?: CityMap;
  playback: FilePlayback;
  selectedPath?: string;
  onSelect: (path?: string) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  // a clicked trail arc names an exact event; the view decides what a jump
  // means (walk playhead vs constellation cursor), so the scene only reports
  onTrailClick?: (seq: number, path?: string) => void;
  // a clicked branch names a subtree: fired with the branch's child dir path
  // (a file edge reports its parent dir) AFTER the fly-to framing starts;
  // empty ground and Esc fly home without reporting a region
  onRegionClick?: (path: string) => void;
  // world-anchored detail card: while a pin is set the scene positions this
  // element beside the pinned object every frame (left/top relative to the
  // scene host) — the view owns the card, the scene owns its geometry
  anchorElRef?: RefObject<HTMLElement | null>;
  // fired when the pin clears (empty ground, Esc fly-home) so the view can
  // drop the card it anchored; a new pin just moves, it never fires this
  onPinCleared?: () => void;
}

// the live pin: the clicked object's world point, frozen at click time, plus
// what stays lit while pinned — an arc by seq, or a branch selection
interface TreePin {
  point: THREE.Vector3;
  arcSeq?: number;
  branch?: { path?: string; fileId?: number };
}

// Firefly tree: the repo is a radial tree — directories fork, files are
// leaves. The walker is a firefly that lights leaves as it lands; attention
// depth shows as the pool of light it leaves behind on the ground.
//
// One variable, one channel: leaf color says WHAT happened (touch state),
// halo radius says HOW MUCH (visits), branch brightness says WHERE the
// light is, and the selection is a shape (ring + beam), never a recolor.
const colors: Record<Touch | "unvisited" | "ghost" | "selected", THREE.Color> = {
  unvisited: new THREE.Color("#56534b"),
  ghost: new THREE.Color("#3a3831"),
  ...touchColors
};
// white-hot walker: keeps the firefly apart from edit-green leaves
const FIREFLY_HOT = new THREE.Color("#f2fadf");
const LEAF_Y = 0.7;
// canonical god-view direction — shared by the initial fit and every fly-to
// framing, so focusing a subtree never changes the reading angle
const VIEW_DIR = new THREE.Vector3(0.3, 0.66, 0.47).normalize();
// branch width classes: subtree attention steps lit edges up from the 1px
// base skeleton; the p85 quantile of nonzero sums splits lit from hot
const BRANCH_LIT_PX = 2;
const BRANCH_HOT_PX = 3.2;
// fat overlays float a hair above the 0.12 skeleton so they never z-fight
const BRANCH_LIT_Y = 0.14;
// per-frame lerp toward a fly-to framing — same easing family as the halos
const FLY_EASE = 0.12;

// halo radius encodes revisits only — touch type already lives in the leaf
// color, and doubling it up here made the radius unreadable
function haloRadius(visits: number): number {
  return Math.min(1.8 * (1 + 0.45 * Math.log2(Math.max(visits, 1))), 4.8);
}

interface HaloSlot {
  fileId: number;
  target: number;
  color: THREE.Color;
}

const LABEL_Y = 1.8;
// the inspector docks on the right; selection pans the camera clear of it
const INSPECTOR_RESERVED_PX = 348;

export function TreeScene({
  city,
  playback,
  selectedPath,
  onSelect,
  onCanvasReady,
  onTrailClick,
  onRegionClick,
  anchorElRef,
  onPinCleared
}: TreeSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const leafMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const ghostMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const ghostIndexRef = useRef<Map<number, number>>(new Map());
  const selectionRef = useRef<{ ring: THREE.Mesh; beam: THREE.Mesh } | null>(null);
  const haloMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const edgesRef = useRef<THREE.LineSegments | null>(null);
  const edgeMetaRef = useRef<{ childPath?: string; childFileId?: number; vertexCount: number }[]>([]);
  const filesRef = useRef<CityFile[]>([]);
  const layoutRef = useRef<TreeLayout | null>(null);
  const slotsRef = useRef<HaloSlot[]>([]);
  const radiiRef = useRef<Map<number, number>>(new Map());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const trailRef = useRef<TrailRenderer | null>(null);
  const fireflyRef = useRef<THREE.Sprite | null>(null);
  const labelSetRef = useRef<DirLabelSet | null>(null);
  const frameRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  // handlers live in the mount effect; they read playback through this ref
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  // same ref trick for the optional arc-click callback — when it is absent
  // the arcs stay decoration and never swallow a leaf click
  const onTrailClickRef = useRef(onTrailClick);
  onTrailClickRef.current = onTrailClick;
  // and for the optional branch-click callback — the pointer handlers live in
  // the mount effect and must always see the latest prop
  const onRegionClickRef = useRef(onRegionClick);
  onRegionClickRef.current = onRegionClick;
  // world-anchored card: the pin the render loop projects each frame, plus
  // the view's card element and clear callback, mirrored like the handlers
  const pinRef = useRef<TreePin | null>(null);
  const anchorElProp = useRef(anchorElRef);
  anchorElProp.current = anchorElRef;
  const onPinClearedRef = useRef(onPinCleared);
  onPinClearedRef.current = onPinCleared;
  // camera fit deferred while the viewport reports no size (hidden pane,
  // background tab); resize retries it instead of leaving the camera at NaN
  const fitPendingRef = useRef<(() => boolean) | null>(null);
  // lit-branch overlays: two fat-line width classes over the thin skeleton
  const branchMidRef = useRef<FatLineBatch | null>(null);
  const branchHotRef = useRef<FatLineBatch | null>(null);
  // retint closure built by the playback effect; pointer handlers call it
  // when the hovered subtree changes so hovering never re-renders React
  const branchTintRef = useRef<(() => void) | null>(null);
  const hoverBranchRef = useRef<{ path?: string; fileId?: number } | null>(null);
  const dirByPathRef = useRef<Map<string, TreeDir>>(new Map());
  // world-unit raycast threshold for the thin skeleton, sized to the layout
  const linePickRef = useRef(0.5);
  // in-flight camera framing (position + orbit target), lerped per frame
  const flyRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  // the full fit, remembered so Esc / empty ground can fly back to it
  const homeRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const layout = useMemo(() => (city && city.files.length > 0 ? computeTreeLayout(city.files) : null), [city]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = prefersReducedMotion();
    reducedRef.current = reduced;

    const scene = new THREE.Scene();
    scene.background = SKY;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight || 1, 0.1, 2400);
    camera.position.set(60, 110, 90);
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

    // screen-space nearest-leaf picking: tiny orbs are hostile raycast
    // targets, so pick whatever leaf lands closest to the pointer
    const PICK_RADIUS = 18;
    const projected = new THREE.Vector3();
    const pickFile = (event: PointerEvent): CityFile | undefined => {
      const treeLayout = layoutRef.current;
      if (!treeLayout || !cameraRef.current || !rendererRef.current) return undefined;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      let best: CityFile | undefined;
      let bestD2 = PICK_RADIUS * PICK_RADIUS;
      for (const file of filesRef.current) {
        const pos = treeLayout.leaf.get(file.id);
        if (!pos) continue;
        projected.set(pos.x, LEAF_Y, pos.z).project(cameraRef.current);
        if (projected.z > 1) continue;
        const sx = ((projected.x + 1) / 2) * rect.width;
        const sy = ((1 - projected.y) / 2) * rect.height;
        const d2 = (sx - px) * (sx - px) + (sy - py) * (sy - py);
        if (d2 < bestD2) {
          bestD2 = d2;
          best = file;
        }
      }
      return best;
    };

    // arcs and lit branches are fat lines (screen-space raycast, generous
    // pixel threshold); the thin skeleton falls back to the world-unit Line
    // threshold sized to the layout in linePickRef
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line2 = { threshold: 8 };
    const ndc = new THREE.Vector2();
    const castFrom = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
    };
    const pickArc = (event: PointerEvent) => {
      if (!onTrailClickRef.current || !trailRef.current) return undefined;
      castFrom(event);
      return trailRef.current.pick(raycaster);
    };
    type BranchPick = { childPath?: string; childFileId?: number };
    const pickBranch = (event: PointerEvent): BranchPick | undefined => {
      const edges = edgesRef.current;
      if (!edges) return undefined;
      castFrom(event);
      raycaster.params.Line = { threshold: linePickRef.current };
      const targets: THREE.Object3D[] = [edges];
      for (const batch of [branchMidRef.current, branchHotRef.current]) {
        if (batch?.object.visible) targets.push(batch.object);
      }
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) return undefined;
      if (hit.object === edges) {
        if (hit.index === undefined) return undefined;
        // segment vertices accumulate in edgeMeta order; walk to the owner
        let vertex = 0;
        for (const meta of edgeMetaRef.current) {
          vertex += meta.vertexCount;
          if (hit.index < vertex) return meta;
        }
        return undefined;
      }
      const batch = hit.object === branchMidRef.current?.object ? branchMidRef.current : branchHotRef.current;
      const owner = typeof hit.faceIndex === "number" ? batch?.ownerAt(hit.faceIndex) : undefined;
      return owner !== undefined ? edgeMetaRef.current[owner] : undefined;
    };

    // smooth focus flight: the framing math mirrors fitView (same direction,
    // same breathing room); the motion is a per-frame lerp in the render loop
    const flyToPoints = (points: THREE.Vector3[]) => {
      if (points.length === 0) return;
      const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
      const fitted = fitDistance(
        camera,
        VIEW_DIR,
        points.map((point) => point.clone().sub(center))
      );
      if (fitted === null) return;
      const distance = THREE.MathUtils.clamp(fitted * 1.12, controls.minDistance, controls.maxDistance);
      controls.autoRotate = false;
      flyRef.current = {
        position: center.clone().addScaledVector(VIEW_DIR, distance),
        target: center
      };
    };
    const flyToSubtree = (branch: BranchPick) => {
      const treeLayout = layoutRef.current;
      if (!treeLayout) return;
      const points: THREE.Vector3[] = [];
      if (branch.childFileId !== undefined) {
        const pos = treeLayout.leaf.get(branch.childFileId);
        if (pos) points.push(new THREE.Vector3(pos.x, LEAF_Y, pos.z));
      } else if (branch.childPath) {
        const prefix = `${branch.childPath}/`;
        for (const file of filesRef.current) {
          if (!file.path.startsWith(prefix)) continue;
          const pos = treeLayout.leaf.get(file.id);
          if (pos) points.push(new THREE.Vector3(pos.x, LEAF_Y, pos.z));
        }
        const dir = dirByPathRef.current.get(branch.childPath);
        if (dir) points.push(new THREE.Vector3(dir.x, BRANCH_LIT_Y, dir.z));
      }
      flyToPoints(points);
    };
    const flyHome = () => {
      const home = homeRef.current;
      if (!home) return;
      controls.autoRotate = false;
      flyRef.current = { position: home.position.clone(), target: home.target.clone() };
    };

    // pin lifecycle: a qualifying click records (or just moves) the pin and
    // its persistent highlight; empty ground and Esc clear both and tell the
    // view, so the card and the lift always leave together
    let pinCardSeen = false;
    const setPin = (pin: TreePin | null) => {
      pinCardSeen = false;
      const prev = pinRef.current;
      pinRef.current = pin;
      trailRef.current?.setPinned(pin?.arcSeq ?? -1);
      branchTintRef.current?.();
      if (!pin && prev) onPinClearedRef.current?.();
    };
    // where a branch pin anchors: the child dir node, or the leaf itself
    const branchAnchor = (branch: BranchPick): THREE.Vector3 | undefined => {
      const treeLayout = layoutRef.current;
      if (!treeLayout) return undefined;
      if (branch.childFileId !== undefined) {
        const pos = treeLayout.leaf.get(branch.childFileId);
        return pos ? new THREE.Vector3(pos.x, LEAF_Y, pos.z) : undefined;
      }
      if (branch.childPath) {
        const dir = dirByPathRef.current.get(branch.childPath);
        return dir ? new THREE.Vector3(dir.x, BRANCH_LIT_Y, dir.z) : undefined;
      }
      return undefined;
    };

    const setBranchHover = (branch: BranchPick | undefined) => {
      const prev = hoverBranchRef.current;
      const next = branch ? { path: branch.childPath, fileId: branch.childFileId } : null;
      const same =
        prev === next || (prev !== null && next !== null && prev.path === next.path && prev.fileId === next.fileId);
      if (same) return;
      hoverBranchRef.current = next;
      branchTintRef.current?.();
    };

    let downAt: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    // click priority: arc (names an exact event) → leaf (18px pick radius)
    // → branch (fly to its subtree) → empty ground (deselect + full fit)
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
      const file = pickFile(event);
      if (file) {
        onSelect(file.path);
        return;
      }
      const branch = pickBranch(event);
      if (branch) {
        // the fly-to framing stays exactly as before; the region report is
        // additive — a dir edge names its child dir, a file edge its parent
        flyToSubtree(branch);
        let region = branch.childPath;
        if (region === undefined && branch.childFileId !== undefined) {
          const leafFile = filesRef.current[branch.childFileId];
          const slash = leafFile ? leafFile.path.lastIndexOf("/") : -1;
          if (slash > 0) region = leafFile.path.slice(0, slash);
        }
        if (region && onRegionClickRef.current) {
          // pin at the child node so the card rides the subtree it names
          const point = branchAnchor(branch);
          setPin(point ? { point, branch: { path: branch.childPath, fileId: branch.childFileId } } : null);
          onRegionClickRef.current(region);
        }
        return;
      }
      onSelect(undefined);
      setPin(null);
      flyHome();
    };
    // hover: cursor + one-line readout, throttled to one pick per frame
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
          setBranchHover(undefined);
          renderer.domElement.style.cursor = "pointer";
          tip.show(arc.path, "click to jump", event.clientX, event.clientY);
          return;
        }
        const file = pickFile(event);
        if (file) {
          setBranchHover(undefined);
          renderer.domElement.style.cursor = "pointer";
          const snapshot = playbackRef.current;
          const touch = snapshot.touchByPath.get(file.path);
          const visits = snapshot.visitsByFile.get(file.id) ?? 0;
          const meta = touch
            ? `${touchWord(touch)} · ${visits} visit${visits === 1 ? "" : "s"}`
            : touchWord(undefined);
          tip.show(file.path, file.ghost ? `${meta} · ghost` : meta, event.clientX, event.clientY);
          return;
        }
        const branch = pickBranch(event);
        setBranchHover(branch);
        renderer.domElement.style.cursor = branch ? "pointer" : "";
        if (!branch) {
          tip.hide();
          return;
        }
        if (branch.childFileId !== undefined) {
          const leafFile = filesRef.current[branch.childFileId];
          if (leafFile) tip.show(leafFile.path, "click to frame", event.clientX, event.clientY);
          else tip.hide();
        } else if (branch.childPath) {
          const dir = dirByPathRef.current.get(branch.childPath);
          const meta = dir ? `${dir.fileCount} files · click to frame` : "click to frame";
          tip.show(branch.childPath, meta, event.clientX, event.clientY);
        }
      });
    };
    const onPointerLeave = () => {
      tip.hide();
      renderer.domElement.style.cursor = "";
      trailRef.current?.setHover(-1);
      setBranchHover(undefined);
    };
    // Esc rides the empty-ground path: drop the selection and pin, fly home
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
      branchMidRef.current?.setResolution(w, h);
      branchHotRef.current?.setResolution(w, h);
      if (fitPendingRef.current?.()) fitPendingRef.current = null;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const clock = new THREE.Clock();
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
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

      // pools of light grow toward their attention radius
      const halos = haloMeshRef.current;
      const slots = slotsRef.current;
      const radii = radiiRef.current;
      const treeLayout = layoutRef.current;
      if (halos && treeLayout && slots.length > 0) {
        let moving = false;
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const pos = treeLayout.leaf.get(slot.fileId);
          if (!pos) continue;
          let cur = radii.get(slot.fileId) ?? 0;
          const diff = slot.target - cur;
          if (Math.abs(diff) > 0.015) {
            cur = reducedRef.current ? slot.target : cur + diff * 0.12;
            radii.set(slot.fileId, cur);
            moving = true;
          } else if (cur !== slot.target) {
            radii.set(slot.fileId, slot.target);
            cur = slot.target;
            moving = true;
          }
          matrix.compose(
            new THREE.Vector3(pos.x, 0.06, pos.z),
            quaternion,
            new THREE.Vector3(Math.max(cur, 0.01) * 2, Math.max(cur, 0.01) * 2, 1)
          );
          halos.setMatrixAt(i, matrix);
        }
        if (moving) halos.instanceMatrix.needsUpdate = true;
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

  // grow the skeleton: ground, edges, leaves, labels
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    filesRef.current = city?.files ?? [];
    layoutRef.current = layout;
    slotsRef.current = [];
    radiiRef.current = new Map();
    // a rebuilt world invalidates the pinned point; drop it quietly
    pinRef.current = null;
    if (!city || !layout) return;

    const group = new THREE.Group();
    const size = layout.radius * 2.3;

    scene.fog = new THREE.Fog(SKY, size * 2.1, size * 4.2);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 6, size * 6),
      new THREE.MeshStandardMaterial({ color: "#101318", roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.25;
    group.add(ground);

    const grid = new THREE.GridHelper(size * 2.4, 40, "#242832", "#1b1f27");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    grid.position.y = -0.24;
    group.add(grid);

    // branch skeleton, one segment soup with per-vertex colors
    const positions: number[] = [];
    const edgeMeta: { childPath?: string; childFileId?: number; vertexCount: number }[] = [];
    for (const edge of layout.edges) {
      let count = 0;
      for (let i = 0; i < edge.points.length - 1; i++) {
        positions.push(edge.points[i].x, 0.12, edge.points[i].z);
        positions.push(edge.points[i + 1].x, 0.12, edge.points[i + 1].z);
        count += 2;
      }
      edgeMeta.push({ childPath: edge.childPath, childFileId: edge.childFileId, vertexCount: count });
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const edgeColors = new Float32Array(positions.length);
    edgeGeo.setAttribute("color", new THREE.BufferAttribute(edgeColors, 3));
    const edges = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })
    );
    edgesRef.current = edges;
    edgeMetaRef.current = edgeMeta;
    group.add(edges);

    // attention-lit branches re-draw as fat overlays above the skeleton;
    // width class carries the subtree's accumulated visits
    const canvasSize = rendererRef.current?.getSize(new THREE.Vector2()) ?? new THREE.Vector2(1, 1);
    const branchMid = new FatLineBatch(BRANCH_LIT_PX, EDGE_LIT);
    const branchHot = new FatLineBatch(BRANCH_HOT_PX, EDGE_LIT);
    branchMid.setResolution(canvasSize.x, canvasSize.y);
    branchHot.setResolution(canvasSize.x, canvasSize.y);
    branchMidRef.current = branchMid;
    branchHotRef.current = branchHot;
    group.add(branchMid.object, branchHot.object);

    dirByPathRef.current = new Map(layout.dirs.map((dir) => [dir.path, dir]));
    // thin-line pick reach scales with the tree so clicks stay forgiving
    linePickRef.current = Math.max(0.35, layout.radius * 0.008);
    flyRef.current = null;

    // leaves: one orb per file, sized by sqrt(lines) — solid for files on
    // disk, wireframe for ghosts (touched in the session, gone from the
    // repo): shape separates them where a third grey never could.
    // state colors must not fade with distance, so leaf-like materials
    // opt out of the fog; only the ground plane keeps the depth cue
    const leafGeo = new THREE.SphereGeometry(0.5, 10, 8);
    const leafMat = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, city.files.length);
    leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(city.files.length * 3), 3);
    const ghostFiles = city.files.filter((file) => file.ghost);
    const ghostIndex = new Map<number, number>();
    ghostFiles.forEach((file, i) => ghostIndex.set(file.id, i));
    ghostIndexRef.current = ghostIndex;
    const matrix = new THREE.Matrix4();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const file of city.files) {
      const pos = layout.leaf.get(file.id);
      if (!pos) continue;
      if (file.ghost) {
        leaves.setMatrixAt(file.id, hidden);
        continue;
      }
      const scale = Math.min(0.24 + Math.sqrt(Math.max(file.lines, 1)) * 0.045, 1.05);
      matrix.compose(new THREE.Vector3(pos.x, LEAF_Y, pos.z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      leaves.setMatrixAt(file.id, matrix);
      leaves.setColorAt(file.id, colors.unvisited);
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    leafMeshRef.current = leaves;
    group.add(leaves);

    let ghosts: THREE.InstancedMesh | null = null;
    if (ghostFiles.length > 0) {
      ghosts = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.55, 8, 5),
        new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.85, toneMapped: false, fog: false }),
        ghostFiles.length
      );
      ghosts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(ghostFiles.length * 3), 3);
      for (const file of ghostFiles) {
        const pos = layout.leaf.get(file.id);
        const i = ghostIndex.get(file.id)!;
        if (!pos) {
          ghosts.setMatrixAt(i, hidden);
          continue;
        }
        const scale = Math.min(0.24 + Math.sqrt(Math.max(file.lines, 1)) * 0.045, 1.05) * 0.8;
        matrix.compose(new THREE.Vector3(pos.x, LEAF_Y, pos.z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
        ghosts.setMatrixAt(i, matrix);
        ghosts.setColorAt(i, colors.ghost);
      }
      ghosts.instanceMatrix.needsUpdate = true;
      if (ghosts.instanceColor) ghosts.instanceColor.needsUpdate = true;
      ghosts.raycast = () => undefined;
      group.add(ghosts);
    }
    ghostMeshRef.current = ghosts;

    // pools of light under visited leaves — normal blending with a fixed
    // alpha: additive stacking burned dense directories into one white
    // blob and erased the per-file radius
    const halos = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: haloTexture(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        toneMapped: false,
        fog: false
      }),
      city.files.length
    );
    halos.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(city.files.length * 3), 3);
    halos.count = 0;
    halos.frustumCulled = false;
    halos.raycast = () => undefined;
    haloMeshRef.current = halos;
    group.add(halos);

    // directory labels: screen-space LOD in the render loop decides which
    // of the biggest subtrees show their name
    labelSetRef.current = new DirLabelSet(layout.dirs, group, LABEL_Y);

    const firefly = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fireflyTexture(),
        color: FIREFLY_HOT,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false
      })
    );
    firefly.userData.baseScale = Math.max(size * 0.026, 2.2);
    firefly.visible = false;
    fireflyRef.current = firefly;
    group.add(firefly);

    // selection is a shape, not a recolor: the ring + beam mark the leaf
    // while its touch color stays intact
    const selectionMat = new THREE.MeshBasicMaterial({
      color: colors.selected,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
      fog: false
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 48), selectionMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.raycast = () => undefined;
    group.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 6, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: colors.selected,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false
      })
    );
    beam.visible = false;
    beam.raycast = () => undefined;
    group.add(beam);
    selectionRef.current = { ring, beam };

    const trail = new TrailRenderer(1.6);
    trail.setResolution(canvasSize.x, canvasSize.y);
    trailRef.current = trail;
    group.add(trail.object);

    groupRef.current = group;
    scene.add(group);

    // keep the canonical viewing direction, but pull back exactly far
    // enough that every leaf fits the viewport's frustum — nominal radius
    // ignores the aspect ratio and overflows short windows
    const fitView = (): boolean => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return true;
      const points = [...layout.leaf.values()].map((pos) => new THREE.Vector3(pos.x, LEAF_Y, pos.z));
      const fitted = fitDistance(camera, VIEW_DIR, points);
      if (fitted === null) return false;
      // breathing room so edge leaves clear the HUD overlays
      const distance = fitted * 1.12;
      camera.position.copy(VIEW_DIR).multiplyScalar(distance);
      controls.target.set(0, 0, 0);
      controls.minDistance = size * 0.15;
      controls.maxDistance = Math.max(size * 2.4, distance * 1.2);
      controls.update();
      // remember the full fit so Esc / empty ground can fly back to it
      homeRef.current = { position: camera.position.clone(), target: new THREE.Vector3(0, 0, 0) };
      return true;
    };
    fitPendingRef.current = fitView() ? null : fitView;

    return () => {
      fitPendingRef.current = null;
      disposeGroup(group);
      scene.remove(group);
      groupRef.current = null;
      leafMeshRef.current = null;
      ghostMeshRef.current = null;
      ghostIndexRef.current = new Map();
      selectionRef.current = null;
      haloMeshRef.current = null;
      edgesRef.current = null;
      branchMidRef.current = null;
      branchHotRef.current = null;
      branchTintRef.current = null;
      hoverBranchRef.current = null;
      dirByPathRef.current = new Map();
      flyRef.current = null;
      homeRef.current = null;
      trailRef.current = null;
      fireflyRef.current = null;
      labelSetRef.current = null;
    };
  }, [city, layout]);

  // playback → leaf colors, halo targets, branch tinting
  useEffect(() => {
    const leaves = leafMeshRef.current;
    const ghosts = ghostMeshRef.current;
    const ghostIndex = ghostIndexRef.current;
    const halos = haloMeshRef.current;
    const edges = edgesRef.current;
    if (!leaves || !halos || !edges || !city || !layout) return;

    const radii = radiiRef.current;
    const slots: HaloSlot[] = [];
    const present = new Set<number>();
    for (const file of city.files) {
      const touch = playback.touchByFile.get(file.id);
      let leafColor = file.ghost ? colors.ghost : colors.unvisited;
      if (touch) {
        leafColor = colors[touch];
        const visits = playback.visitsByFile.get(file.id) ?? 1;
        slots.push({ fileId: file.id, target: haloRadius(visits), color: colors[touch] });
        present.add(file.id);
      }
      if (file.ghost) {
        const i = ghostIndex.get(file.id);
        if (ghosts && i !== undefined) ghosts.setColorAt(i, leafColor);
      } else {
        leaves.setColorAt(file.id, leafColor);
      }
    }
    for (const [fileId, cur] of radii) {
      if (cur > 0.04 && !present.has(fileId)) {
        slots.push({ fileId, target: 0, color: colors.unvisited });
      } else if (cur <= 0.04 && !present.has(fileId)) {
        radii.delete(fileId);
      }
    }
    slots.forEach((slot, i) => halos.setColorAt(i, slot.color));
    halos.count = slots.length;
    if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    if (ghosts?.instanceColor) ghosts.instanceColor.needsUpdate = true;
    slotsRef.current = slots;

    // branches carry the light as width: every visited file adds its visit
    // count to each ancestor directory, so an edge weighs its whole subtree
    const subtreeVisits = new Map<string, number>();
    for (const [fileId, visits] of playback.visitsByFile) {
      const file = city.files[fileId];
      if (!file) continue;
      const parts = file.path.split("/");
      let path = "";
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        subtreeVisits.set(path, (subtreeVisits.get(path) ?? 0) + visits);
      }
    }
    const sums = edgeMetaRef.current.map((meta) => {
      if (meta.childFileId !== undefined) return playback.visitsByFile.get(meta.childFileId) ?? 0;
      if (meta.childPath) return subtreeVisits.get(meta.childPath) ?? 0;
      return 0;
    });
    const hotAt = hotThreshold(sums.filter((sum) => sum > 0));
    const midPositions: number[] = [];
    const midOwners: number[] = [];
    const hotPositions: number[] = [];
    const hotOwners: number[] = [];
    edgeMetaRef.current.forEach((meta, index) => {
      const sum = sums[index];
      if (sum <= 0) return;
      const positions = sum >= hotAt ? hotPositions : midPositions;
      const owners = sum >= hotAt ? hotOwners : midOwners;
      // edgeMeta order equals layout.edges order, so the points line up
      const pts = layout.edges[index].points;
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].x, BRANCH_LIT_Y, pts[i].z, pts[i + 1].x, BRANCH_LIT_Y, pts[i + 1].z);
        owners.push(index);
      }
    });
    branchMidRef.current?.setSegments(midPositions, midOwners);
    branchHotRef.current?.setSegments(hotPositions, hotOwners);

    // brighten branches that lead to light — and lift the hovered subtree,
    // plus the pinned one, so the card's object stays lit while the pointer
    // roams. Rebuilt per snapshot, re-run when hover or pin changes.
    const colorAttr = edges.geometry.getAttribute("color") as THREE.BufferAttribute;
    const tint = new THREE.Color();
    const applyTint = () => {
      const hovered = hoverBranchRef.current;
      const pinned = pinRef.current?.branch ?? null;
      const within = (
        meta: { childPath?: string; childFileId?: number },
        sel: { path?: string; fileId?: number } | null
      ): boolean => {
        if (!sel) return false;
        if (sel.fileId !== undefined) return meta.childFileId === sel.fileId;
        if (sel.path === undefined) return false;
        if (meta.childPath !== undefined) {
          return meta.childPath === sel.path || meta.childPath.startsWith(`${sel.path}/`);
        }
        if (meta.childFileId !== undefined) {
          const file = city.files[meta.childFileId];
          return Boolean(file && file.path.startsWith(`${sel.path}/`));
        }
        return false;
      };
      const lifted = (meta: { childPath?: string; childFileId?: number }): boolean =>
        within(meta, hovered) || within(meta, pinned);
      let vertex = 0;
      edgeMetaRef.current.forEach((meta, index) => {
        tint.copy(sums[index] > 0 ? EDGE_LIT : EDGE_BASE);
        if (lifted(meta)) tint.multiplyScalar(HOVER_LIFT);
        for (let v = 0; v < meta.vertexCount; v++) {
          colorAttr.setXYZ(vertex++, tint.r, tint.g, tint.b);
        }
      });
      colorAttr.needsUpdate = true;
      branchMidRef.current?.tint((owner) => lifted(edgeMetaRef.current[owner]));
      branchHotRef.current?.tint((owner) => lifted(edgeMetaRef.current[owner]));
    };
    branchTintRef.current = applyTint;
    applyTint();
  }, [city, layout, playback]);

  // selection marker follows the selected leaf
  useEffect(() => {
    const selection = selectionRef.current;
    if (!selection || !city || !layout) return;
    const file = selectedPath ? city.files.find((f) => f.path === selectedPath) : undefined;
    const pos = file ? layout.leaf.get(file.id) : undefined;
    if (pos) {
      selection.ring.position.set(pos.x, 0.1, pos.z);
      selection.beam.position.set(pos.x, 3, pos.z);
      selection.ring.visible = true;
      selection.beam.visible = true;
      // the inspector opens over the right edge; pan the leaf clear of it
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const canvas = rendererRef.current?.domElement;
      if (camera && controls && canvas) {
        controls.autoRotate = false;
        // an instant pan and an in-flight framing cannot share the camera
        flyRef.current = null;
        ensureVisible(
          camera,
          controls,
          new THREE.Vector3(pos.x, LEAF_Y, pos.z),
          canvas.clientWidth,
          canvas.clientHeight,
          INSPECTOR_RESERVED_PX
        );
      }
    } else {
      selection.ring.visible = false;
      selection.beam.visible = false;
    }
  }, [city, layout, selectedPath]);

  // trail arcs + firefly
  useEffect(() => {
    const trail = trailRef.current;
    if (!trail || !city || !layout) return;

    // each fixation keeps the event behind it (seq → click-to-jump,
    // magnitude → arc width); the sidecar is filtered exactly like the
    // points, so arc and event indices never skew
    const events = resolveRecentEvents(playback);
    const fixations: TrailFixation[] = [];
    playback.recentTargets.forEach((target, i) => {
      // playback resolves fileId with the same path key the citymap uses, so
      // a target still missing one has no leaf to land on
      const file = target.fileId !== undefined ? city.files[target.fileId] : undefined;
      if (!file) return;
      const pos = layout.leaf.get(file.id);
      if (!pos) return;
      fixations.push({
        point: new THREE.Vector3(pos.x, LEAF_Y + 0.3, pos.z),
        path: target.path,
        seq: events[i]?.seq,
        magnitude: eventMagnitude(events[i])
      });
    });

    const firefly = fireflyRef.current;
    if (firefly) {
      const head = fixations[fixations.length - 1];
      if (head) {
        // the arc rides 0.3 above the leaf, the firefly 1.7 — hence +1.4
        firefly.position.set(head.point.x, head.point.y + 1.4, head.point.z);
        firefly.visible = true;
      } else {
        firefly.visible = false;
      }
    }

    trail.update(fixations);
  }, [city, layout, playback]);

  return <div className="city-scene" ref={hostRef} aria-label="Firefly tree" />;
}
