// Diffusion Lab: enclosed-room gas/liquid spreading with wall reflection + leaks.

import * as THREE from 'three';
import { createDiffusionField, stepDiffusion, MEDIUM } from './diffusionSim.js';
import { VERT_FULLSCREEN, FRAG_DIFFUSION, holeWallFlags } from './shaders.js';

const MEDIUM_CODE = { gas: 0, liquid: 1 };

const DEFAULTS = {
  medium: 'gas',
  gridSize: 160,
  DScale: 1,
  driftScale: 1,
  decayScale: 1,
  speed: 1,
  sourceRate: 0,
  sourceX: 0.5,
  sourceY: 0.35,
  sourceRadius: 0.04,
  injectAmount: 1.2,
  paused: false,
  contour: false,
  showReflection: true,
  leaks: false,
  holeSize: 0.14,
  holeCenter: 0.5,
  holeWalls: ['right'],
  glow: 1.15,
  exposure: 1.05,
};

function makeFullscreenQuad(material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

export class DiffusionLab {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.params = { ...DEFAULTS };
    this.field = null;
    this.meta = null;
    this.tex = null;
    this.t = 0;
    this.playing = true;

    this.uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uExposure: { value: 1.05 },
      uGamma: { value: 1.9 },
      uTex: { value: null },
      uMedium: { value: 0 },
      uSource: { value: new THREE.Vector2(0.5, 0.35) },
      uShowSource: { value: 1 },
      uContour: { value: 0 },
      uShowReflection: { value: 1 },
      uShowLeaks: { value: 0 },
      uHoleSize: { value: 0.14 },
      uHoleCenter: { value: 0.5 },
      uHoleLeft: { value: 0 },
      uHoleRight: { value: 1 },
      uHoleBottom: { value: 0 },
      uHoleTop: { value: 0 },
      uEnclosed: { value: 1 },
    };

    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT_FULLSCREEN,
      fragmentShader: FRAG_DIFFUSION,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = makeFullscreenQuad(this.mat);
    this.group.add(this.quad);

    // Placeholder so the shader never samples a null texture before first upload
    const placeholder = new Uint8Array([20, 30, 40, 255]);
    this.tex = new THREE.DataTexture(placeholder, 1, 1, THREE.RGBAFormat);
    this.tex.needsUpdate = true;
    this.uniforms.uTex.value = this.tex;

    this.setResolution(
      typeof window !== 'undefined' ? window.innerWidth * (window.devicePixelRatio || 1) : 1280,
      typeof window !== 'undefined' ? window.innerHeight * (window.devicePixelRatio || 1) : 720
    );
    this.reset({ seed: true });
  }

  setParam(key, value) {
    this.params[key] = value;
    if (key === 'paused') this.playing = !value;
    if (key === 'gridSize' || key === 'medium') {
      this.reset({ seed: true });
      return;
    }
    this.applyParams();
  }

  applyParams() {
    const p = this.params;
    this.uniforms.uMedium.value = MEDIUM_CODE[p.medium] ?? 0;
    this.uniforms.uExposure.value = p.exposure ?? 1.05;
    this.uniforms.uSource.value.set(p.sourceX ?? 0.5, p.sourceY ?? 0.35);
    this.uniforms.uContour.value = p.contour ? 1 : 0;
    this.uniforms.uShowReflection.value = p.showReflection !== false ? 1 : 0;
    this.uniforms.uShowLeaks.value = p.leaks ? 1 : 0;
    this.uniforms.uHoleSize.value = p.holeSize ?? 0.14;
    this.uniforms.uHoleCenter.value = p.holeCenter ?? 0.5;
    const flags = holeWallFlags(p.holeWalls || ['right']);
    this.uniforms.uHoleLeft.value = flags.left;
    this.uniforms.uHoleRight.value = flags.right;
    this.uniforms.uHoleBottom.value = flags.bottom;
    this.uniforms.uHoleTop.value = flags.top;
    this.uniforms.uEnclosed.value = 1;
    this.playing = !p.paused;
  }

  reset({ seed = true } = {}) {
    const p = this.params;
    const size = Math.min(256, Math.max(96, Math.round(p.gridSize ?? 160)));
    if (!this.field || this.field.size !== size) {
      this.field = createDiffusionField(size);
    } else {
      this.field.clear();
    }
    if (seed) {
      const amt = p.injectAmount ?? (p.medium === 'liquid' ? 1.4 : 1.1);
      this.field.inject(p.sourceX ?? 0.5, p.sourceY ?? 0.35, amt, p.sourceRadius ?? 0.04);
      for (let i = 0; i < 4; i++) {
        stepDiffusion(this.field, 0.03, { ...p, paused: false, sourceRate: 0 });
      }
    }
    this._upload();
    this.applyParams();
  }

  _upload() {
    if (!this.field) return;
    const f = this.field;
    if (!this.tex || this.tex.image?.width !== f.size) {
      if (this.tex) this.tex.dispose();
      this.tex = new THREE.DataTexture(f.rgba, f.size, f.size, THREE.RGBAFormat);
      this.tex.magFilter = THREE.LinearFilter;
      this.tex.minFilter = THREE.LinearFilter;
      this.tex.flipY = false;
      this.tex.generateMipmaps = false;
      this.uniforms.uTex.value = this.tex;
    }
    this.tex.needsUpdate = true;
    this.meta = {
      size: f.size,
      time: f.time,
      peak: f.peak,
      total: f.total,
      spread: f.spread,
      steps: f.steps,
      massLost: f.massLost,
      leakRate: f.leakRate,
      wallHits: f.wallHits,
      medium: this.params.medium || 'gas',
      D: (MEDIUM[this.params.medium || 'gas']?.D ?? 0) * (this.params.DScale ?? 1),
    };
  }

  inject(nx, ny, amountScale = 1) {
    if (!this.field) return;
    const amt = (this.params.injectAmount ?? 1) * amountScale;
    const r = this.params.sourceRadius ?? 0.04;
    this.field.inject(nx, ny, amt, r * (amountScale < 1 ? 0.7 : 1));
    this._upload();
  }

  screenToRoom(clientX, clientY, viewW, viewH) {
    const aspect = viewW / Math.max(viewH, 1);
    let u = clientX / viewW;
    let v = 1 - clientY / viewH;
    if (aspect > 1) u = (u - 0.5) * aspect + 0.5;
    else v = (v - 0.5) / aspect + 0.5;
    return {
      nx: Math.min(Math.max(u, 0), 1),
      ny: Math.min(Math.max(v, 0), 1),
      inside: u >= 0 && u <= 1 && v >= 0 && v <= 1,
    };
  }

  setResolution(w, h) {
    this.uniforms.uResolution.value.set(w, h);
  }

  togglePause() {
    this.params.paused = !this.params.paused;
    this.playing = !this.params.paused;
    return this.params.paused;
  }

  analysis() {
    const p = this.params;
    const m = this.meta || {};
    const med = MEDIUM[p.medium] || MEDIUM.gas;
    return {
      medium: p.medium || 'gas',
      mediumLabel: med.label,
      D: med.D * (p.DScale ?? 1),
      driftY: med.driftY * (p.driftScale ?? 1),
      grid: m.size ?? p.gridSize,
      time: m.time ?? 0,
      peak: m.peak ?? 0,
      total: m.total ?? 0,
      spread: m.spread ?? 0,
      steps: m.steps ?? 0,
      massLost: m.massLost ?? 0,
      leakRate: m.leakRate ?? 0,
      wallHits: m.wallHits ?? 0,
      paused: !!p.paused,
      leaks: !!p.leaks,
      holeSize: p.holeSize ?? 0,
      holeWalls: p.holeWalls || [],
      showReflection: p.showReflection !== false,
      sourceRate: p.sourceRate ?? 0,
      speed: p.speed ?? 1,
    };
  }

  status() {
    const a = this.analysis();
    const leak = a.leaks
      ? ` · leak Ø${(a.holeSize * 100).toFixed(0)}% · lost ${a.massLost.toFixed(0)}`
      : '';
    return `Diffusion · ${a.mediumLabel} · t=${a.time.toFixed(1)}s · spread ${a.spread.toFixed(2)}${leak}${a.paused ? ' · paused' : ''}`;
  }

  update(dt) {
    this.t += dt;
    this.uniforms.uTime.value = this.t;
    if (!this.field) return;
    this.setResolution(
      this.uniforms.uResolution.value.x || 1,
      this.uniforms.uResolution.value.y || 1
    );
    stepDiffusion(this.field, dt, this.params);
    this._upload();
  }
}
