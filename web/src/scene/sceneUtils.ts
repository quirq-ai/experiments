import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { Touch, TraceEvent } from "../types";
import type { FilePlayback } from "../playback/reducer";

// Shared scene vocabulary. The touch colors are the meaning the HUD legend
// promises; both scenes must draw them identically. Ambient colors (ground,
// unvisited, ghost) stay per-scene tuning.
export const SKY = new THREE.Color("#0b0c0f");
export const EMBER = new THREE.Color("#c8674c");

// Lit emissive tints of the HUD swatches: the scene may glow lighter than the
// flat legend colors, but hue family and salience order (edit > read > hit)
// must match what the legend promises.
export const touchColors: Record<Touch | "selected", THREE.Color> = {
  hit: new THREE.Color("#a8a24e"),
  // chromatic enough to read as steel blue on lit terrain columns — a paler
  // tint washed out to white and stopped matching the HUD legend
  read: new THREE.Color("#9dc0e8"),
  edit: new THREE.Color("#a8d94f"),
  selected: new THREE.Color("#e9e4d9")
};

// Structural linework (tree branches, district borders) shares one neutral
// pair: dark hairline for the unlit skeleton, warm grey where attention
// accumulated. Magnitude never gets a hue of its own — it lives in width.
export const EDGE_BASE = new THREE.Color("#242832");
export const EDGE_LIT = new THREE.Color("#7d786d");

// hover feedback is a brightness lift on the existing color, never a recolor
export const HOVER_LIFT = 1.35;

// World-anchored detail cards: the card sits beside the object it describes,
// offset off the anchor point and clamped into the host with fixed margins.
const PIN_OFFSET_X = 14;
const PIN_OFFSET_Y = -10;
const PIN_MARGIN = 12;
const pinNdc = new THREE.Vector3();

// Park a view-owned card element beside a pinned world point: project the
// point through the camera, offset the card off the object, clamp it into the
// host bounds, and flag `data-offscreen` when the point sits behind the camera
// or entirely outside the view. Driven from the scenes' render loops so the
// card rides orbit, damping, and fly-to without a single React render.
export function anchorPinnedElement(
  el: HTMLElement,
  point: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  hostW: number,
  hostH: number
) {
  if (hostW === 0 || hostH === 0) return;
  pinNdc.copy(point).project(camera);
  const px = ((pinNdc.x + 1) / 2) * hostW;
  const py = ((1 - pinNdc.y) / 2) * hostH;
  // z > 1 is the behind-camera guard the leaf picker already relies on
  const offscreen = pinNdc.z > 1 || px < 0 || px > hostW || py < 0 || py > hostH;
  const left = THREE.MathUtils.clamp(
    px + PIN_OFFSET_X,
    PIN_MARGIN,
    Math.max(PIN_MARGIN, hostW - el.offsetWidth - PIN_MARGIN)
  );
  const top = THREE.MathUtils.clamp(
    py + PIN_OFFSET_Y,
    PIN_MARGIN,
    Math.max(PIN_MARGIN, hostH - el.offsetHeight - PIN_MARGIN)
  );
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.dataset.offscreen = offscreen ? "1" : "0";
}

// Distance along `dir` that fits every point inside the camera frustum.
// Returns null while the viewport has no usable aspect (hidden pane, tab in
// the background, mid-layout) — fitting then would park the camera at NaN
// forever; callers must retry once a real resize lands.
export function fitDistance(
  camera: THREE.PerspectiveCamera,
  dir: THREE.Vector3,
  points: Iterable<THREE.Vector3>
): number | null {
  if (!Number.isFinite(camera.aspect) || camera.aspect <= 0) return null;
  const forward = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  let distance = 0;
  for (const point of points) {
    const depth = point.dot(forward);
    distance = Math.max(
      distance,
      Math.abs(point.dot(right)) / tanH - depth,
      Math.abs(point.dot(up)) / tanV - depth
    );
  }
  return distance;
}

