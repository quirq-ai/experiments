import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { EMBER, HOVER_LIFT } from "./sceneUtils";

const SAMPLES = 14;
const MAX_ARCS = 11; // playback keeps 12 recent targets → at most 11 arcs

// magnitude → stroke width: log-compressed pixels, so a 500-line edit reads
// clearly fatter than a 3-line peek without any arc outgrowing the scene
function arcWidth(magnitude: number): number {
  return 1 + 2.2 * Math.min(1, Math.log2(1 + Math.max(magnitude, 0)) / 6);
}

// one recent fixation: where the walker landed, plus the event that put it
// there — seq drives click-to-jump, magnitude drives the stroke width
export interface TrailFixation {
  point: THREE.Vector3;
  path: string;
  seq?: number;
  magnitude: number;
}

export interface TrailHit {
  index: number;
  seq: number;
  path: string;
  // the arc's apex (bezier point at t=0.5): where a world-anchored card pins
  apex: THREE.Vector3;
}

// Fixed-capacity trail: the arc soup changes every playback tick, so each
// arc's fat-line geometry is allocated once and only its interleaved segment
// buffer is rewritten in place. Fat lines (Line2) give the per-arc pixel
// widths and screen-space raycasting that LineBasicMaterial cannot.
export class TrailRenderer {
  readonly object: THREE.Group;
  private readonly lines: Line2[] = [];
  private readonly buffers: THREE.InterleavedBuffer[] = [];
  private readonly meta: (TrailFixation | undefined)[] = new Array(MAX_ARCS).fill(undefined);
  private readonly intensity = new Float32Array(MAX_ARCS);
  private readonly lift: number;
  private active = 0;
  private hovered = -1;
  // a pinned arc is remembered by event seq, not slot index — the arc soup
  // reshuffles every playback tick and seq is the only identity that holds
  private pinnedSeq = -1;
  private readonly apexes = Array.from({ length: MAX_ARCS }, () => new THREE.Vector3());
  private readonly arcPoints = Array.from({ length: SAMPLES + 1 }, () => new THREE.Vector3());
  private readonly mid = new THREE.Vector3();
  private readonly curve = new THREE.QuadraticBezierCurve3();

  constructor(lift: number) {
    this.lift = lift;
    this.object = new THREE.Group();
    for (let i = 0; i < MAX_ARCS; i++) {
      const geometry = new LineGeometry();
      geometry.setPositions(new Float32Array((SAMPLES + 1) * 3));
      const start = geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute;
      start.data.setUsage(THREE.DynamicDrawUsage);
      const material = new LineMaterial({
        color: EMBER.getHex(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        linewidth: 1
      });
      const line = new Line2(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      this.lines.push(line);
      this.buffers.push(start.data);
      this.object.add(line);
    }
  }

  // resolution feeds both the shader (px → clip units) and screen-space picks
  setResolution(width: number, height: number) {
    for (const line of this.lines) {
      line.material.resolution.set(width, height);
    }
  }

  // fixations are the recent landings, oldest first, y already at arc height
  update(fixations: TrailFixation[]) {
    const arcs = Math.min(Math.max(fixations.length - 1, 0), MAX_ARCS);
    const start = fixations.length - 1 - arcs;
    this.active = arcs;
    this.hovered = -1;
    for (let i = 1; i <= arcs; i++) {
      const a = fixations[start + i - 1].point;
      const to = fixations[start + i];
      const b = to.point;
      this.mid.copy(a).lerp(b, 0.5);
      this.mid.y = Math.max(a.y, b.y) + a.distanceTo(b) * 0.22 + this.lift;
      this.curve.v0.copy(a);
      this.curve.v1.copy(this.mid);
      this.curve.v2.copy(b);
      for (let s = 0; s <= SAMPLES; s++) {
        this.curve.getPoint(s / SAMPLES, this.arcPoints[s]);
      }
      const at = i - 1;
      // keep the apex (the t=0.5 sample) so a click can pin a card to it
      this.apexes[at].copy(this.arcPoints[SAMPLES / 2]);
      const array = this.buffers[at].array as Float32Array;
      for (let s = 0; s < SAMPLES; s++) {
        const pa = this.arcPoints[s];
        const pb = this.arcPoints[s + 1];
        const o = s * 6;
        array[o] = pa.x;
        array[o + 1] = pa.y;
        array[o + 2] = pa.z;
        array[o + 3] = pb.x;
        array[o + 4] = pb.y;
        array[o + 5] = pb.z;
      }
      this.buffers[at].needsUpdate = true;
      const line = this.lines[at];
      // stale bounds would make picking miss; recompute lazily on next cast
      line.geometry.boundingSphere = null;
      line.geometry.boundingBox = null;
      const recency = i / arcs;
      this.intensity[at] = 0.05 + 0.95 * recency * recency;
      this.meta[at] = to;
      line.material.color.copy(EMBER).multiplyScalar(this.intensity[at] * this.liftFor(at));
      line.material.linewidth = arcWidth(to.magnitude);
      line.visible = true;
    }
    for (let i = arcs; i < MAX_ARCS; i++) {
      this.lines[i].visible = false;
      this.meta[i] = undefined;
    }
  }

  // nearest arc under the ray that knows its event; arcs that could not be
  // matched to one are decoration and never swallow a click
  pick(raycaster: THREE.Raycaster): TrailHit | undefined {
    let best: TrailHit | undefined;
    let bestDistance = Infinity;
    for (let i = 0; i < this.active; i++) {
      const meta = this.meta[i];
      if (!meta || meta.seq === undefined) continue;
      const hit = raycaster.intersectObject(this.lines[i], false)[0];
      if (hit && hit.distance < bestDistance) {
        bestDistance = hit.distance;
        best = { index: i, seq: meta.seq, path: meta.path, apex: this.apexes[i].clone() };
      }
    }
    return best;
  }

  // hover is a slight brightness lift on the recency fade — magnitude keeps
  // the width channel to itself, and the ember hue never changes
  setHover(index: number) {
    if (index === this.hovered) return;
    this.hovered = index;
    this.recolor();
  }

  // the pinned arc keeps the hover lift regardless of pointer position and
  // through per-tick rebuilds; -1 unpins
  setPinned(seq: number) {
    if (seq === this.pinnedSeq) return;
    this.pinnedSeq = seq;
    this.recolor();
  }

  // hover and pin share one treatment: the same brightness lift, never a hue
  private liftFor(index: number): number {
    const meta = this.meta[index];
    const pinned = meta?.seq !== undefined && meta.seq === this.pinnedSeq;
    return index === this.hovered || pinned ? HOVER_LIFT : 1;
  }

  private recolor() {
    for (let i = 0; i < this.active; i++) {
      this.lines[i].material.color.copy(EMBER).multiplyScalar(this.intensity[i] * this.liftFor(i));
    }
  }
}