// Pan the camera (position + orbit target together, so the view direction
// holds) until `world` projects inside the viewport's safe area. The right
// margin reserves room for the inspector panel, which would otherwise sit
// exactly on top of the leaf the user just selected.
export function ensureVisible(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  world: THREE.Vector3,
  viewW: number,
  viewH: number,
  reservedRight: number
) {
  if (viewW === 0 || viewH === 0) return;
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const depth = world.clone().sub(camera.position).dot(forward);
  if (depth <= 0) return; // behind the camera: panning math breaks down
  const projected = world.clone().project(camera);
  const sx = ((projected.x + 1) / 2) * viewW;
  const sy = ((1 - projected.y) / 2) * viewH;
  const safeL = 48;
  const safeR = Math.max(safeL + 60, viewW - reservedRight - 48);
  const safeT = 120;
  const safeB = viewH - 100;
  const targetX = Math.min(Math.max(sx, safeL), safeR);
  const targetY = Math.min(Math.max(sy, safeT), safeB);
  if (targetX === sx && targetY === sy) return;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward);
  // moving the camera right shifts the point left on screen, and vice versa
  const pan = right
    .multiplyScalar(((sx - targetX) * 2 * depth * tanH) / viewW)
    .addScaledVector(up, ((targetY - sy) * 2 * depth * tanV) / viewH);
  camera.position.add(pan);
  controls.target.add(pan);
  controls.update();
}

// One-line hover readout, driven imperatively from the scenes' pointermove
// handlers so hovering never re-renders the React tree.
export class SceneTip {
  private readonly el: HTMLDivElement;
  private readonly pathEl: HTMLSpanElement;
  private readonly metaEl: HTMLSpanElement;

  constructor(private readonly host: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "scene-tip";
    this.pathEl = document.createElement("span");
    this.metaEl = document.createElement("span");
    this.metaEl.className = "dim";
    this.el.append(this.pathEl, this.metaEl);
    host.appendChild(this.el);
  }

  show(path: string, meta: string, clientX: number, clientY: number) {
    this.pathEl.textContent = path;
    this.metaEl.textContent = ` · ${meta}`;
    this.el.style.display = "block";
    const bounds = this.host.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    const left = Math.min(x + 14, Math.max(0, bounds.width - this.el.offsetWidth - 8));
    const top = Math.min(y + 16, Math.max(0, bounds.height - this.el.offsetHeight - 8));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  hide() {
    this.el.style.display = "none";
  }

  dispose() {
    this.el.remove();
  }
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
      obj.geometry?.dispose();
      const mat = obj.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(disposeMaterial);
      else if (mat) disposeMaterial(mat);
    }
  });
}

function disposeMaterial(mat: THREE.Material) {
  // Material.dispose() does not free assigned textures; module-cached
  // textures (fireflyTexture/haloTexture) are marked shared and must survive.
  const map = (mat as THREE.Material & { map?: THREE.Texture | null }).map;
  if (map && !map.userData.shared) map.dispose();
  mat.dispose();
}

// The playback engine strips the event off each recentTargets entry, but
// historyByPath keeps every event a path saw — and recentTargets are exactly
// the primary targets of the last target-carrying events, in order. So the
// k-th-from-last visit to a path is the k-th-from-last history entry whose
// primary target is that path. Per-session snapshots recover the exact event;
// merged one-world histories concatenate per lane, so there this is
// best-effort (and the one-world scenes leave arc clicks unwired anyway).
export function resolveRecentEvents(playback: FilePlayback): (TraceEvent | undefined)[] {
  const consumed = new Map<string, number>();
  const events: (TraceEvent | undefined)[] = new Array(playback.recentTargets.length).fill(undefined);
  for (let i = playback.recentTargets.length - 1; i >= 0; i--) {
    const path = playback.recentTargets[i].path;
    let skip = consumed.get(path) ?? 0;
    consumed.set(path, skip + 1);
    const history = playback.historyByPath.get(path);
    if (!history) continue;
    for (let j = history.length - 1; j >= 0; j--) {
      const event = history[j];
      // mirror the engine's primary-target choice: skip weak (heuristic) hits
      const primary = event.targets.find((target) => !target.weak) ?? event.targets[0];
      if (!primary || primary.path !== path) continue;
      if (skip === 0) {
        events[i] = event;
        break;
      }
      skip--;
    }
  }
  return events;
}

// How much an event moved: total line-span across its targets; result size
// stands in when no tool reported line ranges; 1 keeps tiny events visible.
export function eventMagnitude(event: TraceEvent | undefined): number {
  if (!event) return 1;
  let span = 0;
  for (const target of event.targets) {
    for (const [from, to] of target.lines ?? []) {
      span += Math.max(0, to - from + 1);
    }
  }
  if (span > 0) return span;
  return event.resultBytes > 0 ? event.resultBytes / 2048 : 1;
}

// Two-class magnitude split: the p85 quantile of the nonzero attention sums
// separates the merely-lit from the truly-hot. Ties land hot, so a lone lit
// subtree still reads as the loudest thing on screen.
export function hotThreshold(nonzero: number[]): number {
  if (nonzero.length === 0) return Infinity;
  const sorted = [...nonzero].sort((a, b) => a - b);
  return sorted[Math.floor(0.85 * (sorted.length - 1))];
}

// A rebuildable batch of fat line segments sharing one pixel width — one
// batch per width class, membership rewritten wholesale when the playback
// snapshot changes. Fat lines (LineSegments2) raycast in screen space, so
// widths picked for meaning double as comfortable click targets.
export class FatLineBatch {
  readonly object: LineSegments2;
  // per-segment owner index (caller-defined), parallel to the instance list
  private owners: number[] = [];
  private readonly base: THREE.Color;

  constructor(widthPx: number, color: THREE.Color) {
    this.base = color.clone();
    const material = new LineMaterial({ linewidth: widthPx, vertexColors: true });
    this.object = new LineSegments2(new LineSegmentsGeometry(), material);
    this.object.visible = false;
    this.object.frustumCulled = false;
  }

  // resolution feeds both the shader (px → clip units) and screen-space picks
  setResolution(width: number, height: number) {
    this.object.material.resolution.set(width, height);
  }

  // positions come as segment pairs (xyz xyz per segment), owners one per
  // segment; the old geometry is disposed, not mutated — replacing attributes
  // in place would leak their GL buffers
  setSegments(positions: number[], owners: number[]) {
    this.object.geometry.dispose();
    const geometry = new LineSegmentsGeometry();
    if (positions.length > 0) {
      geometry.setPositions(positions);
      const colors = new Float32Array(positions.length);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = this.base.r;
        colors[i + 1] = this.base.g;
        colors[i + 2] = this.base.b;
      }
      geometry.setColors(colors);
    }
    this.object.geometry = geometry;
    this.owners = owners;
    this.object.visible = positions.length > 0;
  }

  ownerAt(segmentIndex: number): number | undefined {
    return this.owners[segmentIndex];
  }

  // hover: rewrite the interleaved color buffer in place — lifted owners
  // brighten, everything else returns to base
  tint(lifted: (owner: number) => boolean) {
    if (this.owners.length === 0) return;
    const attr = this.object.geometry.attributes.instanceColorStart as THREE.InterleavedBufferAttribute | undefined;
    if (!attr) return;
    const array = attr.data.array as Float32Array;
    const up = this.base.clone().multiplyScalar(HOVER_LIFT);
    for (let i = 0; i < this.owners.length; i++) {
      const color = lifted(this.owners[i]) ? up : this.base;
      const at = i * 6;
      array[at] = color.r;
      array[at + 1] = color.g;
      array[at + 2] = color.b;
      array[at + 3] = color.r;
      array[at + 4] = color.g;
      array[at + 5] = color.b;
    }
    attr.data.needsUpdate = true;
  }
}
